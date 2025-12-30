window.ACCESS_KEY = "Cyber$supe73r";
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; // Update this!

let currentCategory = 'MAP'; // Tracks if we are viewing Route Maps or Clusters

// --- AUTH & NAVIGATION ---
window.attemptLogin = function() {
    const input = document.getElementById('pass-input').value;
    if (input === window.ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        sessionStorage.setItem('loggedIn', 'true');
        fetchReports();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
};

window.showPage = function(category) {
    currentCategory = category.toUpperCase();
    
    // Update Sidebar UI
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Switch Views
    document.getElementById('page-list').style.display = 'block';
    document.getElementById('page-view').style.display = 'none';
    
    fetchReports(); // Refresh based on category
};

// --- CRUD OPERATIONS ---
window.fetchReports = async function() {
    if(!window.DB_URL.includes("https")) return;
    try {
        const res = await fetch(window.DB_URL);
        const data = await res.json();
        const rawRows = data.slice(1);
        
        // Filter based on the Active Menu Tab
        const filtered = rawRows.filter(r => r[3].toUpperCase() === currentCategory);
        renderTable(filtered);
    } catch (e) { console.error("Load failed", e); }
};

function renderTable(rows) {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4] || 'General'}</td>
            <td>${new Date(r[5]).toLocaleDateString()}</td>
            <td><span class="type-pill">${r[3]}</span></td>
            <td style="text-align:right">
                <button class="btn-view" onclick="viewReport('${r[2]}', '${r[1]}')">View</button>
                <button class="btn-delete" onclick="deleteReport('${r[0]}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.saveNewReport = async function() {
    const reportData = {
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

    await fetch(window.DB_URL, { method: 'POST', body: JSON.stringify(reportData) });
    closeModal();
    fetchReports();
};

window.deleteReport = async function(id) {
    if(!confirm("Delete this report permanently?")) return;
    await fetch(window.DB_URL, { method: 'POST', body: JSON.stringify({ target: "Delete", id: id }) });
    fetchReports();
};

// --- UI HELPERS ---
window.filterTable = function() {
    const val = document.getElementById('main-search').value.toLowerCase();
    const rows = document.querySelectorAll('#report-list-rows tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(val) ? '' : 'none';
    });
};

window.addNewClient = function() {
    const name = prompt("Enter Corporate Client Name:");
    if(name) {
        const sel = document.getElementById('client-select');
        sel.add(new Option(name, name));
        sel.value = name;
    }
};

window.openModal = () => document.getElementById('report-modal').style.display = 'flex';
window.closeModal = () => document.getElementById('report-modal').style.display = 'none';

window.handleLogoUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target.result;
            localStorage.setItem('brand-logo', src);
            document.querySelectorAll('.global-logo-src, #login-display-logo').forEach(img => {
                img.src = src; img.style.display = 'block';
            });
            document.getElementById('login-logo-placeholder').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.onload = function() {
    const savedLogo = localStorage.getItem('brand-logo');
    if(savedLogo) {
        document.querySelectorAll('.global-logo-src, #login-display-logo').forEach(img => {
            img.src = savedLogo; img.style.display = 'block';
        });
        if(document.getElementById('login-logo-placeholder')) document.getElementById('login-logo-placeholder').style.display = 'none';
    }
};
