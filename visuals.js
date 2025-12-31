/**
 * BRANDORB VISUALS - REFINED CLUSTER LAYOUT & STABILITY
 */

// FIX: Back Button logic to prevent logout
window.goBack = function() {
    document.getElementById('viz-header-ui').style.display = 'none';
    // Ensure this matches the ID of your main list container in index.html
    const listView = document.getElementById('list-view') || document.getElementById('landing-page');
    const listHeader = document.getElementById('list-header');
    if(listView) listView.style.display = 'block';
    if(listHeader) listHeader.style.display = 'flex';
    
    document.getElementById('viz-container').style.display = 'none';
    document.getElementById('map-frame').innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }
};

window.populateFilters = function() {
    if (!window.rawData) return;
    window.cleanHeaders = window.rawData[0].map(h => h.trim().replace(/^\uFEFF/, ''));
    const h = window.cleanHeaders;
    const data = window.rawData.slice(1);
    const fill = (id, col, lbl) => {
        const i = h.indexOf(col);
        const el = document.getElementById(id);
        if (i === -1 || !el) return;
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country', 'Countries');
    fill('dest-filter', 'Destination Country', 'Countries');
};

window.recomputeViz = function() {
    if (!window.cleanHeaders) window.populateFilters();
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    const h = window.cleanHeaders;
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
            const ant = L.polyline.antPath(latlngs, { color: f[idx("COLOR")] || '#0ea5e9', weight: 3 }).addTo(window.LMap);

            const tableRows = group.map(s => {
                let rawDate = s[idx("Date")] || "N/A";
                let cleanDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
                return `<tr><td>${cleanDate}</td><td>${s[idx("PRODUCT")]}</td><td>${s[idx("Quantity")]}</td><td>$${s[idx("Value(USD)")]}</td><td>${s[idx("Mode of Transport")]}</td></tr>`
            }).join('');

            ant.bindPopup(`
                <div style="width:500px; font-family:sans-serif;">
                    <b>${f[idx("Exporter")]}</b> (${f[idx("Origin Country")]})<br>
                    <b>${f[idx("Importer")]}</b> (${f[idx("Destination Country")]})<br>
                    <b>Route:</b> ${f[idx("Origin Port")]} to ${f[idx("Destination Port")]}
                    <div class="popup-table-container">
                        <table class="popup-table">
                            <thead><tr><th>Date</th><th>PRODUCT</th><th>Qty</th><th>Value</th><th>Mode</th></tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </div>`, { maxWidth: 550 });
        }
    });
};

window.drawCluster = function(data, idx) {
    if (idx("Exporter") === -1) return console.error("Cluster Columns Missing");

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
        links.push({source: exp, target: imp, type: 'trade'}, {source: exp, target: oC, type: 'loc'}, {source: imp, target: dC, type: 'loc'});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("center", d3.forceCenter(width / 2, height / 2))
        // CUSTOM FORCE: Push countries to edges
        .force("x", d3.forceX().x(d => d.type === 'country' ? (d.id.charCodeAt(0) % 2 === 0 ? 50 : width - 50) : width / 2).strength(d => d.type === 'country' ? 0.8 : 0.1))
        .force("y", d3.forceY().y(d => d.type === 'country' ? (d.id.charCodeAt(1) % 2 === 0 ? 50 : height - 50) : height / 2).strength(d => d.type === 'country' ? 0.8 : 0.1));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'loc' ? "#cbd5e1" : "#1e293b").attr("stroke-width", 2).attr("stroke-opacity", 0.4);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag()
        .on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'country' ? 25 : 15)
        .attr("fill", d => d.type === 'country' ? '#1e293b' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("text").text(d => d.type === 'country' ? "🌐 " + d.id : d.id)
        .attr("y", 40).attr("text-anchor", "middle").style("font-size", "11px").style("font-weight", "bold").style("fill", "#334155");

    sim.on("tick", () => { 
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y); 
        node.attr("transform", d=>`translate(${d.x},${d.y})`); 
    });
};
