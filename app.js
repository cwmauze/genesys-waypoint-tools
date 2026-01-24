/**
 * Genesys Web Engine v1.1 -
 */

function exportData() {
    console.log("Export button clicked...");

    try {
        const table = document.getElementById('wpTable');
        const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
        let waypoints = [];

        // 1. Collect Data
        for (let row of rows) {
            let inputs = row.getElementsByTagName('input');
            if (inputs.length >= 6) {
                waypoints.push({
                    id: inputs[0].value.substring(0, 5).toUpperCase(),
                    name: inputs[1].value.substring(0, 12).toUpperCase(),
                    lat: parseFloat(inputs[2].value),
                    lon: parseFloat(inputs[3].value),
                    elev: parseFloat(inputs[4].value),
                    bearing: parseInt(inputs[5].value) || 0
                });
            }
        }

        console.log("Processing " + waypoints.length + " waypoints...");

        // 2. Mandatory Alphabetical Sort
        waypoints.sort((a, b) => a.id.localeCompare(b.id));

        // 3. Setup Binary Buffer
        const RECORD_SIZE = 88;
        const HEADER_SIZE = 72;
        const TOTAL_FILE_SIZE = 88016; 
        let buffer = new ArrayBuffer(TOTAL_FILE_SIZE);
        let view = new DataView(buffer);

        // 4. Write Header
        view.setUint32(0, waypoints.length, true);
        const headerHex = "0000000000000000000000002000000000000000002000000000000000000000000000000000000000000000000000000a000000000000004728a3b76555424027eadf08657853c0";
        for (let i = 4; i < HEADER_SIZE; i++) {
            view.setUint8(i, parseInt(headerHex.substr(i * 2, 2), 16));
        }

        // 5. Write Records with Double Shift Logic
        waypoints.forEach((wp, i) => {
            let offset = HEADER_SIZE + (i * RECORD_SIZE);
            if (i > 0) {
                let prevWp = waypoints[i-1];
                view.setUint32(offset + 0, Math.round(prevWp.elev / 10) * 10, true);
                view.setUint16(offset + 16, prevWp.bearing, true); 
            }
            for (let j = 0; j < wp.id.length; j++) view.setUint8(offset + 24 + j, wp.id.charCodeAt(j));
            for (let j = 0; j < wp.name.length; j++) view.setUint8(offset + 33 + j, wp.name.charCodeAt(j));
            view.setUint8(offset + 64, 0x0A);
            view.setFloat64(offset + 72, wp.lat, true);
            view.setFloat64(offset + 80, wp.lon, true);
        });

        // 6. Final Dummy Record
        let lastWp = waypoints[waypoints.length - 1];
        let dummyOffset = HEADER_SIZE + (waypoints.length * RECORD_SIZE);
        view.setUint32(dummyOffset + 0, Math.round(lastWp.elev / 10) * 10, true);
        view.setUint16(dummyOffset + 16, lastWp.bearing, true);
        view.setUint8(dummyOffset + 64, 0x0A);

        // 7. CRC Checksum
        let crc = 0xFFFFFFFF;
        let cTable = [];
        for(let n=0; n<256; n++){ let c=n; for(let k=0; k<8; k++) c=((c&1)?(0xEDB88320^(c>>>1)):(c>>>1)); cTable[n]=c; }
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < TOTAL_FILE_SIZE - 8; i++) {
            crc = (crc >>> 8) ^ cTable[(crc ^ bytes[i]) & 0xFF];
        }
        view.setUint32(TOTAL_FILE_SIZE - 8, (crc ^ 0xFFFFFFFF) >>> 0, true);

        // 8. Trigger Download
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "user.dat";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        console.log("Download triggered successfully!");

    } catch (e) {
        console.error("Error during export: ", e);
        alert("Export failed: " + e.message);
    }
}
