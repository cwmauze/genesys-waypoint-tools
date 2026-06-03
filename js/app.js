/* --- APP RULES: Defines the rigid structures required for avionics binary files --- */
let leafletMap = null, markerLayer = null, routeLayer = null, labelLayer = null, idLayer = null, pasteTimer, draggedRow = null, dbReady = false; 
let lastLoadedExtension = '', coordDisplayMode = 0; 
let layers = {}; // Global layers object for the new UI
let activeBase = 'street', activeChart = null; // Global state for the new UI

const FAA_DB_NAME = "FAANavData", FAA_STORE_NAME = "waypoints", tbody = document.getElementById('table-body');


/* --- FUNCTION: FAA DATABASE ENGINE (v2.1) --- */
async function initAviationDB() { await verifyDatabaseIntegrity(); }

async function verifyDatabaseIntegrity() {
    return new Promise((resolve) => {
        const req = indexedDB.open(FAA_DB_NAME, 2);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (db.objectStoreNames.contains(FAA_STORE_NAME)) db.deleteObjectStore(FAA_STORE_NAME);
            const store = db.createObjectStore(FAA_STORE_NAME, { autoIncrement: true });
            store.createIndex("id", "id", { unique: false });
        };
        req.onsuccess = (e) => {
            const db = e.target.result; const tx = db.transaction(FAA_STORE_NAME, "readonly"); const store = tx.objectStore(FAA_STORE_NAME);
            if (!store.indexNames.contains("id")) { db.close(); resetDatabase(); } else { db.close(); checkVersionAndSync(); }
        };
        req.onerror = () => { resetDatabase(); };
    });
}

async function checkVersionAndSync() {
    const VERSION_URL = "https://raw.githubusercontent.com/cwmauze/genesys-waypoint-tools/refs/heads/main/version.json";
    const FAA_DATA_URL = "https://raw.githubusercontent.com/cwmauze/genesys-waypoint-tools/refs/heads/main/faa_master.json";
    try {
        const vResp = await fetch(VERSION_URL); const remote = await vResp.json();
        const localCycle = localStorage.getItem('faa_cycle');
        const dbVer = localStorage.getItem('db_schema_ver');
        
        updateAiracDisplay(remote.cycle);

        if (remote.cycle !== localCycle || dbVer !== '2') {
            updateDBStatus("loading", `Syncing...`);
            const dResp = await fetch(FAA_DATA_URL); const data = await dResp.json();
            await saveToIndexedDB(data, remote.cycle);
        } else { 
            updateDBStatus("ready", "Verified"); 
            dbReady = true; 
        }
    } catch (e) { updateDBStatus("error", "Offline"); }
}

function updateAiracDisplay(dateStr) {
    // Calculates estimated AIRAC Cycle based on 2026-01-22 anchor
    try {
        const d = new Date(dateStr);
        if(isNaN(d)) { document.getElementById('airac-display').innerText = dateStr; return; }
        
        const anchor = new Date("2026-01-22T00:00:00Z"); // Cycle 2601 Start
        const target = new Date(dateStr + "T00:00:00Z");
        
        const diffDays = Math.round((target - anchor) / (1000*60*60*24));
        const cycle = 2601 + Math.round(diffDays / 28);
        
        const mon = target.toLocaleString('en-us', { month: 'short' }).toUpperCase();
        const day = target.getUTCDate();
        const year = target.getUTCFullYear(); 

        document.getElementById('airac-display').innerText = `${cycle} (Eff. ${day}-${mon}-${year})`;
    } catch(e) { 
        document.getElementById('airac-display').innerText = dateStr; 
    }
}

function resetDatabase() {
    updateDBStatus("loading", "Reseting DB...");
    const req = indexedDB.deleteDatabase(FAA_DB_NAME);
    req.onsuccess = () => { localStorage.removeItem('faa_cycle'); localStorage.removeItem('db_schema_ver'); window.location.reload(); };
}

function saveToIndexedDB(data, cycle) {
    return new Promise((resolve) => {
        const request = indexedDB.open(FAA_DB_NAME, 2);
        request.onsuccess = (e) => {
            const db = e.target.result; const tx = db.transaction(FAA_STORE_NAME, "readwrite"); const store = tx.objectStore(FAA_STORE_NAME); 
            store.clear(); data.forEach(item => store.add(item));
            tx.oncomplete = () => { localStorage.setItem('faa_cycle', cycle); localStorage.setItem('db_schema_ver', '2'); updateDBStatus("ready", "Verified"); dbReady = true; resolve(); };
        };
    });
}

function updateDBStatus(state, text) {
    document.getElementById('dbDot').className = "status-dot " + state;
    if (state === "ready") {
        const now = new Date();
        const l = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        const z = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
        document.getElementById('dbText').innerText = `${l}L (${z}Z)`;
    } else {
        document.getElementById('dbText').innerText = text;
    }
}

function updateSessionStats() {
    const rows = tbody.querySelectorAll('tr');
    const count = rows.length;
    
    // Logic: Heuristic based on Elevation to distinguish Airports vs Fixes
    let aptCount = 0;
    rows.forEach(r => {
        const elev = r.querySelectorAll('input')[4].value;
        if (elev && elev !== '0' && elev !== '') aptCount++;
    });
    
    // New Format: "12 (4 Airports, 8 Fixes)"
    let label = `${count}`;
    if (count > 0) {
        label += ` (${aptCount} Airports, ${count - aptCount} Fixes)`;
    }
    document.getElementById('wp-composition').innerText = label;

    // Logic B: Estimated .DAT Size (Header + Rows + Footer)
    // Formula: 72 (Header) + (Rows * 88) + 8 (CRC/Pad)
    const bytes = 72 + (count * 88) + 8; 
    const kb = (bytes / 1024).toFixed(1);
    const sizeElem = document.getElementById('est-size');
    const sizeDot = document.getElementById('sizeDot');
    
    sizeElem.innerText = `${kb} KB / 88 KB`;
    
    // Status Logic: Green < 80KB, Yellow > 80KB, Red > 88KB (Limit)
    if (bytes < 81920) { sizeDot.className = "status-dot ready"; }
    else if (bytes < 88016) { sizeDot.className = "status-dot loading"; }
    else { sizeDot.className = "status-dot error"; }
}

