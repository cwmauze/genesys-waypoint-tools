# Genesys Aerosystems IDU Waypoint Loader

A browser-based, standalone utility for managing user-defined waypoint data for **Genesys Aerosystems IDU series avionics suites**, including the **IDU-450, IDU-680, and IDU-1380** electronic flight information system (EFIS) displays.

## ✈️ Mission Profile
This tool bridges the gap between data software (Excel, Google Earth), flight planning software (ForeFlight), and the Genesys Aerosystems FMS. It ensures that your custom waypoint lists are formatted correctly for seamless upload via USB.



## 🛠 Features
* **Universal Import:** Supports `.dat` (binary), `.csv`, `.txt`, and `.kml`.
* **Edit & Sync:** Decode existing `USER.DAT` files from your aircraft to edit them directly in the browser.
* **KML Visualization:** Export your waypoints for review in Google Earth or mobile flight bags like ForeFlight.
* **Dark Mode Interface:** A high-contrast theme for comfortable data entry during flight planning.
* **Header Intelligence:** Automatically identifies and skips spreadsheet header rows (e.g., "Identifier", "Latitude").
* **Field Portability:** Operates as a single `index.html` file—no internet required after the initial load.

## 📋 Specifications (Logic v5.43)
* **Target Hardware:** IDU-450, IDU-680, IDU-1380.
* **Output Format:** Standardized `USER.DAT` binary.
* **Capacity:** Supports up to 998 user-defined waypoints.
* **Automated Logic:** Manages alphabetical sorting and nomenclature length limits (5-char ID, 12-char Name).

## 🚀 Operation Instructions
1.  **Load Data:** Select your file or paste rows from your data software.
2.  **Verify:** Confirm the coordinates, **Elevation (Ft MSL)**, and **Approach Bearing** in the table.
3.  **Download:** Click **Download USER.DAT** to save the file for USB upload to the EFIS.



## 🔗 Official Documentation
For specific EFIS configuration settings and flight operations, refer to the [Official Genesys IDU Pilot Guides](https://www.moog.com/products/avionics/aircraft-avionics/pilot-guides.html).

---
*Configuration Locked | v5.43*
