window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 

let currentCategory = 'MAP';

// --- FIXED LOGIN & LOGO ---
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
    const targets = document.querySelectorAll('.global-logo-src, #login-display-logo');
    targets.forEach(img => {
        img.src = src;
        img.style.display = 'block';
    });
    const placeholder = document.getElementById('login-logo-placeholder');
    if(placeholder) placeholder.style.display = 'none';
}

// --- FIXED VIEW BUTTON LOGIC ---
window.viewReport = function(csvUrl, title) {
    console.log("Viewing Report:", title, "URL:", csvUrl);
    
    // 1. Hide list, show view
    document.getElementById('page-list').style.display = 'none';
    document.getElementById('page-view').style.display = 'block';
    
    // 2. Set title
    document.getElementById('viewing-title').innerText = title;

    // 3. Initialize Map or Cluster
    if (currentCategory === 'MAP') {
        initRouteMap(csvUrl);
    } else {
        initClusterGraph(csvUrl);
    }
};

// --- DATA FETCHING (Ensure View button gets the right URL) ---
window.renderTable = function(rows) {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4] || 'General'}</td>
            <td>${r[5] ? new Date(r[5]).toLocaleDateString() : 'N/A'}</td>
            <td><span class="type-pill">${r[3]}</span></td>
            <td style="text-align:right">
                <button class="btn-view" onclick="viewReport('${r[2]}', '${r[1]}')">View</button>
                <button class="btn-delete" onclick="deleteReport('${r[0]}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
};

// Add this to make sure your back button works properly
window.goBackToList = function() {
    document.getElementById('page-view').style.display = 'none';
    document.getElementById('page-list').style.display = 'block';
};
