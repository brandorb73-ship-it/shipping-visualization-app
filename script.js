window.attemptLogin = function() {
    const pass = document.getElementById('pass-input').value;
    if (pass === "admin123") { // Matches your access key
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('isLoggedIn', 'true');
        if (typeof window.fetchReports === "function") window.fetchReports();
    } else {
        alert("Invalid Access Key");
    }
};


window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 
let currentCategory = 'MAP';
let activeMap = null;

// --- CORPORATE CLIENT MANAGEMENT ---
window.addNewClient = async function() {
    const clientName = prompt("Enter New Client Name:");
    if (!clientName) return;

    // Update UI immediately
    const sel = document.getElementById('client-select');
    const opt = document.createElement('option');
    opt.value = clientName;
    opt.innerText = clientName;
    sel.appendChild(opt);
    sel.value = clientName;

    // Save to Database
    const payload = {
        target: "Clients",
        data: [clientName, new Date().toISOString()]
    };
    
    try {
        await fetch(window.DB_URL, { method: 'POST', body: JSON.stringify(payload) });
    } catch (e) {
        console.error("Client Sync Error:", e);
    }
};

// --- VISUALIZATION ENGINE (BLANK SCREEN FIX) ---
window.viewReport = async function(url, title) {
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    document.getElementById('viewing-title').innerText = title;
    
    const container = document.getElementById('map-element');
    container.innerHTML = ""; 
    if (activeMap) { activeMap.remove(); activeMap = null; }

    try {
        // Handle Google Sheet links
        const csvUrl = url.includes("google.com") ? url.replace(/\/edit.*$/, '/export?format=csv') : url;
        
        const res = await fetch(csvUrl);
        const text = await res.text();
        const rows = text.split('\n').filter(r => r.trim()).slice(1).map(l => l.split(','));

        if(currentCategory === 'MAP') {
            initRouteMap(rows);
        } else {
            initClusterGraph(rows);
        }
    } catch(e) { 
        container.innerHTML = `<div style="padding:40px;">Error: Data link unreachable or private.</div>`;
    }
};

// --- LEAFLET ROUTE MAP ---
function initRouteMap(data) {
    activeMap = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(activeMap);
    
    data.forEach(r => {
        const oLat = parseFloat(r[2]), oLng = parseFloat(r[3]), dLat = parseFloat(r[4]), dLng = parseFloat(r[5]);
        if(!isNaN(oLat) && !isNaN(dLat)) {
            L.polyline([[oLat, oLng], [dLat, dLng]], {color: '#38bdf8', weight: 2}).addTo(activeMap);
            L.circleMarker([dLat, dLng], {radius: 4, color: '#0f172a'}).addTo(activeMap).bindPopup(r[1]);
        }
    });
}

// --- D3 CLUSTER GRAPH ---
function initClusterGraph(data) {
    const container = document.getElementById('map-element');
    const width = container.clientWidth;
    const height = container.clientHeight || 600;
    const svg = d3.select("#map-element").append("svg").attr("width", "100%").attr("height", height);
    
    let nodes = [], links = [], nodeSet = new Set();
    data.forEach(r => {
        if(r[0] && r[1]) {
            if(!nodeSet.has(r[0])) { nodes.push({id: r[0], type: 'exp'}); nodeSet.add(r[0]); }
            if(!nodeSet.has(r[1])) { nodes.push({id: r[1], type: 'imp'}); nodeSet.add(r[1]); }
            links.push({source: r[0], target: r[1]});
        }
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-250))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "#cbd5e1").attr("stroke-width", 2);

    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle")
        .attr("r", 10).attr("fill", d => d.type === 'exp' ? '#38bdf8' : '#0f172a');

    sim.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });
}
