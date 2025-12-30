const DB_URL = "YOUR_APPS_SCRIPT_URL"; // Paste your Google Script Link here
let currentType = 'map';
let allReports = [];
let map;

// 1. LOGIN CHECK
if(!localStorage.getItem('auth')) {
    let pass = prompt("Enter Password:");
    if(pass === "1234") localStorage.setItem('auth', 'true');
    else window.location.reload();
}

// 2. LOAD DATA FROM GOOGLE DRIVE
async function loadReports() {
    const res = await fetch(DB_URL);
    const data = await res.json();
    allReports = data.slice(1); // Remove headers
    renderList();
}

function renderList() {
    const body = document.getElementById('list-body');
    body.innerHTML = allReports.map((r, i) => `
        <tr>
            <td>${r[1]}</td><td>${r[5]}</td><td>${r[4]}</td><td>${r[3]}</td>
            <td>
                <button onclick="openReport(${i})">Preview</button>
                <button onclick="downloadReport(${i})">Download</button>
            </td>
        </tr>
    `).join('');
}

// 3. MOVING FLOW LINES
function renderMap(data) {
    if(map) map.remove();
    map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    data.forEach(d => {
        const start = [d['Origin latitude'], d['Origin longitude']];
        const end = [d['Destination latitude'], d['Destination longitude']];
        
        // Marker for both
        L.marker(start).addTo(map).bindPopup("Exporter: " + d.Exporter);
        L.marker(end).addTo(map).bindPopup("Importer: " + d.Importer);

        // Moving "Ant Path" line (Animated & Curved)
        L.polyline.antPath([start, end], {
            "paused": false, "reverse": false, "delay": 3000, "dashArray": [10, 20],
            "weight": 3, "color": d.COLOR || "blue", "pulseColor": "#FFFFFF"
        }).addTo(map);
    });
}

// 4. CLUSTER GRAPH WITH LINES
function renderCluster(data) {
    document.getElementById('map').style.display = 'none';
    const container = document.getElementById('cluster-container');
    container.style.display = 'block';
    container.innerHTML = "";

    const width = 800, height = 600;
    const svg = d3.select("#cluster-container").append("svg").attr("width", width).attr("height", height);

    let nodes = [], links = [];
    data.forEach(d => {
        if(!nodes.find(n => n.id === d.Exporter)) nodes.push({id: d.Exporter, type: 'Exp', country: d['Origin Country Name']});
        if(!nodes.find(n => n.id === d.Importer)) nodes.push({id: d.Importer, type: 'Imp', country: d['Destination Country Name']});
        links.push({source: d.Exporter, target: d.Importer});
    });

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width/2, height/2));

    // Draw connecting lines
    const link = svg.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "#999").attr("stroke-width", 2);

    // Draw circles
    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle")
        .attr("r", 12)
        .attr("fill", d => d.type === 'Exp' ? '#ff4444' : '#4444ff') // Red for Exp, Blue for Imp
        .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    node.append("title").text(d => `${d.id} (${d.country})`);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });
}

// 5. SAVE TO DRIVE
async function saveToDrive() {
    const reportData = {
        target: "Reports",
        data: [Date.now(), document.getElementById('new-title').value, document.getElementById('new-url').value, currentType, "General", new Date().toLocaleDateString()]
    };
    await fetch(DB_URL, { method: 'POST', body: JSON.stringify(reportData) });
    alert("Saved to Google Drive!");
    loadReports();
    showSection('list');
}

// Logo Persistence
function uploadLogo(e) {
    const reader = new FileReader();
    reader.onload = () => {
        localStorage.setItem('userLogo', reader.result);
        document.getElementById('logo-img').src = reader.result;
    };
    reader.readAsDataURL(e.target.files[0]);
}

window.onload = () => {
    if(localStorage.getItem('userLogo')) document.getElementById('logo-img').src = localStorage.getItem('userLogo');
    loadReports();
};

function showSection(s) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById('section-'+s).style.display = 'block';
}
