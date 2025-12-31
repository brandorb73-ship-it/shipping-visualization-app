/**
 * BRANDORB VISUALS ENGINE
 */

window.populateFilters = function() {
    if (!window.rawData || window.rawData.length < 1) return;
    const headers = window.rawData[0];
    const data = window.rawData.slice(1);

    const fill = (id, headerName, label) => {
        const i = headers.indexOf(headerName);
        const el = document.getElementById(id);
        if (i === -1 || !el) return;
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${label}</option>` + 
                       vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };

    fill('orig-filter', 'Origin Country', 'Origin Countries');
    fill('dest-filter', 'Destination Country', 'Destination Countries');
};

window.recomputeViz = function() {
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    const headers = window.rawData[0];
    const idx = (n) => headers.indexOf(n);

    // Grouping for Map Arcs (one arc per pair with multi-shipment popup)
    const groupedData = {};
    window.rawData.slice(1).forEach(r => {
        const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}`;
        const searchMatch = r[idx("Exporter")].toLowerCase().includes(search) || 
                            r[idx("Importer")].toLowerCase().includes(search) ||
                            r[idx("PRODUCT")].toLowerCase().includes(search);
        const oMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const dMatch = destF === 'All' || r[idx("Destination Country")] === destF;

        if (searchMatch && oMatch && dMatch) {
            if (!groupedData[key]) groupedData[key] = [];
            groupedData[key].push(r);
        }
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if(window.LMap) { window.LMap.remove(); window.LMap = null; }

    if(tab === 'MAP') window.drawMap(Object.values(groupedData), idx); 
    else window.drawCluster(Object.values(groupedData).flat(), idx, search);
};

window.drawMap = function(groupedShipments, idx) {
    // LIGHT THEME MAP
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    groupedShipments.forEach(shipments => {
        const first = shipments[0];
        const lat1 = parseFloat(first[idx("Origin latitude")]), lng1 = parseFloat(first[idx("Origin longitude")]);
        const lat2 = parseFloat(first[idx("Destination latitude")]), lng2 = parseFloat(first[idx("Destination longitude")]);

        if(!isNaN(lat1) && !isNaN(lat2)) {
            // CURVED ARCS
            const latlngs = [[lat1, lng1], [lat2, lng2]];
            const offsetX = lng2 - lng1, offsetY = lat2 - lat1;
            const r = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));
            const theta = Math.atan2(offsetY, offsetX);
            const thetaOffset = 0.3; // Curvature amount
            const controlPoint = [
                lat1 + (r/2) * Math.sin(theta + thetaOffset),
                lng1 + (r/2) * Math.cos(theta + thetaOffset)
            ];

            const path = L.curve(['M', [lat1, lng1], 'Q', controlPoint, [lat2, lng2]], {
                color: first[idx("COLOR")] || '#0ea5e9', weight: 3, fill: false
            }).addTo(window.LMap);

            // Detailed Multi-Shipment Popup
            const shipmentHTML = shipments.map(s => `
                <div style="border-top:1px solid #ddd; padding-top:5px; margin-top:5px; font-size:11px;">
                    <b>Date:</b> ${s[idx("Date")]}<br>
                    <b>Product:</b> ${s[idx("PRODUCT")]}<br>
                    <b>Transport:</b> ${s[idx("Mode of Transport")]}
                </div>`).join('');

            path.bindPopup(`
                <div style="max-height:250px; overflow-y:auto;">
                    <strong style="color:#0ea5e9">${first[idx("Exporter")]}</strong> (${first[idx("Origin Country")]})<br>
                    <i class="fas fa-long-arrow-alt-right"></i> <strong style="color:#f43f5e">${first[idx("Importer")]}</strong> (${first[idx("Destination Country")]})
                    ${shipmentHTML}
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
        const oC = r[idx("Origin Country")], dC = r[idx("Destination Country")];

        if(!nodeSet.has(exp)) { nodes.push({id: exp, type: 'exp'}); nodeSet.add(exp); }
        if(!nodeSet.has(imp)) { nodes.push({id: imp, type: 'imp'}); nodeSet.add(imp); }
        if(!nodeSet.has(oC)) { nodes.push({id: oC, type: 'country'}); nodeSet.add(oC); }
        if(!nodeSet.has(dC)) { nodes.push({id: dC, type: 'country'}); nodeSet.add(dC); }

        links.push({source: exp, target: imp, data: r, type: 'trade'});
        links.push({source: exp, target: oC, type: 'loc'});
        links.push({source: imp, target: dC, type: 'loc'});
    });

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(120)).force("charge", d3.forceManyBody().strength(-300)).force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'loc' ? "#cbd5e1" : "#334155")
        .attr("stroke-width", d => d.type === 'loc' ? 1 : 2.5)
        .attr("stroke-opacity", 0.8)
        .on("click", (e, d) => {
            if(d.data) alert(`Trade Info:\nProduct: ${d.data[idx("PRODUCT")]}\nDate: ${d.data[idx("Date")]}\nValue: $${d.data[idx("Value(USD)")]}`);
        });

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y}).on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'country' ? 20 : 12)
        .attr("fill", d => d.type === 'country' ? '#94a3b8' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("text").text(d => d.id).attr("y", 28).attr("text-anchor", "middle").attr("fill", "#1e293b").style("font-size", "10px").style("font-weight", "bold");

    sim.on("tick", () => { link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y); node.attr("transform", d=>`translate(${d.x},${d.y})`); });
};
