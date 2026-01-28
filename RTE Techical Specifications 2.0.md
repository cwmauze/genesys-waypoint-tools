# Genesys IDU .RTE Technical Specification
**Version:** 3.5 (Production Standard)  
**Date:** January 28, 2026  
**Status:** VALIDATED / BIT-PERFECT  
**System Target:** Genesys/S-TEC IDU III Avionics  

---

## 1. Architecture Overview

The Genesys `.RTE` file is a **fixed-size, sector-aligned binary container** used to store flight plan data. Unlike modern XML-based formats (GPX), this file uses a rigid memory map where every byte has a pre-determined slot.

### 1.1 Global Constraints
* **File Container Size:** Strictly **11,752 bytes**.
    * *Note:* Even a 2-waypoint flight plan must use the full 11,752-byte container, padded with zeros.
* **Byte Order:** Little-Endian (Intel format).
* **Encoding:** ASCII for strings (Space `0x20` padded).
* **Coordinate System:** WGS84 Decimal Degrees (Float64).
* **Checksum:** Standard IEEE-802.3 CRC-32.

### 1.2 Memory Map
The container is divided into four distinct memory blocks. Offsets are absolute decimal values.

| Block | Start Offset | End Offset | Size | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Header** | 0 | 55 | 56 bytes | Stores Waypoint Count at Offset 0. |
| **Record Table** | 56 | 7411 | 7,356 bytes | Array of 102 fixed-length (72-byte) records. |
| **Name Block** | 7412 | 11743 | 4,332 bytes | Array of fixed-length (31-byte) strings. |
| **Footer (CRC)** | 11744 | 11751 | 8 bytes | CRC-32 Signature & Final Padding. |

---

## 2. Detailed Structure Breakdown

### 2.1 The Header (0 - 55)
* **Offset 0 [UInt32]:** **Waypoint Count**.
    * Represents the number of active waypoints (N).
    * *Example:* A route "KRWI to KLHZ" has a count of `0x02 00 00 00`.
* **Offset 4-55:** Reserved/Padding (Zero-filled).

### 2.2 The Waypoint Record (Stride = 72 Bytes)
Starting at **Offset 56**, the file allows for exactly 102 records.
* **Formula:** `Offset = 56 + (Index * 72)`

| Rel. Offset | Type | Value / Description |
| :--- | :--- | :--- |
| **+00** | Byte[8] | **Ghost Data**. *Native files store Leg Distance here. Generator must write `0x00`.* |
| **+08** | String[6] | **Next Leg ID**. ID of the *previous* waypoint (See Section 3). |
| **+14** | String[2] | **Next Leg Region**. Code "K7". *See Section 3.1*. |
| **+16** | Byte[8] | Reserved/Padding (`0x00`). |
| **+24** | Float64 | **Latitude** (Decimal Degrees). |
| **+32** | Float64 | **Longitude** (Decimal Degrees). |
| **+40** | UInt32 | **Waypoint Type Constant**. Value: `0x40A00000` (Float 5.0). |
| **+44** | Byte[28] | Reserved/Padding (`0x00`). |

### 2.3 The Name Block (Offset 7412)
Starting at **Offset 7412**, this block stores the user-friendly description (e.g., "ROCKY MOUNT").
* **Formula:** `Offset = 7412 + (Index * 31)`
* **Format:** ASCII text, upper-case, padded with spaces (`0x20`), null-terminated.

### 2.4 The CRC Footer (Offset 11744)
* **Offset 11744 [UInt32]:** **CRC-32 Signature**.
    * **Algorithm:** Standard IEEE-802.3 (Poly: `0xEDB88320`).
    * **Scope:** Calculates checksum of bytes `0` to `11743` (Header + Records + Names).
* **Offset 11748 [4 Bytes]:** Final Padding (`0x00`).

---

## 3. The "Leg-Based" Logic (The Critical Mechanism)

The native software does not store IDs with their coordinates. It stores the ID of Waypoint `A` inside the record for Waypoint `B`. This is known as "Next Leg" logic.

### 3.1 Region Code Anomaly (Record 0)
* **The Rule:** The Region Code ("K7") is written to `Offset +14` of the **Next Record**.
* **The Exception:** Record 0 (The Origin) has no "previous" record pointing to it. Therefore, **Record 0 must NOT have a Region Code written to its own `+14` slot.**
    * **Record 0 Offset +14:** Must be `00 00`.
    * **Record 1+ Offset +14:** Must be `4B 37` ("K7").

### 3.2 ID Shifting Example
For a route **KRWI -> KLHZ**:

* **Record 0 (Index 0):**
    * **Coords:** KRWI Lat/Lon.
    * **ID Field (+08):** `00...` (Empty).
    * **Region (+14):** `00 00` (Empty).
* **Record 1 (Index 1):**
    * **Coords:** KLHZ Lat/Lon.
    * **ID Field (+08):** "KRWI" (ID of the *previous* point).
    * **Region (+14):** "K7".
* **Record 2 (Ghost/Phantom):**
    * **Coords:** `0.0` / `0.0`.
    * **ID Field (+08):** "KLHZ" (ID of the *final* point).
    * **Region (+14):** "K7".

---

## 4. "Clean Room" Implementation Guide

To implement an importer/exporter without using native libraries, follow this logic.

### 4.1 Export Logic (Generator)
1.  **Initialize Buffer:** Create an `ArrayBuffer` of exactly **11,752 bytes**. Initialize all with `0`.
2.  **Write Header:** Set `UInt32` at Offset 0 to `waypoints.length`.
3.  **Loop Waypoints (i = 0 to N):**
    * **Coords:** Write Lat/Lon (Float64) to `Rec[i] + 24`.
    * **Type:** Write `0x40A00000` (Float 5.0) to `Rec[i] + 40`.
    * **Logic (Next Leg):**
        * Write `Waypoints[i].ID` to `Rec[i+1] + 08`.
        * Write "K7" to `Rec[i+1] + 14`.
    * **Description:** Write `Waypoints[i].Desc` to `NameBlock[i]`.
4.  **CRC Generation:**
    * Extract bytes `0` to `11743` (Payload).
    * Run standard IEEE CRC-32 algorithm.
    * Write result to Offset `11744`.
5.  **Output:** Save as binary `.RTE` file.

### 4.2 Handling "Ghost Data"
Native files contain non-zero data at offsets `128`, `200`, etc. (likely calculated leg distances).
* **Forensic Verification:** It is confirmed that the native software **accepts files where these bytes are Zero**, provided the CRC is valid.
* **Action:** Your generator should leave these bytes as `0x00`.

---

## 5. File Naming Convention

* **Format:** `SSS-EEE0.RTE`
* **SSS / EEE:** The first 3 characters of the ID.
    * **Exception:** If the ID is a 4-letter ICAO code starting with 'K' (e.g., "KRWI"), strip the 'K' and use the remaining 3 ("RWI").
* **Example:** KRWI to KLHZ -> `RWI-LHZ0.RTE`