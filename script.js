// Make sure to replace this with your actual Deployment URL from Google Sheets
const DB_URL = "YOUR_APPS_SCRIPT_URL_HERE"; 
let reports = [];
let selectedType = 'map';
let mapInstance = null;

// LOGO UPLOAD LOGIC
function handleLogoUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const logoImg = document.getElementById('user-logo');
            const placeholder = document.getElementById('logo-placeholder');
            
            logoImg.src = e.target.result;
            logoImg.style.display = 'block';
            placeholder.style.display = 'none';
            
            // Save to browser memory so it stays on refresh
            localStorage.setItem('brandOrbLogo', e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// LOAD LOGO ON START
window.addEventListener('DOMContentLoaded', () => {
    const savedLogo = localStorage.getItem('brandOrbLogo');
    if (savedLogo) {
        const logoImg = document.getElementById('user-logo');
        const placeholder = document.getElementById('logo-placeholder');
        logoImg.src = savedLogo;
        logoImg.style.display = 'block';
        placeholder.style.display = 'none';
    }
    fetchReports();
});

// PAGE NAVIGATION
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById('page-' + pageId).style.display = 'block';
}

function selectType(type) {
    selectedType = type;
    document.getElementById('btn-map').classList.toggle('active', type === 'map');
    document.getElementById('btn-cluster').classList.toggle('active', type === 'cluster');
}

// REFRESH DATA FROM DRIVE
async function fetchReports() {
    try {
        const response = await fetch(DB_URL);
        const data = await response.json();
        reports = data.slice(1); // Exclude header
        renderTable();
    } catch (e) {
        console.error("Error fetching reports:", e);
    }
}

function renderTable() {
    const tbody = document.getElementById('report-list-rows');
    tbody.innerHTML = reports.map((r, index) => `
        <tr>
            <td><strong>${r[1]}</strong></td>
            <td>${r[4]}</td>
            <td>${r[5]}</td>
            <td><span class="type-tag">${r[3]}</span></td>
            <td>
                <button class="tbl-btn" onclick="previewReport(${index})">View</button>
            </td>
        </tr>
    `).join('');
}

// SAVE NEW REPORT
async function processAndSave() {
    const title = document.getElementById('report-name').value;
    const url = document.getElementById('sheet-url').value;
    const client = document.getElementById('client-select').value;
    
    if(!title || !url) return alert("Please fill in Title and URL");

    const payload = {
        target: "Reports",
        data: [Date.now(), title, url, selectedType, client, new Date().toLocaleDateString()]
    };

    try {
        await fetch(DB_URL, { method: 'POST', body: JSON.stringify(payload) });
        alert("Report Published!");
        location.reload(); // Refresh to show new data
    } catch (e) {
        alert("Error saving to Drive");
    }
}