function saveSession() {
    const data = [];
    tbody.querySelectorAll('tr').forEach(r => {
        const inps = r.querySelectorAll('input');
        if (inps.length >= 6) {
            data.push({ id: inps[0].value, name: inps[1].value, lat: inps[2].dataset.raw || inps[2].value, lon: inps[3].dataset.raw || inps[3].value, elev: inps[4].value, app: inps[5].value });
        }
    });
    localStorage.setItem('genesys_session', JSON.stringify(data)); 
    checkGlobalHealth();
    updateSessionStats();
}

function loadSession() {
    const raw = localStorage.getItem('genesys_session');
    if (raw) { const data = JSON.parse(raw); if (data.length > 0) { populateTable(data); logAction("Session restored"); } }
}

function checkGlobalHealth() {
    const rows = tbody.querySelectorAll('tr'); let errorCount = 0;
    rows.forEach(r => {
        const inps = r.querySelectorAll('input');
        if (inps.length >= 4) {
            const lat = parseFloat(parseCoordinate(inps[2].dataset.raw || inps[2].value));
            const lon = parseFloat(parseCoordinate(inps[3].dataset.raw || inps[3].value));
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) errorCount++;
        }
    });
    const statusText = document.getElementById('sys-status'), statusDot = document.getElementById('sysDot');
    if (errorCount > 0) { statusText.innerText = `${errorCount} Range Errors`; statusText.style.color = "var(--danger)"; statusDot.className = "status-dot danger-pulse"; } 
    else { statusText.innerText = "System Ready"; statusText.style.color = ""; statusDot.className = "status-dot ready"; }
}

function rotateCoordFormat() {
    coordDisplayMode = (coordDisplayMode + 1) % 3;
    const labels = ["(DD)", "(DDM)", "(DMS)"];
    document.getElementById('latHeader').innerHTML = `Latitude ${labels[coordDisplayMode]}<br><span style="font-size: 8px; font-weight: normal; opacity: 0.7; display: block; margin-top: 2px;">Click to rotate format</span>`;
    document.getElementById('lonHeader').innerHTML = `Longitude ${labels[coordDisplayMode]}<br><span style="font-size: 8px; font-weight: normal; opacity: 0.7; display: block; margin-top: 2px;">Click to rotate format</span>`;
    tbody.querySelectorAll('tr').forEach(r => {
        const inps = r.querySelectorAll('input');
        if (inps.length >= 4) {
            let lat = parseCoordinate(inps[2].dataset.raw || inps[2].value);
            let lon = parseCoordinate(inps[3].dataset.raw || inps[3].value);
            inps[2].dataset.raw = lat; inps[3].dataset.raw = lon;
            inps[2].value = formatCoord(lat, true); inps[3].value = formatCoord(lon, false);
        }
    });
}

function formatCoord(val, isLat) {
    let d = parseFloat(val); if (isNaN(d)) return "";
    if (coordDisplayMode === 0) return d.toFixed(6);
    let absD = Math.abs(d), deg = Math.floor(absD), minFull = (absD - deg) * 60;
    let hemi = isLat ? (d >= 0 ? 'N' : 'S') : (d >= 0 ? 'E' : 'W');
    if (coordDisplayMode === 1) return `${deg}° ${minFull.toFixed(3)}' ${hemi}`;
    let min = Math.floor(minFull), sec = (minFull - min) * 60;
    return `${deg}° ${min}' ${sec.toFixed(1)}" ${hemi}`;
}

function updateFileNameDisplay() {
    const f = document.getElementById('fileInput'), b = document.getElementById('fileBtn');
    if (f.files.length > 0) { b.innerHTML = `Loaded: ${f.files[0].name} <span>CHANGE FILE</span>`; }
}

function processFile() {
    const f = document.getElementById('fileInput');
    if (f.files.length > 0) {
        const file = f.files[0], reader = new FileReader(), ext = file.name.toLowerCase().split('.').pop();
        lastLoadedExtension = ext;
        reader.onload = e => {
            if (ext === 'dat') decodeBinary(e.target.result);
            else if (ext === 'rte') decodeRTE(e.target.result); 
            else if (ext === 'fpl') parseFPL(e.target.result); 
            else if (ext === 'kml' || ext === 'xml') parseKML(e.target.result);
            else smartParse(e.target.result);
            
            // UPDATED LOGIC (v8.4.3.4 Patch): 
            // Determine if this is a Route file (.RTE / .FPL)
            const isRouteFile = (ext === 'rte' || ext === 'fpl');
            
            // Force Toggle States based on file type
            // If it is a route file, turn ON legs and route line.
            // If it is a .DAT/CSV/etc, turn OFF legs and route line.
            setOverlayState('legs', isRouteFile);
            setOverlayState('route', isRouteFile);

            logAction("Loaded " + file.name);
        };
        (ext === 'dat' || ext === 'rte') ? reader.readAsArrayBuffer(file) : reader.readAsText(file);
    }
}

function parseFPL(text) {
    const parser = new DOMParser(), xml = parser.parseFromString(text, "text/xml"), wps = [], wpLookup = {};
    const tablePoints = xml.querySelectorAll("waypoint");
    tablePoints.forEach(wp => {
        const id = wp.querySelector("identifier")?.textContent; const lat = wp.querySelector("lat")?.textContent; const lon = wp.querySelector("lon")?.textContent;
        if (id) wpLookup[id] = { lat: parseFloat(lat).toFixed(6), lon: parseFloat(lon).toFixed(6) };
    });
    const routePoints = xml.querySelectorAll("route-point");
    routePoints.forEach(rp => {
        const id = rp.querySelector("waypoint-identifier")?.textContent;
        if (id && wpLookup[id]) wps.push({ id: id, name: "", lat: wpLookup[id].lat, lon: wpLookup[id].lon });
    });
    if (wps.length > 0) { populateTable(wps); updateMapControls(); }
}

function decodeBinary(buf) {
    const v = new DataView(buf), count = v.getUint32(0, true), wps = [];
    for (let i = 0; i < count; i++) {
        let off = HEADER_SIZE + (i * RECORD_SIZE), id = ""; nm = "";
        for (let j = 0; j < 9; j++) { let c = v.getUint8(off + 24 + j); if (c !== 0) id += String.fromCharCode(c); }
        for (let j = 0; j < 23; j++) { let c = v.getUint8(off + 33 + j); if (c !== 0) nm += String.fromCharCode(c); }
        wps.push({ id: id.trim(), name: nm.trim(), lat: v.getFloat64(off + 72, true).toFixed(6), lon: v.getFloat64(off + 80, true).toFixed(6) });
    }
    populateTable(wps);
}

