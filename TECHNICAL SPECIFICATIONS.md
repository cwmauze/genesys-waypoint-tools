# 🛠 Technical Specifications: Genesys IDU `user.dat` Binary Architecture

**Version:** 2.0 (Hardware-Native Verified)
**Date:** January 25, 2026
**Applicability:** Genesys Aerosystems IDU-450, IDU-680, and IDU PC Trainer.

## 1. Executive Summary
This document defines the proprietary `user.dat` binary format used by Genesys Aerosystems EFIS hardware. Unlike standard CSV or XML lists, this format is a **continuous linear memory dump** that relies on specific byte-alignment, memory shifting, and checksum validation.

**Critical Finding:** The IDU-450 parser functions as a **Linked List**. Data for a single logical waypoint is physically split across two adjacent binary records. The system reads the *Identifier* from the current record pointer but retrieves *Vertical Navigation Data* (Elevation/Bearing) from the previous record pointer.

---

## 2. File Anatomy & Initialization
The file must be exactly **88,016 bytes** in length. Any deviation results in immediate rejection by the hardware.

### **A. Global Structure**
* **Total Capacity:** 998 Waypoints (Hard Limit).
* **Structure:** 1 Header + 999 Data Records (998 actual + 1 dummy/buffer).
* **Byte Order:** Little-Endian (Least Significant Byte first).

### **B. The Header (Bytes 0–71)**
The header acts as the "Boot Sector" for the waypoint database. It requires a specific Hex Signature to be recognized as a valid User Database.

| Offset | Size | Type | Value / Description |
| :--- | :--- | :--- | :--- |
| 0 | 4 | `Uint32` | **Waypoint Count:** Total active waypoints. |
| 4 | 68 | `Hex` | **Signature:** `9a01000000000000...` (See Appendix A). |

---

## 3. The "Shift Logic" (Memory Offset Protocol)
The most critical aspect of the file structure is the **Offset Shift**. The hardware reads the `Identifier` from the current memory address but pulls `Elevation` and `Bearing` from the *previous* memory address.

To generate a valid file, the export engine must "look back" and write data out of order.

### **The Write Sequence:**

| Logical Waypoint | Binary Record Index | Content Written to Record |
| :--- | :--- | :--- |
| **Waypoint 1** | Record 0 | ID: `WP1` \| Elev: `0` (Null/System) |
| **Waypoint 2** | Record 1 | ID: `WP2` \| Elev: `WP1_Elev` |
| **Waypoint 3** | Record 2 | ID: `WP3` \| Elev: `WP2_Elev` |
| ... | ... | ... |
| **Waypoint N** | Record N-1 | ID: `WPN` \| Elev: `WPN-1_Elev` |
| **(End Buffer)** | Record N | ID: `(Empty)` \| Elev: `WPN_Elev` |

* **Implementation Rule:** `Record[i].Elevation = Waypoint[i-1].Elevation`
* **The Dummy Record:** An extra record (Record N) is **mandatory** at the end of the list solely to house the Elevation/Bearing data for the final waypoint.

---

## 4. Record Structure (88 Bytes)
Each waypoint record is a fixed 88-byte block.

### **Field Allocation Map**

| Offset | Size | Type | Description |
| :--- | :--- | :--- | :--- |
| **0** | 4 | `Uint32` | **Shifted Elevation:** (Feet MSL) for `Waypoint[i-1]`. |
| **4** | 4 | `Null` | *Reserved / Padding (0x00)*. |
| **8** | 8 | `Float64` | *Legacy/Unused (0.0)*. |
| **16** | 2 | `Uint16` | **Shifted Bearing:** (Magnetic) for `Waypoint[i-1]`. |
| **24** | 9 | `ASCII` | **Short Identifier:** 9-byte allocation. Double-Write field 1. |
| **33** | 23 | `ASCII` | **Long Name:** 23-byte allocation. Double-Write field 2. |
| **64** | 1 | `Byte` | **Magic Byte:** VALIDITY FLAG. Must be `0x0A`. |
| **72** | 8 | `Float64` | **Latitude:** WGS84 Decimal Degrees. |
| **80** | 8 | `Float64` | **Longitude:** WGS84 Decimal Degrees. |

### **Specific Data Rules**
1.  **The Double-Write Protocol:** The identifier/name must be written to **Offset 24** (first 9 chars) AND **Offset 33** (full name up to 23 chars). Writing to only one results in blank entries in the FMS.
2.  **The Magic Byte (`0x0A`):** Offset 64 must contain `0x0A`. If this byte is missing, the IDU ignores the coordinates entirely.
3.  **Coordinate Precision:**
    * **PC Trainer:** Tolerates 32-bit floats.
    * **Aircraft Hardware:** **REQUIRES 64-bit Doubles**. Using 32-bit precision results in "Coordinate Drift" (errors of 3-100ft).

---

## 5. Operational Constraints & Validation
While the file structure allows for specific data sizes, the cockpit display (EFIS) enforces tighter limits.

### **Capacity Limits**
* **Max Waypoints:** 998. (Exceeding this causes buffer overflow in the import logic).

### **Display Limits (The "Truncation Rule")**
* **Physical Storage:** The file stores up to **23 characters** at Offset 33.
* **Cockpit Display:** The IDU map and list screens only display the **first 12 characters**.
* **Validation Logic:** Warn user if Name > 12 chars, but strictly truncate to 23 bytes in the file to preserve binary alignment.

---

## 6. Integrity Validation: CRC-32
The IDU-450 performs a checksum validation upon loading. If the checksum fails, the file is flagged "CORRUPT" and rejected.

* **Location:** The final 4 bytes of the 88,016-byte file.
* **Algorithm:** Standard CRC-32 (`0xEDB88320`).
* **Range:** Calculated from Byte 0 to the end of the padding (Byte 88,011).
* **Padding:** The file must be padded with `0x00` from the end of the last record up to the start of the CRC.

---

## Appendix A: The Golden Header
The file **must** begin with this specific byte sequence (Hex) to be recognized as a valid `user.dat`:

```text
9A 01 00 00 00 00 00 00 00 00 00 00 20 00 00 00
00 00 00 00 00 20 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 0A 00 00 00
00 00 00 00 47 28 A3 B7 65 55 42 40 27 EA DF 08
65 78 53 C0
