window.clusterMode = 'COUNTRY'; 

const formatDate = (dVal) => {
    if (!dVal) return 'N/A';
    const str = String(dVal).trim();
    const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[0] : str;
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
    const fill = (id, col, lbl) => {
        const i = h.findIndex(header => header.trim() === col);
        if (i === -1) return;
        const vals = [...new Set(window.rawData.slice(1).map(r => r[i]))].filter(v => v).sort();
        document.getElementById(id).innerHTML = `<option value="All">All ${lbl}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter', 'Origin Country', 'Countries');
    fill('dest-filter', 'Destination Country', 'Countries');
};

window.recomputeViz = function() {
    if (!window.rawData) return;
    const search = document.getElementById('ent-search').value.toLowerCase();
    const h = window.rawData[0];
    const idx = (n) => h.findIndex(header => header.trim() === n);

    const filtered = window.rawData.slice(1).filter(r => {
        const text = (r[idx("Exporter")] + r[idx("Importer")] + r[idx("PRODUCT")]).toLowerCase();
        const oMatch = document.getElementById('orig-filter').value === 'All' || r[idx("Origin Country")] === document.getElementById('orig-filter').value;
        const dMatch = document.getElementById('dest-filter').value === 'All' || r[idx("Destination Country")] === document.getElementById('dest-filter').value;
        return text.includes(search) && oMatch && dMatch;
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap = null; }

    if (window.currentTab === 'MAP') {
        const groups = {};
        filtered.forEach(r => {
            const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });
        window.drawMap(Object.values(groups), idx);
    } else {
        window.drawCluster(filtered, idx);
    }
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    groups.forEach((group, gIdx) => {
        const f = group[0];
        const lat1 = parseFloat(f[idx("Origin latitude")]), lon1 = parseFloat(f[idx("Origin longitude")]);
        const lat2 = parseFloat(f[idx("Destination latitude")]), lon2 = parseFloat(f[idx("Destination longitude")]);

        if (!isNaN(lat1) && !isNaN(lat2)) {
            const offset = (gIdx * 0.12); 
            const ant = L.polyline.antPath([[lat1, lon1], [lat2 + offset, lon2 + offset]], { 
                color: f[idx("COLOR")] || '#0ea5e9', weight: 3 
            }).addTo(window.LMap);

            const tableRows = group.map(s => `<tr>
                <td>${formatDate(s[idx("Date")])}</td>
                <td>${s[idx("Weight(Kg)")]}</td>
                <td>$${s[idx("Amount($)")]}</td>
                <td>${s[idx("PRODUCT")]}</td>
                <td>${s[idx("Mode of Transportation")]}</td>
            </tr>`).join('');

            ant.bindPopup(`
                <div style="font-family:sans-serif;">
                    <strong>Exporter:</strong> ${f[idx("Exporter")]}<br>
                    <strong>Importer:</strong> ${f[idx("Importer")]}<br>
                    <table class="popup-table">
                        <thead><tr style="background:#f8fafc;">
                            <th style="width:18%">Date</th>
                            <th style="width:12%">Weight</th>
                            <th style="width:15%">Amount</th>
                            <th style="width:45%">PRODUCT</th>
                            <th style="width:10%">Mode</th>
                        </tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>`, { maxWidth: 620 });
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
        const gp = r[idx("Origin Country")];
        if(!exp || !imp || !gp) return;
        [gp].forEach(p => { if(!nodeSet.has(p)) { nodes.push({id: p, type: 'parent'}); nodeSet.add(p); }});
        if(!nodeSet.has(exp)) { nodes.push({id: exp, type: 'exp'}); nodeSet.add(exp); }
        if(!nodeSet.has(imp)) { nodes.push({id: imp, type: 'imp'}); nodeSet.add(imp); }
        links.push({source: exp, target: imp, type: 'trade', data: r});
        links.push({source: gp, target: exp, type: 'link'});
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "#cbd5e1").attr("stroke-width", 1);

    const node = g.append("g").selectAll("circle").data(nodes).enter().append("circle")
        .attr("r", d => d.type === 'parent' ? 20 : 12)
        .attr("fill", d => d.type === 'parent' ? '#1e293b' : '#0ea5e9');

    sim.on("tick", () => {
        link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
        node.attr("cx", d=>d.x).attr("cy", d=>d.y);
    });
};
