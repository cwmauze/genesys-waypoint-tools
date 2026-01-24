# 🛠 Technical Specifications: Genesys `user.dat` Binary Archaeology

This document serves as a technical roadmap for the reverse-engineering of the Genesys Aerosystems (formerly S-TEC/Chelton) IDU `user.dat` binary format. This is a proprietary, fixed-allocation database format used by the IDU-450 and IDU-680 EFIS series.

## 1. Methodology: Decoding the Black Box
The format was decoded using **differential binary analysis**. We utilized a "known-good" file exported from a Genesys IDU simulator and compared it against controlled manual coordinate entries. By observing which bits flipped when changing a single character or digit, we mapped the internal architecture.

### **Key Discovery: The "Trailing Elevation" Logic**
A significant breakthrough was identifying that the elevation for **Waypoint N** is actually stored at the start of the record for **Waypoint N+1**. This "shifted" logic is a relic of older database architectures where the tail-end of one record handles the initialization/setup of the next.

---

## 2. File Anatomy (Little-Endian)
The file is a fixed-width blob of exactly **88,016 bytes**. It accommodates exactly 998 waypoints regardless of how many are actually used.

### **A. The Header (Bytes 0–71)**
The header initializes the database and validates the file source for the IDU operating system.

| Offset | Size (Bytes) | Type | Description |
| :--- | :--- | :--- | :--- |
| 0 | 4 | Uint32 | **Waypoint Count:** Total active waypoints + 1. |
| 4 | 68 | Hex | **Magic String:** A proprietary sequence required for system validation. |

### **B. Data Record Structure (88 Bytes Each)**
Each waypoint record begins at **Byte 72**.

| Offset | Size | Type | Description |
| :--- | :--- | :--- | :--- |
| 0 | 4 | Uint32 | **Elevation:** MSL Feet for the *previous* waypoint in the list. |
| 16 | 2 | Uint16 | **Approach Bearing:** Magnetic bearing (0–359). |
| 24 | 5 | ASCII | **Identifier:** 5-char limit, space-padded (`0x20`). |
| 33 | 12 | ASCII | **Friendly Name:** 12-char limit, space-padded (`0x20`). |
| 64 | 1 | Byte | **Terminator:** Fixed marker (`0x0A`). |
| 72 | 8 | Float64 | **Latitude:** WGS84 Decimal Degrees (Little-Endian). |
| 80 | 8 | Float64 | **Longitude:** WGS84 Decimal Degrees (Little-Endian). |



---

## 3. The Mathematics of Precision

### **Coordinate Resolution**
Genesys utilizes **Double Precision Floating Point (IEEE 754 Float64)**. 
* **Data Width:** 8 bytes per coordinate.
* **Accuracy:** This provides sub-centimeter resolution, significantly exceeding standard GPS requirements.
* **Endianness:** Values must be written in **Little-Endian**. A Latitude of `35.204416` is converted to its 64-bit hex equivalent and the byte order is reversed before buffer insertion.

### **Elevation Logic**
While the IDU interface allows for 1-foot increments, the internal binary logic often groups user waypoints into 10-foot increments to minimize database "jitter."
$$Elevation_{Binary} = \text{round}(Elevation_{User} / 10) \times 10$$

---

## 4. Integrity Validation: CRC-32
The final 8 bytes of the file are reserved for a **CRC-32 Checksum**. If this value is incorrect by even a single bit, the IDU will reject the database with a **"USER WPT DATABASE CORRUPT"** error.

* **Algorithm:** Standard CRC-32 (Ethernet/ISO 3309).
* **Polynomial:** `0xEDB88320`.
* **Calculation Range:** From Byte 0 to Byte 88,007.
* **XOR Out:** `0xFFFFFFFF`.



---

## 5. Implementation Roadmap for Future Developers
If re-implementing this parser, adhere to the following sequence:
1.  **Initialize Buffer:** Create a `Uint8Array` of exactly 88,016 bytes filled with zeros.
2.  **String Padding:** Use spaces (`0x20`) for padding text. Do NOT use null terminators (`0x00`).
3.  **Manage the Shift:** When iterating through your waypoint array, ensure `waypoints[i].elevation` is written to `record[i+1]`.
4.  **Finalize CRC:** Calculate the hash only on the first 88,008 bytes and append the result to the tail of the buffer.

---
*Document Version: 1.0 (Jan 2026)*
