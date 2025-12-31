/**
 * BRANDORB VISUALS - TARGETED FIXES
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

// Helper to find column index (Case-insensitive)
const getIdx = (name) => {
    if (!window.cleanHeaders) return -1;
    const target = name.toLowerCase();
    return window.cleanHeaders.findIndex(h => h.toLowerCase().includes(target));
};

window.populateFilters = function() {
    if (!window.rawData || window.rawData.length === 0) return;
    
    // Clean headers for both Map and Cluster
    window.cleanHeaders = window.rawData[0].map(h => h.trim().replace(/^\uFEFF/, ''));
    
    const data = window.rawData.slice(1);
    const fill = (id, colKey, label) => {
        const i = getIdx(colKey);
        const el = document.getElementById(id);
        if (i === -1 || !el) return;
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${label}</option>` + 
                       vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };

    fill('orig-filter', 'Origin Country', 'Origins');
    fill('dest-filter', 'Destination Country', 'Destinations');
};

window.recomputeViz = function() {
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    
    // Unified indices for filtering
    const i = {
        exp: getIdx("Exporter"),
        imp: getIdx("Importer"),
        prd: getIdx("PRODUCT"),
        oC: getIdx("Origin Country"),
        dC: getIdx("Destination Country")
    };

    const filteredMap = {};
    const clusterData = [];

    window.rawData.slice(1).forEach(r => {
        const oMatch = (origF === "All" || r[i.oC] === origF);
        const dMatch = (destF === "All" || r[i.dC] === destF);
        const sMatch = (r[i.exp] + r[i.imp] + r[i.prd]).toLowerCase().includes(search);

        if (oMatch && dMatch && sMatch) {
            clusterData.push(r); // For Cluster mode
            const key = `${r[i.exp]}|${r[i.imp]}`; // For Map mode grouping
            if (!filteredMap[key]) filteredMap[key] = [];
            filteredMap[key].push(r);
        }
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    if (tab === 'MAP') window.drawMap(Object.values(filteredMap));
    else window.drawCluster(clusterData);
};

window.drawMap = function(groups) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { crossOrigin: true }).addTo(window.LMap);

    const i = {
        lat1: getIdx("Origin latitude"), lng1: getIdx("Origin longitude"),
        lat2: getIdx("Destination latitude"), lng2: getIdx("Destination longitude"),
        exp: getIdx("Exporter"), imp: getIdx("Importer"),
        oC: getIdx("Origin Country"), dC: getIdx("Destination Country"),
        oP: getIdx("Origin Port"), dP: getIdx("Destination Port"),
        date: getIdx("Date"), qty: getIdx("Quantity"),
        val: getIdx("Value"), prd: getIdx("PRODUCT"),
        mod: getIdx("Mode"), col: getIdx("COLOR")
    };

    groups.forEach(group => {
        const f = group[0];
        const p1 = [parseFloat(f[i.lat1]), parseFloat(f[i.lng1])];
        const p2 = [parseFloat(f[i.lat2]), parseFloat(f[i.lng2])];

        if (!isNaN(p1[0]) && !isNaN(p2[0])) {
            const control = [(p1[0] + p2[0]) / 2 + 5, (p1[1] + p2[1]) / 2 + 5];
            const curve = L.curve(['M', p1, 'Q', control, p2]);
            const latlngs = curve.getPath().filter(item => Array.isArray(item)).map(c => L.latLng(c[0], c[1]));
            
            const path = L.polyline.antPath(latlngs, { color: f[i.col] || '#0ea5e9', weight: 3 }).addTo(window.LMap);

            const tableRows = group.map(s => `
                <tr>
                    <td>${s[i.date] || 'N/A'}</td>
                    <td>${s[i.qty]}</td>
                    <td>$${s[i.val]}</td>
                    <td style="white-space:normal;">${s[i.prd]}</td>
                    <td><b>${s[i.oP]}</b> → <b>${s[i.dP]}</b></td>
                    <td>${s[i.mod]}</td>
                </tr>`).join('');

            path.bindPopup(`
                <div style="width:650px;">
                    <h3 style="margin:0 0 5px 0;">${f[i.exp]} <span style="color:#64748b;">→</span> ${f[i.imp]}</h3>
                    <div class="popup-table-container">
                        <table class="popup-table">
                            <thead><tr><th>Date</th><th>Qty</th><th>Value</th><th>Product</th><th>Route (Ports)</th><th>Mode</th></tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </div>
            `, { maxWidth: 700 });
        }
    });
};

window.drawCluster = function(data) {
    const frame = document.getElementById('map-frame');
    const width = frame.clientWidth, height = frame.clientHeight;
    const svg = d3.select("#map-frame").append("svg").attr("width", "100%").attr("height", "100%");
    const g = svg.append("g");
    svg.call(d3.zoom().on("zoom", (e) => g.attr("transform", e.transform)));

    const i = { exp: getIdx("Exporter"), imp: getIdx("Importer"), oC: getIdx("Origin Country"), dC: getIdx("Destination Country") };
    let nodes = [], links = [], nodeSet = new Set();

    data.forEach(r => {
        const entities = [ {id: r[i.exp], type:'exp'}, {id: r[i.imp], type:'imp'}, {id: r[i.oC], type:'country'}, {id: r[i.dC], type:'country'} ];
        entities.forEach(ent => {
            if(ent.id && !nodeSet.has(ent.id)) { 
                nodes.push(ent); 
                nodeSet.add(ent.id); 
            }
        });
        links.push({source: r[i.exp], target: r[i.imp], type: 'trade'});
        links.push({source: r[i.exp], target: r[i.oC], type: 'loc'});
        links.push({source: r[i.imp], target: r[i.dC], type: 'loc'});
    });

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(150)).force("charge", d3.forceManyBody().strength(-600)).force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'loc' ? "#cbd5e1" : "#1e293b").attr("stroke-width", 2).attr("stroke-opacity", 0.6);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag()
        .on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'country' ? 24 : 15)
        .attr("fill", d => d.type === 'country' ? '#475569' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("text").text(d => d.type === 'country' ? "🌐 " + d.id : d.id)
        .attr("y", 38).attr("text-anchor", "middle").attr("fill", "#0f172a")
        .style("font-size", "11px").style("font-weight", "800");

    sim.on("tick", () => { 
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y); 
        node.attr("transform", d=>`translate(${d.x},${d.y})`); 
    });
};
