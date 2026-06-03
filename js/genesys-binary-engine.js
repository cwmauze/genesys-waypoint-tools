/* ------------------------------------------------------------------------------------------------
   GENESYS IDU .RTE & .DAT FILE ENGINE (v9.0 STABLE)
   Forensic binary structure for S-TEC/Genesys Avionics
   DO NOT MODIFY THE CONSTANTS, OFFSETS, OR CRC MATH BELOW.
------------------------------------------------------------------------------------------------ */

/* --- APP RULES: Defines the rigid structures required for avionics binary files --- */
const RECORD_SIZE = 88, HEADER_SIZE = 72, TARGET_FILE_SIZE = 88016; 

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

            // Read ID (Stored in the NEXT record's slot)
            let id = this._readString(view, nextRecOffset + 8, 6);
            if (!id) id = `WP${i + 1}`;
            const desc = this._readString(view, nameOffset, RTE_CONSTANTS.NAME_SIZE);

            waypoints.push({ id: id, lat: lat, lon: lon, desc: desc });
        }
        return waypoints;
    },

    export: function(waypoints) {
        const buffer = new ArrayBuffer(RTE_CONSTANTS.FILE_SIZE);
        const view = new DataView(buffer);
        const byteView = new Uint8Array(buffer);

        view.setUint32(0, waypoints.length, true);

        for (let i = 0; i < waypoints.length; i++) {
            const wp = waypoints[i];
            const currentRecOffset = RTE_CONSTANTS.HEADER_SIZE + (i * RTE_CONSTANTS.REC_SIZE);
            const nextRecOffset = RTE_CONSTANTS.HEADER_SIZE + ((i + 1) * RTE_CONSTANTS.REC_SIZE);
            const nameOffset = RTE_CONSTANTS.NAME_BLOCK_START + (i * RTE_CONSTANTS.NAME_SIZE);

            view.setFloat64(currentRecOffset + 24, wp.lat, true);
            view.setFloat64(currentRecOffset + 32, wp.lon, true);
            view.setUint32(currentRecOffset + 40, RTE_CONSTANTS.TYPE_STANDARD, true);

            // Write ID to next record
            if (i < 101) {
                const idStr = wp.id ? wp.id : `WP${i+1}`;
                this._writeString(view, nextRecOffset + 8, idStr, 6);
            }
            this._writeString(view, nameOffset, wp.desc || "", RTE_CONSTANTS.NAME_SIZE);
        }

        const payload = byteView.subarray(0, RTE_CONSTANTS.CRC_OFFSET);
        const crc = this._calculateCRC32(payload);
        view.setUint32(RTE_CONSTANTS.CRC_OFFSET, crc, true);

        return buffer;
    },

    _readString: function(view, offset, length) {
        let str = "";
        for (let i = 0; i < length; i++) {
            const charCode = view.getUint8(offset + i);
            if (charCode === 0) break;
            str += String.fromCharCode(charCode);
        }
        return str.trim();
    },

    _writeString: function(view, offset, str, maxLen) {
        const s = (str || "").toString().toUpperCase().trim().substring(0, maxLen);
        for (let i = 0; i < s.length; i++) {
            view.setUint8(offset + i, s.charCodeAt(i));
        }
        for (let i = s.length; i < maxLen; i++) {
            view.setUint8(offset + i, (i === maxLen - 1) ? 0 : 32); 
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

function parseCoordinate(i) {
    if (!i) return 0; let s = i.toString().trim().toUpperCase(), m = (/[SW-]/.test(s)) ? -1 : 1;
    let p = s.replace(/[NSWE°'"\-]/g, ' ').trim().split(/\s+/), d = 0;
    if (p.length === 1) d = parseFloat(p[0]); else if (p.length === 2) d = parseFloat(p[0]) + (parseFloat(p[1])/60); else if (p.length >= 3) d = parseFloat(p[0]) + (parseFloat(p[1])/60) + (parseFloat(p[2])/3600);
    return (Math.abs(d) * m).toFixed(6);
}

/* ---------------------------------------------------------
   EXPORT HANDLERS: v8.4 UPDATE (RTE FIX)
   --------------------------------------------------------- */
function validateAndExportGenesys() {
    const tbody = document.getElementById('table-body');
    const rows = [...tbody.querySelectorAll('tr')], headerHex = "9a01000000000000000000002000000000000000002000000000000000000000000000000000000000000000000000000a00000000000004728a3b76555424027eadf08657853c0";
    let bytes = []; let hBuf = new ArrayBuffer(HEADER_SIZE), hView = new DataView(hBuf); hView.setUint32(0, rows.length + 1, true);
    for(let k=0; k<HEADER_SIZE; k++) bytes.push(k<4 ? hView.getUint8(k) : parseInt(headerHex.substr(k*2,2), 16));

    // Track vertical data for the required Shift Logic
    let prevElev = 0;
    let prevBrg = 0;

    rows.forEach(r => {
        const inp = r.querySelectorAll('input'); 
        const lat = parseCoordinate(inp[2].dataset.raw || inp[2].value);
        const lon = parseCoordinate(inp[3].dataset.raw || inp[3].value);
        
        // Extract vertical data
        const elev = parseInt(inp[4].value) || 0;
        const brg = parseInt(inp[5].value) || 0;

        let buf = new ArrayBuffer(RECORD_SIZE), v = new DataView(buf);
        
        // Shift Logic: Apply previous waypoint's vertical data to offsets 0 and 16
        v.setUint32(0, prevElev, true);
        v.setUint16(16, prevBrg, true);

        for(let j=0; j<9; j++) v.setUint8(24+j, (j<inp[0].value.length)?inp[0].value.charCodeAt(j):0);
        for(let j=0; j<23; j++) v.setUint8(33+j, (j<inp[1].value.length)?inp[1].value.charCodeAt(j):0);
        
        // Apply Magic Byte at Offset 64
        v.setUint8(64, 0x0A);

        v.setFloat64(72, parseFloat(lat), true); 
        v.setFloat64(80, parseFloat(lon), true);
        
        for(let k=0; k<RECORD_SIZE; k++) bytes.push(v.getUint8(k));

        // Store current values for the next iteration
        prevElev = elev;
        prevBrg = brg;
    });

    // Generate the mandatory final Dummy Record to house the last waypoint's vertical data
    let dummyBuf = new ArrayBuffer(RECORD_SIZE), dummyView = new DataView(dummyBuf);
    dummyView.setUint32(0, prevElev, true);
    dummyView.setUint16(16, prevBrg, true);
    dummyView.setUint8(64, 0x0A); 
    for(let k=0; k<RECORD_SIZE; k++) bytes.push(dummyView.getUint8(k));

    while(bytes.length < TARGET_FILE_SIZE - 8) bytes.push(0);
    const table = makeCRCTable(); let crc = 0xFFFFFFFF; for(let i=0; i<bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
    crc = (crc ^ 0xFFFFFFFF) >>> 0; let cBuf = new ArrayBuffer(4), cView = new DataView(cBuf); cView.setUint32(0, crc, true);
    for(let k=0; k<4; k++) bytes.push(cView.getUint8(k)); bytes.push(0,0,0,0);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([new Uint8Array(bytes)])); a.download = "user.dat"; a.click();
}
function makeCRCTable(){let c, t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=((c&1)?(0xEDB88320^(c>>>1)):(c>>>1));t[n]=c;}return t;}

/* --- FIXED: EXPORT .RTE (Stable Logic + Record 0 ID Fix) --- */
function exportToRTE() {
    const tbody = document.getElementById('table-body');
    const rows = [...tbody.querySelectorAll('tr')];
    if (rows.length < 2) return alert("Min 2 WPs required for Route.");

    const wpData = rows.map(r => {
        const inputs = r.querySelectorAll('input');
        const latRaw = inputs[2].dataset.raw || inputs[2].value;
        const lonRaw = inputs[3].dataset.raw || inputs[3].value;
        
        return {
            id: inputs[0].value.trim().toUpperCase() || "WP",
            desc: inputs[1].value.trim().toUpperCase(),
            lat: parseFloat(parseCoordinate(latRaw)) || 0.0,
            lon: parseFloat(parseCoordinate(lonRaw)) || 0.0
        };
    });

    try {
        const RTE = {
            FILE_SIZE: 11752,
            HEADER_SIZE: 56,
            REC_SIZE: 72,
            NAME_BLOCK_START: 7412,
            CRC_OFFSET: 11744,
            TYPE_STANDARD: 0x40A00000 
        };

        // 1. Initialize Buffer with ZEROS (0x00)
        // Matches Google Apps Script. 
        const buffer = new ArrayBuffer(RTE.FILE_SIZE);
        const view = new DataView(buffer);
        const byteView = new Uint8Array(buffer);

        // A. Write Header
        view.setUint32(0, wpData.length, true);

        // B. Helper: Write String (Matches GAS Logic Exactly)
        const writeStr = (offset, str, maxLen, nullTerm) => {
            const s = (str || "").toString().toUpperCase().trim().substring(0, maxLen);
            let written = 0;
            // 1. Write Characters
            for (let i = 0; i < s.length; i++) {
                view.setUint8(offset + i, s.charCodeAt(i));
                written++;
            }
            // 2. Pad remainder with SPACES (0x20)
            while (written < maxLen) {
                view.setUint8(offset + written, 0x20);
                written++;
            }
            // 3. Force Null Terminator (If true)
            if (nullTerm) view.setUint8(offset + maxLen - 1, 0x00);
        };

        // C. Write Records
        for (let i = 0; i < wpData.length; i++) {
            const wp = wpData[i];
            const currentRecOffset = RTE.HEADER_SIZE + (i * RTE.REC_SIZE);
            const nextRecOffset = RTE.HEADER_SIZE + ((i + 1) * RTE.REC_SIZE);
            const nameOffset = RTE.NAME_BLOCK_START + (i * 31);

            // 1. Write Coordinates & Type
            view.setFloat64(currentRecOffset + 24, wp.lat, true);
            view.setFloat64(currentRecOffset + 32, wp.lon, true);
            view.setUint32(currentRecOffset + 40, RTE.TYPE_STANDARD, true);

            // 2. Write ID to NEXT Record (Standard Leg Logic)
            if (i < 101) { 
                const idStr = wp.id ? wp.id : `WP${i+1}`;
                writeStr(nextRecOffset + 8, idStr, 6, true); // Null Terminated
                writeStr(nextRecOffset + 14, "K7", 2, false); // Region
            }

            // 3. CRITICAL FIX: Write ID to CURRENT Record (Record 0)
            // The avionics likely reads this slot for the Route Name/Start Display.
            if (i === 0) {
                 const idStr = wp.id ? wp.id : `WP${i+1}`;
                 writeStr(currentRecOffset + 8, idStr, 6, true);
                 writeStr(currentRecOffset + 14, "K7", 2, false);
            }

            // 4. Write Description
            writeStr(nameOffset, wp.desc || "", 31, true); // Null Terminated
        }

        // D. Calculate CRC-32 (IEEE 802.3)
        const payload = byteView.subarray(0, RTE.CRC_OFFSET);
        const crcTable = (function() {
            let c, t = [];
            for(let n=0; n<256; n++){
                c = n;
                for(let k=0; k<8; k++) c = ((c&1) ? (0xEDB88320^(c>>>1)) : (c>>>1));
                t[n] = c;
            }
            return t;
        })();

        let crc = 0xFFFFFFFF;
        for (let i = 0; i < payload.length; i++) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ payload[i]) & 0xFF];
        }
        crc = (crc ^ 0xFFFFFFFF) >>> 0;

        view.setUint32(RTE.CRC_OFFSET, crc, true);

        // Download
        const start = wpData[0].id.replace(/^K/, '').substring(0,3);
        const end = wpData[wpData.length-1].id.replace(/^K/, '').substring(0,3);
        const fileName = `${start}-${end}0.RTE`;

        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (e) {
        console.error(e);
        alert("Export Failed: " + e.message);
    }
}
