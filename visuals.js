/**
 * BRANDORB VISUALS - MASTER RECONCILED SCRIPT
 */

// 1. BACK BUTTON FIX (No Logout)
window.goBack = function() {
    document.getElementById('viz-header-ui').style.display = 'none';
    document.getElementById('viz-container').style.display = 'none';
    
    // Show landing page elements
    if(document.getElementById('list-header')) document.getElementById('list-header').style.display = 'flex';
    if(document.getElementById('list-view')) document.getElementById('list-view').style.display = 'block';
    
    // Cleanup
    document.getElementById('map-frame').innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }
};

// 2. ROBUST COLUMN FINDER (Fixes Cluster "Failed to Load")
const getColIdx = (name) => {
    if (!window.cleanHeaders) return -1;
    return window.cleanHeaders.findIndex(h => 
        h.toLowerCase().trim().includes(name.toLowerCase().trim())
    );
};

window.populateFilters = function() {
    if (!window.rawData) return;
    // Scrub headers for hidden BOM or spaces
    window.cleanHeaders = window.rawData[0].map(h => h.trim().replace(/^\uFEFF/, ''));
    
    const data = window.rawData.slice(1);
    const fill = (id, colName, label) => {
        const i = getColIdx(colName);
        const el = document.getElementById(id);
        if (i === -1 || !el) return;
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${label}</option>` + 
                       vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country', 'Countries');
    fill('dest-filter', 'Destination Country', 'Countries');
};

window.recomputeViz = function() {
    if (!window.cleanHeaders) window.populateFilters();
    
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    
    const i = {
        exp: getColIdx("Exporter"),
        imp: getColIdx("Importer"),
        prd: getColIdx("PRODUCT"),
        oC: getColIdx("Origin Country"),
        dC: getColIdx("Destination Country")
    };

    const filteredMap = {};
    const clusterList = [];

    window.rawData.slice(1).forEach(r => {
        const oMatch = (origF === "All" || r[i.oC] === origF);
        const dMatch = (destF === "All" || r[i.dC] === destF);
        const sMatch = (r[i.exp] + r[i.imp] + r[i.prd]).toLowerCase().includes(search);

        if (oMatch && dMatch && sMatch) {
            clusterList.push(r);
            const key = `${r[i.exp]}|${r[i.imp]}`;
            if (!filteredMap[key]) filteredMap[key] = [];
            filteredMap[key].push(r);
        }
    });

    document.getElementById('map-frame').innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    // Toggle Fit Button
    document.getElementById('fit-btn').style.display = (tab === 'CLUSTER') ? 'flex' : 'none';

    if (tab === 'MAP') window.drawMap(Object.values(filteredMap));
    else window.drawCluster(clusterList);
};

window.drawMap = function(groups) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { crossOrigin: true }).addTo(window.LMap);

    const i = {
        lat1: getColIdx("Origin latitude"), lng1: getColIdx("Origin longitude"),
        lat2: getColIdx("Destination latitude"), lng2: getColIdx("Destination longitude"),
        exp: getColIdx("Exporter"), imp: getColIdx("Importer"),
        oC: getColIdx("Origin Country"), dC: getColIdx("Destination Country"),
        oP: getColIdx("Origin Port"), dP: getColIdx("Destination Port"),
        date: getColIdx("Date"), qty: getColIdx("Quantity"),
        val: getColIdx("Value(USD)"), prd: getColIdx("PRODUCT"),
        mod: getColIdx("Mode of Transport"), col: getColIdx("COLOR")
    };

    groups.forEach(group => {
        const f = group[0];
        const p1 = [parseFloat(f[i.lat1]), parseFloat(f[i.lng1])];
        const p2 = [parseFloat(f[i.lat2]), parseFloat(f[i.lng2])];

        if (!isNaN(p1[0]) && !isNaN(p2[0])) {
            // SMOOTH CURVE CALCULATION
            const dist = Math.sqrt(Math.pow(p2[0]-p1[0], 2) + Math.pow(p2[1]-p1[1], 2));
            const offset = dist * 0.15; 
            const cp = [(p1[0] + p2[0]) / 2 + offset, (p1[1] + p2[1]) / 2 + offset];
            
            const curve = L.curve(['M', p1, 'Q', cp, p2]);
            const pts = curve.getPath().filter(item => Array.isArray(item)).map(c => L.latLng(c[0], c[1]));
            const path = L.polyline.antPath(pts, { color: f[i.col] || '#3b82f6', weight: 3 }).addTo(window.LMap);

            const rows = group.map(s => {
                // DATE FORMAT FIX (YYYY-MM-DD)
                let d = s[i.date] || "";
                let cleanD = d.split('T')[0].split(' ')[0];
                return `<tr><td>${cleanD}</td><td>${s[i.prd]}</td><td>${s[i.qty]}</td><td>$${s[i.val]}</td><td>${s[i.mod]}</td></tr>`;
            }).join('');

            path.bindPopup(`
                <div style="width:500px; font-family:sans-serif;">
                    <b>${f[i.exp]}</b> (${f[i.oC]})<br>
                    <b>${f[i.imp]}</b> (${f[i.dC]})<br>
                    <b>Route:</b> ${f[i.oP]} to ${f[i.dP]}
                    <div class="popup-table-container">
                        <table class="popup-table">
                            <thead><tr><th>Date</th><th>PRODUCT</th><th>Qty</th><th>Value</th><th>Mode</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>`, { maxWidth: 550 });
        }
    });
};

window.drawCluster = function(data) {
    const i = { exp: getColIdx("Exporter"), imp: getColIdx("Importer"), oC: getColIdx("Origin Country"), dC: getColIdx("Destination Country") };
    if (i.exp === -1) return alert("Error: Exporter column not found. Check CSV headers.");

    const frame = document.getElementById('map-frame');
    const width = frame.clientWidth, height = frame.clientHeight;
    const svg = d3.select("#map-frame").append("svg").attr("width", "100%").attr("height", "100%");
    const g = svg.append("g");
    
    window.clusterZoom = d3.zoom().on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(window.clusterZoom);

    let nodes = [], links = [], nodeSet = new Set();
    data.forEach(r => {
        [r[i.exp], r[i.imp], r[i.oC], r[i.dC]].forEach(id => {
            if(id && !nodeSet.has(id)) {
                nodes.push({id, type: (id===r[i.oC]||id===r[i.dC])?'country':(id===r[i.exp]?'exp':'imp')});
                nodeSet.add(id);
            }
        });
        links.push({source: r[i.exp], target: r[i.imp]}, {source: r[i.exp], target: r[i.oC], type:'loc'}, {source: r[i.imp], target: r[i.dC], type:'loc'});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width/2, height/2))
        .force("x", d3.forceX().x(d => d.type === 'country' ? (d.id.charCodeAt(0) % 2 === 0 ? 60 : width - 60) : width/2).strength(0.2))
        .force("y", d3.forceY().y(d => d.type === 'country' ? (d.id.charCodeAt(1) % 2 === 0 ? 60 : height - 60) : height/2).strength(0.2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'loc' ? "#e2e8f0" : "#475569").attr("stroke-width", 1.5);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag()
        .on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'country' ? 22 : 14)
        .attr("fill", d => d.type === 'country' ? '#1e293b' : (d.type === 'exp' ? '#3b82f6' : '#ef4444'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("text").text(d => d.type === 'country' ? "🌐 " + d.id : d.id)
        .attr("y", 35).attr("text-anchor", "middle").style("font-size", "10px").style("font-weight", "bold");

    sim.on("tick", () => {
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
        node.attr("transform", d=>`translate(${d.x},${d.y})`);
    });

    window.fitCluster = () => {
        const bounds = g.node().getBBox();
        const fullW = frame.clientWidth, fullH = frame.clientHeight;
        const scale = 0.8 / Math.max(bounds.width / fullW, bounds.height / fullH);
        svg.transition().duration(750).call(window.clusterZoom.transform, d3.zoomIdentity.translate(fullW/2 - scale*(bounds.x + bounds.width/2), fullH/2 - scale*(bounds.y + bounds.height/2)).scale(scale));
    };
};

window.downloadPDF = function() {
    html2canvas(document.getElementById('map-frame'), { useCORS: true, scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `BrandOrb_Export.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
};
