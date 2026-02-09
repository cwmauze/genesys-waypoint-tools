# Genesys IDU Waypoint and Route Tools

A lightweight, browser-based mission planning utility for managing, editing, and exporting navigation data to Genesys Aerosystems IDU and Garmin GTN/GNS avionics.

## Background & Origin
This toolkit exists because Genesys Aerosystems apparently believes that manual data entry is a core competency for modern pilots. 

Despite their marketing-hype that they are built on an "open" architecture, Genesys provides no manufacturer-supported method for the bulk upload of user waypoints or complex flight plans. According to their documentation, if you need to build a waypoint database, your "approved" options are:

1.  **Manual entry in the cockpit:** Spend hours twisting physical IDU knobs to enter every identifier, name, and coordinate one by one, digit-by-digit.
2.  **The "EFIS Training Tool" method:** Use their PC-based EFIS training tool to manually click through a virtual version of the IDU to go through the exact same process of spinning knobs...except with a keyboard and mouse.

If you call their technical support line and ask the folks there if there is any other way to load waypoints other than manually one-by-one they will happily tell you "no."  Trust me, that's how this all started.

In most industries this would merely be a waste of time...but in aviation this is a genuine safety issue. Forcing a pilot to manually transcribe hundreds coordinates or complex multi-leg routes is an invitation for human error. In the **Rotary-Wing EMS** world where this tool was born a single fat-fingered digit in a lat/long isn't just a typo; it has potential life-or-death consequences.

While other vendors (e.g. Garmin) make data entry really easy (they just use a .CSV file you can generate from any spreadsheet shoftware), Genesys has left it to its customers to build their own safety nets.  Hence - instead of playing data entry clerk with a $50k avionics suite we decided our time was better spent reverse-engineering the binary formats that Genesys uses, then building this tool to recreate them.  End goal here is to give our brother/sister pilots the ability to build and load large waypoint sets/routes into their IDU- series avionics as SAFELY, ACCURATELY, and QUICKLY as possible. Happy flying.

## Technical Specifications
For a deep dive into the engineering behind this tool, refer to the included technical documentation.

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
* **v8.4.4.8:** - .RTE file export functionality fixed.
* **v8.4.3.5:** - .RTE file export functionality broken...working on it.
* **v8.4.3.4:** - UI FIX: Separated Waypoint IDs from Markers. Auto-toggle 'Legs' overlay for Routes vs. Waypoints.
* **v8.4.3.3:** - Minor visual updates to action bar.
* **v8.4.3.2:** - Added dark basemap as default selection.
* **v8.4.3.1:** - Fixed drop up menus. Fixed weather overlays.
* **v8.4.3:** - INTEGRATION: Added New Map Command Bar with FAA Charts & Weather Overlays.
* **v8.4.2.1:** - STABLE: Restored Input fields. Fixed Footer layout. Restored new Purpose text. Added Year to AIRAC.
* **v8.4.2:** - UI UPDATE: Added back rolling sections to timestamp. Updated waypoint tally totals.
* **v8.4.1:** - UI UPDATE: Added Dual-Time (Local/Zulu), explicit AIRAC Cycle display, and real-time database verification timestamp.
* **v8.4:** - STABLE RELEASE: Integrated forensic binary engine for .RTE flight plans (11,752 byte container).
* **v8.3.1.8:** - FIXED: Rewrote .RTE Exporter with "Golden Master" logic (Flags, Leg Shifts, and CRC-32).
* **v8.3.1.7:** - LOGIC PATCH: Smart disambiguation for duplicate IDs. 3-letter inputs prioritize NAVAIDs; 4-letter (K/P) prioritize Airports.
* **v8.3.1.6:** - SELF-HEALING: Added automated database corruption check and manual reset option.
* **v8.3.1.5:** - CRITICAL FIX: Forced schema upgrade to v2 to enable search indexing.
* **v8.3.1.4:** - DB Architecture Upgrade (v2): Enabled duplicate identifiers (Airport/NAVAID separation) and smart prioritization.
* **v8.3.1.3:** - UI Logic Fix: Identifier field now preserves user input (e.g., K-prefixes) and re-search forces row update on edit.
* **v8.3:** - STABLE RELEASE: Transitioned out of beta. Locked functional baseline.
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
