/**
 * GENESYS IDU .RTE FILE ENGINE
 * ------------------------------------------------------------------
 * Handles the binary parsing and generation of flight plans for
 * Genesys/S-TEC IDU III Avionics.
 * * Version: 3.6 (Stable)
 * Updated: Fixed Record 0 ID Transposition and Strict String Padding
 */

const RTE_CONSTANTS = {
    FILE_SIZE: 11752,
    HEADER_SIZE: 56,
    REC_SIZE: 72,
    NAME_SIZE: 31,
    NAME_BLOCK_START: 7412,
    CRC_OFFSET: 11744,
    TYPE_STANDARD: 0x40A00000 // Float 5.0
};

// --- CRC32 LOOKUP TABLE (IEEE 802.3) ---
const CRC_TABLE = (function() {
    let c, table = [];
    for(let n = 0; n < 256; n++){
        c = n;
        for(let k = 0; k < 8; k++){
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[n] = c;
    }
    return table;
})();

const GenesysRTE = {
    
    /**
     * IMPORT: Parses a raw .RTE ArrayBuffer into a JSON object.
     */
    import: function(buffer) {
        const view = new DataView(buffer);
        const waypoints = [];
        const count = view.getUint32(0, true);

        for (let i = 0; i < count; i++) {
            const currentRecOffset = RTE_CONSTANTS.HEADER_SIZE + (i * RTE_CONSTANTS.REC_SIZE);
            const nextRecOffset = RTE_CONSTANTS.HEADER_SIZE + ((i + 1) * RTE_CONSTANTS.REC_SIZE);
            const nameOffset = RTE_CONSTANTS.NAME_BLOCK_START + (i * RTE_CONSTANTS.NAME_SIZE);

            const lat = view.getFloat64(currentRecOffset + 24, true);
            const lon = view.getFloat64(currentRecOffset + 32, true);

            // Read ID from the Leg-based slot (Next Record)
            let id = this._readString(view, nextRecOffset + 8, 6);
            if (!id) id = `WP${i + 1}`;

            const desc = this._readString(view, nameOffset, RTE_CONSTANTS.NAME_SIZE);

            waypoints.push({
                id: id,
                lat: lat,
                lon: lon,
                desc: desc
            });
        }
        return waypoints;
    },

    /**
     * EXPORT: Generates a valid .RTE binary from waypoint data.
     */
    export: function(waypoints) {
        if (!waypoints || waypoints.length < 2) throw new Error("Min 2 WPs required.");

        // 1. Initialize Buffer with ZEROS (0x00)
        const buffer = new ArrayBuffer(RTE_CONSTANTS.FILE_SIZE);
        const view = new DataView(buffer);
        const byteView = new Uint8Array(buffer);

        // A. Write Waypoint Count
        view.setUint32(0, waypoints.length, true);

        // B. Write Records
        for (let i = 0; i < waypoints.length; i++) {
            const wp = waypoints[i];
            const currentRecOffset = RTE_CONSTANTS.HEADER_SIZE + (i * RTE_CONSTANTS.REC_SIZE);
            const nextRecOffset = RTE_CONSTANTS.HEADER_SIZE + ((i + 1) * RTE_CONSTANTS.REC_SIZE);
            const nameOffset = RTE_CONSTANTS.NAME_BLOCK_START + (i * RTE_CONSTANTS.NAME_SIZE);

            // 1. Coordinates & Type Constant
            view.setFloat64(currentRecOffset + 24, Number(wp.lat), true);
            view.setFloat64(currentRecOffset + 32, Number(wp.lon), true);
            view.setUint32(currentRecOffset + 40, RTE_CONSTANTS.TYPE_STANDARD, true);

            // 2. Leg-Based ID Storage (Write current ID to NEXT record)
            if (i < 101) { 
                const idStr = wp.id ? wp.id : `WP${i+1}`;
                this._writeString(view, nextRecOffset + 8, idStr, 6, true); // Null Term
                this._writeString(view, nextRecOffset + 14, "K7", 2, false); // Region
            }

            // 3. CRITICAL FIX: Write ID to Record 0
            // Fixes the "Garbled Route Name" display issue on the selection screen.
            if (i === 0) {
                 const idStr = wp.id ? wp.id : `WP${i+1}`;
                 this._writeString(view, currentRecOffset + 8, idStr, 6, true);
                 this._writeString(view, currentRecOffset + 14, "K7", 2, false);
            }

            // 4. Description (Name Block)
            this._writeString(view, nameOffset, wp.desc || "", RTE_CONSTANTS.NAME_SIZE, true);
        }

        // C. Calculate & Write CRC-32 (IEEE 802.3)
        const payload = byteView.subarray(0, RTE_CONSTANTS.CRC_OFFSET);
        const checksum = this._calculateCRC32(payload);
        view.setUint32(RTE_CONSTANTS.CRC_OFFSET, checksum, true);

        return new Blob([buffer], { type: "application/octet-stream" });
    },

    /**
     * UTILITY: Generates the standard SSS-EEE0.RTE filename
     */
    getFilename: function(waypoints) {
        if (!waypoints || waypoints.length < 2) return "ROUTE0.RTE";
        
        const formatID = (id) => {
            const clean = id.trim().toUpperCase();
            return (clean.length === 4 && clean[0] === 'K') ? clean.substring(1) : clean.substring(0, 3);
        };

        const start = formatID(waypoints[0].id);
        const end = formatID(waypoints[waypoints.length - 1].id);
        return `${start}-${end}0.RTE`;
    },

    // --- INTERNAL HELPERS ---

    _readString: function(view, offset, len) {
        let s = "";
        for (let i = 0; i < len; i++) {
            let c = view.getUint8(offset + i);
            if (c === 0) break;
            if (c >= 32 && c <= 126) s += String.fromCharCode(c);
        }
        return s.trim();
    },

    /**
     * Strict Writing: Pads with Space (0x20), then optionally forces Null (0x00)
     */
    _writeString: function(view, offset, str, maxLen, nullTerm) {
        const s = (str || "").toString().toUpperCase().trim().substring(0, maxLen);
        let written = 0;
        
        // 1. Write ASCII Content
        for (let i = 0; i < s.length; i++) {
            view.setUint8(offset + i, s.charCodeAt(i));
            written++;
        }
        
        // 2. Pad Remaining Slots with Spaces (0x20)
        while (written < maxLen) {
            view.setUint8(offset + written, 0x20);
            written++;
        }
        
        // 3. Force Null Terminator to the last byte of the slot
        if (nullTerm) {
            view.setUint8(offset + maxLen - 1, 0x00);
        }
    },

    _calculateCRC32: function(buffer) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < buffer.length; i++) {
            crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xFF];
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
};
