/* ==========================================
   CONFIG & GLOBAL VARIABLES
   ========================================== */
const DB_URL = "https://script.google.com/macros/s/AKfycbyRBE6_yUjzOPfLjis4OyK6XVtuWIBOmV9khY1cJ6_iQTCldqQbec7jtNmpiAL8-MI9/exec"; 
const ACCESS_KEY = "YourSecretKey123"; // Change this to your preferred password

let reports = [];
let currentRawData = [];
let mapInstance = null;
let selectedType = 'map';

/* ==========================================
   AUTH & LOGO LOGIC
   ========================================== */
async function attemptLogin() {
    const input = document.getElementById('pass-input').value;
    const errorMsg = document.getElementById('login-error');
    
    if (input === ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('auth', 'true');
        errorMsg.style.display = 'none';
        fetchReports();
    } else {
        errorMsg.style.display = 'block';
        document.getElementById('pass-input').value = "";
    }
}

function handleLogoUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            localStorage.setItem('bo-logo', base64Image);
            updateGlobalLogos(base64Image);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function updateGlobalLogos(src) {
    document.querySelectorAll('.global-logo-src').forEach(img => {
        img.src = src;
        img.style.display = 'block';
    });
    
    const loginImg = document.getElementById('login-display-logo');
    const placeholder = document.getElementById('login-logo-placeholder');
    if (loginImg) {
        loginImg.src = src;
        loginImg.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
}

// Auto-run on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedLogo = localStorage.getItem('bo-logo');
    if (savedLogo) updateGlobalLogos(savedLogo);
    
    if (sessionStorage.getItem('auth') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        fetchReports();
    }
});

/* ==========================================
   DATA OPERATIONS (Sheets & Table)
   ========================================== */
async function fetchReports() {
    try {
        const res = await fetch(DB_URL);
        const data = await res.json();
        reports = data.slice(1); // Remove header row
        renderTable();
    } catch (err) {
        console.error("Failed to fetch reports:", err);
    }
}

