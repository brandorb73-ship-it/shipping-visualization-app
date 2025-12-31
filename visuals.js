/**
 * BRANDORB VISUALS - RECONCILED STABLE VERSION
 */

window.downloadPDF = function() {
    const element = document.getElementById('map-frame');
    html2canvas(element, {
        useCORS: true, 
        allowTaint: false,
        backgroundColor: "#f1f5f9",
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `BrandOrb_Export_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
};

window.populateFilters = function() {
    if (!window.rawData) return;
    const h = window.rawData[0].map(s => s.trim().replace(/^\uFEFF/, ''));
    window.cleanHeaders = h; // Store cleaned headers globally

    const data = window.rawData.slice(1);
    const fill = (id, col, lbl) => {
        const i = h.indexOf(col);
        const el = document.getElementById(id);
        if (i === -1) return;
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` + 
                       vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country', 'Countries');
    fill('dest-filter', 'Destination Country', 'Countries');
};

window.recomputeViz = function() {
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    
    // Clean headers for indexing
    const h = window.cleanHeaders || window.rawData[0].map(s => s.trim().replace(/^\uFEFF/, ''));
    const idx = (n) => h.indexOf(n);

    const filteredMap = {};
    const clusterList = [];

    window.rawData.slice(1).forEach(r => {
        const oMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const dMatch = destF === 'All' || r[idx("Destination Country")] === destF;
        const sMatch = (r[idx("Exporter")] + r[idx("Importer")] + r[idx("PRODUCT")]).toLowerCase().includes(search);

        if (oMatch && dMatch && sMatch) {
            clusterList.push(r);
            const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}`;
            if (!filteredMap[key]) filteredMap[key] = [];
            filteredMap[key].push(r);
        }
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    if (tab === 'MAP') window.drawMap(Object.values(filteredMap), idx);
    else window.drawCluster(clusterList, idx);
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { crossOrigin: true }).addTo(window.LMap);

    groups.forEach(group => {
        const f = group[0];
        const p1 = [parseFloat(f[idx("Origin latitude")]), parseFloat(f[idx("Origin longitude")])];
        const p2 = [parseFloat(f[idx("Destination latitude")]), parseFloat(f[idx("Destination longitude")])];

        if (!isNaN(p1[0]) && !isNaN(p2[0])) {
            const controlPoint = [(p1[0] + p2[0]) / 2 + 5, (p1[1] + p2[1]) / 2 + 5];
            const curvePath = L.curve(['M', p1, 'Q', controlPoint, p2]);
            const latlngs = curvePath.getPath().filter(item => Array.isArray(item)).map(coord => L.latLng(coord[0], coord[1]));
            
            const ant = L.polyline.antPath(latlngs, { color: f[idx("COLOR")] || '#0ea5e9', weight: 3, delay: 1000 }).addTo(window.LMap);

            const tableRows = group.map(s => `
                <tr>
                    <td>${s[idx("Date")] || 'N/A'}</td>
                    <td style="white-space:normal; min-width:150px;">${s[idx("PRODUCT")]}</td>
                    <td>${s[idx("Quantity")]}</td>
                    <td>$${s[idx("Value(USD)")]}</td>
                    <td>${s[idx("Mode of Transport")]}</td>
                </tr>`).join('');

            ant.bindPopup(`
                <div style="width:550px; font-family: sans-serif; color: #1e293b;">
                    <div style="margin-bottom: 8px; font-size: 13px;">
                        <b>${f[idx("Exporter")]}</b> (${f[idx("Origin Country")]})<br>
                        <b>${f[idx("Importer")]}</b> (${f[idx("Destination Country")]})<br>
                        <b>Route:</b> ${f[idx("Origin Port")]} to ${f[idx("Destination Port")]}
                    </div>
                    <div class="popup-table-container">
                        <table class="popup-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>PRODUCT</th>
                                    <th>Quantity</th>
                                    <th>Value (USD)</th>
                                    <th>Mode</th>
                                </tr>
                            </thead>
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

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'loc' ? "#cbd5e1" : "#1e293b")
        .attr("stroke-width", 2);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag()
        .on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y})
        .on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'country' ? 20 : 12)
        .attr("fill", d => d.type === 'country' ? '#475569' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff");

    node.append("text").text(d => d.type === 'country' ? "🌐 " + d.id : d.id)
        .attr("y", 30).attr("text-anchor", "middle").attr("fill", "#0f172a")
        .style("font-size", "10px").style("font-weight", "bold");

    sim.on("tick", () => { 
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y); 
        node.attr("transform", d=>`translate(${d.x},${d.y})`); 
    });
};
