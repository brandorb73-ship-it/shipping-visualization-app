/**
 * BRANDORB VISUALS - STABLE VERSION
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

    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    const opF = document.getElementById('orig-port-filter').value;
    const dpF = document.getElementById('dest-port-filter').value;

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

/* ================= ROUTE MAP (UNCHANGED) ================= */

window.drawMap = function(groups, idx) {
    const routeLayers = [];
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png')
        .addTo(window.LMap);

    groups.forEach((group, gIdx) => {
        window.buildColorLegend(routeLayers);
        const f = group[0];

        const lat1 = parseFloat(f[idx("Origin latitude")]);
        const lon1 = parseFloat(f[idx("Origin longitude")]);
        const lat2 = parseFloat(f[idx("Destination latitude")]);
        const lon2 = parseFloat(f[idx("Destination longitude")]);

        if (isNaN(lat1) || isNaN(lat2)) return;

        const jitter = gIdx * 0.015;
        const originLat = lat1 + jitter;
        const originLon = lon1 + jitter;
        const destLat = lat2 + jitter;
        const destLon = lon2 + jitter;

        const ant = L.polyline.antPath(
            [[originLat, originLon], [destLat, destLon]],
            {
                color: f[idx("COLOR")]?.trim() || '#0ea5e9',
                weight: Math.min(2 + group.length * 0.6, 8),
                delay: 1000,
                dashArray: [10, 20]
            }
        ).addTo(window.LMap);

        routeLayers.push({ color: f[idx("COLOR")] || '#0ea5e9', layer: ant });

        L.circleMarker([originLat, originLon], {
            radius: 4,
            color: '#0f172a',
            fillColor: '#0ea5e9',
            fillOpacity: 1,
            weight: 1
        }).addTo(window.LMap);

        L.circleMarker([destLat, destLon], {
            radius: 4,
            color: '#0f172a',
            fillColor: '#f43f5e',
            fillOpacity: 1,
            weight: 1
        }).addTo(window.LMap);

        const tableRows = group.map(s => `
<tr>
<td style="white-space:nowrap;">${formatDate(s[idx("Date")])}</td>
<td>${s[idx("Quantity")] || '-'}</td>
<td>${s[idx("Weight(Kg)")] || '-'}</td>
<td>$${s[idx("Amount($)")] || '-'}</td>
<td>${s[idx("PRODUCT")]}</td>
<td>${s[idx("Mode of Transportation")] || '-'}</td>
</tr>`).join("");

const shipmentCount = group.length;
const totalQty = group.reduce((s,r)=>s+(+r[idx("Quantity")]||0),0);

ant.bindPopup(`
<div style="width:380px; max-height:280px; overflow-y:auto;">
<b>${shipmentCount} Shipments</b><br>
<b>Exporter:</b> ${f[idx("Exporter")]} (${f[idx("Origin Country")]})<br>
<b>Importer:</b> ${f[idx("Importer")]} (${f[idx("Destination Country")]})<br>
<b>Ports:</b> ${f[idx("Origin Port")] || 'N/A'} → ${f[idx("Destination Port")] || 'N/A'}<br>
<b>Total Quantity:</b> ${totalQty}
<table class="popup-table" style="margin-top:6px;">
<thead>
<tr>
<th style="min-width:90px; white-space:nowrap;">Date</th>
<th>Quantity</th>
<th>Weight (Kg)</th>
<th>Value (USD)</th>
<th>Product</th>
<th>Mode</th>
</tr>
</thead>
<tbody>
${tableRows}
</tbody>
</table>
</div>
`, { maxWidth: 420 });
});   // <-- closes groups.forEach
};

/* ================= CLUSTER (ONLY CHANGE HERE) ================= */

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

    /* 🔹 Invisible click layer (NEW) */
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

        // FIXED: Centered Icons
    node.append("foreignObject")
        .attr("width", 30)
        .attr("height", 30)
        // Center calculation: (width / -2) for horizontal and (height / -2) for vertical centering
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
    const legend = document.createElement("div");
    legend.className = "color-legend";
    legend.id = "color-legend";

    const colors = [...new Set(routes.map(r => r.color))];
    colors.forEach(color => {
        const row = document.createElement("div");
        row.className = "color-legend-item";
        row.innerHTML = `
<div class="color-legend-swatch" style="background:${color}"></div>
<span>${color}</span>`;
        legend.appendChild(row);
    });

    container.appendChild(legend);
};
