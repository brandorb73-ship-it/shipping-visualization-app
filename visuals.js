/**
 * BRANDORB VISUALS - CORE ENGINE
 */
window.clusterMode = 'COUNTRY';

// Global helper to find column indices safely (Fixes Date Undefined)
window.getIdx = (name) => {
    if (!window.rawData || !window.rawData[0]) return -1;
    return window.rawData[0].findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
};

window.downloadPDF = function() {
    html2canvas(document.getElementById('map-frame'), { useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'BrandOrb_Export.png';
        link.href = canvas.toDataURL();
        link.click();
    });
};

window.populateFilters = function() {
    const oIdx = getIdx("Origin Country"), dIdx = getIdx("Destination Country");
    if (oIdx === -1) return;
    
    const data = window.rawData.slice(1);
    const fill = (id, idx, lbl) => {
        const el = document.getElementById(id);
        const vals = [...new Set(data.map(r => r[idx]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', oIdx, 'Origins');
    fill('dest-filter', dIdx, 'Destinations');
};

window.recomputeViz = function() {
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    
    const eIdx = getIdx("Exporter"), iIdx = getIdx("Importer"), pIdx = getIdx("PRODUCT"), 
          ocIdx = getIdx("Origin Country"), dcIdx = getIdx("Destination Country");

    const filteredRows = window.rawData.slice(1).filter(r => {
        const oMatch = origF === 'All' || r[ocIdx] === origF;
        const dMatch = destF === 'All' || r[dcIdx] === destF;
        const sMatch = (r[eIdx] + r[iIdx] + r[pIdx]).toLowerCase().includes(search);
        return oMatch && dMatch && sMatch;
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    if (window.currentTab === 'MAP') {
        const groups = {};
        filteredRows.forEach(r => {
            const key = `${r[eIdx]}|${r[iIdx]}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        window.drawMap(Object.values(groups));
    } else {
        frame.insertAdjacentHTML('afterbegin', `
            <div class="viz-controls">
                <button class="toggle-btn ${window.clusterMode==='COUNTRY'?'active':''}" onclick="window.clusterMode='COUNTRY'; recomputeViz()">By Country</button>
                <button class="toggle-btn ${window.clusterMode==='PRODUCT'?'active':''}" onclick="window.clusterMode='PRODUCT'; recomputeViz()">By Product</button>
            </div>`);
        window.drawCluster(filteredRows);
    }
};

window.drawMap = function(groups) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    groups.forEach(group => {
        const f = group[0];
        const lat1 = parseFloat(f[getIdx("Origin latitude")]), lon1 = parseFloat(f[getIdx("Origin longitude")]);
        const lat2 = parseFloat(f[getIdx("Destination latitude")]), lon2 = parseFloat(f[getIdx("Destination longitude")]);

        if (!isNaN(lat1) && !isNaN(lat2)) {
            const p1 = [lat1, lon1], p2 = [lat2, lon2];
            // Smooth Quadratic Curve calculation
            const cp = [ (lat1 + lat2) / 2 + (lon2 - lon1) * 0.15, (lon1 + lon2) / 2 - (lat2 - lat1) * 0.15 ];

            const latlngs = L.curve(['M', p1, 'Q', cp, p2]).getPath()
                             .filter(item => Array.isArray(item)).map(c => L.latLng(c[0], c[1]));
            
            L.polyline.antPath(latlngs, { color: f[getIdx("COLOR")] || '#0ea5e9', weight: 3 }).addTo(window.LMap)
            .bindPopup(`
                <div style="width:350px;">
                    <b>From:</b> ${f[getIdx("Exporter")]} (${f[getIdx("Origin Country")]})<br>
                    <b>To:</b> ${f[getIdx("Importer")]} (${f[getIdx("Destination Country")]})
                    <table class="popup-table">
                        <thead><tr><th>Date</th><th>Qty</th><th>Value</th><th>PRODUCT</th></tr></thead>
                        <tbody>${group.map(s => `<tr><td>${s[getIdx("Date")]}</td><td>${s[getIdx("Quantity")]}</td><td>$${s[getIdx("Value(USD)")]}</td><td>${s[getIdx("PRODUCT")]}</td></tr>`).join('')}</tbody>
                    </table>
                </div>`);
        }
    });
};

window.drawCluster = function(data) {
    const frame = document.getElementById('map-frame');
    const width = frame.clientWidth, height = frame.clientHeight;
    const svg = d3.select("#map-frame").append("svg").attr("width", "100%").attr("height", "100%");
    const g = svg.append("g");
    svg.call(d3.zoom().on("zoom", (e) => g.attr("transform", e.transform)));

    let nodes = [], links = [], nodeSet = new Set();
    const eIdx = getIdx("Exporter"), iIdx = getIdx("Importer"), 
          ocIdx = getIdx("Origin Country"), dcIdx = getIdx("Destination Country"), pIdx = getIdx("PRODUCT");

    data.forEach(r => {
        const exp = r[eIdx], imp = r[iIdx];
        const gp = window.clusterMode === 'COUNTRY' ? r[ocIdx] : r[pIdx];
        const dp = window.clusterMode === 'COUNTRY' ? r[dcIdx] : r[pIdx];

        [gp, dp, exp, imp].forEach(id => {
            if(!nodeSet.has(id)) { 
                nodes.push({id, type: (id===gp||id===dp)?'parent':(id===exp?'exp':'imp')}); 
                nodeSet.add(id); 
            }
        });
        links.push({source: exp, target: imp, data: r, type:'trade'});
        links.push({source: gp, target: exp, type:'link'});
        links.push({source: dp, target: imp, type:'link'});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type==='link' ? "#e2e8f0" : "#94a3b8").attr("stroke-width", 2);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'parent' ? 22 : 15)
        .attr("fill", d => d.type === 'parent' ? '#1e293b' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("text").text(d => d.id).attr("y", 30).attr("text-anchor", "middle").style("font-size", "10px").style("fill", "#334155");

    link.filter(d => d.type === 'trade').on("click", (e, d) => {
        d3.selectAll(".cluster-pop").remove();
        d3.select("#map-frame").append("div").attr("class", "cluster-pop")
            .style("left", e.offsetX + "px").style("top", e.offsetY + "px")
            .html(`<span class="pop-close" onclick="this.parentElement.remove()">×</span>
                   <strong>${d.data[pIdx]}</strong><br>Date: ${d.data[getIdx("Date")]}<br>Value: $${d.data[getIdx("Value(USD)")]}`);
    });

    sim.on("tick", () => {
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
        node.attr("transform", d=>`translate(${d.x},${d.y})`);
    });
};
