window.ui = {
    ACCESS_KEY: "Cyber$supe73r",
    currentTab: "MAP",

    login: function() {
        const pass = document.getElementById('pass-input').value;
        if(pass === this.ACCESS_KEY) {
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('app-container').style.visibility = 'visible';
            this.loadData();
        } else { alert("Wrong Key"); }
    },

    handleLogo: function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const src = e.target.result;
                localStorage.setItem('saved_logo', src);
                document.getElementById('login-preview').src = src;
                document.getElementById('login-preview').style.display = 'block';
                document.getElementById('sidebar-logo').src = src;
                document.getElementById('sidebar-logo').style.display = 'block';
                document.getElementById('upload-text').style.display = 'none';
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    loadData: async function() {
        // Replace with your actual Google Apps Script URL
        const DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec";
        try {
            const res = await fetch(DB_URL);
            const data = await res.json();
            const filtered = data.slice(1).filter(r => r[3].toUpperCase() === this.currentTab);
            this.renderTable(filtered);
        } catch (e) { console.error("Database Connection Error"); }
    },

    renderTable: function(rows) {
        const tbody = document.getElementById('report-rows');
        tbody.innerHTML = rows.map(r => `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:15px;"><strong>${r[1]}</strong></td>
                <td>${r[4]}</td>
                <td>${r[3]}</td>
                <td style="text-align:right; padding-right:15px;">
                    <button onclick="window.viz.init('${r[2]}', '${r[1]}')" style="background:#0f172a; color:#38bdf8; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">View Data</button>
                </td>
            </tr>
        `).join('');
    },

    showTab: function(tab) { this.currentTab = tab; this.loadData(); },
    backToList: function() { 
        document.getElementById('viz-view').style.display = 'none'; 
        document.getElementById('list-view').style.display = 'block'; 
    }
};

// Check for saved logo on load
window.onload = () => {
    const saved = localStorage.getItem('saved_logo');
    if(saved) {
        document.getElementById('sidebar-logo').src = saved;
        document.getElementById('sidebar-logo').style.display = 'block';
    }
};
