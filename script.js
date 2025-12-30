const DB_URL = "https://script.google.com/macros/s/AKfycbwCdQomilIT71s1c6qZWY21RsoVv5ZQG37zilaSEpJQpCoWyABhHpcWroyT1qf7QMgR/exec"; 
let reports = [], currentRawData = [], mapInstance = null, selectedType = 'map';

// 1. AUTH & LOGO
async function attemptLogin() {
    const password = document.getElementById('pass-input').value;
    const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
    if(res.ok) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('brandOrbAuth', 'true');
        fetchReports();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

window.onload = () => {
    if(sessionStorage.getItem('brandOrbAuth') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        fetchReports();
    }
    const savedLogo = localStorage.getItem('bo-logo');
    if(savedLogo) {
        const img = document.getElementById('user-logo');
        img.src = savedLogo; img.style.display = 'block';
        document.getElementById('logo-placeholder').style.display = 'none';
    }
};

function handleLogoUpload(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('user-logo').src = e.target.result;
            document.getElementById('user-logo').style.display = 'block';
            document.getElementById('logo-placeholder').style.display = 'none';
            localStorage.setItem('bo-logo', e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 2. DATA OPS
async function fetchReports() {
    try {
        const response = await fetch(DB_URL);
        const data = await response.json();
        reports = data.slice(1);
        renderTable();
    } catch (e) { console.error("Sync failed"); }
}

function renderTable() {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = reports.map((r, i) => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4]}</td>
            <td>${r[5]}</td>
            <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">${r[3].toUpperCase()}</span></td>
            <td style="text-align:right">
                <button class="btn-publish" style="padding:6px 12px; font-size:12px;" onclick="previewReport(${i})">View Report</button>
            </td>
        </tr>
    `).join('');
}

function previewReport(index) {
    const r = reports[index];
    showPage('view');
    document.getElementById('viewing-title').innerText = r[1];
    Papa.parse(r[2], {
        download: true, header: true,
        complete: (results) => {
            currentRawData = results.data;
            if(r[3] === 'map') renderRedAntsMap(results.data);
            else renderCluster(results.data);
        }
    });
}

// 3. VISUALIZATION
function renderRedAntsMap(data) {
    if(mapInstance) mapInstance.remove();
    document.getElementById('map-element').style.display = 'block';
    document.getElementById('cluster-element').style.display = 'none';
    mapInstance = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);

    const grouped = {};
    data.forEach(d => {
        const key = `${d.Exporter}-${d.Importer}`;
        if(!grouped[key]) grouped[key] = { info: d, items: [] };
        grouped[key].items.push(d);
    });

    Object.values(grouped).forEach(g => {
        const d = g.info;
        const s = [parseFloat(d['Origin latitude']), parseFloat(d['Origin longitude'])];
        const e = [parseFloat(d['Destination latitude']), parseFloat(d['Destination longitude'])];
        if(!s[0] || !e[0]) return;

        L.circleMarker(s, {radius: 5, color: 'red'}).addTo(mapInstance).bindPopup(`<b>Origin:</b> ${d['Origin Country Name']}`);
        L.circleMarker(e, {radius: 5, color: 'black'}).addTo(mapInstance).bindPopup(`<b>Destination:</b> ${d['Destination Country Name']}`);

        const pathPoints = [s, [(s[0]+e[0])/2 + 4, (s[1]+e[1])/2], e];
        const ant = L.polyline.antPath(pathPoints, { color: d.COLOR || 'red', weight: g.items.length > 1 ? 6 : 3, delay: 2000 }).addTo(mapInstance);
        
        L.polylineDecorator(pathPoints, {
            patterns: [{ offset: '55%', repeat: 0, symbol: L.Symbol.arrowHead({ pixelSize: 12, pathOptions: {color: d.COLOR || 'red', fillOpacity: 1} }) }]
        }).addTo(mapInstance);

        const html = `
            <div class="shipment-popup">
                <div class="popup-head"><i class="fas fa-ship"></i> Shipment Details</div>
                <div class="popup-body">
                    <p><b>Exp:</b> ${d.Exporter}<br><b>Imp:</b> ${d.Importer}</p>
                    <div style="max-height:120px; overflow-y:auto;">
                        ${g.items.map(i => `<div class="shipment-item">📦 ${i.Product || 'Cargo'} | ${i.Value || '-'} | ${i.Date || '-'}</div>`).join('')}
                    </div>
                </div>
            </div>`;
        ant.bindPopup(html);
    });
}

function renderCluster(data) {
    document.getElementById('map-element').style.display = 'none';
    const container = document.getElementById('cluster-element');
    container.style.display = 'block'; container.innerHTML = "";
    const width = container.clientWidth, height = container.clientHeight || 600;
    const svg = d3.select("#cluster-element").append("svg").attr("width", width).attr("height", height);
    
    let nodes = [], links = [];
    data.forEach(d => {
        if(!nodes.find(n => n.id === d.Exporter)) nodes.push({id: d.Exporter, type: 'Exp'});
        if(!nodes.find(n => n.id === d.Importer)) nodes.push({id: d.Importer, type: 'Imp'});
        links.push({source: d.Exporter, target: d.Importer});
    });

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(100)).force("charge", d3.forceManyBody().strength(-300)).force("center", d3.forceCenter(width/2, height/2));
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "red").attr("stroke-width", 1.5);
    const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle").attr("r", 10).attr("fill", d => d.type === 'Exp' ? '#0f172a' : '#38bdf8').call(d3.drag().on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }).on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; }).on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
    sim.on("tick", () => { link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y); node.attr("cx", d => d.x).attr("cy", d => d.y); });
}

// 4. UI NAVIGATION
function showPage(p) {
    document.querySelectorAll('.content-page').forEach(page => page.style.display = 'none');
    document.getElementById('page-' + p).style.display = 'block';
}

function selectType(t) {
    selectedType = t;
    document.getElementById('pick-map').classList.toggle('active', t === 'map');
    document.getElementById('pick-cluster').classList.toggle('active', t === 'cluster');
}

async function processAndSave() {
    const title = document.getElementById('report-name').value;
    const url = document.getElementById('sheet-url').value;
    if(!title || !url) return alert("Fill all fields");
    const payload = { target: "Reports", data: [Date.now(), title, url, selectedType, "All Clients", new Date().toLocaleDateString()] };
    await fetch(DB_URL, { method: 'POST', body: JSON.stringify(payload) });
    location.reload();
}

function filterTable() {
    const val = document.getElementById('main-search').value.toLowerCase();
    document.querySelectorAll('#report-list-rows tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(val) ? "" : "none";
    });
}
