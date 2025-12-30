window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 

let currentCategory = 'MAP';
let activeMap = null;

// --- AUTH & NAVIGATION ---
window.attemptLogin = function() {
    const input = document.getElementById('pass-input').value;
    if (input === window.ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('loggedIn', 'true');
        window.fetchReports();
    }
};

window.showPage = function(cat) {
    currentCategory = cat.toUpperCase();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('nav-' + cat).classList.add('active');
    document.getElementById('page-list').style.display = 'block';
    document.getElementById('page-view').style.display = 'none';
    window.fetchReports();
};

// --- DATA PUBLISHING ---
window.viewReport = async function(csvUrl, title) {
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    document.getElementById('viewing-title').innerText = title;

    const container = document.getElementById('map-element');
    container.innerHTML = ""; 
    if (activeMap) { activeMap.remove(); activeMap = null; }

    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        const rows = csvText.split('\n').filter(r => r.trim() !== '').slice(1).map(line => line.split(','));

        if (currentCategory === 'MAP') {
            initRouteMap(rows);
        } else {
            initClusterGraph(rows);
        }
    } catch (e) {
        container.innerHTML = `<div style="padding:50px; color:red;">Error: Link is not a public CSV.</div>`;
    }
};

// --- LEAFLET MAP ENGINE ---
function initRouteMap(data) {
    activeMap = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(activeMap);
    data.forEach(row => {
        const [exp, imp, oLat, oLng, dLat, dLng] = row;
        if (oLat && dLat) {
            L.polyline([[oLat, oLng], [dLat, dLng]], {color: '#38bdf8', weight: 2, opacity: 0.6}).addTo(activeMap);
            L.circleMarker([dLat, dLng], {radius: 5, color: '#0f172a', fillOpacity: 1}).addTo(activeMap).bindPopup(`<b>To:</b> ${imp}`);
        }
    });
}

// --- D3 CLUSTER ENGINE ---
function initClusterGraph(data) {
    const container = document.getElementById('map-element');
    const width = container.clientWidth, height = container.clientHeight;
    const svg = d3.select("#map-element").append("svg").attr("width", width).attr("height", height);

    let nodes = [], links = [], nodeSet = new Set();
    data.forEach(r => {
        if(r[0] && r[1]) {
            if(!nodeSet.has(r[0])) { nodes.push({id: r[0], group: 1}); nodeSet.add(r[0]); }
            if(!nodeSet.has(r[1])) { nodes.push({id: r[1], group: 2}); nodeSet.add(r[1]); }
            links.push({source: r[0], target: r[1]});
        }
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "#cbd5e1").attr("stroke-width", 2);
    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle")
        .attr("r", 10).attr("fill", d => d.group === 1 ? '#38bdf8' : '#0f172a')
        .call(d3.drag().on("start", (e,d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e,d) => { d.fx = e.x; d.fy = e.y; }).on("end", (e,d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append("title").text(d => d.id);
    sim.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });
}

window.goBackToList = () => {
    document.getElementById('page-view').style.display = 'none';
    document.getElementById('page-list').style.display = 'block';
};
