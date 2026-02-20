import os
import json
import zipfile
import io
import requests
import datetime
import re
from bs4 import BeautifulSoup

# --- CONFIGURATION ---
DOF_URL = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dof/"

# Exact FAA APT.txt Column Slices (0-indexed)
APT_COLS = {
    'id': (27, 31),
    'name': (133, 183),
    'lat': (523, 538), 
    'lon': (550, 565)  
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def get_current_airac_cycle():
    base_date = datetime.date(2026, 1, 22) 
    today = datetime.date.today()
    delta = (today - base_date).days
    cycles_passed = delta // 28
    return base_date + datetime.timedelta(days=cycles_passed*28)

def get_dof_zip_url():
    response = requests.get(DOF_URL, headers=HEADERS)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.text, 'html.parser')
    for link in soup.find_all('a', href=True):
        if 'dof' in link['href'].lower() and link['href'].lower().endswith('.zip'):
            return link['href'] if link['href'].startswith('http') else f"https://www.faa.gov{link['href']}"
            
    match = re.search(r'["\']([^"\']*dof[^"\']*\.zip)["\']', response.text, re.IGNORECASE)
    if match:
        url = match.group(1)
        return url if url.startswith('http') else f"https://www.faa.gov{url}"
        
    raise Exception("Could not find a valid DOF ZIP link.")

def faa_to_decimal(s):
    if not s or s.strip() == "": return 0.0
    s = s.strip().upper()
    mult = -1 if ('S' in s or 'W' in s) else 1
    clean = s.replace('N','').replace('S','').replace('E','').replace('W','')
    parts = clean.split('-')
    try:
        if len(parts) >= 3:
            dd = float(parts[0]) + float(parts[1])/60 + float(parts[2])/3600
        else:
            dd = float(clean)
        return round(dd * mult, 6)
    except: 
        return 0.0

def parse_dof_dms(dms_str):
    dms_str = dms_str.strip()
    if not dms_str: return 0.0
    direction = dms_str[-1]
    parts = dms_str[:-1].split()
    if len(parts) != 3: return 0.0
    decimal = float(parts[0]) + (float(parts[1]) / 60.0) + (float(parts[2]) / 3600.0)
    if direction in ['S', 'W']: decimal = -decimal
    return decimal

def harvest_notams():
    """
    Official NMS-API version of the NOTAM Harvester.
    Nationwide Pull: Uses DOMESTIC classification and OBST feature.
    """
    # --- NMS-API CONFIG ---
    # Securely load API credentials from environment variables 
    CLIENT_ID = os.environ.get("FAA_CLIENT_ID")
    CLIENT_SECRET = os.environ.get("FAA_CLIENT_SECRET")
    
    if not CLIENT_ID or not CLIENT_SECRET:
        print("[!] NMS-API Credentials missing in environment. Skipping NOTAM harvest.")
        return
    
    # Using the Pre-Prod/Staging environment endpoints
    AUTH_URL = "https://api-staging.cgifederal-aim.com/v1/auth/token"
    NOTAM_URL = "https://api-staging.cgifederal-aim.com/nmsapi/v1/notams"

    print("[-] Fetching nationwide public NOTAMs via NMS-API...")
    processed_notams = []

    # 1. Authenticate with NMS-API
    try:
        auth_response = requests.post(
            AUTH_URL,
            data={"grant_type": "client_credentials"},
            auth=(CLIENT_ID, CLIENT_SECRET),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15
        )
        auth_response.raise_for_status()
        token = auth_response.json().get("access_token")
    except Exception as e:
        print(f"    > [!] NMS-API Authentication failed: {e}")
        return

    # 2. Request Nationwide NOTAMs Data
    # Requesting GEOJSON format simplifies coordinate extraction
    headers = {
        "Authorization": f"Bearer {token}",
        "nmsResponseFormat": "GEOJSON"
    }
    # Using classification=DOMESTIC and feature=OBST to pull all domestic obstacles
    params = {
        "classification": "DOMESTIC",
        "feature": "OBST"
    }
    
    try:
        # Increased timeout to 60s for the larger nationwide payload
        data_response = requests.get(NOTAM_URL, headers=headers, params=params, timeout=60)
        data_response.raise_for_status()
        data = data_response.json()
        
        # Extract the GeoJSON features array
        features = data.get("data", {}).get("geojson", [])
        print(f"    > DIAGNOSTIC: NMS-API returned {len(features)} total nationwide OBST NOTAMs.")
        
        # Original regex and outage terminology logic (Locked Baseline)
        agl_pattern = r"(\d+)\s?(?:FT)?\s?AGL"
        outage_words = ["OUT", "U/S", "UNMON", "UNLIT", "OBSCURED"]
        
        for feature in features:
            props = feature.get("properties", {}).get("coreNOTAMData", {}).get("notam", {})
            text = props.get("text", "").upper()
            
            # THE NEW STRICT FILTER: Must contain OBST, must contain LGT/LIGHT, and must have an outage word.
            is_unlit_obstacle = ("OBST" in text) and ("LGT" in text or "LIGHT" in text) and any(w in text for w in outage_words)
            
            if is_unlit_obstacle:
                # GeoJSON stores coordinates as [Longitude, Latitude]
                geom_list = feature.get("geometry", {}).get("geometries", [])
                point_geom = next((g for g in geom_list if g.get("type") == "Point"), None)
                
                if point_geom:
                    coords = point_geom.get("coordinates", [0.0, 0.0])
                    lon_val = round(coords[0], 6)
                    lat_val = round(coords[1], 6)
                    
                    agl_match = re.search(agl_pattern, text)
                    agl_val = agl_match.group(1) if agl_match else "Unknown"
                    
                    processed_notams.append({
                        "lat": lat_val,
                        "lon": lon_val,
                        "agl": agl_val,
                        "text": text
                    })
                    
    except Exception as e:
         print(f"    > [!] API request or parsing failed: {e}")
         return
         
    # 3. Save to Disk
    try:
        with open("notams.json", 'w') as f:
            json.dump(processed_notams, f, indent=2)
        print(f"    > Scraped and saved {len(processed_notams)} nationwide NOTAM obstacles to notams.json.")
    except Exception as e:
        print(f"    > [!] Failed to save notams.json: {e}")
        
