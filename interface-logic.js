/**
 * BrandOrb Intelligence Dashboard
 * Interface Logic Module (Premium v2.0)
 */

// --- CONFIGURATION ---
window.ACCESS_KEY = "Cyber$supe73r"; 
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; // Ensure your Google Apps Script URL is pasted here

window.ui = {
    reports: [],     // Local cache of all reports from the database
    currentTab: 'MAP', // Tracking active view (MAP or CLUSTER)

    /**
     * AUTHENTICATION
     */
    login: function() {
        const passInput = document.getElementById('pass-input');
        if (passInput.value === window.ACCESS_KEY) {
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('app-container').style.visibility = 'visible';
            sessionStorage.setItem('brandorb_auth', 'true');
            this.fetchData();
        } else {
            alert("Unauthorized Access Key. Please try again.");
            passInput.value = "";
        }
    },

    /**
     * DATA SYNC
     */
    fetchData: async function() {
        if (!window.DB_URL || window.DB_URL.includes("YOUR_APPS_SCRIPT")) {
            console.warn("Database URL not set. Loading demo mode.");
            return;
        }

        try {
            const response = await fetch(window.DB_URL);
            const data = await response.json();
            
            // Store raw data (skipping header row)
            this.reports = data.slice(1);
            this.renderTable();
        } catch (error) {
            console.error("Connection Error:", error);
        }
    },

    /**
     * TABLE RENDERING & FILTERING
     */
    renderTable: function() {
        const tbody = document.getElementById('report-rows');
        const searchQuery = document.getElementById('report-search').value.toLowerCase();
        const clientFilter = document.getElementById('client-select').value;

        // Filter data based on Tab (Index 3), Search, and Client (Index 4)
        const filtered = this.reports.filter(r => {
            const matchesTab = r[3].toUpperCase() === this.currentTab;
            const matchesSearch = r[1].toLowerCase().includes(searchQuery);
            const matchesClient = (clientFilter === "All" || r[4] === clientFilter);
            return matchesTab && matchesSearch && matchesClient;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:40px; color:#64748b;">No matching reports found.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(r => `
            <tr>
                <td style="font-weight:600; color:#0f172a;">${r[1]}</td>
                <td style="color:#64748b;">${r[4]}</td>
                <td>
                    <span style="font-size:10px; font-weight:700; background:#e2e8f0; color:#1e293b; padding:4px 10px; border-radius:12px; text-transform:uppercase;">
                        ${r[3]}
                    </span>
                </td>
                <td style="text-align:right;">
                    <button class="btn-premium btn-dark" style="padding:6px 16px;" onclick="window.viz.init('${r[2]}', '${r[1]}')">
                        View
                    </button>
                </td>
            </tr>
        `).join('');
    },

    /**
     * NAVIGATION & UI STATE
     */
    showTab: function(tab) {
        this.currentTab = tab.toUpperCase();
        
        // Update UI active states
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active');
            if (el.innerText.toUpperCase().includes(this.currentTab)) el.classList.add('active');
        });

        this.renderTable();
    },

    filterTable: function() {
        this.renderTable();
    },

    backToList: function() {
        document.getElementById('viz-view').style.display = 'none';
        document.getElementById('list-view').style.display = 'block';
    },

    /**
     * MODAL MANAGEMENT
     */
    openModal: function() {
        document.getElementById('report-modal').style.display = 'flex';
    },

    closeModal: function() {
        document.getElementById('report-modal').style.display = 'none';
        // Clear fields
        document.getElementById('modal-title').value = "";
        document.getElementById('modal-url').value = "";
    },

    saveReport: async function() {
        const title = document.getElementById('modal-title').value;
        const url = document.getElementById('modal-url').value;
        const type = document.getElementById('modal-type').value;
        const client = document.getElementById('client-select').value === "All" ? "General" : document.getElementById('client-select').value;

        if (!title || !url) {
            alert("Please provide both a Title and a Data URL.");
            return;
        }

        // Logic to send to Google Sheets
        const payload = {
            action: 'add',
            title: title,
            url: url,
            type: type,
            client: client
        };

        try {
            await fetch(window.DB_URL, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            alert("Report Published Successfully!");
            this.closeModal();
            this.fetchData(); // Refresh the list
        } catch (e) {
            alert("Sync error. Please check your App Script connection.");
        }
    },

    /**
     * LOGO HANDLING
     */
    handleLogo: function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const b64 = e.target.result;
                localStorage.setItem('brandorb_logo', b64);
                this.applyLogo(b64);
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    applyLogo: function(src) {
        const preview = document.
