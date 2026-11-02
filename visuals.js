/**
 * BRANDORB VISUALS - EXTENDED STABLE & PLAYBACK VERSION
 */
function normalizeHeader(h) {
    return h
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}
function buildHeaderIndex(headers) {
    const map = {};
    headers.forEach((h, i) => {
        map[normalizeHeader(h)] = i;
    });
    return map;
}

function sanitizeRows(rows, idx) {
    return rows.filter(r => {
        try {
            return (
                r[idx("Exporter")] &&
                r[idx("Importer")] &&
                r[idx("Origin Country")] &&
                r[idx("Destination Country")]
            );
        } catch {
            return false;
        }
    });
}
window.clusterMode = 'COUNTRY'; 
// ✅ Always return the report name
window.getReportTitle = function () {
    return window.reportName || "";
};

// FIXED DATE NORMALIZER: Specifically targets YYYY-MM-DD
const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    const strVal = String(dateValue).trim();
    const regex = /(\d{4})-(\d{2})-(\d{2})/;
    const match = strVal.match(regex);
    if (match) return match[0];
    let d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return strVal;
};

window.downloadPDF = function () {
    const mapEl = document.getElementById('map-frame');
    window.LMap.invalidateSize(true);
    html2canvas(mapEl, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        ignoreElements: el => el.classList.contains("leaflet-control")
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'BrandOrb_RouteMap.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
};

window.populateFilters = function() {
    if (!window.rawData || window.rawData.length < 2) return;
    const h = window.rawData[0];
    const data = window.rawData.slice(1);
    const fill = (id, col, lbl) => {
        const i = h.findIndex(header => header.trim() === col);
        if (i === -1) return;
        const el = document.getElementById(id);
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` +
            vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country', 'Countries');
    fill('dest-filter', 'Destination Country', 'Countries');
    fill('orig-port-filter', 'Origin Port', 'Origin Ports');
    fill('dest-port-filter', 'Destination Port', 'Destination Ports');
};

window.recomputeViz = function() {
    if (!window.rawData) return;

    const search = (document.getElementById('ent-search')?.value || '').toLowerCase();
    const origF = document.getElementById('orig-filter')?.value || 'All';
    const destF = document.getElementById('dest-filter')?.value || 'All';
    const opF = document.getElementById('orig-port-filter')?.value || 'All';
    const dpF = document.getElementById('dest-port-filter')?.value || 'All';

    const h = window.rawData[0];
    const headerIndex = buildHeaderIndex(h);
    const idx = name => headerIndex[normalizeHeader(name)];

    const cleanedRows = sanitizeRows(window.rawData.slice(1), idx);

    const filteredRows = cleanedRows.filter(r => {
        const exporter = r[idx("Exporter")] || "";
        const sMatch = (exporter + (r[idx("Importer")]||"") + (r[idx("PRODUCT")]||""))
            .toLowerCase().includes(search);
        const oMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const dMatch = destF === 'All' || r[idx("Destination Country")] === destF;
        const opMatch = opF === 'All' || r[idx("Origin Port")] === opF;
        const dpMatch = dpF === 'All' || r[idx("Destination Port")] === dpF;
        return oMatch && dMatch && opMatch && dpMatch && sMatch;
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    frame.insertAdjacentHTML("afterbegin", `
    <div class="viz-title">
        ${window.getReportTitle()}
    </div>
`);
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    if (window.currentTab === 'MAP') {
        const groups = {};
        filteredRows.forEach(r => {
            const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}|${r[idx("Origin Port")]}|${r[idx("Destination Port")]}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        window.drawMap(Object.values(groups), idx);
    } else {
        frame.insertAdjacentHTML('afterbegin', `
        <div class="viz-controls">
            <button class="toggle-btn ${window.clusterMode==='COUNTRY'?'active':''}"
                onclick="window.clusterMode='COUNTRY'; recomputeViz()">Group by Country</button>
            <button class="toggle-btn ${window.clusterMode==='PRODUCT'?'active':''}"
                onclick="window.clusterMode='PRODUCT'; recomputeViz()">Group by Product</button>
        </div>`);
        window.drawCluster(filteredRows, idx);
    }
};

/* ================= ROUTE MAP ================= */

window.drawMap = function(groups, idx) {
    const routeLayers = [];
    window.LMap = L.map('map-frame').setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(window.LMap);

    groups.forEach((group, gIdx) => {
        window.buildColorLegend(routeLayers);
        const f = group[0];

        let lat1 = parseFloat(f[idx("Origin latitude")]);
        let lon1 = parseFloat(f[idx("Origin longitude")]);
        let lat2 = parseFloat(f[idx("Destination latitude")]);
        let lon2 = parseFloat(f[idx("Destination longitude")]);

        // Check custom port dictionary lookup fallback
        const oPort = f[idx("Origin Port")] || f[idx("Origin Country")];
        const dPort = f[idx("Destination Port")] || f[idx("Destination Country")];
        if ((isNaN(lat1) || isNaN(lon1)) && window.customCoords?.[oPort]) {
            lat1 = window.customCoords[oPort].lat;
            lon1 = window.customCoords[oPort].lng;
        }
        if ((isNaN(lat2) || isNaN(lon2)) && window.customCoords?.[dPort]) {
            lat2 = window.customCoords[dPort].lat;
            lon2 = window.customCoords[dPort].lng;
        }

        if (isNaN(lat1) || isNaN(lat2)) {
            window.promptMissingCoordinate(oPort, dPort);
            return;
        }

        const jitter = gIdx * 0.015;
        const originLat = lat1 + jitter;
        const originLon = lon1 + jitter;
        const destLat = lat2 + jitter;
        const destLon = lon2 + jitter;

        // Calculate Curved Bezier points
        const curvePoints = window.getCurvedPoints([originLat, originLon], [destLat, destLon]);

        // Determine line width based on View Mode
        let lineWeight = Math.min(2 + group.length * 0.6, 8);
        if (window.viewMode === 'Transaction View') {
            lineWeight = Math.min(4 + group.length * 1.8, 22);
        }

        const routeLine = L.polyline(curvePoints, {
            color: f[idx("COLOR")]?.trim() || (window.viewMode === 'Transaction View' ? '#f43f5e' : '#0ea5e9'),
            weight: lineWeight,
            opacity: 0.85
        }).addTo(window.LMap);

        routeLayers.push({ color: f[idx("COLOR")] || '#0ea5e9', layer: routeLine });

        // Origin Node (Red Dot)
        L.circleMarker([originLat, originLon], {
            radius: 5,
            color: '#ffffff',
            fillColor: '#ef4444',
            fillOpacity: 1,
            weight: 1.5
        }).addTo(window.LMap);

        // Destination Node (Purple Dot)
        L.circleMarker([destLat, destLon], {
            radius: 5,
            color: '#ffffff',
            fillColor: '#a855f7',
            fillOpacity: 1,
            weight: 1.5
        }).addTo(window.LMap);

        const tableRows = group.map(s => `
<tr>
<td style="white-space:nowrap;">${formatDate(s[idx("Date")])}</td>
<td>${s[idx("Exporter")] || '-'}</td>
<td>${s[idx("Importer")] || '-'}</td>
<td>${s[idx("Weight(Kg)")] || '-'}</td>
<td>${s[idx("Brand")] || 'NOT DECLARED'}</td>
<td>${s[idx("Grade")] || 'RUTILE'}</td>
<td>${s[idx("Variant")] || '-'}</td>
<td>$${s[idx("Amount($)")] || '-'}</td>
</tr>`).join("");

        const shipmentCount = group.length;
        const totalValue = group.reduce((s,r)=>s+(+r[idx("Amount($)")]||0),0);

        routeLine.bindPopup(`
<div class="custom-card-popup">
<strong style="color:#e11d48; font-size:14px;">${window.viewMode === 'Transaction View' ? 'Export (Supplying) Route' : 'Trade Route'}: ${f[idx("Origin Country")]} → ${f[idx("Destination Country")]}</strong><br>
<span style="font-size:12px; color:#475569;">Total Transactions: ${shipmentCount} | Combined Route Value: $${totalValue.toLocaleString()}</span><br>
<b>Product:</b> ${f[idx("PRODUCT")] || 'N/A'}<br>
<table class="popup-table" style="margin-top:8px; width:100%;">
<thead>
<tr>
<th>Date</th><th>Exporter</th><th>Importer</th><th>Weight(Kg)</th><th>Brand</th><th>Grade</th><th>Variant</th><th>Value</th>
</tr>
</thead>
<tbody>
${tableRows}
</tbody>
</table>
</div>
`, { maxWidth: 520 });
    });
};

/* ================= CLUSTER ================= */

window.drawCluster = function(data, idx) {
    window._tradeAgg = {};
    const frame = document.getElementById('map-frame');
    const width = frame.clientWidth;
    const height = frame.clientHeight;

    const svg = d3.select(frame).append("svg")
        .attr("width", "100%")
        .attr("height", "100%");
    const g = svg.append("g");

    svg.call(d3.zoom().on("zoom", e => g.attr("transform", e.transform)));

    let nodes = [], links = [], nodeSet = new Set();

    data.forEach(r => {
        const exp = r[idx("Exporter")];
        const imp = r[idx("Importer")];
        const gp = window.clusterMode === 'COUNTRY'
            ? r[idx("Origin Country")]
            : r[idx("PRODUCT")];
        const dp = window.clusterMode === 'COUNTRY'
            ? r[idx("Destination Country")]
            : r[idx("PRODUCT")];

        [gp, dp].forEach(p => {
            if (p && !nodeSet.has(p)) {
                nodes.push({ id: p, type: 'parent' });
                nodeSet.add(p);
            }
        });

        if (exp && !nodeSet.has(exp)) {
            nodes.push({ id: exp, type: 'exp' });
            nodeSet.add(exp);
        }
        if (imp && !nodeSet.has(imp)) {
            nodes.push({ id: imp, type: 'imp' });
            nodeSet.add(imp);
        }

        const tradeKey = exp + "→" + imp;

        if (!window._tradeAgg[tradeKey]) {
            window._tradeAgg[tradeKey] = {
                source: exp,
                target: imp,
                type: 'trade',
                rows: []
            };
        }

        window._tradeAgg[tradeKey].rows.push(r);

        links.push({ source: gp, target: exp, type: 'link' });
        links.push({ source: dp, target: imp, type: 'link' });
    });

    Object.values(window._tradeAgg).forEach(l => links.push(l));

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = g.append("g")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", d => d.type === 'trade' ? "#94a3b8" : "#e2e8f0")
        .attr("stroke-width", 2);

    /* 🔹 Invisible click layer */
    const clickLayer = g.append("g")
        .selectAll("line")
        .data(links.filter(d => d.type === 'trade'))
        .enter()
        .append("line")
        .attr("stroke", "transparent")
        .attr("stroke-width", 10)
        .style("cursor", "pointer");

    const node = g.append("g")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .call(d3.drag()
            .on("start", (e, d) => {
                if (!e.active) sim.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on("drag", (e, d) => {
                d.fx = e.x; d.fy = e.y;
            })
            .on("end", (e, d) => {
                if (!e.active) sim.alphaTarget(0);
                d.fx = null; d.fy = null;
            })
        );

    node.append("circle")
        .attr("r", d => d.type === 'parent' ? 22 : 14)
        .attr("fill", d => d.type === 'parent'
            ? '#1e293b'
            : d.type === 'exp'
                ? '#0ea5e9'
                : '#f43f5e')
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

    // Centered Icons
    node.append("foreignObject")
        .attr("width", 30)
        .attr("height", 30)
        .attr("x", -15) 
        .attr("y", -15)
        .style("pointer-events", "none")
        .html(d => {
            let iconClass = "fa-globe"; 
            if (d.type === 'exp') iconClass = "fa-building"; 
            if (d.type === 'imp') iconClass = "fa-store";    
            return `<div style="display:flex; align-items:center; justify-content:center; width:30px; height:30px;">
                        <i class="fas ${iconClass}" style="color:white; font-size:${d.type==='parent'?'16px':'12px'};"></i>
                    </div>`;
        });
    
    node.append("text")
        .text(d => d.id)
        .attr("y", 35)
        .attr("text-anchor", "middle")
        .style("font-size", "9px")
        .style("font-weight", "bold");

    /* 🔹 Popup moved to clickLayer */
    clickLayer.on("click", (e, d) => {
        const rows = d.rows;
        d3.selectAll(".cluster-pop").remove();

        d3.select("#map-frame")
            .append("div")
            .attr("class", "cluster-pop")
            .style("left", e.offsetX + "px")
            .style("top", e.offsetY + "px")
            .html(`
<span class="pop-close" onclick="this.parentElement.remove()">×</span>
<strong>${rows[0][idx("Exporter")]} → ${rows[0][idx("Importer")]}</strong>

<table class="popup-table" style="margin-top:6px;">
<thead>
<tr>
<th style="min-width:90px; white-space:nowrap;">Date</th>
<th>Quantity</th>
<th>Weight (Kg)</th>
<th>Value (USD)</th>
<th>Product</th>
</tr>
</thead>
<tbody>
${rows.map(r => `
<tr>
<td style="white-space:nowrap;">${formatDate(r[idx("Date")])}</td>
<td>${r[idx("Quantity")] || '-'}</td>
<td>${r[idx("Weight(Kg)")] || '-'}</td>
<td>$${r[idx("Amount($)")]}</td>
<td>${r[idx("PRODUCT")]}</td>
</tr>
`).join("")}
</tbody>
</table>
`);
    });

    sim.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        clickLayer
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
};

window.buildColorLegend = function(routes) {
    const container = document.getElementById("map-frame");
    document.getElementById("color-legend")?.remove();
    if (window.hideLegend) return;

    const legend = document.createElement("div");
    legend.className = "network-legend-card";
    legend.id = "color-legend";

    legend.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:bold; font-size:12px; color:#1e293b;">NETWORK LEGEND</span>
            <span style="font-size:10px; color:#3b82f6; text-transform:uppercase; font-weight:bold;">${window.viewMode || 'TRADE FLOW'}</span>
            <button onclick="window.hideLegend=true; document.getElementById('color-legend').remove();" style="border:none; background:none; cursor:pointer;">✕</button>
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin:4px 0; font-size:11px;">
            <span style="width:10px; height:10px; background:#ef4444; border-radius:50%;"></span> Origin Node
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin:4px 0; font-size:11px;">
            <span style="width:10px; height:10px; background:#a855f7; border-radius:50%;"></span> Destination Node
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin:4px 0; font-size:11px;">
            <span style="width:16px; height:2px; background:#2563eb;"></span> Imports (Blue)
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin:4px 0; font-size:11px;">
            <span style="width:16px; height:2px; background:#ef4444;"></span> Exports (Red)
        </div>
    `;
    container.appendChild(legend);
};

/* ================= NEW EXTENSIONS & VIEW MODES ================= */

window.viewMode = 'Trade Flow';
window.playbackSpeed = 1000;
window.playbackInterval = null;
window.playbackIndex = 0;
window.customCoords = {};

// Curved line helper
window.getCurvedPoints = function(start, end) {
    const lat1 = start[0], lng1 = start[1];
    const lat2 = end[0], lng2 = end[1];
    const midLat = (lat1 + lat2) / 2 + (lng2 - lng1) * 0.15;
    const midLng = (lng1 + lng2) / 2 - (lat2 - lat1) * 0.15;

    const points = [];
    for (let t = 0; t <= 1; t += 0.05) {
        const curLat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2;
        const curLng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * midLng + t * t * lng2;
        points.push([curLat, curLng]);
    }
    return points;
};

// View Mode Switching
window.setViewMode = function(mode) {
    window.viewMode = mode;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.trim() === mode);
    });
    window.recomputeViz();
};