function renderTable() {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = reports.map((r, i) => `
        <tr>
            <td><strong>${r[1]}</strong><div style="font-size:10px;color:#94a3b8">Ref: ${r[0]}</div></td>
            <td>${r[4] || 'General'}</td>
            <td>${r[5]}</td>
            <td><span style="font-size:11px;font-weight:700;padding:4px 8px;background:#f1f5f9;border-radius:4px">${r[3].toUpperCase()}</span></td>
            <td style="text-align:right">
                <button class="btn-save" style="padding:6px 12px; font-size:12px; background:#0f172a; color:white; border-radius:4px;" onclick="previewReport(${i})">View</button>
                <button class="btn-delete" style="color:#ef4444; border:none; background:none; cursor:pointer;" onclick="deleteReport('${r[0]}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function processAndSave() {
    const title = document.getElementById('report-name').value;
    const url = document.getElementById('sheet-url').value;
    const client = document.getElementById('client-select').value;
    const showLogo = document.getElementById('include-logo').checked;

    if (!title || !url) return alert("Please fill all fields");

    const payload = { 
        target: "Reports", 
        data: [Date.now(), title, url, selectedType, client, new Date().toLocaleDateString(), showLogo] 
    };

    await fetch(DB_URL, { method: 'POST', body: JSON.stringify(payload) });
    showPage('list');
    fetchReports();
}

async function deleteReport(id) {
    if (!confirm("Are you sure you want to delete this report?")) return;
    await fetch(DB_URL, { method: 'POST', body: JSON.stringify({ target: "Delete", id: id }) });
    fetchReports();
}

/* ==========================================
   VISUALIZATION: ROUTE MAP
   ========================================== */
function renderRedAntsMap(data) {
    if (mapInstance) mapInstance.remove();
    document.getElementById('map-element').style.display = 'block';
    document.getElementById('cluster-element').style.display = 'none';
    
    mapInstance = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);

    // Lane Grouping Logic
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
        const color = d.COLOR || '#38bdf8';
        const isGrouped = lane.items.length > 1;

        // 1. Draw Ant Path
        const ant = L.polyline.antPath(pathPoints, { 
            color: color, 
            weight: isGrouped ? 7 : 3, 
            delay: 2000 
        }).addTo(mapInstance);

        // 2. Draw Directional Arrows
        L.polylineDecorator(pathPoints, {
            patterns: [{ 
                offset: '55%', 
                repeat: 0, 
                symbol: L.Symbol.arrowHead({
                    pixelSize: 12, 
                    pathOptions: { color: color, fillOpacity: 1, stroke: false }
                }) 
            }]
        }).addTo(mapInstance);

        // 3. Create Shipment Details Popup
        const popupHtml = `
            <div class="shipment-popup">
                <div class="popup-head"><i class="fas fa-ship"></i> Trade Lane Details</div>
                <div class="popup-body">
                    <strong>Exporter:</strong> ${d.Exporter}<br>
                    <strong>Importer:</strong> ${d.Importer}<hr>
                    <div style="max-height:150px; overflow-y:auto;">
                        ${lane.items.map(i => `
                            <div class="shipment-item">
                                <strong>${i.Product || 'Cargo'}</strong><br>
                                <small>${i['Origin Port']} → ${i['Destination Port']}<br>
                                Qty: ${i.Quantity || 'N/A'} | Date: ${i.Date}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
        ant.bindPopup(popupHtml, { maxWidth: 300 });

        L.circleMarker(s, { radius: 4, color: 'red' }).addTo(mapInstance);
        L.circleMarker(e, { radius: 4, color: 'black' }).addTo(mapInstance);
    });
}

/* ==========================================
   VISUALIZATION: CLUSTER GRAPH (D3)
   ========================================== */
function renderCluster(data) {
    document.getElementById('map-element').style.display = 'none';
    const container = document.getElementById('cluster-element');
    container.style.display = 'block';
    container.innerHTML = "";
    
    const width = container.clientWidth;
    const height = container.clientHeight || 600;
    const svg = d3.select("#cluster-element").append("svg").attr("width", width).attr("height", height);
    
    let nodes = [], links = [];
    data.forEach(d => {
        if (!nodes.find(n => n.id === d.Exporter)) nodes.push({ id: d.Exporter, type: 'Exp' });
        if (!nodes.find(n => n.id === d.Importer)) nodes.push({ id: d.Importer, type: 'Imp' });
        links.push({ source: d.Exporter, target: d.Importer });
    });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", "#e2e8f0").attr("stroke-width", 2);

    const node = svg.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag()
            .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
            .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append("circle").attr("r", 12).attr("fill", d => d.type === 'Exp' ? '#0f172a' : '#38bdf8');
    node.append("text").text(d => d.id).attr("font-size", "10px").attr("dx", 15).attr("dy", 4);

    sim.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
}

/* ==========================================
   UI CONTROLS & NAVIGATION
   ========================================== */
function previewReport(idx) {
    const r = reports[idx];
    showPage('view');
    document.getElementById('viewing-title').innerText = r[1];
    document.getElementById('viz-logo').style.display = (r[6] == "true" || r[6] == true) ? 'block' : 'none';
    
    Papa.parse(r[2], {
        download: true, header: true, skipEmptyLines: true,
        complete: (res) => {
            currentRawData = res.data;
            if (r[3] === 'map') {
                updateFilters(res.data);
                renderRedAntsMap(res.data);
            } else { 
                renderCluster(res.data); 
            }
        }
    });
}

function updateFilters(data) {
    const colors = [...new Set(data.map(d => d.COLOR).filter(Boolean))];
    const countries = [...new Set(data.map(d => d['Origin Country Name']).filter(Boolean))];
    
    document.getElementById('color-filter').innerHTML = '<option value="All">All Colors</option>' + 
        colors.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('origin-filter').innerHTML = '<option value="All">All Countries</option>' + 
        countries.map(o => `<option value="${o}">${o}</option>`).join('');
}

function applyMapFilters() {
    const c = document.getElementById('color-filter').value;
    const o = document.getElementById('origin-filter').value;
    const filtered = currentRawData.filter(x => 
        (c === 'All' || x.COLOR === c) && 
        (o === 'All' || x['Origin Country Name'] === o)
    );
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

function exportToPDF() { 
    window.print(); 
}

function filterTable() {
    const v = document.getElementById('main-search').value.toLowerCase();
    document.querySelectorAll('#report-list-rows tr').forEach(tr => {
        tr.style.display = tr.innerText.toLowerCase().includes(v) ? '' : 'none';
    });
}

function addNewClient() {
    const n = prompt("Enter New Client Name:");
    if (n) {
        const s = document.getElementById('client-select');
        s.add(new Option(n, n));
        s.value = n;
    }
}
