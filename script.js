window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 
let currentCategory = 'MAP';
let activeMap = null;

// --- LOGIN & LOGO ---
window.attemptLogin = function() {
    if (document.getElementById('pass-input').value === window.ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('isLoggedIn', 'true');
        window.fetchReports();
    } else { alert("Access Denied"); }
};

window.handleLogoUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            localStorage.setItem('brandorb_logo', e.target.result);
            window.applyLogo(e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.applyLogo = (src) => {
    document.querySelectorAll('.global-logo-src, #login-display-logo').forEach(img => { img.src = src; img.style.display = 'block'; });
};

// --- DATA ENGINES ---
window.viewReport = async function(url, title) {
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    document.getElementById('viewing-title').innerText = title;
    
    const container = document.getElementById('map-element');
    container.innerHTML = ""; if (activeMap) { activeMap.remove(); activeMap = null; }

    const csvUrl = url.includes("google.com") ? url.replace(/\/edit.*$/, '/export?format=csv') : url;
    const res = await fetch(csvUrl);
    const text = await res.text();
    const rows = text.split('\n').filter(r => r.trim()).slice(1).map(l => l.split(','));

    if(currentCategory === 'MAP') initRouteMap(rows); else initClusterGraph(rows);
};

function initRouteMap(data) {
    activeMap = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(activeMap);
    data.forEach(r => {
        const oLat = parseFloat(r[2]), oLng = parseFloat(r[3]), dLat = parseFloat(r[4]), dLng = parseFloat(r[5]);
        if(!isNaN(oLat)) {
            L.polyline([[oLat, oLng], [dLat, dLng]], {color: '#38bdf8', weight: 2}).addTo(activeMap);
            L.circleMarker([dLat, dLng], {radius: 5, color: '#0f172a'}).addTo(activeMap).bindPopup(`<b>${r[0]}</b>`);
        }
    });
}

function initClusterGraph(data) {
    const container = document.getElementById('map-element');
    const width = container.clientWidth, height = container.clientHeight || 600;
    const svg = d3.select("#map-element").append("svg").attr("width", width).attr("height", height);
    
    let nodes = [], links = [], nodeSet = new Set();
    data.forEach(r => {
        if(r[0] && r[1]) {
            if(!nodeSet.has(r[0])) { nodes.push({id: r[0], g: 1}); nodeSet.add(r[0]); }
            if(!nodeSet.has(r[1])) { nodes.push({id: r[1], g: 2}); nodeSet.add(r[1]); }
            links.push({source: r[0], target: r[1]});
        }
    });

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(120)).force("charge", d3.forceManyBody().strength(-200)).force("center", d3.forceCenter(width/2, height/2));
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "#cbd5e1");
    
    const nodeGroup = svg.append("g").selectAll("g").data(nodes).enter().append("g");
    nodeGroup.append("circle").attr("r", 10).attr("fill", d => d.g === 1 ? '#38bdf8' : '#0f172a');
    
    // ADD TEXT LABELS TO CLUSTERS
    nodeGroup.append("text").text(d => d.id).attr("x", 12).attr("y", 4).style("font-size", "10px").style("fill", "#334155");

    sim.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });
}
