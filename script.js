/* ==========================================
   CONFIG
   ========================================== */
window.ACCESS_KEY = "Cyber$supe73r"; 
window.DB_URL = "https://script.google.com/macros/s/AKfycbyRBE6_yUjzOPfLjis4OyK6XVtuWIBOmV9khY1cJ6_iQTCldqQbec7jtNmpiAL8-MI9/exec"; 

/* ==========================================
   AUTH & LOGO
   ========================================== */
window.handleLogoUpload = function(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var imgData = e.target.result;
            localStorage.setItem('bo-logo', imgData);
            updateLogos(imgData);
        };
        reader.readAsDataURL(input.files[0]);
    }
};

function updateLogos(src) {
    document.querySelectorAll('.global-logo-src').forEach(img => {
        img.src = src;
        img.style.display = 'block';
    });
    const preview = document.getElementById('login-display-logo');
    if(preview) { preview.src = src; preview.style.display = 'block'; }
    const ph = document.getElementById('login-logo-placeholder');
    if(ph) ph.style.display = 'none';
}

window.attemptLogin = function() {
    const pass = document.getElementById('pass-input').value;
    if(pass === window.ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('auth', 'true');
        // Trigger data fetch if URL exists
        if(window.DB_URL.includes("https")) fetchReports();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
};

/* ==========================================
   ROUTE MAP (ARROWS & POPUPS)
   ========================================== */
function renderRouteMap(data) {
    const map = L.map('map-element').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    // Grouping shipments for the same lane
    const lanes = {};
    data.forEach(d => {
        const key = `${d.Exporter}-${d.Importer}`;
        if (!lanes[key]) lanes[key] = { info: d, items: [] };
        lanes[key].items.push(d);
    });

    Object.values(lanes).forEach(lane => {
        const d = lane.info;
        const start = [parseFloat(d['Origin latitude']), parseFloat(d['Origin longitude'])];
        const end = [parseFloat(d['Destination latitude']), parseFloat(d['Destination longitude'])];
        
        if (isNaN(start[0]) || isNaN(end[0])) return;

        // Create the curved path points
        const pathPoints = [start, [(start[0] + end[0]) / 2 + 5, (start[1] + end[1]) / 2], end];
        
        // 1. Add Animated Path
        const path = L.polyline.antPath(pathPoints, {
            color: d.COLOR || 'red',
            weight: lane.items.length > 1 ? 6 : 3,
            delay: 2000
        }).addTo(map);

        // 2. Add Directional Arrow
        L.polylineDecorator(pathPoints, {
            patterns: [{
                offset: '55%',
                symbol: L.Symbol.arrowHead({
                    pixelSize: 12,
                    pathOptions: { color: d.COLOR || 'red', fillOpacity: 1, stroke: false }
                })
            }]
        }).addTo(map);

        // 3. Add Shipment Popup (Scrollable)
        const popupContent = `
            <div class="shipment-popup">
                <div class="popup-head">TRADE LANE: ${lane.items.length} SHIPMENT(S)</div>
                <div class="popup-body">
                    <strong>Exporter:</strong> ${d.Exporter}<br>
                    <strong>Importer:</strong> ${d.Importer}
                    <hr>
                    <div style="max-height:120px; overflow-y:auto;">
                        ${lane.items.map(i => `
                            <div class="shipment-item">
                                <b>${i.Product}</b><br>
                                <small>Qty: ${i.Quantity} | Date: ${i.Date}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
        path.bindPopup(popupContent);
    });
}

/* ==========================================
   INITIALIZATION
   ========================================== */
window.onload = function() {
    const savedLogo = localStorage.getItem('bo-logo');
    if(savedLogo) updateLogos(savedLogo);

    if(sessionStorage.getItem('auth') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        if(window.DB_URL.includes("https")) fetchReports();
    }
};

window.showPage = function(p) {
    document.querySelectorAll('.content-page').forEach(page => page.style.display = 'none');
    document.getElementById('page-' + p).style.display = 'block';
};
