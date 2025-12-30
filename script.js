window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 

let currentCategory = 'MAP';
let activeMap = null;

// --- NAVIGATION ---
window.showPage = function(category) {
    currentCategory = category.toUpperCase();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('nav-' + category).classList.add('active');
    document.getElementById('page-list').style.display = 'block';
    document.getElementById('page-view').style.display = 'none';
    window.fetchReports();
};

// --- CORE VISUALIZATION ENGINE ---
window.viewReport = async function(csvUrl, title) {
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    document.getElementById('viewing-title').innerText = title;

    const container = document.getElementById('map-element');
    container.innerHTML = ""; // Clear for next render
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
        console.error("Data Load Error:", e);
        container.innerHTML = "<p style='padding:20px;'>Error: Could not load CSV. Ensure the link is public.</p>";
    }
};

// --- D3 CLUSTER GRAPH ---
function initClusterGraph(data) {
    const container = document.getElementById('map-element');
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select("#map-element").append("svg")
        .attr("width", width).attr("height", height);

    let nodes = [];
    let links = [];
    let nodeSet = new Set();

    data.forEach(row => {
        const s = row[0], t = row[1];
        if(s && t) {
            if(!nodeSet.has(s)) { nodes.push({id: s, type: 'exporter'}); nodeSet.add(s); }
            if(!nodeSet.has(t)) { nodes.push({id: t, type: 'importer'}); nodeSet.add(t); }
            links.push({source: s, target: t});
        }
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-150))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "#cbd5e1").attr("stroke-width", 1.5);

    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle")
        .attr("r", 7).attr("fill", d => d.type === 'exporter' ? "#38bdf8" : "#0f172a")
        .call(d3.drag().on("start", (e, d) => {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
        }).on("drag", (e, d) => {
            d.fx = e.x; d.fy = e.y;
        }).on("end", (e, d) => {
            if (!e.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
        }));

    node.append("title").text(d => d.id);

    sim.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });
}

function initRouteMap(data) {
    activeMap = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(activeMap);
    data.forEach(row => {
        const [exp, imp, oLat, oLng, dLat, dLng] = row;
        if (oLat && dLat) {
            L.polyline([[oLat, oLng], [dLat, dLng]], {color: '#38bdf8', weight: 2}).addTo(activeMap);
            L.circleMarker([dLat, dLng], {radius: 4, color: '#0f172a'}).addTo(activeMap).bindPopup(imp);
        }
    });
}