// Animated Playback Engine
window.startPlayback = function() {
    if (!window.rawData || window.rawData.length < 2) return;
    const h = window.rawData[0];
    const headerIndex = buildHeaderIndex(h);
    const idx = name => headerIndex[normalizeHeader(name)];

    const sortedRows = sanitizeRows(window.rawData.slice(1), idx).sort((a, b) => {
        return new Date(formatDate(a[idx("Date")])) - new Date(formatDate(b[idx("Date")]));
    });

    window.stopPlayback();
    window.playbackIndex = 0;

    window.playbackInterval = setInterval(() => {
        if (window.playbackIndex >= sortedRows.length) {
            window.stopPlayback();
            return;
        }

        const row = sortedRows[window.playbackIndex];
        window.playbackIndex++;
        window.renderSinglePlaybackStep(row, sortedRows.length, idx);
    }, window.playbackSpeed);
};

window.stopPlayback = function() {
    if (window.playbackInterval) {
        clearInterval(window.playbackInterval);
        window.playbackInterval = null;
    }
    document.getElementById('playback-hud')?.remove();
};

window.setSpeed = function(spd, elem) {
    document.querySelectorAll('.spd-btn').forEach(b => b.classList.remove('active'));
    elem.classList.add('active');
    if (spd === 'slow') window.playbackSpeed = 2000;
    if (spd === '1x') window.playbackSpeed = 1000;
    if (spd === 'fast') window.playbackSpeed = 300;
    if (window.playbackInterval) window.startPlayback();
};

