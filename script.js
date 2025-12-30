let DB_URL = "YOUR_APPS_SCRIPT_URL_HERE"; 
let reports = [];
let selectedType = 'map';
let mapInstance = null;

window.onload = async () => {
    loadSavedLogo();
    await fetchReports();
};

async function fetchReports() {
    try {
        const response = await fetch(DB_URL);
        const data = await response.json();
        // Use a Set to prevent duplicates if the spreadsheet has double entries
        let uniqueReports = [];
        let seenIds = new Set();
        
        data.slice(1).forEach(r => {
            if(!seenIds.has(r[0])) {
                uniqueReports.push(r);
                seenIds.add(r[0]);
            }
        });
        
        reports = uniqueReports;
        renderTable();
        updateSidebarLists();
    } catch (e) { console.error("Sync error:", e); }
}

function updateSidebarLists() {
    const mapList = document.getElementById('route-map-list');
    const clusterList = document.getElementById('cluster-report-list');
    
    mapList.innerHTML = reports.filter(r => r[3] === 'map').map(r => `<div class="sub-item" onclick="previewReportById('${r[0]}')">${r[1]}</div>`).join('');
    clusterList.innerHTML = reports.filter(r => r[3] === 'cluster').map(r => `<div class="sub-item" onclick="previewReportById('${r[0]}')">${r[1]}</div>`).join('');
}

function renderFlowMap(data) {
    if(mapInstance) { mapInstance.remove(); }
    document.getElementById('map-element').style.display = 'block';
    document.getElementById('cluster-element').style.display = 'none';
    
    mapInstance = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);

    data.forEach(d => {
        const s = [parseFloat(d['Origin latitude']), parseFloat(d['Origin longitude'])];
        const e = [parseFloat(d['Destination latitude']), parseFloat(d['Destination longitude'])];
        if(!s[0] || !e[0]) return;

        // Curved Path Logic
        let latlngs = [];
        let offsetX = e[1] - s[1], offsetY = e[0] - s[0];
        let r = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));
        let theta = Math.atan2(offsetY, offsetX);
        let thetaOffset = 0.5; // Controls the curve amount
        let midpoint = [ s[0] + (e[0] - s[0]) / 2 + (r/4), s[1] + (e[1] - s[1]) / 2 ];

        // Marker for both with Popups
        L.circleMarker(s, {color: 'green', radius: 4}).addTo(mapInstance).bindPopup(`Exporter: ${d.Exporter}<br>Port: ${d['Origin Port']}`);
        L.circleMarker(e, {color: 'red', radius: 4}).addTo(mapInstance).bindPopup(`Importer: ${d.Importer}<br>Port: ${d['Destination Port']}`);

        // CURVED MOVING ANT PATH
        L.polyline.antPath([s, midpoint, e], {
            "paused": false, "delay": 2000, "dashArray": [10, 20],
            "weight": 3, "color": d.COLOR || "navy", "pulseColor": "#ffffff", "curved": true
        }).addTo(mapInstance);
    });
}

function renderCluster(data) {
    document.getElementById('map-element').style.display = 'none';
    const container = document.getElementById('cluster-element');
    container.style.display = 'block';
    container.innerHTML = "";

    const width = container.clientWidth, height = 600;
    const svg = d3.select("#cluster-element").append("svg").attr("width", width).attr("height", height);

    // Grouping nodes by country
    let nodes = [];
    let links = [];

    data.forEach(d => {
        if(!nodes.find(n => n.id === d.Exporter)) nodes.push({id: d.Exporter, type: 'Exp', country: d['Origin Country Name']});
        if(!nodes.find(n => n.id === d.Importer)) nodes.push({id: d.Importer, type: 'Imp', country: d['Destination Country Name']});
        links.push({source: d.Exporter, target: d.Importer});
    });

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("x", d3.forceX(d => d.type === 'Exp' ? width/4 : 3*width/4).strength(0.1)) // Separate Exporters/Importers
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "red").attr("stroke-width", 1.5).attr("opacity", 0.6);

    const node = svg.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    node.append("circle").attr("r", 12).attr("fill", d => d.type === 'Exp' ? '#d32f2f' : '#1976d2');
    
    // Node Labels
    node.append("text").text(d => d.id).attr("font-size", "10px").attr("dx", 15).attr("dy", 4);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
}

function dragstarted(e, d) { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
function dragged(e, d) { d.fx = e.x; d.fy = e.y; }
function dragended(e, d) { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }
