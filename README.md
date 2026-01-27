# Genesys IDU Waypoint and Route Tools

A lightweight, browser-based mission planning utility for managing, editing, and exporting navigation data to Genesys Aerosystems IDU and Garmin GTN/GNS avionics.

## Background & Origin
This tool exists because Genesys Aerosystems apparently believes that manual data entry is a core competency for modern pilots.

Despite the sophistication of their EFIS hardware, Genesys provides no official, manufacturer-supported method for the bulk upload of user waypoints or complex flight plans. According to their technical support, if you need to load a mission database, your "approved" options are:

1.  **Manual entry in the cockpit:** Spend hours twisting physical IDU knobs to enter every identifier, name, and coordinate one by one.
2.  **The "EFIS Training Tool" method:** Use their PC-based EFIS training tool to manually click through a virtual version of the exact same menus to recreate the data.

In most industries, this is merely a waste of time but in aviation—specifically in the **Rotary-Wing EMS** world where this tool was born—this is a genuine safety issue. Forcing a pilot to manually transcribe hundreds of lines of coordinate data or complex multi-leg routes is an invitation for human error. In a mission-critical HEMS environment, a single fat-fingered digit isn't just a typo; it has potential life-or-death consequences.

While other vendors (like Garmin) have spent the last decade making data integration seamless, Genesys has left it to the end-users to engineer their own safety nets. We decided our time was better spent reverse-engineering the binary formats than playing data entry clerk with a $50k avionics suite.

## Technical Specifications
For a deep dive into the engineering behind this tool, refer to the included technical documentation.

### User Waypoints (`user.dat`)
* **Header Architecture:** The 72-byte fixed header requirements.
* **Record Structure:** The 88-byte waypoint record blocks.
* **Data Types:** IEEE 754 Double Precision Float handling.

### Flight Plans (`.rte`)
* **File Architecture:** Fixed 4,776-byte binary structure.
* **Leg-Based Logic:** Implementation of the "Phantom Record" architecture, where the ID for Waypoint *N* is stored in Record *N+1*.
* **Integrity:** Validated CRC-32 checksums calculated at offset 4768 (File Size - 8) to ensure hardware acceptance without file deletion errors.

## Features
### Mission Planning & Editing
* **Visual Route Editor:** Drag-and-drop functionality allows you to re-sequence waypoints visually. No more spreadsheet row cutting-and-pasting.
* **Flight Plan Integration:** Import an existing `.rte` file, modify the leg sequence, add new waypoints from a bulk paste, and export a route file for the cockpit.

### Core Utilities
* **Binary Encoding:** Automatically generates valid Genesys `user.dat` and `.rte` files with correct "K7" region codes and CRC checksums.
* **Format Agnostic:** Paste coordinates in Decimal Degrees (DD), Degrees Decimal Minutes (DDM), or Degrees Minutes Seconds (DMS) and let the parser do the heavy lifting.
* **Safety Validation:** Automatically warns you when a waypoint exceeds hardware character limits (5/12 for Genesys, 6/25 for Garmin).
* **Cross-Verification:** One-click links to Google Maps, Google Earth, and ForeFlight Web to verify coordinates before they ever reach the aircraft.

## Version History
* **v8.0.1:** **Mission Planning Release.** Consolidated build. Added native support for Genesys Flight Plan (`.rte`) import/export. Implemented "Phantom Record" architecture and strict CRC-32 logic (Offset 4768) for full avionics interoperability.
* **v7.6.5:** Strict Garmin `user.wpt` alignment (Headerless, 4 columns, fixed precision).
* **v6.12:** Expanded instruction block with explicit coordinate format definitions; restored hardware truncation alerts.
* **v6.00:** Major overhaul of bulk paste parser and auto-load event listeners.
* **v5.00:** Initial release of reverse-engineered `user.dat` binary export functionality.

## Usage
1.  Open `index.html` in any modern browser.
2.  **Load Data:** Drag and drop a `.dat`, `.rte`, `.wpt`, or `.kml` file, or bulk-paste rows from your dispatch software.
3.  **Edit Mission:** Use the drag handles (⠿) to reorder waypoints or modify the route sequence.
4.  **Export:** Click **Download .RTE** (Flight Plan) or **Download user.dat** (Database) and copy the file to your data card.

## License
Open Source Project. See GitHub repository for details.
