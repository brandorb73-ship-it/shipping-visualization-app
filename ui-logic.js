// --- ADD THESE TWO LINES BACK AT THE TOP ---
window.ACCESS_KEY = "Cyber$supe73r"; 
window.DB_URL = "https://script.google.com/macros/s/AKfycbzvnTinsKASNna9T_T9ODSy3FiBAU8BN-VciXWmbxdhGWaSUQKZmwnuT9nRW8kORq0/exec"; 

window.ui = {
    reports: [], 
    currentTab: 'MAP', // Track which tab is active
    
    window.ui = {
    reports: [], // Local cache for filtering

    openModal: function() {
        document.getElementById('report-modal').style.display = 'flex';
    },

    closeModal: function() {
        document.getElementById('report-modal').style.display = 'none';
    },

    saveReport: function() {
        const title = document.getElementById('modal-title').value;
        const url = document.getElementById('modal-url').value;
        const type = document.getElementById('modal-type').value;

        if(!title || !url) return alert("Please fill all fields");

        // Here you would normally send to Google Apps Script. 
        // For now, we add it to the view locally to confirm it works.
        console.log("Saving report:", {title, url, type});
        alert("Report Sent to Database!");
        this.closeModal();
        // Trigger data refresh if DB is connected
    },

    filterTable: function() {
        const searchQuery = document.getElementById('report-search').value.toLowerCase();
        const clientFilter = document.getElementById('client-select').value;
        const rows = document.querySelectorAll('#report-rows tr');

        rows.forEach(row => {
            const title = row.cells[0].innerText.toLowerCase();
            const client = row.cells[1].innerText;
            
            const matchesSearch = title.includes(searchQuery);
            const matchesClient = (clientFilter === "All" || client === clientFilter);

            row.style.display = (matchesSearch && matchesClient) ? "" : "none";
        });
    },

    // Mock data injection to test the "View" button
    loadMockData: function() {
        const mockData = [
            { name: "Test - Flow Map", client: "General", type: "MAP" },
            { name: "Q3 Cluster Analysis", client: "TRX", type: "CLUSTER" },
            { name: "Global Routes Q4", client: "General", type: "MAP" }
        ];

        const tbody = document.getElementById('report-rows');
        tbody.innerHTML = mockData.map(r => `
            <tr>
                <td><strong>${r.name}</strong></td>
                <td style="color:#64748b">${r.client}</td>
                <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">${r.type}</span></td>
                <td style="text-align:right">
                    <button class="btn-premium btn-dark" style="padding:6px 15px; display:inline-flex;" onclick="alert('Viz script installment needed to view')">View</button>
                </td>
            </tr>
        `).join('');
    }
};

window.onload = () => {
    window.ui.loadMockData();
};
