const DB_URL = "https://script.google.com/macros/s/AKfycbwCdQomilIT71s1c6qZWY21RsoVv5ZQG37zilaSEpJQpCoWyABhHpcWroyT1qf7QMgR/exec"; 
let reports = [];
let selectedType = 'map';
let mapInstance = null;

// Initialize
window.onload = () => {
    loadSavedLogo();
    fetchReports();
};

function showPage(pageId) {
    document.querySelectorAll('.content-page').forEach(p => p.style.display = 'none');
    document.getElementById('page-' + pageId).style.display = 'block';
    // Clear map if moving away from view
    if(pageId !== 'view' && mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }
}

// LOGO LOGIC
function handleLogoUpload(input) {
    if (input.files && input.files[0]) {
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

function loadSavedLogo() {
    const saved = localStorage.getItem('bo-logo');
    if(saved) {
        document.getElementById('user-logo').src = saved;
        document.getElementById('user-logo').style.display = 'block';
        document.getElementById('logo-placeholder').style.display = 'none';
    }
}

// CLIENT LOGIC
function addNewClient() {
    const name = prompt("Enter Client Name:");
    if(name) {
        const sel = document.getElementById('client-select');
        const opt = document.createElement('option');
        opt.value = name; opt.text = name;
        sel.add(opt);
    }
}

// DATA SYNC
async function fetchReports() {
    try {
        const response = await fetch(DB_URL);
        const data = await response.json();
        reports = data.slice(1);
        renderTable();
    } catch (e) { console.error("Database offline"); }
}

function renderTable() {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = reports.map((r, i) => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4]}</td>
            <td>${r[5]}</td>
            <td><span class="badge">${r[3]}</span></td>
            <td style="text-align:right">
                <button class="btn-primary" style="padding: 6px 12px; font-size:12px" onclick="previewReport(${i})">View</button>
                <button class="btn-delete" onclick="deleteReport(${i})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// PREVIEW LOGIC
function previewReport(index) {
    const r = reports[index];
    showPage('view');
    document.getElementById('viewing-title').innerText = r[1];

    Papa.parse(r[2], {
        download: true,
        header: true,
        complete: (results) => {
            if(r[3] === 'map') renderCurvedMap(results.data);
            else renderCluster(results.data);
        }
    });
}

function renderCurvedMap(data) {
    document.getElementById('map-element').style.display = 'block';
    document.getElementById('cluster-element').style.display = 'none';

    mapInstance = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);

    data.forEach(d => {
        const s = [parseFloat(d['Origin latitude']), parseFloat(d['Origin longitude'])];
        const e = [parseFloat(d['Destination latitude']), parseFloat(d['Destination longitude'])];
        
        if(!s[0] || !e[0]) return;

        // Draw Markers
        L.circleMarker(s, {radius: 5, color: 'green'}).addTo(mapInstance).bindPopup(`Exporter: ${d.Exporter}`);
        L.circleMarker(e, {radius: 5, color: 'red'}).addTo(mapInstance).bindPopup(`Importer: ${d.Importer}`);

        // Curved Path calculation
        const latlngs = [s, e];
        const curve = L.polyline.antPath([s, [ (s[0]+e[0])/2 + 5, (s[1]+e[1])/2 ], e], {
            "paused": false, "delay": 2500, "dashArray": [10, 20], "weight": 3, "color": "#0f172a", "pulseColor": "#38bdf8"
        }).addTo(mapInstance);
    });
}

async function deleteReport(index) {
    if(confirm("Are you sure you want to delete this report?")) {
        // In this version, we remove it locally. For Drive, you'd need a 'DELETE' post.
        reports.splice(index, 1);
        renderTable();
    }
}
