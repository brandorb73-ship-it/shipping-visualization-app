window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 

let currentCategory = 'MAP';
let activeMap = null;

// --- LOGIN ---
window.attemptLogin = function() {
    const input = document.getElementById('pass-input').value;
    if (input === window.ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('isLoggedIn', 'true');
        window.fetchReports();
    }
};

// --- DATA PUBLISHING (VIEW LOGIC) ---
window.viewReport = async function(csvUrl, title) {
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    document.getElementById('viewing-title').innerText = title;

    // Clear previous map instance if it exists
    if (activeMap) { activeMap.remove(); activeMap = null; }

    try {
        // 1. Fetch the actual shipment data
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        
        // 2. Simple CSV Parse (Assumes headers: Exporter, Importer, Origin Lat, Origin Long, Dest Lat, Dest Long)
        const rows = csvText.split('\n').slice(1).map(line => line.split(','));

        if (currentCategory === 'MAP') {
            initRouteMap(rows);
        } else {
            initClusterGraph(rows);
        }
    } catch (e) {
        console.error("Failed to fetch shipment data:", e);
        alert("Error loading CSV. Check if the link is public.");
    }
};

function initRouteMap(data) {
    activeMap = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(activeMap);

    data.forEach(row => {
        const [exporter, importer, oLat, oLng, dLat, dLng] = row;
        if (!oLat || !dLat) return;

        const start = [parseFloat(oLat), parseFloat(oLng)];
        const end = [parseFloat(dLat), parseFloat(dLng)];

        // Draw the line
        L.polyline([start, end], {color: '#38bdf8', weight: 2, opacity: 0.6}).addTo(activeMap);
        
        // Add Marker for Destination
        L.circleMarker(end, {radius: 4, color: '#0f172a'}).addTo(activeMap)
            .bindPopup(`<b>To:</b> ${importer}<br><b>From:</b> ${exporter}`);
    });
}

// --- STANDARD REFRESH ---
window.fetchReports = async function() {
    if(!window.DB_URL.includes("https")) return;
    const res = await fetch(window.DB_URL);
    const data = await res.json();
    const rows = data.slice(1);
    const filtered = rows.filter(r => r[3].toUpperCase() === currentCategory);
    
    document.getElementById('report-list-rows').innerHTML = filtered.map(r => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4] || 'General'}</td>
            <td>${r[5] || ''}</td>
            <td>${r[3]}</td>
            <td style="text-align:right">
                <button class="btn-view" onclick="window.viewReport('${r[2]}', '${r[1]}')">View</button>
            </td>
        </tr>
    `).join('');
};

window.goBackToList = () => {
    document.getElementById('page-view').style.display = 'none';
    document.getElementById('page-list').style.display = 'block';
};
