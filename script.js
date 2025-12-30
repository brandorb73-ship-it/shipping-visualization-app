window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 

let currentCategory = 'MAP';

// --- LOGIN & LOGO SCALING ---
window.handleLogoUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target.result;
            localStorage.setItem('brand-logo', src);
            applyLogo(src);
        };
        reader.readAsDataURL(input.files[0]);
    }
};

function applyLogo(src) {
    document.querySelectorAll('.global-logo-src, #login-display-logo').forEach(img => {
        img.src = src;
        img.style.display = 'block';
    });
    if(document.getElementById('login-logo-placeholder')) 
        document.getElementById('login-logo-placeholder').style.display = 'none';
}

// --- TABLE RENDERING & VIEW BUTTON FIX ---
window.renderTable = function(rows) {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4] || 'General'}</td>
            <td>${r[5] ? new Date(r[5]).toLocaleDateString() : 'N/A'}</td>
            <td><span class="type-pill" style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:11px;">${r[3]}</span></td>
            <td style="text-align:right">
                <button class="btn-view" onclick="viewReport('${r[2]}', '${r[1]}')">View</button>
                <button class="btn-delete" onclick="deleteReport('${r[0]}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
};

// --- NAVIGATION ---
window.viewReport = function(csvUrl, title) {
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    document.getElementById('viewing-title').innerText = title;
    
    // Load the visualization
    if(currentCategory === 'MAP') {
        initRouteMap(csvUrl);
    } else {
        initClusterGraph(csvUrl);
    }
};

window.goBackToList = function() {
    document.getElementById('page-view').style.display = 'none';
    document.getElementById('page-list').style.display = 'block';
};

// --- INITIAL LOAD ---
window.onload = function() {
    const savedLogo = localStorage.getItem('brand-logo');
    if(savedLogo) applyLogo(savedLogo);
    
    if(sessionStorage.getItem('loggedIn') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        fetchReports();
    }
};
