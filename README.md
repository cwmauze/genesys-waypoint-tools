# Genesys Aerosystems IDU Waypoint Loader

A browser-based, standalone utility for managing user-defined waypoint data for **Genesys Aerosystems IDU series avionics suites** (IDU-450, IDU-680, IDU-1380), **Garmin GTN series** navigators, and **Complete Flight** dispatch systems.

## ✈️ Mission Profile
This tool acts as a universal translator between mapping software (Google Earth), flight planning software (ForeFlight), and your avionics. It handles the conversion of "dirty" coordinate data into the precise binary and text formats required for aircraft upload via USB or SD card.

## 🛠 Features
* **Zero-Click Processing:** Data populates the table automatically upon file selection or bulk pasting.
* **Integrated Map Preview:** Interactive Leaflet.js overlay with togglable **Streets**, **Satellite**, and **FAA VFR Sectional** layers.
* **Multi-Format Export:** Generate proprietary `user.dat` (Genesys binary), `user.wpt` (Garmin CSV), or `Complete_Flight.csv` (Dispatch) files.
* **Robust Coordinate Parsing:** Detects and converts Decimal Degrees (DD), Degrees Decimal Minutes (DDM), and Degrees Minutes Seconds (DMS) automatically.
* **KML Smart-Conversion:** Automatically detects and converts altitude units (Meters to Feet) based on Google Earth's `<altitudeMode>` tags.
* **Data Safety:** Hardware-specific warnings appear during export if identifiers must be shortened (truncated) to fit system limits (5-char for Genesys, 6-char for Garmin).

## 📋 Specifications
* **Genesys Capacity:** Supports up to 998 user-defined waypoints.
* **Garmin Capacity:** Formatted for GTN 650/750 compatibility.
* **Nomenclature Logic:** Hover over map markers to see a hierarchical view of the Identifier (Bold) and Friendly Name.
* **Binary Integrity:** Includes a reverse-engineered CRC-32 checksum to ensure `user.dat` files are accepted by the IDU without corruption errors.

## 🚀 Operation Instructions
1.  **Load Data:** Select your file (.dat, .csv, .kml) or paste rows directly into the bulk field.
2.  **Map Preview:** Click **Preview on Map** to visually verify waypoint placement against VFR sectionals or satellite imagery.
3.  **Verify:** Confirm coordinates and supplemental data in the table.
4.  **Download:** Click the desired system button. Review any truncation warnings before finalizing.

## 📜 Version History

| Version | Date | Key Updates |
| :--- | :--- | :--- |
| **v5.80** | Jan 2026 | Removed "Load Data" button; added auto-processing; FAA VFR Sectional layers. |
| **v5.79** | Jan 2026 | Implemented dual-layer Leaflet preview and hierarchical marker tooltips. |
| **v5.70** | Jan 2026 | Integrated Leaflet.js for in-browser map previews. |
| **v5.60** | Jan 2026 | Added automatic unit detection for KML altitude (Meters to Feet). |
| **v5.50** | Jan 2026 | Initial support for Garmin `.wpt` and experimental Complete Flight CSV. |
| **v5.00** | Jan 2026 | First successful reverse-engineered binary `user.dat` export. |

## 🔗 Documentation & References
* [🛠 **Technical Specs: Genesys Binary Archaeology**](./TECHNICAL_SPECS.md) - A deep dive into how the `user.dat` format was decoded.
* [Official Genesys IDU Pilot Guides (Moog)](https://www.moog.com/products/avionics/aircraft-avionics/pilot-guides.html)
* [Garmin GTN User Waypoint Import Guide](https://support.garmin.com/en-US/?faq=3mcdU37gXi88ipwjJIxJo7)

---
*Build: v5.80 | [Project Home](https://github.com/cwmauze/genesys-waypoint-tools/tree/main)*
