import json
import os
import datetime
import requests
import zipfile
import io
import re

# --- CONFIGURATION: FAA 28-Day NASR Field Positions ---
# Cycle 2601 Standards
# Arrays are (Start_Index, End_Index) for Python slicing

APT_COLS = {
    'id': (27, 31),      # Landing Facility Site Number or Location ID
    'name': (133, 183),  # Facility Name
    'lat': (523, 535),   # Formatted Latitude
    'lon': (550, 562),   # Formatted Longitude
    'elev': (578, 585)   # Elevation
}

NAV_COLS = {
    'id': (4, 8),        # ID is usually 3-4 chars
    'name': (42, 72),    # Name is up to 30 chars
    'lat': (371, 383), 
    'lon': (396, 408),
    'type': (8, 28)      # NAV Type (VOR, VORTAC, NDB)
}

FIX_COLS = {
    'id': (4, 9),        # Fix ID is 5 chars (bytes 4-9)
    'lat': (66, 78), 
    'lon': (80, 92)
}

# --- MODULE 1: FETCHER (The Scraper) ---
def get_current_airac_cycle():
    """
    Calculates the current FAA AIRAC cycle effective date.
    Cycle 2601 Effective Date: Jan 22, 2026.
    Cycle duration: 28 days.
    """
    base_date = datetime.date(2026, 1, 22) # Confirmed Cycle 2601 start
    today = datetime.date.today()
    
    delta = (today - base_date).days
    cycles_passed = delta // 28
    
    current_cycle_start = base_date + datetime.timedelta(days=cycles_passed*28)
    return current_cycle_start

def download_faa_data():
    """
    Scrapes the FAA NASR website to find and download the official 28-day subscription zip.
    """
    cycle_date = get_current_airac_cycle()
    date_str = cycle_date.strftime("%Y-%m-%d") # e.g., 2026-01-22
    
    # 1. Visit the Cycle Landing Page (Official FAA Source)
    # This page always exists for active cycles and contains the real download link
    landing_url = f"https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/{date_str}"
    
    print(f"[-] Accessing Cycle Page: {landing_url}")
    
    try:
        # We need a User-Agent because FAA blocks generic Python scripts
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        
        page_resp = requests.get(landing_url, headers=headers, timeout=15)
        
        if page_resp.status_code != 200:
            print(f"[!] Error: Landing page not found ({page_resp.status_code}). Cycle {date_str} might not be published yet.")
            return False, None
            
        # 2. Extract the ZIP link using Regex
        # Look for: href=".../28DaySubscription_NS.zip" or "28DaySubscription_Effective_....zip"
        # The regex finds any href ending in .zip
        match = re.search(r'href=["\']([^"\']+\.zip)["\']', page_resp.text)
        
        # Fallback: Sometimes the link is absolute
        if not match:
             match = re.search(r'href=["\'](https://[^"\']+\.zip)["\']', page_resp.text)
            
        if match:
            zip_url = match.group(1)
            
            # Handle relative URLs if necessary
            if not zip_url.startswith("http"):
                zip_url = "https://www.faa.gov" + zip_url
                
            print(f"[-] Found ZIP URL: {zip_url}")
            
            # 3. Download the File
            r = requests.get(zip_url, headers=headers, stream=True)
            if r.status_code == 200:
                print("[-] Downloading...")
                try:
                    z = zipfile.ZipFile(io.BytesIO(r.content))
                    
                    target_files = ['APT.txt', 'NAV.txt', 'FIX.txt']
                    extracted = 0
                    for file_info in z.infolist():
                        # FAA sometimes puts files in subfolders, we flatten them here
                        fname = os.path.basename(file_info.filename)
                        if fname in target_files:
                            file_info.filename = fname # Flatten path
                            z.extract(file_info, ".")
                            print(f"    > Extracted {fname}")
                            extracted += 1
                    
                    if extracted > 0:
                        print("[-] Extraction complete.")
                        return True, date_str
                    else:
                        print("[!] ZIP downloaded but did not contain expected text files (APT.txt, NAV.txt, FIX.txt).")
                        return False, None
                except zipfile.BadZipFile:
                    print("[!] Error: The downloaded file was not a valid ZIP.")
                    return False, None
            else:
                print(f"[!] Download failed with code {r.status_code}")
                return False, None
        else:
            print("[!] Could not find a ZIP download link on the FAA page.")
            return False, None

    except Exception as e:
        print(f"[!] Critical Error: {e}")
        return False, None

