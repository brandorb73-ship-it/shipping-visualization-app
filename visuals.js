/**
 * BRANDORB VISUALS - REPAIR COMPLETE
 */

// Fix PDF Download for Map Background
window.downloadPDF = function() {
    const element = document.getElementById('map-frame');
    html2canvas(element, {
        useCORS: true, 
        allowTaint: false,
        backgroundColor: "#f1f5f9",
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `BrandOrb_Report_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
};

window.populateFilters = function() {
    if (!window.rawData) return;
    // Clean headers to fix hidden characters (Solves Date N/A)
    const h = window.rawData[0].map(s => s.trim().replace(/^\uFEFF/, ''));
    window.cleanHeaders = h;

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

window.recomputeViz = function() {
    const search = document.getElementById('ent-search').value.toLowerCase();
    const h = window.cleanHeaders;
    const idx = (n) => h.indexOf(n);

    const filtered = {};
    window.rawData.slice(1).forEach(r => {
        const sMatch = (r[idx("Exporter")] + r[idx("Importer")] + r[idx("PRODUCT")]).toLowerCase().includes(search);
        if (sMatch) {
            const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}`;
            if (!filtered[key]) filtered[key] = [];
            filtered[key].push(r);
        }
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    if (tab === 'MAP') window.drawMap(Object.values(filtered), idx);
    else window.drawCluster(Object.values(filtered).flat(), idx);
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    // Added crossOrigin for PDF support
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        crossOrigin: true
    }).addTo(window.LMap);

    const dateIdx = window.cleanHeaders.findIndex(h => h.toLowerCase().includes("date"));

    groups.forEach(group => {
        const f = group[0];
        const p1 = [parseFloat(f[idx("Origin latitude")]), parseFloat(f[idx("Origin longitude")])];
        const p2 = [parseFloat(f[idx("Destination latitude")]), parseFloat(f[idx("Destination longitude")])];

        if (!isNaN(p1[0]) && !isNaN(p2[0])) {
            const controlPoint = [(p1[0] + p2[0]) / 2 + 5, (p1[1] + p2[1]) / 2 + 5];
            const curvePath = L.curve(['M', p1, 'Q', controlPoint, p2]);
            const latlngs = curvePath.getPath().filter(item => Array.isArray(item)).map(c => L.latLng(c[0], c[1]));
            
            const ant = L.polyline.antPath(latlngs, { color: f[idx("COLOR")] || '#0ea5e9', weight: 3 }).addTo(window.LMap);

            const tableRows = group.map(s => `
                <tr>
                    <td>${s[dateIdx] || 'N/A'}</td>
                    <td>${s[idx("Quantity")]}</td>
                    <td>$${s[idx("Value(USD)")]}</td>
                    <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis;">${s[idx("PRODUCT")]}</td>
                    <td>${s[idx("Mode of Transport")]}</td>
                </tr>`).join('');

            ant.bindPopup(`
                <div style="width:550px;">
                    <b>Exporter:</b> ${f[idx("Exporter")]} (${f[idx("Origin Country")]})<br>
                    <b>Importer:</b> ${f[idx("Importer")]} (${f[idx("Destination Country")]})
                    <div class="popup-table-container">
                        <table class="popup-table">
                            <thead><tr><th>Date</th><th>Qty</th><th>Value</th><th>Product</th><th>Mode</th></tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </div>
            `, { maxWidth: 600 });
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
        links.push({source: exp, target: imp, data: r, type: 'trade'});
        links.push({source: exp, target: oC, type: 'loc'});
        links.push({source: imp, target: dC, type: 'loc'});
    });

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(150)).force("charge", d3.forceManyBody().strength(-500)).force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'loc' ? "#cbd5e1" : "#1e293b").attr("stroke-width", 2);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y}).on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'country' ? 22 : 14).attr("fill", d => d.type === 'country' ? '#475569' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e')).attr("stroke", "#fff").attr("stroke-width", 2);
    node.append("text").text(d => d.type === 'country' ? "🌐 " + d.id : d.id).attr("y", 35).attr("text-anchor", "middle").attr("fill", "#0f172a").style("font-size", "11px").style("font-weight", "bold");

    sim.on("tick", () => { link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y); node.attr("transform", d=>`translate(${d.x},${d.y})`); });
};
