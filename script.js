window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec";

// AUTH LOGIC
window.attemptLogin = function() {
    const input = document.getElementById('pass-input').value;
    if (input === window.ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('isLoggedIn', 'true');
        fetchReports();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
};

window.handleLogoUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            localStorage.setItem('brandorb_logo', data);
            updateAllLogos(data);
        };
        reader.readAsDataURL(input.files[0]);
    }
};

function updateAllLogos(src) {
    document.querySelectorAll('.global-logo-src').forEach(img => {
        img.src = src;
        img.style.display = 'block';
    });
    const loginImg = document.getElementById('login-display-logo');
    if(loginImg) { loginImg.src = src; loginImg.style.display = 'block'; }
    const ph = document.getElementById('login-logo-placeholder');
    if(ph) ph.style.display = 'none';
}

// UI LOGIC
window.addNewClient = function() {
    const n = prompt("Enter Client Name:");
    if(n) {
        const s = document.getElementById('client-select');
        s.add(new Option(n, n));
        s.value = n;
    }
};

window.showPage = function(p) {
    document.querySelectorAll('.content-page').forEach(page => page.style.display = 'none');
    document.getElementById('page-' + p).style.display = 'block';
};

// DATA FETCHING
async function fetchReports() {
    if(!window.DB_URL.includes("https")) return;
    try {
        const res = await fetch(window.DB_URL);
        const data = await res.json();
        const reports = data.slice(1);
        const tbody = document.getElementById('report-list-rows');
        tbody.innerHTML = reports.map((r, i) => `
            <tr>
                <td><strong>${r[1]}</strong></td>
                <td>${r[4] || 'General'}</td>
                <td>${r[5] || 'N/A'}</td>
                <td>${r[3].toUpperCase()}</td>
                <td style="text-align:right">
                    <button class="btn-publish" onclick="viewReport('${r[2]}', '${r[1]}')">View</button>
                </td>
            </tr>
        `).join('');
    } catch(e) { console.error("Fetch failed", e); }
}

window.viewReport = function(csvUrl, title) {
    window.showPage('view');
    document.getElementById('viewing-title').innerText = title;
    // Map initialization logic here...
    console.log("Loading report:", csvUrl);
};

window.onload = function() {
    const logo = localStorage.getItem('brandorb_logo');
    if(logo) updateAllLogos(logo);
    if(sessionStorage.getItem('isLoggedIn') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        fetchReports();
    }
};
