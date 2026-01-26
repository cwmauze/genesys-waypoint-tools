# Genesys Waypoint Tools

A lightweight, browser-based utility for managing and exporting waypoint data to Genesys Aerosystems IDU and Garmin GTN/GNS avionics.

## Background & Origin
This tool exists because Genesys Aerosystems apparently believes that manual data entry is a core competency for modern pilots.

Despite the sophistication of their EFIS hardware, Genesys provides no official, manufacturer-supported method for the bulk upload of user waypoints. According to their technical support, if you need to load a database of—potentially—hundreds of waypoints, your "approved" options are:

1.  **Cockpit Manual Entry:** Spend hours twisting physical IDU knobs to enter every identifier, name, and coordinate one by one.
2.  **The "Trainer" Method:** Use their PC-based EFIS training tool to manually click through a virtual version of the exact same menus to recreate the data.

In most industries, this is called a "waste of time." In aviation—specifically in the **Rotary-Wing EMS** world where this tool was born—this is a genuine safety issue. Forcing a pilot to manually transcribe hundreds of lines of coordinate data is an invitation for human error. In a mission-critical HEMS environment, a single fat-fingered digit isn't just a typo; it’s a potential life-or-death navigation failure. 

While other vendors (like Garmin) have spent the last decade making data integration seamless, Genesys has left it to the end-users to engineer their own safety nets. We decided our time was better spent reverse-engineering the `user.dat` binary format than playing "entry clerk" with a $50k avionics suite. 

## Technical Specifications
For a deep dive into the engineering behind this tool, refer to the [Link to TECHNICAL SPECIFICATIONS}(TECHNICAL SPECIFICATIONS.md). 
It provides a detailed mapping of the `user.dat` binary structure, including:
* **Header Architecture:** The 72-byte fixed header requirements.
* **Record Structure:** The 88-byte waypoint record blocks.
* **Data Types:** IEEE 754 Double Precision Float handling for coordinates.
* **Integrity:** The implementation of the CRC-32 checksum required for IDU hardware acceptance.

## Features
* **Binary Encoding:** Automatically generates a valid Genesys `user.dat` file with proper CRC checksums.
* **Format Agnostic:** Paste coordinates in Decimal Degrees (DD), Degrees Decimal Minutes (DDM), or Degrees Minutes Seconds (DMS) and let the parser do the heavy lifting.
* **Safety Validation:** Automatically warns you when a waypoint exceeds hardware character limits (5/12 for Genesys, 6/25 for Garmin).
* **Cross-Verification:** One-click links to Google Maps, Google Earth, and ForeFlight Web to verify coordinates before they ever reach the aircraft.

## Version History
* **v6.12:** Expanded instruction block with explicit coordinate format definitions; restored hardware truncation alerts.
* **v6.08:** Introduced conditional UI logic to hide the "View waypoint in" column until data is present.
* **v6.00:** Major overhaul of bulk paste parser and auto-load event listeners.
* **v5.00:** Initial release of reverse-engineered `user.dat` binary export functionality.

## Usage
1. Open `index.html` in any modern browser.
2. Select an existing file to edit or bulk-paste rows from your spreadsheet or dispatch software.
3. Verify the data in the table.
4. Export to your desired hardware format and copy the file to your data card.

## License
Open Source Project. See GitHub repository for details.