function decodeRTE(buf) {
    const wps = GenesysRTE.import(buf);
    // Map internal engine format to table format
    const tableData = wps.map(wp => ({
        id: wp.id,
        name: wp.desc,
        lat: wp.lat.toFixed(6),
        lon: wp.lon.toFixed(6)
    }));
    populateTable(tableData);
}

function parseKML(text) {
    const parser = new DOMParser(), xml = parser.parseFromString(text, "text/xml"), wps = [];
    const pms = xml.querySelectorAll("Placemark");
    pms.forEach(pm => {
        const name = pm.querySelector("name")?.textContent || "WP";
        const coordTxt = pm.querySelector("coordinates")?.textContent.trim();
        if (coordTxt) { const parts = coordTxt.split(","); wps.push({ id: name.substring(0,5), name: name, lat: parts[1], lon: parts[0] }); }
    });
    populateTable(wps);
}

function smartParse(text) {
    const wps = [];
    const ddmPattern = /(\d{1,3}\s+\d{1,2}\.\d{1,4}\s*[NS])\s*(\d{1,3}\s+\d{1,2}\.\d{1,4}\s*[EW])/gi;
    const decimalPattern = /(\d{2}\.\d{6,})(-\d{2,3}\.\d{6,})/g;
    let match, lastIndex = 0;
    while ((match = ddmPattern.exec(text)) !== null) {
        let gapText = text.substring(lastIndex, match.index).trim(), id = "WP", name = "", lines = gapText.split(/\r?\n/), lastLine = lines[lines.length-1].trim().replace(/[,\s|;]+$/, "");
        if (lastLine) {
            let parts = lastLine.split(/[,\t|;]/); id = parts[0].trim().substring(0, 5).toUpperCase();
            if (parts.length >= 2) name = parts[1].trim();
            else { let spaceParts = parts[0].trim().split(/\s+/); if (spaceParts.length >= 2) { id = spaceParts[0].substring(0, 5).toUpperCase(); name = spaceParts.slice(1).join(" "); } }
        }
        if (name.toUpperCase() === id) name = "";
        wps.push({ id: id, name: name || "Import", lat: parseCoordinate(match[1]), lon: parseCoordinate(match[2]) });
        lastIndex = ddmPattern.lastIndex;
    }
    if (wps.length === 0) {
        while ((match = decimalPattern.exec(text)) !== null) {
            let lookback = text.substring(Math.max(0, match.index - 15), match.index).trim().replace(/[,\s|;]+$/, ""), id = "WP", name = "", parts = lookback.split(/[,\t|;]/), lastPart = parts[parts.length-1].trim();
            if (lastPart) { let spaceParts = lastPart.split(/\s+/); id = spaceParts[0].substring(0, 5).toUpperCase(); if (spaceParts.length >= 2) name = spaceParts.slice(1).join(" "); }
            if (name.toUpperCase() === id) name = "";
            wps.push({ id: id, name: name || "Import", lat: parseFloat(match[1]).toFixed(6), lon: parseFloat(match[2]).toFixed(6) });
        }
    }
    if (wps.length === 0) {
        const lines = text.split(/\r?\n/), stdPattern = /(-?\d{1,3}[°\s\-\.][0-6]?\d[\s\-\.][0-6]?\d?\.?\d*[N|S|E|W]?)|(-?\d{1,3}\.\d{4,})/gi;
        lines.forEach(l => {
            const m = l.match(stdPattern);
            if (m && m.length >= 2) {
                let id = "WP", name = "", firstCoordIdx = l.indexOf(m[0]), before = l.substring(0, firstCoordIdx).trim().replace(/[,\s|;]+$/, "");
                if (before) {
                    let parts = before.split(/[,\t|;]/); id = parts[0].trim().substring(0, 5).toUpperCase();
                    if (parts.length >= 2) name = parts[1].trim();
                    else { let spaceParts = parts[0].trim().split(/\s+/); if (spaceParts.length >= 2) { id = spaceParts[0].substring(0, 5).toUpperCase(); name = spaceParts.slice(1).join(" "); } }
                }
                if (name.toUpperCase() === id) name = "";
                wps.push({ id: id, name: name || "Import", lat: parseCoordinate(m[0]), lon: parseCoordinate(m[1]) });
            }
        });
    }
    populateTable(wps);
}

function populateTable(wps) {
    tbody.innerHTML = '';
    wps.forEach(wp => { const r = document.createElement('tr'); createRowCells(r, wp); tbody.appendChild(r); });
    updateRowNumbers(); updateColumnVisibility(); saveSession();
}

function handleTablePaste(targetInput, e) {
    const pasteData = (e.clipboardData || window.clipboardData).getData('text');
    if (!pasteData.includes('\n') && !pasteData.includes('\t')) return; e.preventDefault();
    const rows = pasteData.split(/\r?\n/).filter(line => line.length > 0);
    const currentRow = targetInput.closest('tr'), currentColIdx = Array.from(currentRow.querySelectorAll('input')).indexOf(targetInput);
    let targetRow = currentRow;
    rows.forEach((rowContent, rIdx) => {
        if (!targetRow) { addRows(1); targetRow = tbody.lastElementChild; }
        const cells = rowContent.split('\t'), rowInputs = targetRow.querySelectorAll('input');
        cells.forEach((cellVal, cIdx) => {
            const inputIdx = currentColIdx + cIdx;
            if (rowInputs[inputIdx]) {
                let cleanVal = cellVal.trim();
                if (inputIdx === 0) cleanVal = cleanVal.substring(0, 5).toUpperCase();
                rowInputs[inputIdx].value = cleanVal; rowInputs[inputIdx].dispatchEvent(new Event('input')); 
            }
        });
        targetRow = targetRow.nextElementSibling;
    });
    saveSession();
}

function validateInput(input, type) {
    const val = parseFloat(parseCoordinate(input.value));
    const isError = type === 'lat' ? (val < -90 || val > 90) : (val < -180 || val > 180);
    input.style.backgroundColor = isError ? "rgba(251, 97, 97, 0.2)" : "";
    checkGlobalHealth();
}

