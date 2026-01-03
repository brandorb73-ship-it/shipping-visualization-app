/**
 * BRANDORB VISUALS - ARC FLOW & FIXED CLUSTER
 */

window.downloadPDF = function() {
    html2canvas(document.getElementById('map-frame'), { useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'BrandOrb_Report.png';
        link.href = canvas.toDataURL();
        link.click();
    });
};

window.populateFilters = function() {
    if (!window.rawData) return;
    const h = window.rawData[0];
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
    if (!window.rawData) return;
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    const h = window.rawData[0];
    const idx = (n) => h.indexOf(n);

    // FIX: Filter data correctly to prevent Cluster Graph errors
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
            // ARC LOGIC: Creating a smoother physical arc
            const offsetX = (p2[1] - p1[1]) * 0.2;
            const offsetY = (p1[0] - p2[0]) * 0.2;
            const controlPoint = [(p1[0] + p2[0]) / 2 + offsetY, (p1[1] + p2[1]) / 2 + offsetX];
            
            const curvePath = L.curve(['M', p1, 'Q', controlPoint, p2]);
            const latlngs = curvePath.getPath().filter(item => Array.isArray(item)).map(coord => L.latLng(coord[0], coord[1]));
            
            const ant = L.polyline.antPath(latlngs, { 
                color: f[idx("COLOR")] || '#0ea5e9', 
                weight: 3, 
                delay: 800,
                paused: false,
                reverse: false
            }).addTo(window.LMap);

            const tableRows = group.map(s => `
                <tr>
                    <td>${s[idx("Date")] || 'N/A'}</td>
                    <td>${s[idx("Quantity")]}</td>
                    <td>$${s[idx("Value(USD)")]}</td>
                    <td>${s[idx("PRODUCT")]}</td>
                    <td>${s[idx("Mode of Transport")] || 'Sea'}</td>
                </tr>`).join('');

            ant.bindPopup(`
                <div style="width:380px; font-family:sans-serif; font-size:12px;">
                    <b>Exporter:</b> ${f[idx("Exporter")]} (${f[idx("Origin Country")]})<br>
                    <b>Importer:</b> ${f[idx("Importer")]} (${f[idx("Destination Country")]})<br>
                    <b>Ports:</b> ${f[idx("Origin Port")] || 'N/A'} → ${f[idx("Destination Port")] || 'N/A'}<br>
                    <table class="popup-table">
                        <thead><tr><th>Date</th><th>Qty</th><th>Value</th><th>Product</th><th>Mode</th></tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            `, { maxWidth: 400 });
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
        if(!exp || !imp) return;
        [exp, imp].forEach(id => {
            if(!nodeSet.has(id)) { 
                nodes.push({id, type: id===exp?'exp':'imp'}); 
                nodeSet.add(id); 
            }
        });
        links.push({source: exp, target: imp, data: r});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "#cbd5e1").attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("click", (e, d) => {
             d3.selectAll(".cluster-pop").remove();
             d3.select("#map-frame").append("div").attr("class", "cluster-pop")
                .style("left", e.offsetX + "px").style("top", e.offsetY + "px")
                .html(`<b>${d.data[idx("PRODUCT")]}</b><br>Qty: ${d.data[idx("Quantity")]}<br>Value: $${d.data[idx("Value(USD)")]}<br><button onclick="this.parentElement.remove()">Close</button>`);
        });

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", 20).attr("fill", d => d.type === 'exp' ? '#0ea5e9' : '#f43f5e').attr("stroke", "#fff");
    
    node.append("foreignObject").attr("x", -10).attr("y", -12).attr("width", 20).attr("height", 20)
        .html(d => `<i class="fas ${d.type==='exp'?'fa-building':'fa-store'}" style="color:white; font-size:14px"></i>`);

    node.append("text").text(d => d.id).attr("y", 35).attr("text-anchor", "middle").style("font-size", "10px").style("font-weight", "bold");

    sim.on("tick", () => { 
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y); 
        node.attr("transform", d=>`translate(${d.x},${d.y})`); 
    });
};
