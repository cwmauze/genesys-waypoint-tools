# Genesys IDU .RTE Technical Specification
**Version:** 1.0  
**Date:** January 26, 2026  
**Status:** FORENSIC GOLD MASTER  
**File Type:** Binary Route File (Little-Endian)  

---

## 1. File Architecture Overview

The Genesys IDU `.RTE` file is a fixed-size, sector-aligned binary format used to store flight plan data. Unlike standard GPS formats (GPX/KML) which use XML, this is a legacy binary structure that relies on specific byte offsets and "Leg-Based" logic.

### 1.1 Global Constraints
* **File Size:** Fixed at **4,776 bytes**.
* **Byte Order:** Little-Endian (Intel format).
* **Encoding:** ASCII for strings (0x20 Space padded).
* **Coordinate System:** WGS84 Decimal Degrees.

### 1.2 Memory Map
The file is divided into four distinct memory blocks:

| Block | Offset (Decimal) | Size | Description |
| :--- | :--- | :--- | :--- |
| **Header** | 0 | 56 bytes | Contains Waypoint Count. |
| **Waypoint Table** | 56 | ~2,976 bytes | Array of 72-byte records storing coords & flags. |
| **Name Table** | 3032 | ~1,740 bytes | Array of 31-byte text descriptions. |
| **Footer (CRC)** | 4772 | 4 bytes | 32-bit Checksum. |

---

## 2. Detailed Breakdown

### 2.1 The Header (0 - 55)
The header is 56 bytes long. Only the first 4 bytes are currently identified as functional data. The remainder appears to be padding.

* **Offset 0 [UInt32]:** **Waypoint Count** (N).
    * This is the number of active waypoints in the flight plan.
    * *Note:* The parser reads `N` records, plus an implicit "Phantom Record" for the final ID.

### 2.2 The Waypoint Record (Stride = 72 Bytes)
Starting at **Offset 56**, the file contains a contiguous array of fixed-length records. Each record is **72 bytes** long.

| Offset (Rel) | Type | Size | Value / Description |
| :--- | :--- | :--- | :--- |
| **+00** | Byte | 1 | **Sequence/Flag**. <br>• `0xB3`: Start of Origin (Waypoint 1). <br>• `0x00`: All other waypoints. |
| **+01** | Byte | 1 | **Origin Flag**. <br>• `0x01`: Start of Origin (Waypoint 1). <br>• `0x00`: All other waypoints. |
| **+08** | String | 6 | **Waypoint ID (Legacy/From)**. <br>• 6-char ASCII, Null-Terminated. <br>• *See Section 3.1 for ID Shift Logic.* |
| **+14** | String | 2 | **Region Code**. <br>• Typically "K7". <br>• **CRITICAL:** Do NOT use a null terminator. Must be 2 chars. |
| **+24** | Double | 8 | **Latitude** (Decimal Degrees). Little-Endian. |
| **+32** | Double | 8 | **Longitude** (Decimal Degrees). Little-Endian. |
| **+40** | Float | 4 | **Type/Altitude**. <br>• Fixed constant: `4.0` (0x00008040). |
| **+44** | Bytes | 28 | **Padding**. <br>• Filled with `0x00` or garbage data. |

### 2.3 The Name Table (Offset 3032)
Starting at **Offset 3032 (0xBD8)**, this block contains the full text descriptions (e.g., "RALEIGH-DURHAM INTL").

* **Stride:** 31 Bytes.
* **Format:** ASCII Text, padded with Spaces (`0x20`), ending with a Null Terminator (`0x00`).
* **Indexing:** Name[i] corresponds to Waypoint Record[i].

### 2.4 The CRC (Offset 4772)
The last 4 bytes of the file contain a standard CRC32 Checksum.
* **Algorithm:** Standard CRC32 (Poly: `0xEDB88320`).
* **Scope:** Calculates checksum of bytes 0 to 4771.
* **Location:** Bytes 4772-4775.

---

## 3. The "Leg-Based" Logic (Critical)

The most complex aspect of the .RTE format is how it handles Waypoint IDs. It does not store "Point" properties; it stores "Leg" properties.

### 3.1 The "ID Shift"
In the binary file, Record `N` stores the coordinates for Waypoint `N`, but the ID for Waypoint `N-1`.

* **Record 0 (Origin):**
    * Coordinates: **RDU** (Lat/Lon).
    * ID Field: **Empty** (No leg leads TO the origin).
    * Flag: `0xB3 01`.
* **Record 1:**
    * Coordinates: **FAY** (Lat/Lon).
    * ID Field: **"KRDU"** (The ID of the *previous* waypoint).
* **Record 2:**
    * Coordinates: **ILM** (Lat/Lon).
    * ID Field: **"FAY"** (The ID of the *previous* waypoint).
* **Record 3 (Phantom):**
    * Coordinates: **0.0 / 0.0**.
    * ID Field: **"KILM"** (The final destination ID).

### 3.2 Importer Logic
To correctly read the file:
1.  Read `Count` from Header.
2.  Loop `i` from `0` to `Count-1`:
    * Read Coordinates from Record `i`.
    * Read Description from Name Block `i`.
    * Read ID from Record `i+1` (The next record).
3.  *Edge Case:* If Record `i+1` is empty, use "WP [i+1]".

### 3.3 Exporter Logic
To correctly write the file:
1.  Write `Count` to Header.
2.  Loop `i` from `0` to `Count-1`:
    * Write Coordinates of Row `i` to Record `i`.
    * Write ID of Row `i` to Record `i+1`.
    * Write "K7" to Record `i+1` Region slot.
3.  Set Flags `0xB3 01` only on Record 0.

---

## 4. File Naming Convention

The Trainer expects a strict 8.3 filename format derived from the Start and End identifiers.

* **Format:** `SSS-EEE0.RTE`
* **SSS:** First 3 characters of the Origin ID (or 3 chars if 4-letter ICAO code).
    * *Rule:* If ID is "KRDU" (4 chars starting with K and all alpha), use "RDU". Otherwise use first 3 chars.
* **EEE:** First 3 characters of the Destination ID (same rule as above).
* **0:** Constant suffix digit.
* **Extension:** `.RTE`

**Example:**
* **Route:** KRDU -> KILM
* **Start:** "RDU"
* **End:** "ILM"
* **Filename:** `RDU-ILM0.RTE`

---

## 5. Hexadecimal Reference (Known Good Origin)

Forensic signature of a valid First Record (Offset 56):

    Offset 56:  B3 01 00 00 00 00 00 00 00 00 00 00 00 00 4B 37
                ^^ ^^                   ^^ ^^ ^^ ^^ ^^ ^^ ^^ ^^
                Flag                    Null ID (Origin)  Region "K7"

Forensic signature of a valid Second Record (Offset 128):

    Offset 128: 00 00 00 00 00 00 00 00 4B 52 44 55 00 00 4B 37
                ^^ ^^                   ^^ ^^ ^^ ^^       ^^ ^^
                No Flag                 ID "KRDU"         Region "K7"

---

## 6. Implementation Checklist (Forensic Recovery)

If re-implementing this tool from scratch, ensure:
1.  [ ] **Header Size** is set to 56 bytes.
2.  [ ] **Record Size** is set to 72 bytes.
3.  [ ] **Sequence 0** starts at Offset 56 with `0xB3 01` flag.
4.  [ ] **Region "K7"** is written as 2 bytes (`0x4B 0x37`) without a trailing null.
5.  [ ] **ID Look-Ahead:** The ID for the current waypoint is written to the *next* record's ID slot.
6.  [ ] **CRC32** is calculated on bytes 0-4771 and written to 4772.
