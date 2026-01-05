/**
 * BRANDORB VISUALS - STABLE VERSION
 */
window.clusterMode = 'COUNTRY'; 

// FIXED DATE NORMALIZER: Specifically targets YYYY-MM-DD
const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    const strVal = String(dateValue).trim();
    // 1. Try to match YYYY-MM-DD pattern directly from string
    const regex = /(\d{4})-(\d{2})-(\d{2})/;
    const match = strVal.match(regex);
    if (match) return match[0];

    // 2. Fallback to JS Date parsing
    let d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    return strVal; 
};

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
    if (!window.rawData) return;
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    const h = window.rawData[0];
    const idx = (n) => h.findIndex(header => header.trim() === n);

    const filteredRows = window.rawData.slice(1).filter(r => {
        const exporter = r[idx("Exporter")] || "";
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
        frame.insertAdjacentHTML('afterbegin', `<div class="viz-controls">
            <button class="toggle-btn ${window.clusterMode==='COUNTRY'?'active':''}" onclick="window.clusterMode='COUNTRY'; recomputeViz()">Group by Country</button>
            <button class="toggle-btn ${window.clusterMode==='PRODUCT'?'active':''}" onclick="window.clusterMode='PRODUCT'; recomputeViz()">Group by Product</button>
        </div>`);
        window.drawCluster(filteredRows, idx);
    }
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    groups.forEach((group, gIdx) => {
        const f = group[0];
        const lat1 = parseFloat(f[idx("Origin latitude")]);
        const lon1 = parseFloat(f[idx("Origin longitude")]);
        
        const lat2 = parseFloat(f[idx("Destination latitude")]);
        const lon2 = parseFloat(f[idx("Destination longitude")]);

        if (!isNaN(lat1) && !isNaN(lat2)) {
            // Fan out destinations to prevent overlap, but keep origins identical
            const offset = (gIdx * 0.12); 
            const finalDestLat = lat2 + offset;
            const finalDestLon = lon2 + offset;

            // STRAIGHT ANT PATH (No bend)
            const ant = L.polyline.antPath([[lat1, lon1], [finalDestLat, finalDestLon]], { 
                color: f[idx("COLOR")] || '#0ea5e9', 
                weight: 2.5, 
                delay: 1000,
                dashArray: [10, 20]
            }).addTo(window.LMap);

            const tableRows = group.map(s => `<tr>
                    <td>${s[idx("Date")] || 'N/A'}</td>
                    <td>${s[idx("Weight(Kg)")]}</td>
                    <td>$${s[idx("Amount($)")]}</td>
                    <td>${s[idx("PRODUCT")]}</td>
                    <td>${s[idx("Mode of Transportation")]}</td>
            </tr>`).join('');

            ant.bindPopup(`
                <div style="width:380px; font-family:sans-serif; max-height:280px; overflow-y:auto;">
                    <div style="margin-bottom:8px;">
                        <b>Exporter:</b> ${f[idx("Exporter")]} (${f[idx("Origin Country")]})<br>
                    <b>Importer:</b> ${f[idx("Importer")]} (${f[idx("Destination Country")]})<br>
                        <b>Ports:</b> ${f[idx("Origin Port") ] || 'N/A'} → ${f[idx("Destination Port")] || 'N/A'}
                    </div>
                    <table class="popup-table" style="width:100%; border-collapse: collapse; table-layout: fixed;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="width:85px; text-align:left;">Date</th>
                                <th style="width:35px;">Weight(Kg)</th>
                                <th style="width:60px;">Amount($)</th>
                                <th style="width:130px;">PRODUCT</th>
                                <th style="width:40px;">Mode</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>`, { maxWidth: 420 });
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
        const gp = window.clusterMode === 'COUNTRY' ? r[idx("Origin Country")] : r[idx("PRODUCT")];
        const dp = window.clusterMode === 'COUNTRY' ? r[idx("Destination Country")] : r[idx("PRODUCT")];
        if(!exp || !imp || !gp) return;
        [gp, dp].forEach(p => { if(!nodeSet.has(p)) { nodes.push({id: p, type: 'parent'}); nodeSet.add(p); }});
        if(!nodeSet.has(exp)) { nodes.push({id: exp, type: 'exp'}); nodeSet.add(exp); }
        if(!nodeSet.has(imp)) { nodes.push({id: imp, type: 'imp'}); nodeSet.add(imp); }
        links.push({source: exp, target: imp, type: 'trade', data: r});
        links.push({source: gp, target: exp, type: 'link'}, {source: dp, target: imp, type: 'link'});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'link' ? "#e2e8f0" : "#94a3b8").attr("stroke-width", 2);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    // Circles
    node.append("circle")
        .attr("r", d => d.type === 'parent' ? 22 : 14)
        .attr("fill", d => d.type === 'parent' ? '#1e293b' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    // FIXED: Centered Icons
    node.append("foreignObject")
        .attr("width", 30)
        .attr("height", 30)
        // Center calculation: (width / -2) for horizontal and (height / -2) for vertical centering
        .attr("x", -15) 
        .attr("y", -15)
        .style("pointer-events", "none")
        .html(d => {
            let iconClass = "fa-globe"; 
            if (d.type === 'exp') iconClass = "fa-building"; 
            if (d.type === 'imp') iconClass = "fa-store";    
            return `<div style="display:flex; align-items:center; justify-content:center; width:30px; height:30px;">
                        <i class="fas ${iconClass}" style="color:white; font-size:${d.type==='parent'?'16px':'12px'};"></i>
                    </div>`;
        });

    node.append("text").text(d => d.id).attr("y", 35).attr("text-anchor", "middle").style("font-size", "9px").style("font-weight", "bold");

    // FIXED: Added Quantity to Popup
    link.filter(d => d.type === 'trade').on("click", (e, d) => {
        d3.selectAll(".cluster-pop").remove();
        d3.select("#map-frame").append("div").attr("class", "cluster-pop")
            .style("left", e.offsetX + "px").style("top", e.offsetY + "px")
            .html(`<span class="pop-close" onclick="this.parentElement.remove()">×</span>
                <strong>${d.data[idx("PRODUCT")]}</strong><br>
                Date: ${formatDate(d.data[idx("Date")])}<br>
                Qty: ${d.data[idx("Quantity")] || '-'}<br>
                Value: $${d.data[idx("Amount($)")]}`);
    });

    sim.on("tick", () => {
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
        node.attr("transform", d=>`translate(${d.x},${d.y})`);
    });
};
