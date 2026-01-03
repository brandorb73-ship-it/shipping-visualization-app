/**
 * BRANDORB VISUALS - STABLE RECOVERY VERSION
 */
window.clusterMode = 'COUNTRY';

// FUZZY & AGGRESSIVE HEADER SEARCH
function getIdx(headers, targets) {
    if (!headers) return -1;
    // Clean headers: remove hidden characters, trim, and lowercase
    const cleanHeaders = headers.map(h => 
        String(h).replace(/[^\x20-\x7E]/g, "").trim().toLowerCase()
    );
    
    for (let t of targets) {
        const target = t.toLowerCase();
        const found = cleanHeaders.indexOf(target);
        if (found !== -1) return found;
    }
    return -1;
}

window.recomputeViz = function() {
    if (!window.rawData || window.rawData.length < 2) {
        const frame = document.getElementById('map-frame');
        frame.innerHTML = `<div style="padding:20px; color:red;">Data Source Error: Please check CSV format.</div>`;
        return;
    }
    
    const h = window.rawData[0];
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;

    const idx = {
        exp: getIdx(h, ["Exporter"]),
        imp: getIdx(h, ["Importer"]),
        oC:  getIdx(h, ["Origin Country"]),
        dC:  getIdx(h, ["Destination Country"]),
        prod:getIdx(h, ["PRODUCT"]),
        lat1:getIdx(h, ["Origin latitude"]),
        lon1:getIdx(h, ["Origin longitude"]),
        lat2:getIdx(h, ["Destination latitude"]),
        lon2:getIdx(h, ["Destination longitude"]),
        date:getIdx(h, ["Date", "YYYY-MM-DD", "Shipment Date"]),
        qty: getIdx(h, ["Quantity"]),
        val: getIdx(h, ["Value(USD)", "Value"]),
        mode:getIdx(h, ["Mode of Transport"]),
        oPort: getIdx(h, ["Origin Port"]),
        dPort: getIdx(h, ["Destination Port"]),
        col: getIdx(h, ["COLOR"])
    };

    // CRITICAL CHECK: If Exporter column isn't found, stop and alert
    if (idx.exp === -1) {
        console.error("Column 'Exporter' not found. Headers seen:", h);
        document.getElementById('map-frame').innerHTML = `<div style="padding:20px;"><b>Error:</b> Column "Exporter" not found in CSV.</div>`;
        return;
    }

    const filteredRows = window.rawData.slice(1).filter(r => {
        if (!r[idx.exp]) return false;
        const oMatch = origF === 'All' || r[idx.oC] === origF;
        const dMatch = destF === 'All' || r[idx.dC] === destF;
        const sMatch = (r[idx.exp] + (r[idx.imp]||"") + (r[idx.prod]||"")).toLowerCase().includes(search);
        return oMatch && dMatch && sMatch;
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    if (window.currentTab === 'MAP') {
        const groups = {};
        filteredRows.forEach(r => {
            const key = `${r[idx.exp]}|${r[idx.imp]}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        window.drawMap(Object.values(groups), idx);
    } else {
        frame.insertAdjacentHTML('afterbegin', `
            <div class="viz-controls">
                <button class="toggle-btn ${window.clusterMode==='COUNTRY'?'active':''}" onclick="window.clusterMode='COUNTRY'; recomputeViz()">Group by Country</button>
                <button class="toggle-btn ${window.clusterMode==='PRODUCT'?'active':''}" onclick="window.clusterMode='PRODUCT'; recomputeViz()">Group by Product</button>
            </div>`);
        window.drawCluster(filteredRows, idx);
    }
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    groups.forEach(group => {
        const f = group[0];
        const p1 = [parseFloat(f[idx.lat1]), parseFloat(f[idx.lon1])];
        const p2 = [parseFloat(f[idx.lat2]), parseFloat(f[idx.lon2])];

        if (!isNaN(p1[0]) && !isNaN(p2[0])) {
            // STRAIGHT LINE ANT PATH
            const ant = L.polyline.antPath([p1, p2], { 
                color: f[idx.col] || '#0ea5e9', weight: 3, delay: 1000 
            }).addTo(window.LMap);

            const rows = group.map(s => `
                <tr>
                    <td>${s[idx.date] || "N/A"}</td>
                    <td>${s[idx.qty] || "0"}</td>
                    <td>$${s[idx.val] || "0"}</td>
                    <td>${s[idx.prod] || "N/A"}</td>
                    <td>${s[idx.mode] || "N/A"}</td>
                </tr>`).join('');

            ant.bindPopup(`
                <div class="map-popup-container">
                    <div style="font-size:12px; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;">
                        <b>Exporter:</b> ${f[idx.exp]} (${f[idx.oC]})<br>
                        <b>Importer:</b> ${f[idx.imp]} (${f[idx.dC]})<br>
                        <b>Ports:</b> ${f[idx.oPort] || 'N/A'} → ${f[idx.dPort] || 'N/A'}
                    </div>
                    <div class="popup-scroll">
                        <table class="popup-table">
                            <thead><tr><th>Date</th><th>Quantity</th><th>Value (USD)</th><th>PRODUCT</th><th>Mode</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>`, { maxWidth: 450 });
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
        const exp = r[idx.exp], imp = r[idx.imp];
        const p1 = window.clusterMode === 'COUNTRY' ? r[idx.oC] : r[idx.prod];
        const p2 = window.clusterMode === 'COUNTRY' ? r[idx.dC] : r[idx.prod];

        [p1, p2, exp, imp].forEach((id, i) => {
            if(id && !nodeSet.has(id)) {
                nodes.push({id, type: i < 2 ? 'parent' : (i === 2 ? 'exp' : 'imp')});
                nodeSet.add(id);
            }
        });
        links.push({source: exp, target: imp, type: 'trade', data: r});
        links.push({source: p1, target: exp, type: 'link'});
        links.push({source: p2, target: imp, type: 'link'});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.type === 'link' ? 60 : 180))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'link' ? "#e2e8f0" : "#94a3b8").attr("stroke-width", 2);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'parent' ? 24 : 18)
        .attr("fill", d => d.type === 'parent' ? '#1e293b' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e'))
        .attr("stroke", "#fff").attr("stroke-width", 2);

    node.append("foreignObject").attr("x", -9).attr("y", -11).attr("width", 20).attr("height", 20)
        .html(d => `<i class="fas ${d.type==='parent'?'fa-globe':(d.type==='exp'?'fa-building':'fa-store')}" style="color:white; font-size:14px"></i>`);

    node.append("text").text(d => d.id).attr("y", 40).attr("text-anchor", "middle").style("font-size", "10px").style("font-weight", "bold");

    link.filter(d => d.type === 'trade').on("click", (e, d) => {
        d3.selectAll(".cluster-pop").remove();
        d3.select("#map-frame").append("div").attr("class", "cluster-pop")
            .style("left", e.offsetX + "px").style("top", e.offsetY + "px")
            .html(`<span class="pop-close" onclick="this.parentElement.remove()">×</span>
                   <strong>${d.data[idx.prod]}</strong><br>
                   <b>Date:</b> ${d.data[idx.date] || "N/A"}<br>
                   <b>Value:</b> $${d.data[idx.val]}`);
    });

    sim.on("tick", () => {
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
        node.attr("transform", d=>`translate(${d.x},${d.y})`);
    });
};