def process_data():
    obstacles = []
    airports = {}
    metadata = {"dof_date": "Unknown", "apt_count": 0, "obs_count": 0}

    # --- 1. DOWNLOAD & PARSE DOF (56-Day Cycle) ---
    print("[-] Fetching latest DOF ZIP...")
    try:
        dof_zip_url = get_dof_zip_url()
        print(f"[-] Downloading: {dof_zip_url}")
        
        r_dof = requests.get(dof_zip_url, headers=HEADERS)
        with zipfile.ZipFile(io.BytesIO(r_dof.content)) as z:
            dat_filename = next(name for name in z.namelist() if name.upper().endswith('DOF.DAT'))
            with z.open(dat_filename) as f:
                for line_bytes in f:
                    line = line_bytes.decode('utf-8', errors='ignore')
                    
                    if line.startswith("  CURRENCY DATE ="):
                        metadata["dof_date"] = line.split("=")[1].strip()
                        
                    if len(line) < 100 or line.startswith("CUR") or line.startswith("-") or line.startswith("OAS") or line.startswith(" "):
                        continue
                    try:
                        agl_str = line[83:88].strip()
                        if not agl_str.isdigit(): continue
                        agl = int(agl_str)
                        if agl < 200: continue
                        
                        lat = parse_dof_dms(line[35:47])
                        lon = parse_dof_dms(line[48:61])
                        city = line[18:34].strip()
                        state = line[15:17].strip().upper() # ADDED: 2-Letter State Code
                        oas = line[0:9].strip()
                        
                        obstacles.append({"id": oas, "state": state, "city": city, "lat": lat, "lon": lon, "agl": agl})
                    except:
                        continue
        print(f"    > Parsed {len(obstacles)} Obstacles.")
    except Exception as e:
        print(f"[!] DOF Process failed: {e}")

    # --- 2. DOWNLOAD & PARSE NASR APT (28-Day Cycle) ---
    print("\n[-] Fetching latest NASR APT ZIP...")
    cycle_date = get_current_airac_cycle()
    date_str = cycle_date.strftime("%Y-%m-%d")
    landing_url = f"https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/{date_str}"
    
    metadata["apt_date"] = cycle_date.strftime("%m/%d/%y")
    
    try:
        page_resp = requests.get(landing_url, headers=HEADERS, timeout=15)
        match = re.search(r'href=["\']([^"\']+\.zip)["\']', page_resp.text)
        if not match: match = re.search(r'href=["\'](https://[^"\']+\.zip)["\']', page_resp.text)
        
        if match:
            zip_url = match.group(1)
            if not zip_url.startswith("http"): zip_url = "https://www.faa.gov" + zip_url
            
            print(f"[-] Downloading: {zip_url}")
            r_nasr = requests.get(zip_url, headers=HEADERS, stream=True)
            
            with zipfile.ZipFile(io.BytesIO(r_nasr.content)) as z:
                apt_file_info = next(f for f in z.infolist() if f.filename.endswith('APT.txt'))
                with z.open(apt_file_info) as f:
                    for line_bytes in f:
                        line = line_bytes.decode('latin-1', errors='ignore')
                        if line.startswith("APT"):
                            loc_id = line[APT_COLS['id'][0]:APT_COLS['id'][1]].strip()
                            name_str = line[APT_COLS['name'][0]:APT_COLS['name'][1]].strip()
                            lat_str = line[APT_COLS['lat'][0]:APT_COLS['lat'][1]].strip()
                            lon_str = line[APT_COLS['lon'][0]:APT_COLS['lon'][1]].strip()
                            if loc_id and lat_str and lon_str:
                                lat = faa_to_decimal(lat_str)
                                lon = faa_to_decimal(lon_str)
                                if lat != 0.0 and lon != 0.0:
                                    airports[loc_id] = {"name": name_str, "lat": lat, "lon": lon}
            print(f"    > Parsed {len(airports)} Airports/Heliports.")
        else:
            print("[!] Could not find NASR ZIP link.")
    except Exception as e:
        print(f"[!] NASR Process failed: {e}")

    # --- 3. SAVE WITH FAILSAFE ---
    print("\n[-] Compiling outputs...")
    
    if len(obstacles) > 0:
        with open("obstacles.json", 'w') as f:
            json.dump(obstacles, f, separators=(',', ':'))
        metadata["obs_count"] = len(obstacles)
        print(f"[-] Saved {len(obstacles)} obstacles.")
    else:
        print("[!] WARNING: No obstacles parsed. Skipping overwrite to protect existing data.")
        if os.path.exists("obstacles.json"):
            try:
                with open("obstacles.json", 'r') as f:
                    metadata["obs_count"] = len(json.load(f))
            except: pass
            
    if len(airports) > 0:
        with open("airports.json", 'w') as f:
            json.dump(airports, f, separators=(',', ':'))
        metadata["apt_count"] = len(airports)
        print(f"[-] Saved {len(airports)} airports.")
        
    with open("metadata.json", 'w') as f:
        json.dump(metadata, f)
        
    # --- 4. NEW: NOTAM HARVEST (Version 2.0 MVP) ---
    harvest_notams()
        
    print("[-] Success. Database update complete.")

if __name__ == "__main__":
    process_data()