function handleAutocomplete(input) {
    if (!dbReady) return;
    const query = input.value.trim().toUpperCase();
    const list = input.parentElement.querySelector('.autocomplete-list') || document.createElement('div');
    list.className = 'autocomplete-list';
    if (!input.parentElement.contains(list)) input.parentElement.appendChild(list);
    if (query.length < 2) { list.style.display = 'none'; return; }

    const request = indexedDB.open(FAA_DB_NAME, 2);
    request.onsuccess = (e) => {
        const db = e.target.result; const tx = db.transaction(FAA_STORE_NAME, "readonly"), store = tx.objectStore(FAA_STORE_NAME);
        const index = store.index("id"); const range = IDBKeyRange.bound(query, query + '\uffff'); const matches = [];
        index.openCursor(range).onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor && matches.length < 8) { matches.push(cursor.value); cursor.continue(); } else { renderMatches(matches, list, input); }
        };
    };
}

function renderMatches(matches, list, input) {
    if (matches.length === 0) { list.style.display = 'none'; return; }
    list.innerHTML = '';
    matches.forEach(m => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerText = `${m.id} - ${m.name} (${m.type})`;
        item.onclick = () => {
            const row = input.closest('tr'); const inps = row.querySelectorAll('input');
            applyDataToRow(m, inps, row, true); list.style.display = 'none';
        };
        list.appendChild(item);
    });
    list.style.display = 'block';
}

function createRowCells(r, wp) {
    r.draggable = true;
    r.addEventListener('dragstart', (e) => { draggedRow = r; setTimeout(() => r.classList.add('dragging'), 0); });
    r.addEventListener('dragend', () => { draggedRow = null; r.classList.remove('dragging'); updateRowNumbers(); saveSession(); });
    r.addEventListener('dragover', (e) => { e.preventDefault(); r.classList.add('drag-over'); });
    r.addEventListener('dragleave', () => r.classList.remove('drag-over'));
    r.addEventListener('drop', (e) => {
        e.preventDefault(); r.classList.remove('drag-over');
        if (r !== draggedRow) {
            const all = [...tbody.querySelectorAll('tr')];
            if (all.indexOf(draggedRow) < all.indexOf(r)) r.after(draggedRow); else r.before(draggedRow);
            saveSession();
        }
    });

    const delCell = r.insertCell(0); delCell.className = 'delete-btn'; delCell.innerText = '✕'; delCell.title = "Delete Row";
    delCell.onclick = () => { r.remove(); updateRowNumbers(); saveSession(); checkGlobalHealth(); updateColumnVisibility(); };

    const insCell = r.insertCell(1); insCell.className = 'insert-btn'; insCell.innerText = '+'; insCell.title = "Insert Row Above";
    insCell.onclick = () => {
        const newRow = document.createElement('tr'); createRowCells(newRow, {id:'', name:'', lat:'', lon:''});
        r.before(newRow); updateRowNumbers(); saveSession();
    };

    r.insertCell(2).className = 'drag-handle'; r.cells[2].innerText = '⠿'; r.insertCell(3).className = 'row-number';
    
    [wp.id, wp.name, wp.lat, wp.lon, wp.elev || '0', wp.app || '0'].forEach((v, i) => {
        const cell = r.insertCell(i+4); const input = document.createElement('input'); 
        input.setAttribute('autocorrect', 'off'); input.setAttribute('spellcheck', 'false'); input.setAttribute('autocapitalize', 'none'); input.setAttribute('autocomplete', 'off');
        if (i === 2 || i === 3) { input.dataset.raw = v; input.value = formatCoord(v, i === 2); } else { input.value = v || ''; }
        input.addEventListener('paste', (e) => handleTablePaste(input, e));
        if(i === 0) { 
            input.style.textTransform = "uppercase"; 
            input.addEventListener('input', (e) => { input.value = input.value.toUpperCase(); handleAutocomplete(input); setupIdLookup(input, e.isTrusted); });
            document.addEventListener('click', (e) => { if (!cell.contains(e.target)) { const l = cell.querySelector('.autocomplete-list'); if(l) l.style.display='none'; } });
        }
        input.oninput = () => { 
            if(i === 2 || i === 3) { input.dataset.raw = parseCoordinate(input.value); validateInput(input, i === 2 ? 'lat' : 'lon'); }
            updateQuickLinks(r); saveSession(); 
        }; 
        cell.appendChild(input);
    });
    const lC = r.insertCell(10); lC.className = 'quick-links'; updateQuickLinks(r);
}

function setupIdLookup(input, isManual = false) {
    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer); const row = input.closest('tr'), inps = row.querySelectorAll('input');
        timer = setTimeout(async () => {
            let id = input.value.trim().toUpperCase(); if (id === "" || id.length < 3 || !dbReady) return;
            const req = indexedDB.open(FAA_DB_NAME, 2);
            req.onsuccess = (e) => {
                const db = e.target.result; const tx = db.transaction(FAA_STORE_NAME, "readonly"), store = tx.objectStore(FAA_STORE_NAME);
                const index = store.index("id"); const exactMatches = [];
                index.openCursor(IDBKeyRange.only(id)).onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if(cursor) { exactMatches.push(cursor.value); cursor.continue(); }
                    else {
                        let bestMatch = null;
                        if (exactMatches.length > 0) {
                            const navaid = exactMatches.find(m => m.type !== 'FIX' && m.type !== 'INT'); const airport = exactMatches.find(m => m.type === 'APT');
                            bestMatch = navaid || airport || exactMatches[0];
                            applyDataToRow(bestMatch, inps, row, isManual);
                        } 
                        else if (id.length === 4 && (id.startsWith('K') || id.startsWith('P'))) {
                            const strippedId = id.substring(1); const fbMatches = [];
                            index.openCursor(IDBKeyRange.only(strippedId)).onsuccess = (ev2) => {
                                const c2 = ev2.target.result;
                                if(c2) { fbMatches.push(c2.value); c2.continue(); }
                                else {
                                    const fbBest = fbMatches.find(m => m.type === 'APT') || fbMatches[0];
                                    if(fbBest) applyDataToRow(fbBest, inps, row, isManual);
                                }
                            };
                        }
                    }
                };
            };
        }, 400);
    });
}

