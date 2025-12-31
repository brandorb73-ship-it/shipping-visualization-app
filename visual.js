/**
 * BRANDORB VISUALS - Route Maps & Cluster Graphs
 */

window.populateFilters = function() {
    const headers = rawData[0];
    const idx = (n) => headers.indexOf(n);
    const data = rawData.slice(1);

    const fill = (id, headerName) => {
        const i = idx(headerName);
        if (i === -1) return;
        const vals = [...new Set(data.map(r => r[i]))].sort();
        document.getElementById(id).innerHTML = `<option value="All">All ${headerName}s</option>` + 
                                                 vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country');
    fill('dest-filter', 'Destination Country');
};

window.recomputeViz = function() {
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;

    const headers = rawData[0];
    const idx = (n) => headers.indexOf(n);

    const filtered = rawData.slice(1).filter(r => {
        const textMatch = r[idx("Exporter")].toLowerCase().includes(search) || 
                          r[idx("Importer")].toLowerCase().includes(search) ||
                          r[idx("PRODUCT")].toLowerCase().includes(search);
        const origMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const destMatch = destF === 'All' || r[idx("Destination Country")] === destF;
        return textMatch && origMatch && destMatch;
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if(LMap) { LMap.remove(); LMap = null; }

    if(tab === 'MAP') drawMap(filtered, idx); 
    else drawCluster(filtered, idx, search);
};

window.drawMap = function(data, idx) {
    LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(LMap);

    const shipments = {};
    data.forEach(r => {
        const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}`;
        if(!shipments[key]) shipments[key] = [];
        shipments[key].push(r);
    });

    Object.values(shipments).forEach(group => {
        const r = group[0];
        const lat1 = parseFloat(r[idx("Origin latitude")]), lng1 = parseFloat(r[idx("Origin longitude")]);
        const lat2 = parseFloat(r[idx("Destination latitude")]), lng2 = parseFloat(r[idx("Destination longitude")]);

        if(!isNaN(lat1) && !isNaN(lat2)) {
            const antPath = L.polyline.antPath([[lat1, lng1], [lat2, lng2]], {
                delay: 1000, color: r[idx("COLOR")] || '#ff4d4d', weight: group.length > 1 ? 6 : 3
            }).addTo(LMap);

            const itemsHtml = group.map(s => `
                <div class="shipment-item" style="border-bottom:1px solid #444; padding:5px 0;">
                    <div style="color:#38bdf8; font-weight:bold;">${s[idx("PRODUCT")]}</div>
                    <b>Val:</b> $${s[idx("Value(USD)")]} | <b>Qty:</b> ${s[idx("Quantity")]}<br>
                    <b>Date:</b> ${s[idx("Date")]} | <b>Mode:</b> ${s[idx("Mode of Transport")]}
                </div>
            `).join('');

            antPath.bindPopup(`
                <div style="min-width:240px; color:white">
                    <h4 style="margin:0; color:#38bdf8">${r[idx("Exporter")]} → ${r[idx("Importer")]}</h4>
                    <p style="font-size:11px; margin:5px 0;">${r[idx("Origin Port")]} <i class="fas fa-arrow-right"></i> ${r[idx("Destination Port")]}</p>
                    <div style="max-height:150px; overflow-y:auto">${itemsHtml}</div>
                </div>
            `);
        }
    });
};

window.drawCluster = function(data, idx, searchTerm) {
    const frame = document.getElementById('map-frame');
    const width = frame.clientWidth, height = frame.clientHeight;
    const svg = d3.select("#map-frame").append("svg").attr("width", "100%").attr("height", "100%");
    const g = svg.append("g");
    svg.call(d3.zoom().on("zoom", (e) => g.attr("transform", e.transform)));

    let nodes = [], links = [], nodeSet = new Set();
    data.forEach(r => {
        const exp = r[idx("Exporter")], imp = r[idx("Importer")];
        if(!nodeSet.has(exp)) { nodes.push({id: exp, type: 'exp', country: r[idx("Origin Country")]}); nodeSet.add(exp); }
        if(!nodeSet.has(imp)) { nodes.push({id: imp, type: 'imp', country: r[idx("Destination Country")]}); nodeSet.add(imp); }
        links.push({source: exp, target: imp, product: r[idx("PRODUCT")], val: r[idx("Value(USD)")], color: r[idx("COLOR")]});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(220))
        .force("charge", d3.forceManyBody().strength(-600))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("path").data(links).enter().append("path")
        .attr("stroke", d => d.color || "#38bdf8").attr("stroke-width", 2).attr("fill", "none")
        .attr("opacity", 0.6);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", 18)
        .attr("fill", d => d.type === 'exp' ? '#0ea5e9' : '#f43f5e')
        .attr("stroke", "#fff").attr("stroke-width", d => (searchTerm && d.id.toLowerCase().includes(searchTerm)) ? 4 : 1)
        .attr("class", d => (searchTerm && d.id.toLowerCase().includes(searchTerm)) ? "highlight-node" : "");

    node.append("text").text(d => d.id).attr("y", 30).attr("text-anchor", "middle").attr("fill", "white").style("font-size", "10px");
    node.append("text").text(d => d.country).attr("y", 40).attr("text-anchor", "middle").attr("fill", "#64748b").style("font-size", "8px");

    sim.on("tick", () => {
        link.attr("d", d => {
            const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, dr = Math.sqrt(dx * dx + dy * dy);
            return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
        });
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
};
