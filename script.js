window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 
let currentCategory = 'MAP';
let activeMap = null;

// --- LOGIN & LOGO (FIXED) ---
window.attemptLogin = function() {
    const input = document.getElementById('pass-input').value;
    if (input === window.ACCESS_KEY) {
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
    document.querySelectorAll('.global-logo-src, #login-display-logo').forEach(img => {
        img.src = src; img.style.display = 'block';
    });
    if(document.getElementById('login-logo-placeholder')) document.getElementById('login-logo-placeholder').style.display = 'none';
};

// --- DATA LOGIC ---
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
        if(r[2]) L.polyline([[r[2], r[3]], [r[4], r[5]]], {color: '#38bdf8', weight: 2}).addTo(activeMap);
    });
}

function initClusterGraph(data) {
    const container = document.getElementById('map-element');
    const width = container.clientWidth, height = container.clientHeight || 600;
    const svg = d3.select("#map-element").append("svg").attr("width", "100%").attr("height", height);
    
    let nodes = [], links = [], nodeSet = new Set();
    data.forEach(r => {
        if(r[0] && r[1]) {
            if(!nodeSet.has(r[0])) { nodes.push({id: r[0], g: 1}); nodeSet.add(r[0]); }
            if(!nodeSet.has(r[1])) { nodes.push({id: r[1], g: 2}); nodeSet.add(r[1]); }
            links.push({source: r[0], target: r[1]});
        }
    });

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(100)).force("charge", d3.forceManyBody().strength(-200)).force("center", d3.forceCenter(width/2, height/2));
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "#cbd5e1");
    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle").attr("r", 8).attr("fill", d => d.g === 1 ? '#38bdf8' : '#0f172a');
    sim.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });
}

// Ensure login persists on refresh
window.onload = () => {
    const logo = localStorage.getItem('brandorb_logo');
    if(logo) window.applyLogo(logo);
    if(sessionStorage.getItem('isLoggedIn') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        window.fetchReports();
    }
};

window.showPage = (c) => { currentCategory = c.toUpperCase(); window.fetchReports(); };
window.goBackToList = () => { document.getElementById('page-view').style.display = 'none'; document.getElementById('page-list').style.display = 'block'; };
window.openModal = () => document.getElementById('report-modal').style.display = 'flex';
window.closeModal = () => document.getElementById('report-modal').style.display = 'none';
