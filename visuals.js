/**
 * BRANDORB VISUALS ENGINE
 */

window.downloadPDF = function() {
    const element = document.getElementById('map-frame');
    html2canvas(element, { useCORS: true, allowTaint: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'BrandOrb_Report.png';
        link.href = canvas.toDataURL();
        link.click();
    });
};

window.populateFilters = function() {
    if (!window.rawData) return;
    const headers = window.rawData[0];
    const data = window.rawData.slice(1);
    const fill = (id, col, lbl) => {
        const i = headers.indexOf(col);
        const el = document.getElementById(id);
        if (i === -1 || !el) return;
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country', 'Origin Countries');
    fill('dest-filter', 'Destination Country', 'Destination Countries');
};

window.recomputeViz = function() {
    const search = document.getElementById('ent-search').value.toLowerCase();
    const typeF = document.getElementById('entity-type-filter').value;
    const headers = window.rawData[0];
    const idx = (n) => headers.indexOf(n);

    const grouped = {};
    window.rawData.slice(1).forEach(r => {
        const exp = r[idx("Exporter")], imp = r[idx("Importer")];
        let match = (exp+imp+r[idx("PRODUCT")]).toLowerCase().includes(search);
        if(typeF === "Exporter") match = exp.toLowerCase().includes(search);
        if(typeF === "Importer") match = imp.toLowerCase().includes(search);

        if(match) {
            const key = `${exp}|${imp}`;
            if(!grouped[key]) grouped[key] = [];
            grouped[key].push(r);
        }
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if(window.LMap) { window.LMap.remove(); window.LMap = null; }

    if(tab === 'MAP') window.drawMap(Object.values(grouped), idx);
    else window.drawCluster(Object.values(grouped).flat(), idx);
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    const hasCurve = typeof L.curve === 'function';

    groups.forEach(group => {
        const f = group[0];
        const p1 = [parseFloat(f[idx("Origin latitude")]), parseFloat(f[idx("Origin longitude")])];
        const p2 = [parseFloat(f[idx("Destination latitude")]), parseFloat(f[idx("Destination longitude")])];

        if(!isNaN(p1[0]) && !isNaN(p2[0])) {
            let path;
            if(hasCurve) {
                // Curved Arc
                path = L.curve(['M', p1, 'Q', [(p1[0]+p2[0])/2 + 5, (p1[1]+p2[1])/2 + 5], p2], {
                    color: f[idx("COLOR")] || '#0ea5e9', weight: 3, fill: false
                }).addTo(window.LMap);
            } else {
                // Fallback to straight line if plugin fails
                path = L.polyline([p1, p2], {color: '#0ea5e9', weight: 2}).addTo(window.LMap);
            }

            const html = group.map(s => `<div style="border-top:1px solid #eee; padding-top:4px; font-size:11px;">
                <b>Product:</b> ${s[idx("PRODUCT")]}<br><b>Date:</b> ${s[idx("Date")]}<br><b>Transport:</b> ${s[idx("Mode of Transport")]}</div>`).join('');
            path.bindPopup(`<b>${f[idx("Exporter")]}</b> → <b>${f[idx("Importer")]}</b><br>${html}`);
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
        const exp = r[idx("Exporter")], imp = r[idx("Importer")], oC = r[idx("Origin Country")], dC = r[idx("Destination Country")];
        if(!nodeSet.has(exp)) { nodes.push({id: exp, type: 'exp'}); nodeSet.add(exp); }
        if(!nodeSet.has(imp)) { nodes.push({id: imp, type: 'imp'}); nodeSet.add(imp); }
        if(!nodeSet.has(oC)) { nodes.push({id: oC, type: 'country'}); nodeSet.add(oC); }
        if(!nodeSet.has(dC)) { nodes.push({id: dC, type: 'country'}); nodeSet.add(dC); }
        links.push({source: exp, target: imp, data: r, type: 'trade'});
        links.push({source: exp, target: oC, type: 'loc'});
        links.push({source: imp, target: dC, type: 'loc'});
    });

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(100)).force("charge", d3.forceManyBody().strength(-300)).force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d => d.type === 'loc' ? "#cbd5e1" : "#1e293b").attr("stroke-width", 2)
        .on("click", (e, d) => { if(d.data) alert(`Product: ${d.data[idx("PRODUCT")]}\nQty: ${d.data[idx("Quantity")]}\nValue: $${d.data[idx("Value(USD)")]}\nMode: ${d.data[idx("Mode of Transport")]}`); });

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag().on("start", (e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y}).on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle").attr("r", d => d.type === 'country' ? 18 : 12).attr("fill", d => d.type === 'country' ? '#475569' : (d.type === 'exp' ? '#0ea5e9' : '#f43f5e')).attr("stroke", "#fff");
    node.append("text").text(d => d.type === 'country' ? "🌐 " + d.id : d.id).attr("y", 28).attr("text-anchor", "middle").attr("fill", "#0f172a").style("font-size", "10px").style("font-weight", "bold");

    sim.on("tick", () => { link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y); node.attr("transform", d=>`translate(${d.x},${d.y})`); });
};
