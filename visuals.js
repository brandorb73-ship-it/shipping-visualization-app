/**
 * BRANDORB VISUALS - STABLE VERSION
 */
window.clusterMode = 'COUNTRY'; // Default toggle state

window.downloadPDF = function() {
    html2canvas(document.getElementById('map-frame'), { useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'BrandOrb_Report.png';
        link.href = canvas.toDataURL();
        link.click();
    });
};

window.populateFilters = function() {
    if (!window.rawData || window.rawData.length < 2) return;
    const h = window.rawData[0];
    const data = window.rawData.slice(1);
    const fill = (id, col, lbl) => {
        const i = h.findIndex(header => header.trim() === col);
        if (i === -1) return;
        const el = document.getElementById(id);
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country', 'Countries');
    fill('dest-filter', 'Destination Country', 'Countries');
};

window.recomputeViz = function() {
    if (!window.rawData) { console.error("No data found"); return; }
    
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    const h = window.rawData[0];
    const idx = (n) => h.findIndex(header => header.trim() === n);

    const filteredRows = window.rawData.slice(1).filter(r => {
        const exporter = r[idx("Exporter")] || "";
        if (!exporter) return false;
        
        const oMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const dMatch = destF === 'All' || r[idx("Destination Country")] === destF;
        const sMatch = (exporter + (r[idx("Importer")]||"") + (r[idx("PRODUCT")]||"")).toLowerCase().includes(search);
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
        // Add Toggle UI for Cluster
        frame.insertAdjacentHTML('afterbegin', `
            <div class="viz-controls">
                <button class="toggle-btn ${window.clusterMode==='COUNTRY'?'active':''}" onclick="window.clusterMode='COUNTRY'; recomputeViz()">Group by Country</button>
                <button class="toggle-btn ${window.clusterMode==='PRODUCT'?'active':''}" onclick="window.clusterMode='PRODUCT'; recomputeViz()">Group by Product</button>
            </div>
        `);
        window.drawCluster(filteredRows, idx);
    }
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    // Helper to find index safely
    const getIdx = (name) => window.rawData[0].findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
        const found = window.rawData[0].findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
        return found;
    };

    groups.forEach(group => {
        const f = group[0];
        const lat1 = parseFloat(f[getIdx("Origin latitude")]), lon1 = parseFloat(f[getIdx("Origin longitude")]);
        const lat2 = parseFloat(f[getIdx("Destination latitude")]), lon2 = parseFloat(f[getIdx("Destination longitude")]);

        if (!isNaN(lat1) && !isNaN(lat2)) {
            const p1 = [lat1, lon1], p2 = [lat2, lon2];
            
            // Calculate a control point for a smooth curve (not a sharp bend)
            const midLat = (lat1 + lat2) / 2;
            const midLon = (lon1 + lon2) / 2;
            const bendFactor = 0.15; // Adjust for more/less curve
            const cp = [
                midLat + (lon2 - lon1) * bendFactor,
                midLon - (lat2 - lat1) * bendFactor
            ];

            const latlngs = L.curve(['M', p1, 'Q', cp, p2]).getPath()
                             .filter(item => Array.isArray(item)).map(c => L.latLng(c[0], c[1]));
            
            const ant = L.polyline.antPath(latlngs, { 
                color: f[getIdx("COLOR")] || '#0ea5e9', 
                weight: 3, 
                delay: 1000,
                paused: false,
                reverse: false
            }).addTo(window.LMap);

            const tableRows = group.map(s => `
                <tr>
                    <td>${s[getIdx("Date")] || 'N/A'}</td>
                    <td>${s[getIdx("Quantity")]}</td>
                    <td>$${s[getIdx("Value(USD)")]}</td>
                    <td>${s[getIdx("PRODUCT")]}</td>
                    <td>${s[getIdx("Mode of Transport")] || 'N/A'}</td>
                </tr>`).join('');

            ant.bindPopup(`
                <div style="width:380px; font-size:12px;">
                    <b>Exporter:</b> ${f[getIdx("Exporter")]}<br>
                    <b>Importer:</b> ${f[getIdx("Importer")]}<br>
                    <table class="popup-table">
                        <thead><tr><th>Date</th><th>Qty</th><th>Value</th><th>PRODUCT</th><th>Mode</th></tr></thead>
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
        const groupParent = window.clusterMode === 'COUNTRY' ? r[idx("Origin Country")] : r[idx("PRODUCT")];
        const destParent = window.clusterMode === 'COUNTRY' ? r[idx("Destination Country")] : r[idx("PRODUCT")];

        if(!exp || !imp || !groupParent) return;

        // Parent Nodes (Country or Product)
        [groupParent, destParent].forEach(p => {
            if(!nodeSet.has(p)) { nodes.push({id: p, type: 'parent'}); nodeSet.add(p); }
        });

        // Entity Nodes
        if(!nodeSet.has(exp)) { nodes.push({id: exp, type: 'exp'}); nodeSet.add(exp); }
        if(!nodeSet.has(imp)) { nodes.push({id: imp, type: 'imp'}); nodeSet.add(imp); }

        links.push({source: exp, target: imp, type: 'trade', data: r});
        links.push({source: groupParent, target: exp, type: 'link'});
        links.push({source: destParent, target: imp, type: 'link'});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.type === 'link' ? 50 : 150))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'link' ? "#e2e8f0" : "#94a3b8")
        .attr("stroke-width", 2);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'parent' ? 24 : 16)
        .attr("fill", d => d.type === 'parent' ? '#1e293b' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("foreignObject").attr("x", -9).attr("y", -11).attr("width", 20).attr("height", 20)
        .html(d => `<i class="fas ${d.type==='parent'?'fa-globe':(d.type==='exp'?'fa-building':'fa-store')}" style="color:white; font-size:14px"></i>`);

    node.append("text").text(d => d.id).attr("y", 35).attr("text-anchor", "middle").style("font-size", "9px").style("font-weight", "bold");

    link.filter(d => d.type === 'trade').on("click", (e, d) => {
        d3.selectAll(".cluster-pop").remove();
        d3.select("#map-frame").append("div").attr("class", "cluster-pop")
            .style("left", e.offsetX + "px").style("top", e.offsetY + "px")
            .html(`<span class="pop-close" onclick="this.parentElement.remove()">×</span>
                   <strong>${d.data[getIdx("PRODUCT")]}</strong><br>
                   Date: ${d.data[getIdx("Date")] || 'N/A'}<br>
                   Value: $${d.data[getIdx("Value(USD)")]}`);
    });

    sim.on("tick", () => {
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
        node.attr("transform", d=>`translate(${d.x},${d.y})`);
    });
};
