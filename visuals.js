/**
 * BRANDORB VISUALS - COMPLETE TRADE VIZ, ANIMATION & PORT PARSER ENGINE
 */

function normalizeHeader(h) {
    if (!h) return "";
    return String(h)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

function buildHeaderIndex(headers) {
    const map = {};
    if (Array.isArray(headers)) {
        headers.forEach((h, i) => {
            map[normalizeHeader(h)] = i;
        });
    }
    return map;
}

function sanitizeRows(rows, idx) {
    return rows.filter(r => {
        try {
            return (
                r[idx("Exporter")] ||
                r[idx("Importer")] ||
                r[idx("Origin Country")] ||
                r[idx("Destination Country")]
            );
        } catch {
            return false;
        }
    });
}

window.clusterMode = 'COUNTRY'; 
window.viewMode = 'Trade Flow';
window.playbackSpeed = 1000;
window.playbackInterval = null;
window.isPaused = false;
window.playbackIndex = 0;
window.customCoords = {};
window.sortedPlaybackRows = [];

window.getReportTitle = function () {
    return window.reportName || "";
};

// Date Formatter
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
    if (window.LMap) window.LMap.invalidateSize(true);
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
        if (!el) return;
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
        const importer = r[idx("Importer")] || "";
        const product = r[idx("PRODUCT")] || "";
        const sMatch = (exporter + importer + product).toLowerCase().includes(search);
        const oMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const dMatch = destF === 'All' || r[idx("Destination Country")] === destF;
        const opMatch = opF === 'All' || r[idx("Origin Port")] === opF;
        const dpMatch = dpF === 'All' || r[idx("Destination Port")] === dpF;
        return oMatch && dMatch && opMatch && dpMatch && sMatch;
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    
    // Inject Top Control Bar
    window.renderTopControls(frame);

    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    if (window.currentTab === 'MAP' || !window.currentTab) {
        window.currentTab = 'MAP';

        // Group rows dynamically according to View Mode
        const groups = {};
        filteredRows.forEach(r => {
            let key;
            if (window.viewMode === 'Country Flow') {
                key = `${r[idx("Origin Country")]}|${r[idx("Destination Country")]}`;
            } else if (window.viewMode === 'Port Flow') {
                key = `${r[idx("Origin Port")]}|${r[idx("Destination Port")]}`;
            } else if (window.viewMode === 'Product Flow') {
                key = `${r[idx("PRODUCT")]}|${r[idx("Origin Country")]}|${r[idx("Destination Country")]}`;
            } else {
                key = `${r[idx("Exporter")]}|${r[idx("Importer")]}|${r[idx("Origin Country")]}|${r[idx("Destination Country")]}`;
            }
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        window.drawMap(Object.values(groups), idx);
    } else {
        frame.insertAdjacentHTML('beforeend', `
        <div class="viz-controls">
            <button class="toggle-btn ${window.clusterMode==='COUNTRY'?'active':''}"
                onclick="window.clusterMode='COUNTRY'; recomputeViz()">Group by Country</button>
            <button class="toggle-btn ${window.clusterMode==='PRODUCT'?'active':''}"
                onclick="window.clusterMode='PRODUCT'; recomputeViz()">Group by Product</button>
        </div>`);
        window.drawCluster(filteredRows, idx);
    }
};

/* ================= ROUTE MAP DRAWING ================= */

window.drawMap = function(groups, idx) {
    const routeLayers = [];
    window.LMap = L.map('map-frame', { zoomControl: false }).setView([20, 0], 2);
    L.control.zoom({ position: 'topleft' }).addTo(window.LMap);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(window.LMap);

    const bounds = [];

    groups.forEach((group, gIdx) => {
        window.buildColorLegend(routeLayers);
        const f = group[0];

        const getVal = (colName) => {
            const i = idx(colName);
            return (i !== undefined && f[i] !== undefined) ? f[i] : null;
        };

        const oCountry = getVal("Origin Country") || "";
        const dCountry = getVal("Destination Country") || "";
        const oPort = getVal("Origin Port") || oCountry;
        const dPort = getVal("Destination Port") || dCountry;

        let lat1 = parseFloat(getVal("Origin latitude"));
        let lon1 = parseFloat(getVal("Origin longitude"));
        let lat2 = parseFloat(getVal("Destination latitude"));
        let lon2 = parseFloat(getVal("Destination longitude"));

        // Custom uploaded coordinates dictionary fallback
        if ((isNaN(lat1) || isNaN(lon1)) && window.customCoords[oPort]) {
            lat1 = window.customCoords[oPort].lat; lon1 = window.customCoords[oPort].lng;
        }
        if ((isNaN(lat2) || isNaN(lon2)) && window.customCoords[dPort]) {
            lat2 = window.customCoords[dPort].lat; lon2 = window.customCoords[dPort].lng;
        }

        // Default Geocoding Fallbacks
        if (isNaN(lat1) || isNaN(lon1)) {
            const fb1 = window.lookupCoord(oPort || oCountry);
            lat1 = fb1.lat; lon1 = fb1.lng;
        }
        if (isNaN(lat2) || isNaN(lon2)) {
            const fb2 = window.lookupCoord(dPort || dCountry);
            lat2 = fb2.lat; lon2 = fb2.lng;
        }

        const jitter = (gIdx % 5) * 0.02;
        const originLat = lat1 + jitter;
        const originLon = lon1 + jitter;
        const destLat = lat2 + jitter;
        const destLon = lon2 + jitter;

        bounds.push([originLat, originLon], [destLat, destLon]);

        const curvePoints = window.getCurvedPoints([originLat, originLon], [destLat, destLon]);

        // Dynamic Line Weights per View Mode
        let lineWeight = Math.min(2 + group.length * 0.8, 10);
        if (window.viewMode === 'Transaction View') {
            lineWeight = Math.min(4 + group.length * 2.5, 20);
        }

        const routeColor = getVal("COLOR")?.trim() || (window.viewMode === 'Transaction View' ? '#f43f5e' : '#0ea5e9');

        const routeLine = L.polyline(curvePoints, {
            color: routeColor,
            weight: lineWeight,
            opacity: 0.85
        }).addTo(window.LMap);

        routeLayers.push({ color: routeColor, layer: routeLine });

        // Red Origin Marker
        L.circleMarker([originLat, originLon], {
            radius: 5, color: '#ffffff', fillColor: '#ef4444', fillOpacity: 1, weight: 1.5
        }).addTo(window.LMap);

        // Purple Destination Marker
        L.circleMarker([destLat, destLon], {
            radius: 5, color: '#ffffff', fillColor: '#a855f7', fillOpacity: 1, weight: 1.5
        }).addTo(window.LMap);

        // Table Rows inside Popup
        const tableRows = group.map(s => {
            const g = col => {
                const i = idx(col);
                return (i !== undefined && s[i] !== undefined) ? s[i] : '-';
            };
            return `
<tr>
<td style="white-space:nowrap;">${formatDate(g("Date"))}</td>
<td>${g("Exporter")}</td>
<td>${g("Importer")}</td>
<td>${g("Weight(Kg)")}</td>
<td>${g("BRAND") || 'NOT DECLARED'}</td>
<td>${g("VARIANT") || '-'}</td>
<td>$${g("Amount($)")}</td>
</tr>`;
        }).join("");

        const shipmentCount = group.length;
        const totalValue = group.reduce((s, r) => {
            const i = idx("Amount($)");
            return s + (i !== undefined ? (+r[i] || 0) : 0);
        }, 0);

        routeLine.bindPopup(`
<div class="custom-card-popup">
<div class="pop-header">${window.viewMode === 'Transaction View' ? 'Export Route' : 'Trade Route'}: ${oCountry} → ${dCountry}</div>
<div class="pop-sub">Transactions: <b>${shipmentCount}</b> | Total Value: <b>$${totalValue.toLocaleString()}</b></div>
<div style="font-size:10px; margin-bottom:4px;"><b>Product:</b> ${getVal("PRODUCT") || 'N/A'}</div>
<table class="popup-table">
<thead>
<tr>
<th>Date</th><th>Exporter</th><th>Importer</th><th>Weight</th><th>Brand</th><th>Variant</th><th>Value</th>
</tr>
</thead>
<tbody>
${tableRows}
</tbody>
</table>
</div>
`, { maxWidth: 440 });
    });

    if (bounds.length > 0 && window.LMap) {
        try { window.LMap.fitBounds(bounds, { padding: [40, 40] }); } catch(e){}
    }
};

/* ================= CLUSTER GRAPH ================= */

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
        const gp = window.clusterMode === 'COUNTRY' ? r[idx("Origin Country")] : r[idx("PRODUCT")];
        const dp = window.clusterMode === 'COUNTRY' ? r[idx("Destination Country")] : r[idx("PRODUCT")];

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
            window._tradeAgg[tradeKey] = { source: exp, target: imp, type: 'trade', rows: [] };
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
        .attr("fill", d => d.type === 'parent' ? '#1e293b' : d.type === 'exp' ? '#0ea5e9' : '#f43f5e')
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

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
<th style="min-width:70px;">Date</th>
<th>Quantity</th>
<th>Weight</th>
<th>Value ($)</th>
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-weight:bold; font-size:10px; color:#0f172a;">NETWORK LEGEND</span>
            <span style="font-size:9px; color:#2563eb; font-weight:bold; text-transform:uppercase;">${window.viewMode || 'TRADE FLOW'}</span>
            <button onclick="window.hideLegend=true; document.getElementById('color-legend').remove();" style="border:none; background:none; cursor:pointer; font-size:11px;">✕</button>
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin:2px 0; font-size:10px;">
            <span style="width:8px; height:8px; background:#ef4444; border-radius:50%;"></span> Origin Node
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin:2px 0; font-size:10px;">
            <span style="width:8px; height:8px; background:#a855f7; border-radius:50%;"></span> Destination Node
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin:2px 0; font-size:10px;">
            <span style="width:14px; height:2px; background:#2563eb;"></span> Imports (Blue)
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin:2px 0; font-size:10px;">
            <span style="width:14px; height:2px; background:#ef4444;"></span> Exports (Red)
        </div>
    `;
    container.appendChild(legend);
};

/* ================= TOP CONTROLS & PLAYBACK ================= */

window.renderTopControls = function(frame) {
    let topBar = document.getElementById('top-viz-toolbar');
    if (!topBar) {
        topBar = document.createElement('div');
        topBar.id = 'top-viz-toolbar';
        topBar.className = 'top-viz-toolbar';
        frame.parentElement.insertBefore(topBar, frame);
    }

    const views = ['Trade Flow', 'Country Flow', 'Port Flow', 'Product Flow', 'Strategic Value Routes', 'High Volume Routes', 'Transaction View'];
    
    topBar.innerHTML = `
        <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
            ${views.map(v => `
                <button class="view-btn ${window.viewMode === v ? 'active' : ''}" onclick="window.setViewMode('${v}')">${v}</button>
            `).join('')}
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
            <label class="spd-btn" style="cursor:pointer;" title="Upload Port Coordinate XLSX / CSV">
                📁 Port Coords
                <input type="file" accept=".xlsx, .xls, .csv" style="display:none;" onchange="window.handlePortCoordinateUpload(this)">
            </label>
            <button class="spd-btn ${window.playbackSpeed===2000?'active':''}" onclick="window.setSpeed(2000, this)">Slow</button>
            <button class="spd-btn ${window.playbackSpeed===1000?'active':''}" onclick="window.setSpeed(1000, this)">1x</button>
            <button class="spd-btn ${window.playbackSpeed===300?'active':''}" onclick="window.setSpeed(300, this)">Fast</button>
            
            <button class="play-btn" onclick="window.togglePlayPause()">
                ${window.playbackInterval ? (window.isPaused ? '▶ Resume' : '⏸ Pause') : '▶ Animate Playback'}
            </button>
            ${window.playbackInterval ? `<button class="stop-btn" onclick="window.stopPlayback()">⏹ Stop</button>` : ''}
        </div>
    `;
};

window.setViewMode = function(mode) {
    window.viewMode = mode;
    window.recomputeViz();
};

window.setSpeed = function(spd, elem) {
    window.playbackSpeed = spd;
    if (window.playbackInterval && !window.isPaused) {
        window.startPlaybackLoop();
    }
    window.renderTopControls(document.getElementById('map-frame'));
};

window.togglePlayPause = function() {
    if (!window.playbackInterval) {
        window.startPlayback();
    } else {
        window.isPaused = !window.isPaused;
        window.renderTopControls(document.getElementById('map-frame'));
    }
};

window.startPlayback = function() {
    if (!window.rawData || window.rawData.length < 2) return;
    const h = window.rawData[0];
    const headerIndex = buildHeaderIndex(h);
    const idx = name => headerIndex[normalizeHeader(name)];

    window.sortedPlaybackRows = sanitizeRows(window.rawData.slice(1), idx).sort((a, b) => {
        return new Date(formatDate(a[idx("Date")])) - new Date(formatDate(b[idx("Date")]));
    });

    window.playbackIndex = 0;
    window.isPaused = false;
    window.startPlaybackLoop();
};

window.startPlaybackLoop = function() {
    if (window.playbackInterval) clearInterval(window.playbackInterval);

    const h = window.rawData[0];
    const headerIndex = buildHeaderIndex(h);
    const idx = name => headerIndex[normalizeHeader(name)];

    window.playbackInterval = setInterval(() => {
        if (window.isPaused) return;

        if (window.playbackIndex >= window.sortedPlaybackRows.length) {
            window.stopPlayback();
            return;
        }

        const row = window.sortedPlaybackRows[window.playbackIndex];
        window.playbackIndex++;
        window.renderSinglePlaybackStep(row, window.sortedPlaybackRows.length, idx);
    }, window.playbackSpeed);

    window.renderTopControls(document.getElementById('map-frame'));
};

window.stopPlayback = function() {
    if (window.playbackInterval) {
        clearInterval(window.playbackInterval);
        window.playbackInterval = null;
    }
    window.isPaused = false;
    document.getElementById('playback-hud')?.remove();
    window.renderTopControls(document.getElementById('map-frame'));
};

window.renderSinglePlaybackStep = function(r, total, idx) {
    const frame = document.getElementById('map-frame');
    document.getElementById('playback-hud')?.remove();

    const g = col => {
        const i = idx(col);
        return (i !== undefined && r[i] !== undefined && r[i] !== '') ? r[i] : 'N/A';
    };

    const hud = document.createElement('div');
    hud.id = 'playback-hud';
    hud.className = 'playback-card-hud';
    hud.innerHTML = `
        <div class="hud-box">
            <div class="hud-header">
                <span style="color:#38bdf8;">RECORD ${window.playbackIndex} / ${total}</span>
                <span style="color:#94a3b8;">📅 ${formatDate(g("Date"))}</span>
            </div>
            <table class="hud-table">
                <tr><td>EXPORTER</td><td class="hud-val">${g("Exporter")}</td></tr>
                <tr><td>IMPORTER</td><td class="hud-val">${g("Importer")}</td></tr>
                <tr><td>ORIGIN</td><td class="hud-val">${g("Origin Country")}</td></tr>
                <tr><td>DESTINATION</td><td class="hud-val">${g("Destination Country")}</td></tr>
                <tr><td>PRODUCT</td><td class="hud-val">${g("PRODUCT")}</td></tr>
                <tr><td>HS CODE</td><td class="hud-val">${g("HS Code")}</td></tr>
                <tr><td>BRAND</td><td class="hud-val">${g("BRAND")}</td></tr>
                <tr><td>VARIANT</td><td class="hud-val">${g("VARIANT")}</td></tr>
                <tr><td>WEIGHT</td><td class="hud-val">${g("Weight(Kg)")} Kg</td></tr>
                <tr><td>QUANTITY</td><td class="hud-val">${g("Quantity")} ${g("Quantity Unit") !== 'N/A' ? g("Quantity Unit") : ''}</td></tr>
                <tr><td>VALUE</td><td class="hud-val-green">$${g("Amount($)")}</td></tr>
            </table>
        </div>
    `;
    frame.appendChild(hud);

    // Focus single line on map for active playback step
    if (window.LMap) {
        const oC = g("Origin Country");
        const dC = g("Destination Country");
        const fb1 = window.lookupCoord(g("Origin Port") !== 'N/A' ? g("Origin Port") : oC);
        const fb2 = window.lookupCoord(g("Destination Port") !== 'N/A' ? g("Destination Port") : dC);
        
        L.polyline(window.getCurvedPoints([fb1.lat, fb1.lng], [fb2.lat, fb2.lng]), {
            color: '#38bdf8', weight: 4, opacity: 0.9
        }).addTo(window.LMap);
    }
};

/* ================= PORT SPREADSHEET PARSER ================= */

window.handlePortCoordinateUpload = function(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();

    if (file.name.endsWith('.csv')) {
        reader.onload = function(e) {
            const lines = e.target.result.split('\n');
            if (lines.length > 1) {
                const headers = lines[0].split(',').map(h => normalizeHeader(h));
                lines.slice(1).forEach(l => {
                    const cols = l.split(',');
                    if (cols.length >= 3) {
                        const port = cols[0]?.trim();
                        const lat = parseFloat(cols[headers.indexOf('latitude') !== -1 ? headers.indexOf('latitude') : 1]);
                        const lng = parseFloat(cols[headers.indexOf('longitude') !== -1 ? headers.indexOf('longitude') : 2]);
                        if (port && !isNaN(lat) && !isNaN(lng)) {
                            window.customCoords[port] = { lat, lng };
                        }
                    }
                });
                alert('Port Coordinates Loaded Successfully!');
                window.recomputeViz();
            }
        };
        reader.readAsText(file);
    } else {
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet);

                json.forEach(row => {
                    let port = row['Port'] || row['Country'] || row['Facility'] || row['Short Code'];
                    let lat = parseFloat(row['Latitude'] || row['lat'] || row['Lat']);
                    let lng = parseFloat(row['Longitude'] || row['lng'] || row['Long'] || row['Lon']);

                    if (port && !isNaN(lat) && !isNaN(lng)) {
                        window.customCoords[String(port).trim()] = { lat, lng };
                    }
                });
                alert('Port Coordinates Loaded Successfully!');
                window.recomputeViz();
            } catch (err) {
                alert('Failed to parse coordinate XLSX file. Ensure file has columns: Port/Country, Latitude, Longitude.');
            }
        };
        reader.readAsArrayBuffer(file);
    }
};

// Geocoding Fallbacks
window.lookupCoord = function(name) {
    if (!name) return { lat: 20.0, lng: 0.0 };
    const key = String(name).toUpperCase().trim();
    const map = {
        'INDIA': { lat: 20.5937, lng: 78.9629 },
        'CHINA': { lat: 35.8617, lng: 104.1954 },
        'TURKEY': { lat: 38.9637, lng: 35.2433 },
        'ARMENIA': { lat: 40.0691, lng: 45.0382 },
        'UNITED KINGDOM': { lat: 55.3781, lng: -3.4360 },
        'UNITED STATES': { lat: 37.0902, lng: -95.7129 },
        'BRAZIL': { lat: -14.2350, lng: -51.9253 }
    };
    return map[key] || window.customCoords[key] || { lat: (key.length * 7) % 50, lng: (key.length * 13) % 120 };
};

window.getCurvedPoints = function(start, end) {
    const lat1 = start[0], lng1 = start[1];
    const lat2 = end[0], lng2 = end[1];
    const midLat = (lat1 + lat2) / 2 + (lng2 - lng1) * 0.12;
    const midLng = (lng1 + lng2) / 2 - (lat2 - lat1) * 0.12;

    const points = [];
    for (let t = 0; t <= 1; t += 0.05) {
        const curLat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2;
        const curLng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * midLng + t * t * lng2;
        points.push([curLat, curLng]);
    }
    return points;
};
