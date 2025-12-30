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
    } else { document.getElementById('login-error').style.display = 'block'; }
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

window.applyLogo = function(src) {
    document.querySelectorAll('.global-logo-src, #login-display-logo').forEach(img => { img.src = src; img.style.display = 'block'; });
    if(document.getElementById('login-logo-placeholder')) document.getElementById('login-logo-placeholder').style.display = 'none';
};

// --- DATABASE & PUBLISHING ---
window.fetchReports = async function() {
    if(!window.DB_URL.includes("https")) return;
    try {
        const res = await fetch(window.DB_URL);
        const data = await res.json();
        const filtered = data.slice(1).filter(r => r[3].toUpperCase() === currentCategory);
        window.renderTable(filtered);
    } catch(e) { console.error("Sync Error:", e); }
};

window.saveNewReport = async function() {
    const data = {
        target: "Reports",
        data: [Date.now(), document.getElementById('rep-title').value, document.getElementById('rep-url').value, document.getElementById('rep-type').value, document.getElementById('client-select').value, new Date().toISOString()]
    };
    await fetch(window.DB_URL, { method: 'POST', body: JSON.stringify(data) });
    window.closeModal();
    window.fetchReports();
};

window.deleteReport = async function(id) {
    if(!confirm("Delete report?")) return;
    await fetch(window.DB_URL, { method: 'POST', body: JSON.stringify({ target: "Delete", id: id }) });
    window.fetchReports();
};

window.renderTable = function(rows) {
    document.getElementById('report-list-rows').innerHTML = rows.map(r => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4]}</td>
            <td>${new Date(r[5]).toLocaleDateString()}</td>
            <td>${r[3]}</td>
            <td style="text-align:right">
                <button class="btn-login" style="width:auto; padding:6px 12px;" onclick="window.viewReport('${r[2]}', '${r[1]}')">View</button>
                <button style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;" onclick="window.deleteReport('${r[0]}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
};

// --- VISUALIZATIONS ---
window.viewReport = async function(url, title) {
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    document.getElementById('viewing-title').innerText = title;
    const container = document.getElementById('map-element');
    container.innerHTML = ""; if (activeMap) { activeMap.remove(); activeMap = null; }

    const res = await fetch(url);
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
    const width = container.clientWidth, height = container.clientHeight;
    const svg = d3.select("#map-element").append("svg").attr("width", width).attr("height", height);
    let nodes = [], links = [], nodeSet = new Set();
    data.forEach(r => {
        if(!nodeSet.has(r[0])) { nodes.push({id: r[0]}); nodeSet.add(r[0]); }
        if(!nodeSet.has(r[1])) { nodes.push({id: r[1]}); nodeSet.add(r[1]); }
        links.push({source: r[0], target: r[1]});
    });
    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id)).force("charge", d3.forceManyBody().strength(-100)).force("center", d3.forceCenter(width/2, height/2));
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "#ddd");
    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle").attr("r", 6).attr("fill", "#0f172a");
    sim.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
    });
}

window.showPage = (cat) => { currentCategory = cat.toUpperCase(); window.fetchReports(); };
window.goBackToList = () => { document.getElementById('page-view').style.display = 'none'; document.getElementById('page-list').style.display = 'block'; };
window.openModal = () => document.getElementById('report-modal').style.display = 'flex';
window.closeModal = () => document.getElementById('report-modal').style.display = 'none';

window.onload = () => {
    const saved = localStorage.getItem('brandorb_logo');
    if(saved) window.applyLogo(saved);
    if(sessionStorage.getItem('isLoggedIn') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        window.fetchReports();
    }
};
