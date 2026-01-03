/**
 * BRANDORB VISUALS - STABLE VERSION
 */

window.goBack = function() {
    document.getElementById('viz-header-ui').style.display = 'none';
    document.getElementById('viz-container').style.display = 'none';
    document.getElementById('list-header').style.display = 'flex';
    document.getElementById('list-view').style.display = 'block';
    document.getElementById('map-frame').innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }
};

const getColIdx = (name) => {
    if (!window.cleanHeaders) return -1;
    return window.cleanHeaders.findIndex(h => h.toLowerCase().trim().includes(name.toLowerCase().trim()));
};

window.populateFilters = function() {
    if (!window.rawData) return;
    window.cleanHeaders = window.rawData[0].map(h => h.trim().replace(/^\uFEFF/, ''));
    const h = window.cleanHeaders;
    const data = window.rawData.slice(1);
    
    const fill = (id, col, lbl) => {
        const i = getColIdx(col);
        const el = document.getElementById(id);
        if (i === -1 || !el) return;
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country', 'Origins');
    fill('dest-filter', 'Destination Country', 'Destinations');
};

window.recomputeViz = function() {
    if (!window.cleanHeaders) window.populateFilters();
    const search = document.getElementById('ent-search').value.toLowerCase();
    const oF = document.getElementById('orig-filter').value;
    const dF = document.getElementById('dest-filter').value;
    
    const i = {
        exp: getColIdx("Exporter"), imp: getColIdx("Importer"), prd: getColIdx("PRODUCT"),
        oC: getColIdx("Origin Country"), dC: getColIdx("Destination Country")
    };

    const filteredMap = {};
    const clusterList = [];

    window.rawData.slice(1).forEach(r => {
        const oM = (oF === "All" || r[i.oC] === oF);
        const dM = (dF === "All" || r[i.dC] === dF);
        const sM = (r[i.exp] + r[i.imp] + r[i.prd]).toLowerCase().includes(search);
        if (oM && dM && sM) {
            clusterList.push(r);
            const key = `${r[i.exp]}|${r[i.imp]}`;
            if (!filteredMap[key]) filteredMap[key] = [];
            filteredMap[key].push(r);
        }
    });

    document.getElementById('map-frame').innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }
    if (tab === 'MAP') window.drawMap(Object.values(filteredMap));
    else window.drawCluster(clusterList);
};

window.drawMap = function(groups) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    const i = {
        lat1: getColIdx("Origin latitude"), lng1: getColIdx("Origin longitude"),
        lat2: getColIdx("Destination latitude"), lng2: getColIdx("Destination longitude"),
        exp: getColIdx("Exporter"), imp: getColIdx("Importer"),
        oC: getColIdx("Origin Country"), dC: getColIdx("Destination Country"),
        oP: getColIdx("Origin Port"), dP: getColIdx("Destination Port"),
        date: getColIdx("Date"), qty: getColIdx("Quantity"),
        val: getColIdx("Value"), prd: getColIdx("PRODUCT"),
        mod: getColIdx("Mode"), col: getColIdx("COLOR")
    };

    groups.forEach(group => {
        const f = group[0];
        const p1 = [parseFloat(f[i.lat1]), parseFloat(f[i.lng1])];
        const p2 = [parseFloat(f[i.lat2]), parseFloat(f[i.lng2])];

        if (!isNaN(p1[0]) && !isNaN(p2[0])) {
            // SMOOTH ARCS
            const offsetX = (p2[1] - p1[1]) * 0.2;
            const offsetY = (p1[0] - p2[0]) * 0.2;
            const cp = [(p1[0] + p2[0]) / 2 + offsetY, (p1[1] + p2[1]) / 2 + offsetX];
            
            const curve = L.curve(['M', p1, 'Q', cp, p2]);
            const pts = curve.getPath().filter(item => Array.isArray(item)).map(c => L.latLng(c[0], c[1]));
            const path = L.polyline.antPath(pts, { color: f[i.col] || '#3b82f6', weight: 2 }).addTo(window.LMap);

            const rows = group.map(s => {
                let d = (s[i.date] || "").split('T')[0];
                return `<tr><td>${d}</td><td>${s[i.prd]}</td><td>${s[i.qty]}</td><td>$${s[i.val]}</td><td>${s[i.mod]}</td></tr>`;
            }).join('');

            path.bindPopup(`
                <div style="width:400px;">
                    <b>Exporter:</b> ${f[i.exp]} (${f[i.oC]})<br>
                    <b>Importer:</b> ${f[i.imp]} (${f[i.dC]})<br>
                    <b>Route:</b> ${f[i.oP]} to ${f[i.dP]}
                    <table class="popup-table">
                        <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Value</th><th>Mode</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`, { maxWidth: 450 });
        }
    });
};

window.drawCluster = function(data) {
    const i = { exp: getColIdx("Exporter"), imp: getColIdx("Importer"), oC: getColIdx("Origin Country"), dC: getColIdx("Destination Country") };
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
        .force("link", d3.forceLink(links).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "#cbd5e1").attr("stroke-width", 1);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag()
        .on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'country' ? 18 : 10)
        .attr("fill", d => d.type === 'country' ? '#1e293b' : (d.type === 'exp' ? '#3b82f6' : '#ef4444'))
        .attr("stroke", "#fff");

    node.append("text").text(d => d.id).attr("y", 25).attr("text-anchor", "middle").style("font-size", "9px");

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
    html2canvas(document.getElementById('map-frame'), { useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Export.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
};
