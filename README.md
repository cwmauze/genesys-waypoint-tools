# Genesys Aerosystems IDU Waypoint Loader

A browser-based, standalone utility for managing user-defined waypoint data for **Genesys Aerosystems IDU series avionics suites** (IDU-450, IDU-680, IDU-1380) and **Garmin GTN series** navigators.

## ✈️ Mission Profile
This tool acts as a universal translator between data software (Excel, Google Earth), flight planning software (ForeFlight), and your avionics. It ensures custom waypoint lists are formatted correctly for seamless upload via USB or SD card.

## 🛠 Features
* **Dual Format Export:** Generate proprietary `user.dat` (Genesys) or `user.wpt` (Garmin) files from a single list.
* **Smart Import:** Automatically detects Garmin 4-column CSVs or Genesys 6-column data.
* **Edit & Sync:** Decode existing binary files from your aircraft to edit them directly in the browser.
* **KML Visualization:** Export waypoints for review in Google Earth or mobile flight bags like ForeFlight.
* **Field Portability:** Operates as a single `index.html` file—no internet required after the initial load.

## 📋 Specifications
* **Genesys Capacity:** Supports up to 998 user-defined waypoints.
* **Garmin Capacity:** Formatted for GTN 650/750 compatibility.
* **Automated Logic:** Manages alphabetical sorting and nomenclature length limits (5-char for Genesys, 6-char for Garmin).

## 🚀 Operation Instructions
1.  **Load Data:** Select your file or paste rows from your data software.
2.  **Verify:** Confirm the coordinates and supplemental data in the table.
3.  **Download:** Click the descriptive button for your specific avionics suite (Genesys or Garmin).

## 🔗 Technical References
* [Official Genesys IDU Pilot Guides (Moog)](https://www.moog.com/products/avionics/aircraft-avionics/pilot-guides.html)
* [Garmin GTN User Waypoint File Creation & Import Guide](https://support.garmin.com/en-US/?faq=3mcdU37gXi88ipwjJIxJo7)

## 🗺️ Roadmap (To-Do)
* **Data Validation:** Highlight out-of-range coordinates.
* **Nomenclature Warnings:** Visual indicators for identifiers exceeding character limits.
* **Duplicate Detection:** Identify and flag duplicate waypoint IDs.

---
*Release Version: 5.46*