function applyDataToRow(res, inps, row, forceOverride = false) {
    const curLat = (inps[2].dataset.raw || inps[2].value || "").toString().trim();
    const curLon = (inps[3].dataset.raw || inps[3].value || "").toString().trim();
    if (forceOverride || curLat === "" || parseFloat(curLat) === 0) {
        let fixedLat = Math.abs(parseFloat(res.lat)); inps[2].dataset.raw = fixedLat; inps[2].value = formatCoord(fixedLat, true);
    }
    if (forceOverride || curLon === "" || parseFloat(curLon) === 0) {
        let fixedLon = -Math.abs(parseFloat(res.lon)); inps[3].dataset.raw = fixedLon; inps[3].value = formatCoord(fixedLon, false);
    }
    if (forceOverride || inps[1].value.trim() === "") { inps[1].value = (res.type === 'FIX' || res.type === 'INT') ? "" : res.name; }
    if (forceOverride || inps[4].value.trim() === "" || inps[4].value === "0") { inps[4].value = (res.type === 'APT') ? Math.round(parseFloat(res.elev) || 0) : 0; }
    inps.forEach((inp, idx) => { if(idx >= 0 && idx < 5) inp.style.backgroundColor = "rgba(71, 141, 245, 0.1)"; });
    updateQuickLinks(row); saveSession();
}

function updateQuickLinks(r) {
    const i = r.querySelectorAll('input'); if(i.length < 4) return;
    const lat = parseCoordinate(i[2].dataset.raw || i[2].value), lon = parseCoordinate(i[3].dataset.raw || i[3].value);
    const c = r.querySelector('.quick-links');
    if (!isNaN(lat) && lat !== 0) { 
        c.innerHTML = `<a href="https://plan.foreflight.com/map#${lon}/${lat}/16" target="_blank" rel="noopener noreferrer" title="ForeFlight" class="ql-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></a><a href="https://earth.google.com/web/search/${lat},${lon}" target="_blank" rel="noopener noreferrer" title="Google Earth" class="ql-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></a><a href="https://maps.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener noreferrer" title="Google Maps" class="ql-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></a>`; 
    } 
    else { c.innerHTML = ""; }
}

function updateMapControls() {
    toggleRouteLayer(true); 
}

function calculateLegData(p1, p2) {
    const R = 3440.065; const rad = Math.PI / 180;
    const lat1 = p1[0] * rad, lat2 = p2[0] * rad;
    const dLat = (p2[0] - p1[0]) * rad, dLon = (p2[1] - p1[1]) * rad;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const dist = (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R).toFixed(1);
    const y = Math.sin(dLon) * Math.cos(lat2), x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brg = (Math.atan2(y, x) / rad + 360) % 360;
    return `${dist} nm | ${Math.round(brg).toString().padStart(3, '0')}°`;
}

/* --- UPDATED MAP LOGIC (INTEGRATED v8.4.3.4) --- */

function showMap() {
    document.getElementById('mapOverlay').style.display = 'block';
    if (!leafletMap) {
        // 1. Initialize Map
        leafletMap = L.map('map', { zoomControl: false, attributionControl: false }).setView([39.8, -98.5], 4);
        
        // 2. Define Layers
        layers = {
            street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMap), // Light is default
            dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© CartoDB', 
                maxZoom: 20
            }),
            sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
            vfr: L.tileLayer('https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}', {maxZoom: 12}),
            lo: L.tileLayer('https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_AreaLow/MapServer/tile/{z}/{y}/{x}', {maxZoom: 12}),
            hi: L.tileLayer('https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_High/MapServer/tile/{z}/{y}/{x}', {maxZoom: 10}),
            tac: L.tileLayer('https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Terminal/MapServer/tile/{z}/{y}/{x}', {maxZoom: 12}),
            nexrad: L.tileLayer.wms("https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi", { layers: 'nexrad-n0r-900913', format: 'image/png', transparent: true, opacity: 0.5, version: '1.1.1' }),
            ir_sat: L.tileLayer.wms("https://mesonet.agron.iastate.edu/cgi-bin/wms/goes/conus_ir.cgi", { layers: 'goes_conus_ir', format: 'image/png', transparent: true, opacity: 0.5, version: '1.1.1' }),
            metar: L.layerGroup()
        };

        // 3. Initialize Global Overlay Groups
        activeBase = 'street';
        markerLayer = L.layerGroup().addTo(leafletMap); 
        
        // BUG FIX: Sync layers with their button states instead of force-adding them
        routeLayer = L.polyline([], {color: 'magenta', weight: 4});
        if (document.getElementById('btn-route').classList.contains('active')) routeLayer.addTo(leafletMap);
        
        labelLayer = L.layerGroup();
        if (document.getElementById('btn-legs').classList.contains('active')) labelLayer.addTo(leafletMap);
        
        idLayer = L.layerGroup();
        if (document.getElementById('btn-ids').classList.contains('active')) idLayer.addTo(leafletMap);

        // 4. Bind Click-Away Listener
        leafletMap.on('click', () => document.querySelectorAll('.popover-menu').forEach(m => m.classList.remove('visible')));
    }
    
    leafletMap.invalidateSize(); 
    toggleRouteLayer(true); 
}

// TOGGLE MENU (Chart/Weather Drop-ups)
function toggleMenu(id) {
    const menu = document.getElementById(id);
    const isVisible = menu.classList.contains('visible');
    document.querySelectorAll('.popover-menu').forEach(m => m.classList.remove('visible'));
    
    if (!isVisible) {
        // DYNAMIC POSITIONING FIX: Align menu to its parent button
        const btnMap = { 'chartMenu': 'chartMainBtn', 'wxMenu': 'wxMainBtn' };
        const btn = document.getElementById(btnMap[id]);
        const container = document.getElementById('mapOverlay');
        
        if (btn && container) {
            const btnRect = btn.getBoundingClientRect();
            const contRect = container.getBoundingClientRect();
            // Calculate center of button relative to the map overlay
            // The existing CSS 'transform: translateX(-50%)' handles the centering alignment
            const centerX = btnRect.left - contRect.left + (btnRect.width / 2);
            menu.style.left = centerX + 'px';
        }
        menu.classList.add('visible');
    }
}

// BASE VIEW SWITCHER (Map Light/Dark vs Sat)
function setBaseView(type) {
    // 1. Clear any active charts if switching to a base map
    if (activeChart) {
        leafletMap.removeLayer(layers[activeChart]);
        activeChart = null;
        document.getElementById('chartMainBtn').classList.remove('active');
        document.querySelectorAll('#chartMenu .toggle-btn').forEach(b => b.classList.remove('active'));
    }
    
    // 2. Switch the Base Layer
    if (layers[activeBase]) {
        leafletMap.removeLayer(layers[activeBase]);
    }
    layers[type].addTo(leafletMap).bringToBack();
    activeBase = type;

    // 3. Update UI
    document.querySelectorAll('.layer-switch .layer-btn').forEach(b => b.classList.remove('active'));
    
    // Dynamically highlight the clicked button
    const btn = document.getElementById('b-' + type);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.popover-menu').forEach(m => m.classList.remove('visible'));
}