window.renderSinglePlaybackStep = function(r, total, idx) {
    const frame = document.getElementById('map-frame');
    document.getElementById('playback-hud')?.remove();

    const hud = document.createElement('div');
    hud.id = 'playback-hud';
    hud.className = 'playback-card-hud';
    hud.innerHTML = `
        <div style="background:#0f172a; color:#fff; padding:12px; border-radius:8px; font-family:sans-serif; width:300px; font-size:11px;">
            <div style="font-weight:bold; border-bottom:1px solid #334155; padding-bottom:6px; margin-bottom:8px; display:flex; justify-content:space-between;">
                <span>RECORD ${window.playbackIndex} / ${total}</span>
                <span>📅 ${formatDate(r[idx("Date")])}</span>
            </div>
            <table style="width:100%; border-collapse:collapse; color:#cbd5e1;">
                <tr><td>EXPORTER</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("Exporter")] || 'N/A'}</td></tr>
                <tr><td>IMPORTER</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("Importer")] || 'N/A'}</td></tr>
                <tr><td>ORIGIN</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("Origin Country")] || 'N/A'}</td></tr>
                <tr><td>DESTINATION</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("Destination Country")] || 'N/A'}</td></tr>
                <tr><td>PRODUCT</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("PRODUCT")] || 'N/A'}</td></tr>
                <tr><td>BRAND</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("Brand")] || 'NOT DECLARED'}</td></tr>
                <tr><td>GRADE</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("Grade")] || 'RUTILE'}</td></tr>
                <tr><td>VARIANT</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("Variant")] || 'DR 2100'}</td></tr>
                <tr><td>WEIGHT</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("Weight(Kg)")] || '-'} MT</td></tr>
                <tr><td>QUANTITY</td><td style="text-align:right; font-weight:bold; color:#fff;">${r[idx("Quantity")] || '-'}</td></tr>
                <tr><td>VALUE</td><td style="text-align:right; font-weight:bold; color:#fff;">$${r[idx("Amount($)")] || '-'}</td></tr>
            </table>
        </div>
    `;
    frame.appendChild(hud);
};

