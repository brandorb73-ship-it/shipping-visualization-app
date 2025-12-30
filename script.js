// --- GLOBAL CONFIG ---
window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 
let currentCategory = 'MAP';

// --- LOGIN & LOGO ---
window.attemptLogin = function() {
    const input = document.getElementById('pass-input').value;
    if (input === window.ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('isLoggedIn', 'true');
        window.fetchReports();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
};

window.handleLogoUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target.result;
            localStorage.setItem('brandorb_logo', src);
            window.applyLogo(src);
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.applyLogo = function(src) {
    document.querySelectorAll('.global-logo-src, #login-display-logo').forEach(img => {
        img.src = src;
        img.style.display = 'block';
    });
    const ph = document.getElementById('login-logo-placeholder');
    if(ph) ph.style.display = 'none';
};

// --- NAVIGATION & CATEGORIES ---
window.showPage = function(category) {
    currentCategory = category.toUpperCase();
    
    // Sidebar UI
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('nav-' + category).classList.add('active');
    
    // Page Visibility
    document.getElementById('page-list').style.display = 'block';
    document.getElementById('page-view').style.display = 'none';
    
    window.fetchReports();
};

window.goBackToList = function() {
    document.getElementById('page-view').style.display = 'none';
    document.getElementById('page-list').style.display = 'block';
};

// --- DATABASE OPERATIONS ---
window.fetchReports = async function() {
    if(!window.DB_URL.includes("https")) return;
    try {
        const res = await fetch(window.DB_URL);
        const data = await res.json();
        const rows = data.slice(1); // Remove header
        
        // Filter by category (Route Map vs Cluster)
        const filtered = rows.filter(r => r[3].toUpperCase() === currentCategory);
        window.renderTable(filtered);
    } catch(e) { console.error("Fetch failed", e); }
};

window.renderTable = function(rows) {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4] || 'General'}</td>
            <td>${r[5] ? new Date(r[5]).toLocaleDateString() : 'N/A'}</td>
            <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">${r[3]}</span></td>
            <td style="text-align:right">
                <button class="btn-view" onclick="window.viewReport('${r[2]}', '${r[1]}')">View</button>
                <button class="btn-delete" onclick="window.deleteReport('${r[0]}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
};

window.viewReport = function(csvUrl, title) {
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    document.getElementById('viewing-title').innerText = title;
    
    console.log("Loading report data from:", csvUrl);
    // Placeholder for map/cluster loading logic
};

window.deleteReport = async function(id) {
    if(!confirm("Delete this report?")) return;
    await fetch(window.DB_URL, { method: 'POST', body: JSON.stringify({ target: "Delete", id: id }) });
    window.fetchReports();
};

window.saveNewReport = async function() {
    const data = {
        target: "Reports",
        data: [
            Date.now(),
            document.getElementById('rep-title').value,
            document.getElementById('rep-url').value,
            document.getElementById('rep-type').value,
            document.getElementById('client-select').value,
            new Date().toISOString()
        ]
    };
    await fetch(window.DB_URL, { method: 'POST', body: JSON.stringify(data) });
    window.closeModal();
    window.fetchReports();
};

// --- UI HELPERS ---
window.openModal = () => document.getElementById('report-modal').style.display = 'flex';
window.closeModal = () => document.getElementById('report-modal').style.display = 'none';
window.filterTable = () => {
    const val = document.getElementById('main-search').value.toLowerCase();
    const rows = document.querySelectorAll('#report-list-rows tr');
    rows.forEach(r => r.style.display = r.innerText.toLowerCase().includes(val) ? '' : 'none');
};
window.addNewClient = () => {
    const n = prompt("Client Name:");
    if(n) {
        const s = document.getElementById('client-select');
        s.add(new Option(n, n));
        s.value = n;
    }
};

// --- ON LOAD ---
window.addEventListener('load', () => {
    const savedLogo = localStorage.getItem('brandorb_logo');
    if(savedLogo) window.applyLogo(savedLogo);

    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        window.fetchReports();
    }
});
