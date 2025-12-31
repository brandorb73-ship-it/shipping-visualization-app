/**
 * BRANDORB VISUALS ENGINE - FINAL REVISION
 */

// PDF DOWNLOAD FUNCTION
window.downloadPDF = function() {
    const element = document.getElementById('map-frame');
    html2canvas(element, { useCORS: true, allowTaint: true }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `BrandOrb_Intelligence_Report_${Date.now()}.png`;
        link.href = imgData;
        link.click();
    });
};

window.populateFilters = function() {
    if (!window.rawData) return;
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
    const typeF = document.getElementById('entity-type-filter').value;
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    const headers = window.rawData[0];
    const idx = (n) => headers.indexOf(n);

    const groupedData = {};
    window.rawData.slice(1).forEach(r => {
        const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}`;
        
        // Entity Type Filter Logic
        let typeMatch = true;
        if(typeF === "Exporter") typeMatch = r[idx("Exporter")].toLowerCase().includes(search);
        else if(typeF === "Importer") typeMatch = r[idx("Importer")].toLowerCase().includes(search);
        else typeMatch = r[idx("Exporter")].toLowerCase().includes(search) || r[idx("Importer")].toLowerCase().includes(search) || r[idx("PRODUCT")].toLowerCase().includes(search);

        const oMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const dMatch = destF === 'All' || r[idx("Destination Country")] === destF;

        if (typeMatch && oMatch && dMatch) {
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
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    groupedShipments.forEach(shipments => {
        const first = shipments[0];
        const lat1 = parseFloat(first[idx("Origin latitude")]), lng1 = parseFloat(first[idx("Origin longitude")]);
        const lat2 = parseFloat(first[idx("Destination latitude")]), lng2 = parseFloat(first[idx("Destination longitude")]);

        if(!isNaN(lat1) && !isNaN(lat2)) {
            // FIX: Leaflet.curve implementation
            const path = L.curve(['M', [lat1, lng1], 'Q', [(lat1+lat2)/2 + 5, (lng1+lng2)/2 + 5], [lat2, lng2]], {
                color: first[idx("COLOR")] || '#0ea5e9', weight: 3, fill: false
            }).addTo(window.LMap);

            const shipmentHTML = shipments.map(s => `
                <div style="border-top:1px solid #ddd; margin-top:5px; padding-top:5px; font-size:11px;">
                    <b>Product:</b> ${s[idx("PRODUCT")]}<br>
                    <b>Qty:</b> ${s[idx("Quantity")]} | <b>Val:</b> $${s[idx("Value(USD)")]}<br>
                    <b>Date:</b> ${s[idx("Date")]}
                </div>`).join('');

            path.bindPopup(`<b>${first[idx("Exporter")]}</b> (${first[idx("Origin Country")]})<br>→ <b>${first[idx("Importer")]}</b><br>${shipmentHTML}`);
        }
    });
};

window.drawCluster = function(data, idx, searchTerm) {
    const frame = document.getElementById('map-frame');
    frame.style.background = "#f1f5f9"; // Light Grey Background
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

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(130)).force("charge", d3.forceManyBody().strength(-400)).force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "#334155").attr("stroke-width", 2.5).attr("stroke-opacity", 0.9)
        .on("click", (e, d) => {
            if(d.data) alert(`SHIPMENT INFO:\nProduct: ${d.data[idx("PRODUCT")]}\nQty: ${d.data[idx("Quantity")]}\nValue: $${d.data[idx("Value(USD)")]}\nTransport: ${d.data[idx("Mode of Transport")]}`);
        });

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y}).on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    // Country Node Icon (Globe) vs Entity Node (Circle)
    node.append("circle").attr("r", d => d.type === 'country' ? 22 : 14)
        .attr("fill", d => d.type === 'country' ? '#475569' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("text")
        .text(d => d.type === 'country' ? "🌐 " + d.id : d.id)
        .attr("y", 32).attr("text-anchor", "middle")
        .attr("fill", "#0f172a") // Dark labels for visibility
        .style("font-size", "11px").style("font-weight", "800");

    sim.on("tick", () => { link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y); node.attr("transform", d=>`translate(${d.x},${d.y})`); });
};
