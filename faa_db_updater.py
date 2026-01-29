import json
import os
import datetime
import requests
import zipfile
import io

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

# --- MODULE 1: FETCHER (The "Robot") ---
def get_current_airac_cycle():
    """
    Calculates the current FAA AIRAC cycle effective date.
    Cycle 2601 Effective Date: Jan 22, 2026.
    Cycle duration: 28 days.
    """
    # Corrected Base Date for Cycle 2601
    base_date = datetime.date(2026, 1, 22)
    today = datetime.date.today()
    
    # Calculate days passed since the base cycle start
    delta = (today - base_date).days
    
    # Calculate how many full 28-day cycles have passed
    cycles_passed = delta // 28
    
    # The effective date is the base date + (N * 28 days)
    current_cycle_start = base_date + datetime.timedelta(days=cycles_passed*28)
    
    return current_cycle_start

def download_faa_data():
    """
    Downloads and extracts the specific 28-day subscription file from the FAA.
    """
    cycle_date = get_current_airac_cycle()
    date_str = cycle_date.strftime("%Y-%m-%d") # Format: 2026-01-25
    
    url = f"https://nfdc.faa.gov/webContent/28DaySub/{date_str}/28DaySubscription_NS.zip"
    print(f"[-] Attempting to download Cycle Effective: {date_str}")
    print(f"[-] URL: {url}")
    
    try:
        r = requests.get(url, stream=True)
        if r.status_code == 200:
            print("[-] Download successful. Extracting...")
            z = zipfile.ZipFile(io.BytesIO(r.content))
            
            # We only need APT.txt, NAV.txt, and FIX.txt
            # FAA sometimes buries them in folders, but usually they are at root or single folder.
            # We will extract only what we need to the current folder.
            
            target_files = ['APT.txt', 'NAV.txt', 'FIX.txt']
            for file_info in z.infolist():
                if file_info.filename in target_files:
                    z.extract(file_info, ".")
                    print(f"    > Extracted {file_info.filename}")
            print("[-] Extraction complete.")
            return True, date_str
        else:
            print(f"[!] Error: Failed to download. Status Code: {r.status_code}")
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
    
    # 2. Version File (Updates the 'cycle' to trigger web app refresh)
    # We estimate the 4-digit cycle code (YYCC) roughly or just use the date
    # Ideally, we map 2026-01-25 -> 2601. For now, let's use the Date String as the cycle ID
    # or you can write a helper to calculate the 4-digit code.
    
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