// Port Coordinate File Upload Parser (XLSX / CSV)
window.handlePortCoordinateUpload = function(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        json.forEach(row => {
            const key = row['Port'] || row['Country'];
            if (key && row['Latitude'] && row['Longitude']) {
                window.customCoords[key] = {
                    lat: parseFloat(row['Latitude']),
                    lng: parseFloat(row['Longitude'])
                };
            }
        });
        alert('Port Coordinates Loaded Successfully!');
        window.recomputeViz();
    };
    reader.readAsArrayBuffer(file);
};

// Missing Coordinate Prompt Fallback
window.promptMissingCoordinate = function(orig, dest) {
    if (document.getElementById('coord-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'coord-modal';
    modal.className = 'coord-modal-overlay';
    modal.innerHTML = `
        <div class="coord-modal-content">
            <h3>Missing Location Coordinates</h3>
            <p>Enter coordinates for: <b>${orig}</b> or <b>${dest}</b></p>
            <input type="text" id="manual-location-name" value="${orig}" placeholder="Location Name">
            <input type="number" step="any" id="manual-lat" placeholder="Latitude (e.g. 51.505)">
            <input type="number" step="any" id="manual-lng" placeholder="Longitude (e.g. -0.09)">
            <button onclick="window.saveManualCoord()">Save Coordinate</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.saveManualCoord = function() {
    const loc = document.getElementById('manual-location-name').value;
    const lat = parseFloat(document.getElementById('manual-lat').value);
    const lng = parseFloat(document.getElementById('manual-lng').value);
    if (loc && !isNaN(lat) && !isNaN(lng)) {
        window.customCoords[loc] = { lat, lng };
        document.getElementById('coord-modal').remove();
        window.recomputeViz();
    }
};
