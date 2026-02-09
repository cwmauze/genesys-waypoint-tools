# Genesys IDU .RTE Technical Specification
**Version:** 3.6 (Universal Standard)  
**Date:** February 9, 2026  
**Status:** VALIDATED / CROSS-PLATFORM COMPATIBLE  
**System Target:** Genesys/S-TEC IDU III Avionics  

---

## 1. Introduction & Methodology
This specification is the result of iterative forensic analysis moving from "Black Box" observation to "White Box" implementation. Through approximately 10 distinct test bench versions, we isolated the proprietary structural requirements of the Genesys .RTE binary format to create a dependency-free engine.

---

## 2. Architecture Overview
The Genesys `.RTE` file is a **fixed-size, sector-aligned binary container** used to store flight plan data. Unlike modern XML-based formats, this file uses a rigid memory map where every byte has a pre-determined slot.

### 2.1 Global Constraints
* **File Container Size:** Strictly **11,752 bytes**. Even a 2-waypoint flight plan must use the full container, padded with zeros.
* **Byte Order:** Little-Endian (Intel format).
* **Encoding:** ASCII for strings, padded with spaces (`0x20`).
* **Coordinate System:** WGS84 Decimal Degrees (Float64).
* **Checksum:** Standard IEEE-802.3 CRC-32.

### 2.2 Memory Map
Offsets are absolute decimal values.

| Block | Start Offset | End Offset | Size | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Header** | 0 | 55 | 56 bytes | Stores Waypoint Count at Offset 0. |
| **Record Table** | 56 | 7411 | 7,356 bytes | Array of 102 fixed-length (72-byte) records. |
| **Name Block** | 7412 | 11743 | 4,332 bytes | Array of 102 fixed-length (31-byte) strings. |
| **Footer (CRC)** | 11744 | 11751 | 8 bytes | CRC-32 Signature & Final Padding. |

---

## 3. Detailed Structure Breakdown

### 3.1 The Header (0 - 55)
* **Offset 0 [UInt32]:** **Waypoint Count**.
* **Offset 4-55:** Reserved/Padding (Zero-filled).

### 3.2 The Waypoint Record (Stride = 72 Bytes)
Starting at **Offset 56**, the file allows for exactly 102 records.
* **Formula:** `Offset = 56 + (Index * 72)`.

| Rel. Offset | Type | Value / Description |
| :--- | :--- | :--- |
| **+00** | Byte[8] | **Ghost Data**. Native files store Leg Cache here. Generator writes `0x00`. |
| **+08** | String[6] | **Identifier**. See Section 4 for Storage Logic. |
| **+14** | String[2] | **Region Code**. Value: "K7". |
| **+16** | Byte[8] | Reserved/Padding (`0x00`). |
| **+24** | Float64 | **Latitude** (Decimal Degrees). |
| **+32** | Float64 | **Longitude** (Decimal Degrees). |
| **+40** | UInt32 | **Waypoint Type Constant**. Value: `0x40A00000` (Float 5.0). |
| **+44** | Byte[28] | Reserved/Padding (`0x00`). |

### 3.3 The Name Block (Offset 7412)
Stores user-friendly descriptions (e.g., "CHARLOTTE/DOUGLAS INTL").
* **Formula:** `Offset = 7412 + (Index * 31)`.
* **Requirement:** Must be **Null Terminated** at byte 31 (`Offset + 30 = 0x00`) for universal compatibility.

---

## 4. Storage Logic & Transposition

### 4.1 Leg-Based ID Storage (The Offset Rule)
The IDU uses "Leg-Based" logic for Waypoint Identifiers.
* **Coordinates** for Waypoint *i* are stored in **Record *i***.
* **Identifier** for Waypoint *i* is stored in **Record *i+1***.

### 4.2 The Record 0 Requirement (Universal Compatibility Fix)
To ensure the "Route Name" displays correctly in selection menus and to satisfy strict hardware parsers, **Record 0 must contain the Identifier of the first waypoint**.



**Logical Mapping Example (2 Waypoint Route):**
* **Record 0 (Index 0):**
    * **Coords:** Waypoint 1 Lat/Lon.
    * **ID Field (+08):** Waypoint 1 ID.
    * **Region (+14):** "K7".
* **Record 1 (Index 1):**
    * **Coords:** Waypoint 2 Lat/Lon.
    * **ID Field (+08):** Waypoint 1 ID.
    * **Region (+14):** "K7".
* **Record 2 (Ghost Record):**
    * **ID Field (+08):** Waypoint 2 ID.
    * **Region (+14):** "K7".

---

## 5. Implementation Guide (The "Universal" Protocol)

### 5.1 Export Logic (Generator)
1.  **Initialize Buffer:** Create an `ArrayBuffer` of **11,752 bytes**. Initialize all with `0x00`.
2.  **Write Header:** Set `UInt32` at Offset 0 to `waypoints.length`.
3.  **String Padding Rule (Strict):**
    * Fill string field with ASCII characters.
    * Pad remaining length with Spaces (`0x20`).
    * **Force Null Terminator:** Set the final byte of the fixed-length field (byte 6 for IDs, byte 31 for Names) to `0x00`.
4.  **Loop Waypoints (i = 0 to N):**
    * **Coords:** Write Lat/Lon (Float64) to `Rec[i] + 24`.
    * **Type:** Write `0x40A00000` (Float 5.0) to `Rec[i] + 40`.
    * **Next-Leg Logic:** Write `Waypoints[i].ID` to `Rec[i+1] + 08`.
    * **Display-Logic Fix:** If `i == 0`, write `Waypoints[0].ID` to `Rec[0] + 08`.
    * **Description:** Write `Waypoints[i].Desc` to `NameBlock[i]`.
5.  **CRC Generation:** Run IEEE CRC-32 on bytes `0` to `11743`. Write result to Offset `11744`.

### 5.2 Forensic Summary
Strict hardware versions (Computer B) will delete files if:
* The identifier strings are not explicitly Null-terminated.
* The Name Block background is filled with spaces instead of zeros.
* Record 0 is left empty, causing a display buffer overflow (garbage text).