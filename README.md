# Genesys Aerosystems IDU Waypoint Loader

A browser-based, standalone utility for managing user-defined waypoint data for **Genesys Aerosystems IDU series avionics suites** (IDU-450, IDU-680, IDU-1380), **Garmin GTN series** navigators, and **Complete Flight** dispatch systems.

## ✈️ Mission Profile
This tool acts as a universal translator between data software (Excel, Google Earth), flight planning software (ForeFlight), and your avionics. It handles the conversion of "dirty" coordinate data (DD, DDM, and DMS) into the precise formats required for aircraft upload via USB or SD card.

## 🛠 Features
* **Multi-Format Export:** Generate proprietary `user.dat` (Genesys binary), `user.wpt` (Garmin CSV), or `Complete_Flight.csv` (Dispatch) files.
* **Robust Coordinate Parsing:** Automatically detects and converts Decimal Degrees (DD), Degrees Decimal Minutes (DDM), and Degrees Minutes Seconds (DMS) regardless of cardinal direction placement (e.g., "N 40..." vs "40... N").
* **Smart Import:** Automatically detects Garmin 4-column CSVs or Genesys 6-column data structures.
* **Edit & Sync:** Decode existing binary files from your aircraft to edit them directly in the browser.
* **Field Portability:** Operates as a single `index.html` file—no internet required after the initial load.

## 📋 Specifications
* **Genesys Capacity:** Supports up to 998 user-defined waypoints.
* **Garmin Capacity:** Formatted for GTN 650/750 compatibility.
* **Nomenclature Logic:** Automatically manages sorting and length limits (5-char for Genesys, 6-char for Garmin).

## 🚀 Operation Instructions
1.  **Load Data:** Select your file or paste rows from your data software.
2.  **Verify:** Confirm the coordinates and supplemental data in the table.
3.  **Download:** Click the descriptive button for your specific target system.



## 🔗 Technical References
* [Official Genesys IDU Pilot Guides (Moog)](https://www.moog.com/products/avionics/aircraft-avionics/pilot-guides.html)
* [Garmin GTN User Waypoint File Creation & Import Guide](https://support.garmin.com/en-US/?faq=3mcdU37gXi88ipwjJIxJo7)

## 🗺️ Roadmap (To-Do)
* **Data Validation:** Highlight out-of-range coordinates.
* **Nomenclature Warnings:** Visual indicators for identifiers exceeding character limits.
* **Complete Flight Refinement:** Move dispatch export from Experimental to Stable based on field testing.

---
*Release Version: 5.50*