# --- MODULE 2: CRUNCHER (The Parser) ---
def faa_to_decimal(s):
    """
    Converts FAA formatted coordinate string (e.g., '35-20-04.532N') 
    to Decimal Degrees (e.g., 35.334592).
    """
    if not s or s.strip() == "": return 0
    s = s.strip().upper()
    mult = -1 if ('S' in s or 'W' in s or '-' in s) else 1
    clean = s.replace('N','').replace('S','').replace('E','').replace('W','')
    parts = clean.split('-')
    
    try:
        if len(parts) == 3: # Format: DD-MM-SS.SSSS
            dd = float(parts[0]) + float(parts[1])/60 + float(parts[2])/3600
        else:
            dd = float(clean)
        return round(dd * mult, 6)
    except: 
        return 0

def build_database(cycle_date_str):
    master = []
    print("\n[-] Starting Database Build...")

    # PROCESS AIRPORTS (APT)
    if os.path.exists('APT.txt'):
        count = 0
        with open('APT.txt', 'r', encoding='latin-1') as f:
            for line in f:
                if line.startswith('APT'):
                    master.append({
                        "id": line[APT_COLS['id'][0]:APT_COLS['id'][1]].strip(),
                        "name": line[APT_COLS['name'][0]:APT_COLS['name'][1]].strip(),
                        "lat": faa_to_decimal(line[APT_COLS['lat'][0]:APT_COLS['lat'][1]]),
                        "lon": faa_to_decimal(line[APT_COLS['lon'][0]:APT_COLS['lon'][1]]),
                        "elev": line[APT_COLS['elev'][0]:APT_COLS['elev'][1]].strip() or "0",
                        "type": "APT"
                    })
                    count += 1
        print(f"    > Processed {count} Airports.")

    # PROCESS NAVAIDS (NAV)
    if os.path.exists('NAV.txt'):
        count = 0
        with open('NAV.txt', 'r', encoding='latin-1') as f:
            for line in f:
                # NAV1 is the primary record type for Navaids
                if line.startswith('NAV1'):
                    raw_type = line[NAV_COLS['type'][0]:NAV_COLS['type'][1]].strip()
                    nav_type = "VOR" # Simplify for Genesys/Garmin compatibility
                    master.append({
                        "id": line[NAV_COLS['id'][0]:NAV_COLS['id'][1]].strip(),
                        "name": line[NAV_COLS['name'][0]:NAV_COLS['name'][1]].strip(),
                        "lat": faa_to_decimal(line[NAV_COLS['lat'][0]:NAV_COLS['lat'][1]]),
                        "lon": faa_to_decimal(line[NAV_COLS['lon'][0]:NAV_COLS['lon'][1]]),
                        "type": nav_type, 
                        "desc": raw_type
                    })
                    count += 1
        print(f"    > Processed {count} NAVAIDs.")

    # PROCESS WAYPOINTS (FIX)
    if os.path.exists('FIX.txt'):
        count = 0
        with open('FIX.txt', 'r', encoding='latin-1') as f:
            for line in f:
                # FIX1 is the primary record type for Waypoints
                if line.startswith('FIX1'):
                    master.append({
                        "id": line[FIX_COLS['id'][0]:FIX_COLS['id'][1]].strip(),
                        "name": line[FIX_COLS['id'][0]:FIX_COLS['id'][1]].strip(), 
                        "lat": faa_to_decimal(line[FIX_COLS['lat'][0]:FIX_COLS['lat'][1]]),
                        "lon": faa_to_decimal(line[FIX_COLS['lon'][0]:FIX_COLS['lon'][1]]),
                        "type": "FIX"
                    })
                    count += 1
        print(f"    > Processed {count} Waypoints.")

    # WRITE OUTPUTS
    print(f"[-] Compiling {len(master)} records...")
    
    # 1. Main DB
    with open('faa_master.json', 'w') as f:
        json.dump(master, f)
    
    # 2. Version File
    version_data = {
        "cycle": cycle_date_str, 
        "updated": datetime.datetime.now().isoformat()
    }
    with open('version.json', 'w') as f:
        json.dump(version_data, f)

    print("[-] Success. faa_master.json and version.json updated.")

# --- MAIN EXECUTION ---
if __name__ == "__main__":
    print("=== GENESYS DB AUTOMATION TOOL ===")
    success, date_str = download_faa_data()
    if success:
        build_database(date_str)
        # Cleanup
        for f in ['APT.txt', 'NAV.txt', 'FIX.txt']:
            if os.path.exists(f): os.remove(f)
        print("[-] Cleanup complete. Exiting.")
    else:
        print("[!] Process failed.")
