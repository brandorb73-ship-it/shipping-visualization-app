window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 
let currentCategory = 'MAP';
let activeMap = null;
let simulation = null;

// Ensure functions are available globally immediately
window.attemptLogin = function() {
    const val = document.getElementById('pass-input').value;
    if (val === window.ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('isLoggedIn', 'true');
        window.fetchReports();
    } else { alert("Invalid Access Key"); }
};

window.fetchReports = async function() {
    try {
        const res = await fetch(window.DB_URL);
        const data = await res.json();
        const rows = data.slice(1).filter(r => r[3].toUpperCase() === currentCategory.toUpperCase());
        renderTable(rows);
    } catch (e) { console.log("Data sync pending..."); }
};

function renderTable(rows) {
    document.getElementById('report-list-rows').innerHTML = rows.map(r => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4]}</td>
            <td>${r[5]}</td>
            <td><span class="badge">${r[3]}</span></td>
            <td style="text-align:right">
                <button onclick="window.viewReport('${r[2]}', '${r[1]}')" class="btn-primary-add" style="padding:5px 10px;">View</button>
            </td>
        </tr>`).join('');
}

window.viewReport = async function(url, title) {
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    document.getElementById('viewing-title').innerText = title;
    
    const container = document.getElementById('map-element');
    container.innerHTML = "";
    if (activeMap) { activeMap.remove(); activeMap = null; }

    const csvUrl = url.includes("google.com") ? url.replace(/\/edit.*$/, '/export?format=csv') : url;
    const res = await fetch(csvUrl);
    const text = await res.text();
    const data = text.split('\n').filter(r => r.trim()).slice(1).map(l => l.split(','));

    if(currentCategory === 'MAP') initMap(data); else initCluster(data);
};

function initMap(data) {
    activeMap = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(activeMap);
    data.forEach(r => {
        if(r[2] && !isNaN(parseFloat(r[2]))) {
            // Draw Route
            L.polyline([[r[2], r[3]], [r[4], r[5]]], {color: '#38bdf8', weight: 3}).addTo(activeMap);
            // Add Shipment Label
            L.circleMarker([r[4], r[5]], {radius: 6, color: '#0f172a'}).addTo(activeMap).bindPopup(`<b>Shipment:</b> ${r[0]}`);
        }
    });
}

function initCluster(data) {
    const container = document.getElementById('map-element');
    const width = container.clientWidth, height = container.clientHeight;
    const svg = d3.select("#map-element").append("svg").attr("width", "100%").attr("height", "100%");
    const g = svg.append("g");

    // Add Zoom behavior
    svg.call(d3.zoom().on("zoom", (e) => g.attr("transform", e.transform)));

    let nodes = [], links = [], nodeSet = new Set();
    data.forEach(r => {
        if(r[0] && r[1]) {
            if(!nodeSet.has(r[0])) { nodes.push({id: r[0], type: 'source'}); nodeSet.add(r[0]); }
            if(!nodeSet.has(r[1])) { nodes.push({id: r[1], type: 'target'}); nodeSet.add(r[1]); }
            links.push({source: r[0], target: r[1]});
        }
    });

    simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "#cbd5e1").attr("stroke-width", 2);
    const node = g.append("g").selectAll("g").data(nodes).enter().append("g");

    node.append("circle").attr("r", 10).attr("fill", d => d.type === 'source' ? '#38bdf8' : '#0f172a');
    
    // THE FIX: Add names/labels to clusters
    node.append("text").text(d => d.id).attr("x", 14).attr("y", 4).style("font-size", "12px").style("font-weight", "600");

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
}

window.openModal = () => document.getElementById('report-modal').style.display = 'flex';
window.closeModal = () => document.getElementById('report-modal').style.display = 'none';
window.goBackToList = () => { document.getElementById('page-view').style.display = 'none'; document.getElementById('page-list').style.display = 'block'; };
window.showPage = (c) => { currentCategory = c.toUpperCase(); window.fetchReports(); };

window.onload = () => {
    if(sessionStorage.getItem('isLoggedIn') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        window.fetchReports();
    }
};
