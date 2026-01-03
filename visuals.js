/**
 * BRANDORB VISUALS - PRODUCTION STABLE
 */
window.clusterMode = 'COUNTRY';

window.recomputeViz = function() {
    if (!window.rawData) return;
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    
    // HEADER INDEXER WITH AUTO-TRIM (Fixes the "undefined" issues)
    const h = window.rawData[0].map(v => v.trim());
    const idx = (n) => h.indexOf(n);

    const filteredRows = window.rawData.slice(1).filter(r => {
        if (!r[idx("Exporter")]) return false;
        const oMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const dMatch = destF === 'All' || r[idx("Destination Country")] === destF;
        const sMatch = (r[idx("Exporter")] + r[idx("Importer")] + (r[idx("PRODUCT")]||"")).toLowerCase().includes(search);
        return oMatch && dMatch && sMatch;
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    if (window.currentTab === 'MAP') {
        const groups = {};
        filteredRows.forEach(r => {
            const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        window.drawMap(Object.values(groups), idx);
    } else {
        frame.insertAdjacentHTML('afterbegin', `
            <div class="viz-controls">
                <button class="toggle-btn ${window.clusterMode==='COUNTRY'?'active':''}" onclick="window.clusterMode='COUNTRY'; recomputeViz()">Group by Country</button>
                <button class="toggle-btn ${window.clusterMode==='PRODUCT'?'active':''}" onclick="window.clusterMode='PRODUCT'; recomputeViz()">Group by Product</button>
            </div>`);
        window.drawCluster(filteredRows, idx);
    }
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    groups.forEach(group => {
        const f = group[0];
        const p1 = [parseFloat(f[idx("Origin latitude")]), parseFloat(f[idx("Origin longitude")])];
        const p2 = [parseFloat(f[idx("Destination latitude")]), parseFloat(f[idx("Destination longitude")])];

        if (!isNaN(p1[0]) && !isNaN(p2[0])) {
            // SMOOTH ARC MATH
            const offsetX = (p2[1] - p1[1]) * 0.25;
            const offsetY = (p1[0] - p2[0]) * 0.25;
            const mid = [(p1[0] + p2[0]) / 2 + offsetY, (p1[1] + p2[1]) / 2 + offsetX];
            
            const curve = L.curve(['M', p1, 'Q', mid, p2], {
                color: f[idx("COLOR")] || '#0ea5e9', 
                fill: false, weight: 3
            });

            // Convert curve to points for AntPath
            const latlngs = curve.getPath().filter(item => Array.isArray(item)).map(c => L.latLng(c[0], c[1]));
            
            const ant = L.polyline.antPath(latlngs, { 
                color: f[idx("COLOR")] || '#0ea5e9', 
                weight: 3, 
                pulseColor: '#ffffff',
                delay: 1000 
            }).addTo(window.LMap);

            const tableRows = group.map(s => `
                <tr>
                    <td>${s[idx("Date")] || 'N/A'}</td>
                    <td>${s[idx("Quantity")]}</td>
                    <td>$${s[idx("Value(USD)")]}</td>
                    <td>${s[idx("PRODUCT")]}</td>
                    <td>${s[idx("Mode of Transport")] || 'N/A'}</td>
                </tr>`).join('');

            ant.bindPopup(`
                <div style="width:380px; font-size:12px;">
                    <b>Exporter:</b> ${f[idx("Exporter")]} (${f[idx("Origin Country")]})<br>
                    <b>Importer:</b> ${f[idx("Importer")]} (${f[idx("Destination Country")]})<br>
                    <b>Ports:</b> ${f[idx("Origin Port")] || 'N/A'} → ${f[idx("Destination Port")] || 'N/A'}
                    <table class="popup-table">
                        <thead><tr><th>Date</th><th>Quantity</th><th>Value (USD)</th><th>PRODUCT</th><th>Mode</th></tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>`, { maxWidth: 400 });
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
        const exp = r[idx("Exporter")], imp = r[idx("Importer")];
        const oC = r[idx("Origin Country")], dC = r[idx("Destination Country")];
        const prod = r[idx("PRODUCT")];

        const parent1 = window.clusterMode === 'COUNTRY' ? oC : prod;
        const parent2 = window.clusterMode === 'COUNTRY' ? dC : prod;

        [parent1, parent2, exp, imp].forEach((id, i) => {
            if(id && !nodeSet.has(id)) {
                nodes.push({id, type: i < 2 ? 'parent' : (i === 2 ? 'exp' : 'imp')});
                nodeSet.add(id);
            }
        });
        links.push({source: exp, target: imp, type: 'trade', data: r});
        links.push({source: parent1, target: exp, type: 'geo'});
        links.push({source: parent2, target: imp, type: 'geo'});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.type === 'geo' ? 60 : 180))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'geo' ? "#e2e8f0" : "#94a3b8")
        .attr("stroke-width", 2);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'parent' ? 24 : 18)
        .attr("fill", d => d.type === 'parent' ? '#1e293b' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("foreignObject").attr("x", -9).attr("y", -11).attr("width", 20).attr("height", 20)
        .html(d => `<i class="fas ${d.type==='parent'?'fa-globe':(d.type==='exp'?'fa-building':'fa-store')}" style="color:white; font-size:14px"></i>`);

    node.append("text").text(d => d.id).attr("y", 40).attr("text-anchor", "middle").style("font-size", "10px").style("font-weight", "bold");

    link.filter(d => d.type === 'trade').on("click", (e, d) => {
        d3.selectAll(".cluster-pop").remove();
        d3.select("#map-frame").append("div").attr("class", "cluster-pop")
            .style("left", e.offsetX + "px").style("top", e.offsetY + "px")
            .html(`<span class="pop-close" onclick="this.parentElement.remove()">×</span>
                   <strong style="color:#0ea5e9">${d.data[idx("PRODUCT")]}</strong><br>
                   <b>Date:</b> ${d.data[idx("Date")] || 'N/A'}<br>
                   <b>Value:</b> $${d.data[idx("Value(USD)")]}`);
    });

    sim.on("tick", () => {
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
        node.attr("transform", d=>`translate(${d.x},${d.y})`);
    });
};