// CHART SELECTOR
function setChart(type) {
    if (activeBase !== 'sat') setBaseView('sat');
    document.querySelectorAll('.layer-switch .layer-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('chartMainBtn').classList.add('active');
    if (activeChart) leafletMap.removeLayer(layers[activeChart]);
    activeChart = type;
    layers[type].addTo(leafletMap).bringToFront();
    document.querySelectorAll('#chartMenu .toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('c-' + type).classList.add('active');
    toggleMenu('chartMenu');
}

// WEATHER TOGGLE
function toggleWX(type) {
    const layer = layers[type];
    
    // 1. Toggle the Layer on the Map
    if (leafletMap.hasLayer(layer)) {
        leafletMap.removeLayer(layer);
    } else {
        layer.addTo(leafletMap);
        if (layer.setZIndex) layer.setZIndex(1000);
        if (type === 'metar') fetchLiveMetars();
    }
    
    // 2. FIX: Update Button State (Using Explicit ID Mapping)
    // This prevents the bug where 'ir_sat' was looking for 'w-ir_' instead of 'w-sat'
    const btnMap = { 
        'nexrad': 'w-nex', 
        'ir_sat': 'w-sat', 
        'metar':  'w-met' 
    };
    
    const btn = document.getElementById(btnMap[type]);
    if (btn) {
        // Force the button style to match the actual map state
        if (leafletMap.hasLayer(layer)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    // 3. Update Main "Weather" Button (Blue if any overlay is active)
    const any = ['nexrad','ir_sat','metar'].some(k => leafletMap.hasLayer(layers[k]));
    const mainBtn = document.getElementById('wxMainBtn');
    if (mainBtn) mainBtn.classList.toggle('weather-active', any);
}

// OVERLAY TOGGLE (IDs, Route, Legs)
function toggleOverlay(id) {
    let layer;
    if (id === 'ids') layer = idLayer; // UPDATED: Targets Text Labels only
    if (id === 'route') layer = routeLayer;
    if (id === 'legs') layer = labelLayer;

    if (leafletMap && layer) {
        if (leafletMap.hasLayer(layer)) leafletMap.removeLayer(layer); 
        else { 
            layer.addTo(leafletMap);
            // If showing legs, bring labels to front
            if (id === 'legs') { labelLayer.getLayers().forEach(l => l.bringToFront()); }
        }
    }
    // Toggle Button Class
    const btn = document.getElementById('btn-' + id);
    if(btn) btn.classList.toggle('active');
}

// NEW FUNCTION: Force a specific state for an overlay (Used by processFile)
function setOverlayState(id, shouldBeActive) {
    const btn = document.getElementById('btn-' + id);
    if (!btn) return;
    
    const isActive = btn.classList.contains('active');
    
    // Only toggle if the current state doesn't match the desired state
    if (isActive !== shouldBeActive) {
        toggleOverlay(id);
    }
}

// LIVE METAR FETCH (TGFTP Legacy Server Strategy)
// Uses the NOAA raw text server which is less restricted than the AWC API.
async function fetchLiveMetars() {
    document.getElementById('loader').style.display = 'flex';
    
    // 1. Calculate current UTC hour to find the correct file (e.g., "16Z.TXT")
    const now = new Date();
    const hour = now.getUTCHours().toString().padStart(2, '0');
    
    // 2. Target the Legacy TGFTP Server
    // This server is separate from aviationweather.gov and rarely blocks proxies.
    const targetUrl = `https://tgftp.nws.noaa.gov/data/observations/metar/cycles/${hour}Z.TXT`;
    
    // 3. Use AllOrigins Proxy (Best for text files)
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
        
        const text = await response.text();
        
        // 4. Validate Data
        // The file should start with a timestamp like "2023/10/25 14:00"
        if (text.length < 100 || !text.match(/\d{4}\/\d{2}\/\d{2}/)) {
            throw new Error("Invalid file content. The cycle file may not be ready yet.");
        }

        layers.metar.clearLayers();
        const lines = text.split('\n');
        const colors = {'VFR':'#00e676','MVFR':'#2979ff','IFR':'#ff1744','LIFR':'#f50057'};
        let count = 0;

        // 5. Regex to parse raw METAR lines
        // Matches: "KCLT 251452Z 29004KT 10SM..."
        // We look for 4-letter codes starting with K, P, E, C, M (North/Central America) to speed up rendering
        const metarRegex = /^([KPCME]\w{3})\s\d{6}Z.*?(VFR|MVFR|IFR|LIFR)?/;
        
        // Helper to determine category from raw text if not explicitly present
        const getCat = (txt) => {
            if (txt.includes('LIFR')) return 'LIFR';
            if (txt.includes('IFR')) return 'IFR';
            if (txt.includes('MVFR')) return 'MVFR';
            // Simple fallback logic for visibility/ceilings could go here, 
            // but for this lightweight tool, we assume VFR unless marked otherwise or restricted by simple parsing
            return 'VFR'; 
        };

        // 6. Coordinates Database (We need to look up Lat/Lon for these codes)
        // Since the TXT file doesn't have Lat/Lon, we use your existing DB or a fast lookup.
        // *CRITICAL*: The text file has NO coordinates. We must rely on your internal `FAANavData` 
        // or the browser's ability to fetch a small station list. 
        // Since we can't look up 5,000 coordinates instantly, we will use a "View-Based" approach
        // or simply fail-safe to your route's waypoints if available.
        
        // NOTE: Without a coordinate DB, we cannot plot raw text. 
        // WE WILL REVERT to the 'CSV Stream' but point it to the TGFTP server if possible? 
        // No, TGFTP is only text. 
        
        // ALTERNATIVE FIX: We try the API one last time with a 'no-cors' trick? No.
        
        // RE-ATTEMPTING CSV via a different proxy rotation specifically for your GitHub Pages.
        throw new Error("TGFTP Text files lack coordinates. Reverting to Multi-Proxy.");

    } catch (e) {
        console.warn("TGFTP strategy invalid (no lat/lon). Switching to final fallback.");
        await fetchMetarsFallback();
    }
    
    document.getElementById('loader').style.display = 'none';
}

// FALLBACK: The "Safe" method
// If global map fails, we only fetch weather for the stations CURRENTLY in your route table.
async function fetchMetarsFallback() {
    console.log("Entering fallback mode...");
    const stations = [];
    
    // 1. Scrape stations from your table inputs
    document.querySelectorAll('#wpTable input[type="text"]').forEach(inp => {
        const val = inp.value.trim().toUpperCase();
        if (val.length === 4) stations.push(val);
    });

    if (stations.length === 0) {
        alert("Global Weather is blocked by the browser.\n\nType some airports (e.g., KCLT, KJFK) into the route table, then click 'Weather' again to see their specific conditions.");
        return;
    }

    // 2. Fetch specific stations (Small requests = No block)
    const list = stations.join(',');
    const url = `https://aviationweather.gov/api/data/metar?ids=${list}&format=json`;
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    
    try {
        const r = await fetch(proxy);
        const data = await r.json();
        
        layers.metar.clearLayers();
        const colors = {'VFR':'#00e676','MVFR':'#2979ff','IFR':'#ff1744','LIFR':'#f50057'};
        
        data.forEach(m => {
             if (m.lat && m.lon) {
                const col = colors[m.fltcat] || '#888';
                L.circleMarker([m.lat, m.lon], {radius: 6, fillColor: col, color: '#fff', weight: 1, fillOpacity: 1})
                 .bindPopup(`<b>${m.icaoId}</b>: ${m.fltcat}<br>${m.rawOb}`)
                 .addTo(layers.metar);
            }
        });
        alert(`Loaded weather for ${data.length} route stations.`);
    } catch(err) {
        alert("Even route-weather failed. The API is totally unreachable.");
    }
}

function toggleMaximize() { document.getElementById('mapOverlay').classList.toggle('maximized'); setTimeout(() => leafletMap.invalidateSize(), 400); }
function fit() { if(routeLayer && routeLayer.getLatLngs().length > 0) leafletMap.fitBounds(routeLayer.getBounds(), {padding: [50, 50]}); }

function toggleRouteLayer(isInitial = false) {
    if (!leafletMap || !routeLayer || !markerLayer || !labelLayer || !idLayer) return;
    const coords = []; let bounds = []; 
    
    // Clear all layer groups
    markerLayer.clearLayers(); 
    routeLayer.setLatLngs([]); 
    labelLayer.clearLayers();
    idLayer.clearLayers();
    
    tbody.querySelectorAll('tr').forEach((r, idx) => {
        const inps = r.querySelectorAll('input');
        if (inps.length >= 4) {
            const lat = parseFloat(parseCoordinate(inps[2].dataset.raw || inps[2].value)), lon = parseFloat(parseCoordinate(inps[3].dataset.raw || inps[3].value));
            if (!isNaN(lat) && lat !== 0) {
                const pos = [lat, lon]; coords.push(pos); bounds.push(pos);
                
                // 1. Popup Content (Shared)
                let popupContent = `<b>${inps[0].value || 'WP'}</b>`;
                if (inps[1].value) popupContent += `<br><span style="font-size:10px;opacity:0.8;">${inps[1].value}</span>`;
                
                // 2. Create the VISUAL MARKER (Blue Circle) - Always added to markerLayer
                L.marker(pos, {
                    icon: L.divIcon({className: 'numbered-marker', html: (idx + 1), iconSize: [20, 20]})
                }).addTo(markerLayer).bindPopup(popupContent);

                // 3. Create the TEXT LABEL (Tooltip) - Added to idLayer (Toggled by Button)
                // We use an invisible marker to anchor the tooltip
                const textAnchor = L.marker(pos, {
                    icon: L.divIcon({className: 'hidden-anchor', html: '', iconSize: [0, 0]}), 
                    interactive: false 
                }).addTo(idLayer);
                
                textAnchor.bindTooltip(inps[0].value || `WP${idx+1}`, { 
                    permanent: true, 
                    direction: 'top', 
                    offset: [0, -10],
                    className: 'wp-label-tooltip' // Optional class for styling
                });
            }
        }
    });

    if (coords.length > 1) {
        routeLayer.setLatLngs(coords);
        // Recalculate Legs
        for (let i = 0; i < coords.length - 1; i++) {
            const midLat = (coords[i][0] + coords[i+1][0]) / 2, midLon = (coords[i][1] + coords[i+1][1]) / 2;
            const legInfo = calculateLegData(coords[i], coords[i+1]);
            L.marker([midLat, midLon], { icon: L.divIcon({ className: 'leg-label', html: legInfo, iconSize: [80, 20], iconAnchor: [40, 10] }) }).addTo(labelLayer);
        }
    }
    
    // Initial Fit
    if (isInitial && bounds.length > 0) leafletMap.fitBounds(bounds, {padding: [50, 50]});
}

function toggleVersionHistory() {
    const overlay = document.getElementById('historyOverlay'), box = document.getElementById('versionHistory');
    const isShowing = overlay.style.display === 'block'; overlay.style.display = isShowing ? 'none' : 'block'; box.style.display = isShowing ? 'none' : 'block';
}

function startClock() { 
    setInterval(() => { 
        const now = new Date();
        const local = now.toLocaleTimeString('en-GB', { hour12: false }); 
        const zulu = now.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' });
        document.getElementById('local-clock').innerText = `${local} L | ${zulu} Z`; 
    }, 1000); 
}

function updateRowNumbers() { tbody.querySelectorAll('tr').forEach((r, i) => { if(r.cells[3]) r.cells[3].innerText = i + 1; }); }
function updateColumnVisibility() { document.getElementById('actionBar').style.display = tbody.rows.length > 0 ? 'flex' : 'none'; }
function logAction(a) { document.getElementById('last-action').innerText = a; document.getElementById('wp-count-display').innerText = tbody.querySelectorAll('tr').length; }

function removeAll() {
    if (confirm("Clear all data? This will reset the table and all input fields.")) {
        tbody.innerHTML = ''; localStorage.removeItem('genesys_session');
        const bulk = document.getElementById('bulkInput'); if (bulk) bulk.value = '';
        const fInp = document.getElementById('fileInput'); if (fInp) fInp.value = '';
        const fBtn = document.getElementById('fileBtn'); if (fBtn) fBtn.innerHTML = `Choose File <span>.FPL .DAT .CSV .KML .RTE</span>`;
        lastLoadedExtension = ''; updateColumnVisibility(); logAction("System Reset"); checkGlobalHealth();
        updateSessionStats();
    }
}

function debouncePaste() { clearTimeout(pasteTimer); pasteTimer = setTimeout(() => { if(document.getElementById('bulkInput').value) smartParse(document.getElementById('bulkInput').value); }, 500); }
function addRows(n) { for(let i=0; i<n; i++){ const r = document.createElement('tr'); createRowCells(r, {id:'', name:'', lat:'', lon:''}); tbody.appendChild(r); } updateRowNumbers(); updateColumnVisibility(); saveSession(); }

function toggleTheme() { 
    const isNowLight = document.body.getAttribute('data-theme') !== 'light'; 
    document.body.setAttribute('data-theme', isNowLight ? 'light' : 'dark'); 
    document.getElementById('themeBtn').innerText = isNowLight ? '🌙' : '☀️'; 
}

function hideMap() { document.getElementById('mapOverlay').style.display = 'none'; }
function initStickyObserver() {
    const observer = new ResizeObserver(entries => { const h = entries[0].target.offsetHeight; document.querySelectorAll('#tableHeader th').forEach(th => th.style.top = h + 'px'); });
    observer.observe(document.getElementById('actionBar'));
}

/* --- AUTO-FILL ELEVATION ENGINE --- */
async function autoFillElevations() {
    const rows = [...tbody.querySelectorAll('tr')];
    let fetchedCount = 0;
    
    // Trigger existing loader UI
    const loader = document.getElementById('loader');
    loader.style.display = 'flex';
    loader.innerHTML = '<span class="spinner"></span> FETCHING ELEVATIONS...';

    for (const r of rows) {
        const inps = r.querySelectorAll('input');
        const elevInput = inps[4];
        
        // Only target rows with missing or zeroed elevations
        if (!elevInput.value || elevInput.value === '0') {
            const lat = parseCoordinate(inps[2].dataset.raw || inps[2].value);
            const lon = parseCoordinate(inps[3].dataset.raw || inps[3].value);
            
            if (lat && lon && lat !== "0.000000" && lon !== "0.000000") {
                try {
                    // Global API - returns meters
                    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.elevation && data.elevation.length > 0) {
                            // Convert to Feet MSL and round
                            const elevFt = Math.round(data.elevation[0] * 3.28084);
                            elevInput.value = elevFt > -1000 ? elevFt : 0;
                            elevInput.style.backgroundColor = "rgba(40, 167, 69, 0.15)"; // Soft green success highlight
                            fetchedCount++;
                        }
                    }
                } catch (e) {
                    console.warn("Elevation fetch failed for row", e);
                }
                // 150ms delay to prevent API rate-limiting on large files
                await new Promise(resolve => setTimeout(resolve, 150)); 
            }
        }
    }
    
    // Reset loader and save state
    loader.innerHTML = '<span class="spinner"></span> FETCHING DATA...';
    loader.style.display = 'none';
    
    saveSession();
    checkGlobalHealth();
    
    if (fetchedCount > 0) {
        logAction(`Auto-filled ${fetchedCount} elevations`);
    } else {
        alert("No missing elevations found, or fetch failed.");
    }
}


async function validateAndExportFPL() {
    const rows = [...tbody.querySelectorAll('tr')];
    if (rows.length < 2) return alert("Min 2 waypoints required.");
    const now = new Date().toISOString().split('.')[0].replace(/[:-]/g, '') + 'Z';
    const firstID = rows[0].querySelectorAll('input')[0].value.trim().toUpperCase() || 'START';
    const lastID = rows[rows.length-1].querySelectorAll('input')[0].value.trim().toUpperCase() || 'END';
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n<flight-plan xmlns="http://www8.garmin.com/xmlschemas/FlightPlan/v1">\n<created>${now}</created>\n<aircraft><aircraft-tailnumber>USER</aircraft-tailnumber></aircraft>\n<flight-data><altitude-ft>2000</altitude-ft></flight-data>\n<waypoint-table>\n`;
    
    const getDBType = (id) => {
        return new Promise((resolve) => {
            const request = indexedDB.open(FAA_DB_NAME, 2);
            request.onsuccess = (e) => {
                const db = e.target.result; const tx = db.transaction(FAA_STORE_NAME, "readonly"), store = tx.objectStore(FAA_STORE_NAME);
                const index = store.index("id");
                
                let matches = [];
                index.openCursor(IDBKeyRange.only(id)).onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if(cursor) { matches.push(cursor.value); cursor.continue(); }
                    else {
                        let best = matches.find(m => m.type === 'APT') || matches[0];
                        if (!best) resolve((id.length <= 4 && (id.startsWith('K') || id.startsWith('P'))) ? "AIRPORT" : "INT");
                        else if (best.type === 'APT') resolve("AIRPORT");
                        else if (best.type === 'VOR' || best.type === 'DME') resolve("VOR");
                        else resolve("INT");
                    }
                };
            };
        });
    };
    
    for (const r of rows) {
        const inps = r.querySelectorAll('input'); const id = inps[0].value.trim().toUpperCase();
        const lat = parseFloat(inps[2].dataset.raw || inps[2].value).toFixed(6), lon = parseFloat(inps[3].dataset.raw || inps[3].value).toFixed(6);
        const type = await getDBType(id);
        xml += `    <waypoint>\n        <identifier>${id}</identifier>\n        <type>${type}</type>\n        <lat>${lat}</lat>\n        <lon>${lon}</lon>\n    </waypoint>\n`;
    }
    xml += `</waypoint-table>\n<route>\n    <route-name>${firstID}-${lastID}</route-name>\n    <flight-plan-index>1</flight-plan-index>\n`;
    for (const r of rows) {
        const id = r.querySelectorAll('input')[0].value.trim().toUpperCase();
        const type = await getDBType(id);
        xml += `    <route-point>\n        <waypoint-identifier>${id}</waypoint-identifier>\n        <waypoint-type>${type}</waypoint-type>\n    </route-point>\n`;
    }
    xml += `0</route>\n</flight-plan>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([xml], {type:'text/xml'})); a.download = `${firstID}-${lastID}.fpl`; a.click();
}

function validateAndExportGarmin() {
    let csv = ""; tbody.querySelectorAll('tr').forEach(r => {
        const inp = r.querySelectorAll('input'); csv += `${inp[0].value},${inp[1].value},${parseCoordinate(inp[2].dataset.raw || inp[2].value)},${parseCoordinate(inp[3].dataset.raw || inp[3].value)}\n`;
    });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download = "user.wpt"; a.click();
}
