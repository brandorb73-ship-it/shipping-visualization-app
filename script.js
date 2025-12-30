const DB_URL = "https://script.google.com/macros/s/AKfycbyRBE6_yUjzOPfLjis4OyK6XVtuWIBOmV9khY1cJ6_iQTCldqQbec7jtNmpiAL8-MI9/exec"; 
let reports = [], currentRawData = [], mapInstance = null, selectedType = 'map';

// 1. AUTH & LOGO
async function attemptLogin() {
    const password = document.getElementById('pass-input').value;
    const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
    if(res.ok) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('auth', 'true');
        fetchReports();
    } else { document.getElementById('login-error').style.display = 'block'; }
}

function handleLogoUpload(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            localStorage.setItem('bo-logo', e.target.result);
            updateGlobalLogos(e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function updateGlobalLogos(src) {
    document.querySelectorAll('.global-logo-src').forEach(img => { img.src = src; img.style.display = 'block'; });
    const ph = document.getElementById('login-logo-placeholder');
    if(ph) ph.style.display = 'none';
    const loginImg = document.getElementById('login-display-logo');
    if(loginImg) { loginImg.src = src; loginImg.style.display = 'block'; }
}

window.onload = () => {
    const saved = localStorage.getItem('bo-logo');
    if(saved) updateGlobalLogos(saved);
    if(sessionStorage.getItem('auth') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        fetchReports();
    }
};

// 2. DATA OPS
async function fetchReports() {
    const res = await fetch(DB_URL);
    const data = await res.json();
    reports = data.slice(1);
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = reports.map((r, i) => `
        <tr>
            <td><strong>${r[1]}</strong><div style="font-size:10px;color:#94a3b8">Ref: ${r[0]}</div></td>
            <td>${r[4]}</td>
            <td>${r[5]}</td>
            <td><span style="font-size:11px;font-weight:700;padding:4px 8px;background:#f1f5f9;border-radius:4px">${r[3].toUpperCase()}</span></td>
            <td style="text-align:right">
                <button class="btn-save" style="padding:6px 12px; font-size:12px;" onclick="previewReport(${i})">View</button>
                <button class="btn-delete" onclick="deleteReport('${r[0]}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function processAndSave() {
    const title = document.getElementById('report-name').value;
    const url = document.getElementById('sheet-url').value;
    const client = document.getElementById('client-select').value;
    const showLogo = document.getElementById('include-logo').checked;
    if(!title || !url) return alert("Please fill all fields");

    const payload = { target: "Reports", data: [Date.now(), title, url, selectedType, client, new Date().toLocaleDateString(), showLogo] };
    await fetch(DB_URL, { method: 'POST', body: JSON.stringify(payload) });
    location.reload();
}

async function deleteReport(id) {
    if(!confirm("Delete this report?")) return;
    await fetch(DB_URL, { method: 'POST', body: JSON.stringify({ target: "Delete", id: id }) });
    fetchReports();
}

// 3. VISUALIZATION (Route Map)
function renderRedAntsMap(data) {
    if(mapInstance) mapInstance.remove();
    document.getElementById('map-element').style.display = 'block';
    document.getElementById('cluster-element').style.display = 'none';
    
    mapInstance = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);

    const lanes = {};
    data.forEach(d => {
        const key = `${d.Exporter}-${d.Importer}`;
        if (!lanes[key]) lanes[key] = { info: d, items: [] };
        lanes[key].items.push(d);
    });

    Object.values(lanes).forEach(lane => {
        const d = lane.info;
        const s = [parseFloat(d['Origin latitude']), parseFloat(d['Origin longitude'])];
        const e = [parseFloat(d['Destination latitude']), parseFloat(d['Destination longitude'])];
        if (isNaN(s[0]) || isNaN(e[0])) return;

        const pathPoints = [s, [(s[0] + e[0]) / 2 + 4, (s[1] + e[1]) / 2], e];
        const color = d.COLOR || 'red';
        
        // Ant Path
        const ant = L.polyline.antPath(pathPoints, { 
            color: color, weight: lane.items.length > 1 ? 7 : 3, delay: 2000 
        }).addTo(mapInstance);

        // Arrows
        L.polylineDecorator(pathPoints, {
            patterns: [{ offset: '55%', repeat: 0, symbol: L.Symbol.arrowHead({pixelSize: 12, pathOptions: {color: color, fillOpacity: 1}}) }]
        }).addTo(mapInstance);

        const html = `
            <div class="shipment-popup">
                <div class="popup-head"><i class="fas fa-ship"></i> Shipment Details</div>
                <div class="popup-body">
                    <b>Exporter:</b> ${d.Exporter}<br><b>Importer:</b> ${d.Importer}<hr>
                    <div style="max-height:150px; overflow-y:auto;">
                        ${lane.items.map(i => `
                            <div class="shipment-item">
                                <b>${i.Product || 'Cargo'}</b><br>
                                <small>${i['Origin Port']} → ${i['Destination Port']}<br>
                                Val: ${i.Value} | Date: ${i.Date}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
        ant.bindPopup(html);
        L.circleMarker(s, {radius: 4, color: 'red'}).addTo(mapInstance).bindPopup(`Origin: ${d['Origin Country Name']}`);
        L.circleMarker(e, {radius: 4, color: 'black'}).addTo(mapInstance).bindPopup(`Destination: ${d['Destination Country Name']}`);
    });
}

// 4. CLUSTER GRAPH (D3.js)
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
        links.push({source: d.Exporter, target: d.Importer, data: d});
    });

    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(150)).force("charge", d3.forceManyBody().strength(-300)).force("center", d3.forceCenter(width/2, height/2));
    const link = svg.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "#e2e8f0").attr("stroke-width", 2);
    const node = svg.append("g").selectAll("g").data(nodes).enter().append("g").call(d3.drag().on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }).on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; }).on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append("circle").attr("r", 12).attr("fill", d => d.type === 'Exp' ? '#0f172a' : '#38bdf8');
    node.append("text").text(d => d.id).attr("font-size", "10px").attr("dx", 15).attr("dy", 4);
    node.append("title").text(d => `${d.type}: ${d.id}`);

    sim.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
}

// 5. UI FLOW
function previewReport(idx) {
    const r = reports[idx];
    showPage('view');
    document.getElementById('viewing-title').innerText = r[1];
    document.getElementById('viz-logo').style.display = (r[6] == "true" || r[6] == true) ? 'block' : 'none';
    
    Papa.parse(r[2], {
        download: true, header: true, skipEmptyLines: true,
        complete: (res) => {
            currentRawData = res.data;
            if(r[3] === 'map') {
                updateFilters(res.data);
                renderRedAntsMap(res.data);
            } else { renderCluster(res.data); }
        }
    });
}

function updateFilters(data) {
    const colors = [...new Set(data.map(d => d.COLOR).filter(Boolean))];
    const origins = [...new Set(data.map(d => d['Origin Country Name']).filter(Boolean))];
    const dests = [...new Set(data.map(d => d['Destination Country Name']).filter(Boolean))];
    document.getElementById('color-filter').innerHTML = '<option value="All">Colors</option>' + colors.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('origin-filter').innerHTML = '<option value="All">Origins</option>' + origins.map(o => `<option value="${o}">${o}</option>`).join('');
    document.getElementById('dest-filter').innerHTML = '<option value="All">Dests</option>' + dests.map(d => `<option value="${d}">${d}</option>`).join('');
}

function applyMapFilters() {
    const c = document.getElementById('color-filter').value;
    const o = document.getElementById('origin-filter').value;
    const d = document.getElementById('dest-filter').value;
    const filtered = currentRawData.filter(x => (c === 'All' || x.COLOR === c) && (o === 'All' || x['Origin Country Name'] === o) && (d === 'All' || x['Destination Country Name'] === d));
    renderRedAntsMap(filtered);
}

function showPage(p) { 
    document.querySelectorAll('.content-page').forEach(pg => pg.style.display = 'none');
    document.getElementById('page-' + p).style.display = 'block'; 
}

function selectType(t) { 
    selectedType = t;
    document.getElementById('pick-map').classList.toggle('active', t === 'map');
    document.getElementById('pick-cluster').classList.toggle('active', t === 'cluster');
}

function exportToPDF() { window.print(); }
function filterTable() {
    const v = document.getElementById('main-search').value.toLowerCase();
    document.querySelectorAll('#report-list-rows tr').forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(v) ? '' : 'none');
}
function addNewClient() {
    const n = prompt("Client Name:");
    if(n) { const s = document.getElementById('client-select'); s.add(new Option(n, n)); s.value = n; }
}
