/**
 * BRANDORB VISUALS - FINAL PRODUCTION SCRIPT
 */

const PRODUCT_PALETTE = {
    'Electronics': '#3b82f6',
    'Textiles': '#8b5cf6',
    'Food': '#10b981',
    'Machinery': '#f59e0b',
    'Chemicals': '#ef4444',
    'Automotive': '#6366f1',
    'Default': '#0ea5e9'
};

// IMPROVED DOWNLOAD: Captures Map, Lines, and Legend
window.downloadPDF = function() {
    const target = document.getElementById('map-frame');
    
    // Ensure Leaflet tiles are loaded before capture
    html2canvas(target, {
        useCORS: true, 
        allowTaint: true,
        backgroundColor: '#f1f5f9',
        scale: 2 // High resolution
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `BrandOrb_Report_${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
};

window.populateFilters = function() {
    if (!window.rawData) return;
    const h = window.rawData[0];
    const data = window.rawData.slice(1);
    const fill = (id, col, lbl) => {
        const i = h.indexOf(col);
        const el = document.getElementById(id);
        if (i === -1) return;
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country', 'Countries');
    fill('dest-filter', 'Destination Country', 'Countries');
};

// NEW: Adds a visual legend to the corner of the map
function drawLegend(data, idx) {
    const existing = document.getElementById('viz-legend');
    if (existing) existing.remove();

    const products = [...new Set(data.map(r => r[idx("PRODUCT")]))].filter(v => v);
    if (products.length === 0) return;

    const legend = document.createElement('div');
    legend.id = 'viz-legend';
    legend.style = `
        position: absolute; bottom: 20px; left: 20px; z-index: 1000;
        background: white; padding: 10px; border-radius: 6px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1); font-size: 11px;
    `;
    
    legend.innerHTML = '<div style="font-weight:bold; margin-bottom:5px;">Product Key</div>';
    products.forEach(p => {
        const color = PRODUCT_PALETTE[p] || PRODUCT_PALETTE.Default;
        legend.innerHTML += `
            <div style="display:flex; align-items:center; margin-bottom:3px;">
                <div style="width:12px; height:12px; background:${color}; margin-right:8px; border-radius:2px;"></div>
                ${p}
            </div>`;
    });
    document.getElementById('map-frame').appendChild(legend);
}

window.recomputeViz = function() {
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    const h = window.rawData[0];
    const idx = (n) => h.indexOf(n);

    const filtered = [];
    window.rawData.slice(1).forEach(r => {
        const oMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const dMatch = destF === 'All' || r[idx("Destination Country")] === destF;
        const sMatch = (r[idx("Exporter")] + r[idx("Importer")] + r[idx("PRODUCT")]).toLowerCase().includes(search);

        if (oMatch && dMatch && sMatch) filtered.push(r);
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    drawLegend(filtered, idx);

    if (window.currentTab === 'MAP') {
        const groups = {};
        filtered.forEach(r => {
            const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        window.drawMap(Object.values(groups), idx);
    } else {
        window.drawCluster(filtered, idx);
    }
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame', { preferCanvas: false }).setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { crossOrigin: true }).addTo(window.LMap);

    groups.forEach(group => {
        const f = group[0];
        const p1 = [parseFloat(f[idx("Origin latitude")]), parseFloat(f[idx("Origin longitude")])];
        const p2 = [parseFloat(f[idx("Destination latitude")]), parseFloat(f[idx("Destination longitude")])];

        if (!isNaN(p1[0]) && !isNaN(p2[0])) {
            const offsetX = (p2[1] - p1[1]) * 0.15;
            const offsetY = (p1[0] - p2[0]) * 0.15;
            const mid = [(p1[0] + p2[0]) / 2 + offsetY, (p1[1] + p2[1]) / 2 + offsetX];
            
            const curvePath = L.curve(['M', p1, 'Q', mid, p2]);
            const latlngs = curvePath.getPath().filter(item => Array.isArray(item)).map(c => L.latLng(c[0], c[1]));
            const prodColor = PRODUCT_PALETTE[f[idx("PRODUCT")]] || f[idx("COLOR")] || PRODUCT_PALETTE.Default;

            const ant = L.polyline.antPath(latlngs, { color: prodColor, weight: 3, delay: 1200 }).addTo(window.LMap);

            const tableRows = group.map(s => `
                <tr>
                    <td>${s[idx("Date")] || 'N/A'}</td>
                    <td>${s[idx("Quantity")]}</td>
                    <td>$${s[idx("Value(USD)")]}</td>
                    <td>${s[idx("PRODUCT")]}</td>
                </tr>`).join('');

            ant.bindPopup(`
                <div style="width:320px; max-height:200px; overflow-y:auto; font-size:11px;">
                    <b>${f[idx("Exporter")]}</b> → <b>${f[idx("Importer")]}</b>
                    <table class="popup-table">
                        <thead><tr><th>Date</th><th>Qty</th><th>Value</th><th>Prod</th></tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>`);
        }
    });
};

window.drawCluster = function(data, idx) {
    const frame = document.getElementById('map-frame');
    const width = frame.clientWidth, height = frame.clientHeight;
    const svg = d3.select("#map-frame").append("svg").attr("width", "100%").attr("height", "100%");
    const g = svg.append("g");
    svg.call(d3.zoom().on("zoom", (e) => g.attr("transform", e.transform)));

    let nodes = [], links = [], nodeSet = new Set();
    data.forEach(r => {
        const exp = r[idx("Exporter")], imp = r[idx("Importer")], oC = r[idx("Origin Country")], dC = r[idx("Destination Country")];
        [exp, imp, oC, dC].forEach(id => {
            if(id && !nodeSet.has(id)) { 
                nodes.push({id, type: (id===oC||id===dC)?'country':(id===exp?'exp':'imp')}); 
                nodeSet.add(id); 
            }
        });
        links.push({source: exp, target: imp, data: r});
    });

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(150)).force("charge", d3.forceManyBody().strength(-600)).force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => PRODUCT_PALETTE[d.data[idx("PRODUCT")]] || "#cbd5e1")
        .attr("stroke-width", 3).attr("stroke-opacity", 0.6)
        .on("click", (e, d) => {
            d3.selectAll(".cluster-pop").remove();
            const pop = d3.select("#map-frame").append("div").attr("class", "cluster-pop")
                .style("left", (e.offsetX + 15) + "px").style("top", (e.offsetY) + "px")
                .html(`<b>${d.data[idx("PRODUCT")]}</b><hr>Qty: ${d.data[idx("Quantity")]}<br>Value: $${d.data[idx("Value(USD)")]}<br><button onclick="this.parentElement.remove()" style="width:100%; margin-top:5px;">Close</button>`);
        });

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", (e,d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; }).on("drag", (e,d) => { d.fx=e.x; d.fy=e.y; }).on("end", (e,d) => { if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; }));

    node.append("circle").attr("r", d => d.type === 'country' ? 28 : 20)
        .attr("fill", d => d.type === 'country' ? '#1e293b' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("foreignObject").attr("x", d => d.type === 'country' ? -9 : -7).attr("y", d => d.type === 'country' ? -12 : -10).attr("width", 20).attr("height", 20)
        .html(d => `<i class="fas ${d.type==='country'?'fa-globe':(d.type==='exp'?'fa-building':'fa-store')}" style="color:white; font-size:${d.type==='country'?'18px':'14px'}"></i>`);

    node.append("text").text(d => d.id).attr("y", 45).attr("text-anchor", "middle").style("font-size", "10px").style("font-weight", "bold");

    sim.on("tick", () => { link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y); node.attr("transform", d=>`translate(${d.x},${d.y})`); });
};
