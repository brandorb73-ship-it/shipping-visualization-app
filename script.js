let map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let allData = [];
let currentView = 'flow';

function toggleModal(show) { document.getElementById('modal-overlay').style.display = show ? 'block' : 'none'; }

function loadDataFromUrl() {
    let url = document.getElementById('sheet-url').value;
    Papa.parse(url, {
        download: true, header: true, skipEmptyLines: true,
        complete: function(results) {
            allData = results.data;
            updateFilters();
            filterData();
            toggleModal(false);
        }
    });
}

function updateFilters() {
    const colors = [...new Set(allData.map(d => d.COLOR))].filter(Boolean);
    const origins = [...new Set(allData.map(d => d['Origin Country Name']))].filter(Boolean);
    const dests = [...new Set(allData.map(d => d['Destination Country Name']))].filter(Boolean);
    
    fillSelect('color-filter', colors);
    fillSelect('origin-filter', origins);
    fillSelect('dest-filter', dests);
}

function fillSelect(id, items) {
    let select = document.getElementById(id);
    select.innerHTML = `<option value="All">All</option>`;
    items.forEach(item => select.innerHTML += `<option value="${item}">${item}</option>`);
}

function filterData() {
    let search = document.getElementById('search-box').value.toLowerCase();
    let colorF = document.getElementById('color-filter').value;
    let originF = document.getElementById('origin-filter').value;

    let filtered = allData.filter(d => {
        let matchesSearch = d.Exporter.toLowerCase().includes(search) || d.Importer.toLowerCase().includes(search);
        let matchesColor = colorF === 'All' || d.COLOR === colorF;
        let matchesOrigin = originF === 'All' || d['Origin Country Name'] === originF;
        return matchesSearch && matchesColor && matchesOrigin;
    });

    if (currentView === 'flow') renderFlowMap(filtered);
    else renderClusterGraph(filtered);
}

function renderFlowMap(data) {
    map.eachLayer(l => { if (l instanceof L.Polyline || l instanceof L.CircleMarker) map.removeLayer(l); });

    // Grouping by Exporter-Importer pairs for thick lines
    let groups = d3.group(data, d => d.Exporter + d.Importer);

    groups.forEach((shipments, key) => {
        let s = shipments[0];
        if (!s['Origin latitude'] || !s['Destination latitude']) return;

        let lineWeight = shipments.length > 1 ? 8 : 3;
        let lineColor = s.COLOR || 'blue';

        let line = L.polyline([
            [s['Origin latitude'], s['Origin longitude']],
            [s['Destination latitude'], s['Destination longitude']]
        ], { color: lineColor, weight: lineWeight, opacity: 0.6 }).addTo(map);

        // Marker for origin country
        L.circleMarker([s['Origin latitude'], s['Origin longitude']], {radius: 5, color: 'green'}).addTo(map)
            .bindPopup(s['Origin Country Name']);

        // Popup logic with Dropdown for multiple shipments
        let shipmentDetails = shipments.map((ship, i) => `
            <div style="border-top:1px solid #eee; padding-top:5px; margin-top:5px;">
                <b>Shipment ${i+1}:</b><br>
                📦 Product: ${ship.PRODUCT}<br>
                💰 Value: ${ship['Value(USD)']} | Qty: ${ship.Quantity}<br>
                📅 Date: ${ship.Date}
            </div>
        `).join('');

        line.bindPopup(`
            <div style="max-height: 200px; overflow-y: auto;">
                <h4 style="margin:0">Shipment Details</h4>
                🚢 Mode: ${s['Mode of Transport']}<br>
                🏭 Exp: ${s.Exporter}<br>
                🤝 Imp: ${s.Importer}<br>
                📍 Port: ${s['Origin Port']} ➔ ${s['Destination Port']}
                ${shipmentDetails}
            </div>
        `);
    });
}

function renderClusterGraph(data) {
    // This uses D3 to create a forced layout of Exporters and Importers
    document.getElementById('cluster-graph').innerHTML = "";
    const width = document.getElementById('cluster-graph').clientWidth;
    const height = document.getElementById('cluster-graph').clientHeight;

    const svg = d3.select("#cluster-graph").append("svg").attr("width", width).attr("height", height);

    // Grouping nodes by Country
    let nodes = [];
    data.forEach(d => {
        if (!nodes.find(n => n.id === d.Exporter)) nodes.push({ id: d.Exporter, type: 'Exporter', country: d['Origin Country Name'] });
        if (!nodes.find(n => n.id === d.Importer)) nodes.push({ id: d.Importer, type: 'Importer', country: d['Destination Country Name'] });
    });

    const simulation = d3.forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(-100))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(30));

    const nodeElements = svg.append("g")
        .selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("r", 10)
        .attr("fill", d => d.type === 'Exporter' ? '#e74c3c' : '#3498db') // Red for Exp, Blue for Imp
        .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    simulation.on("tick", () => {
        nodeElements.attr("cx", d => d.x).attr("cy", d => d.y);
    });

    function dragstarted(event) { if (!event.active) simulation.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; }
    function dragged(event) { event.subject.fx = event.x; event.subject.fy = event.y; }
    function dragended(event) { if (!event.active) simulation.alphaTarget(0); event.subject.fx = null; event.subject.fy = null; }
}

function switchTab(tab) {
    currentView = tab;
    document.getElementById('map').style.display = tab === 'flow' ? 'block' : 'none';
    document.getElementById('cluster-graph').style.display = tab === 'cluster' ? 'block' : 'none';
    filterData();
}
