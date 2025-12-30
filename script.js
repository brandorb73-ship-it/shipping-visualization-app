let DB_URL = "https://script.google.com/macros/s/AKfycbwCdQomilIT71s1c6qZWY21RsoVv5ZQG37zilaSEpJQpCoWyABhHpcWroyT1qf7QMgR/exec"; // ENSURE THIS IS CORRECT
let selectedType = 'map';
let reports = [];

// Initialize
window.onload = async () => {
    loadSavedLogo();
    await fetchReports();
};

function showPage(id) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.getElementById('page-' + id).style.display = 'block';
}

function selectType(type) {
    selectedType = type;
    document.getElementById('box-map').classList.toggle('active', type === 'map');
    document.getElementById('box-cluster').classList.toggle('active', type === 'cluster');
}

// FETCH FROM GOOGLE DRIVE
async function fetchReports() {
    try {
        const response = await fetch(DB_URL);
        const data = await response.json();
        reports = data.slice(1); // Exclude header row
        renderTable();
    } catch (e) {
        console.error("Could not load from Drive. Checking local storage...");
    }
}

function renderTable() {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = reports.map((r, index) => `
        <tr>
            <td>${r[1]}</td>
            <td>${r[5]}</td>
            <td>${r[4]}</td>
            <td>${r[3]}</td>
            <td>
                <button onclick="previewReport(${index})">Preview</button>
                <button onclick="deleteReport(${index})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// SAVE TO DRIVE
async function processAndSave() {
    const title = document.getElementById('report-name').value;
    const url = document.getElementById('sheet-url').value;
    const client = document.getElementById('client-select').value;
    const date = new Date().toLocaleDateString();

    const payload = {
        target: "Reports",
        data: [Date.now(), title, url, selectedType, client, date]
    };

    // Save to Drive
    await fetch(DB_URL, { method: 'POST', body: JSON.stringify(payload) });
    
    // Refresh
    await fetchReports();
    showPage('list');
}

function previewReport(index) {
    const r = reports[index];
    const url = r[2]; // The Google Sheet URL
    const type = r[3];
    
    showPage('view');
    document.getElementById('viewing-title').innerText = r[1];

    Papa.parse(url, {
        download: true,
        header: true,
        complete: function(results) {
            if(type === 'map') renderMap(results.data);
            else renderCluster(results.data);
        }
    });
}

function renderMap(data) {
    document.getElementById('map-element').style.display = 'block';
    document.getElementById('cluster-element').style.display = 'none';
    
    let map = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    data.forEach(d => {
        const start = [parseFloat(d['Origin latitude']), parseFloat(d['Origin longitude'])];
        const end = [parseFloat(d['Destination latitude']), parseFloat(d['Destination longitude'])];
        
        if(!start[0] || !end[0]) return;

        L.marker(start).addTo(map).bindPopup("Exporter: " + d.Exporter);
        L.marker(end).addTo(map).bindPopup("Importer: " + d.Importer);

        // MOVING CURVED LINES
        L.polyline.antPath([start, end], {
            color: d.COLOR || 'red', 
            pulseColor: 'white',
            delay: 2000,
            dashArray: [10, 20],
            weight: 3
        }).addTo(map);
    });
}

// CLUSTER LOGIC (Grouped by country)
function renderCluster(data) {
    document.getElementById('map-element').style.display = 'none';
    const container = document.getElementById('cluster-element');
    container.style.display = 'block';
    container.innerHTML = "";

    const width = container.clientWidth || 800;
    const height = 600;
    const svg = d3.select("#cluster-element").append("svg").attr("width", width).attr("height", height);

    let nodes = [], links = [];
    data.forEach(d => {
        if(!nodes.find(n => n.id === d.Exporter)) nodes.push({id: d.Exporter, type: 'Exp', country: d['Origin Country Name']});
        if(!nodes.find(n => n.id === d.Importer)) nodes.push({id: d.Importer, type: 'Imp', country: d['Destination Country Name']});
        links.push({source: d.Exporter, target: d.Importer});
    });

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "#bbb").attr("stroke-width", 2);

    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle")
        .attr("r", 15)
        .attr("fill", d => d.type === 'Exp' ? '#ff6b6b' : '#4facfe')
        .call(d3.drag().on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
                      .on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append("title").text(d => d.id + " (" + d.country + ")");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });
}

function handleLogo(e) {
    const reader = new FileReader();
    reader.onload = () => {
        localStorage.setItem('savedLogo', reader.result);
        loadSavedLogo();
    };
    reader.readAsDataURL(e.target.files[0]);
}

function loadSavedLogo() {
    const data = localStorage.getItem('savedLogo');
    if(data) {
        document.getElementById('user-logo').src = data;
        document.getElementById('user-logo').style.display = 'block';
        document.getElementById('logo-placeholder').style.display = 'none';
    }
}
