/**
 * BRANDORB VISUALS - STABLE VERSION
 */
window.clusterMode = 'COUNTRY'; 

// FIXED DATE NORMALIZER: Specifically targets YYYY-MM-DD
const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    const strVal = String(dateValue).trim();
    // 1. Try to match YYYY-MM-DD pattern directly
    const regex = /(\d{4})-(\d{2})-(\d{2})/;
    const match = strVal.match(regex);
    if (match) return match[0];

    // 2. Fallback to JS Date parsing
    let d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    return strVal; 
};

window.drawMap = function(groups, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    groups.forEach((group, gIdx) => {
        const f = group[0];
        // Origin stays EXACT (All lines start at the same pin)
        const lat1 = parseFloat(f[idx("Origin latitude")]);
        const lon1 = parseFloat(f[idx("Origin longitude")]);
        
        // Destination gets a tiny OFFSET (Lines fan out at the destination)
        let lat2 = parseFloat(f[idx("Destination latitude")]);
        let lon2 = parseFloat(f[idx("Destination longitude")]);

        if (!isNaN(lat1) && !isNaN(lat2)) {
            // Apply a small stagger to the destination based on group index
            // This prevents lines from landing on the exact same pixel
            const offset = (gIdx * 0.15); 
            const finalDestLat = lat2 + offset;
            const finalDestLon = lon2 + offset;

            // STRAIGHT ANT PATH (No curves)
            const ant = L.polyline.antPath([[lat1, lon1], [finalDestLat, finalDestLon]], { 
                color: f[idx("COLOR")] || '#0ea5e9', 
                weight: 2.5, 
                delay: 1000,
                dashArray: [10, 20]
            }).addTo(window.LMap);

            const tableRows = group.map(s => `<tr>
                <td>${formatDate(s[idx("Date")])}</td>
                <td>${s[idx("Quantity")] || '-'}</td>
                <td>$${s[idx("Value(USD)")]}</td>
                <td style="word-break: break-all; min-width: 140px; font-size: 10px;">${s[idx("PRODUCT")]}</td>
                <td>${s[idx("Mode of Transport")] || 'N/A'}</td>
            </tr>`).join('');

            ant.bindPopup(`
                <div style="width:380px; font-family:sans-serif; max-height:280px; overflow-y:auto;">
                    <div style="margin-bottom:8px;">
                        <b>Exporter:</b> ${f[idx("Exporter")]}<br>
                        <b>Importer:</b> ${f[idx("Importer")]}<br>
                        <b>Ports:</b> ${f[idx("Origin Port") ] || 'N/A'} → ${f[idx("Destination Port")] || 'N/A'}
                    </div>
                    <table class="popup-table" style="width:100%; border-collapse: collapse; table-layout: fixed;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="width:85px; text-align:left;">Date</th>
                                <th style="width:35px;">Qty</th>
                                <th style="width:60px;">Value</th>
                                <th style="width:130px;">PRODUCT</th>
                                <th style="width:40px;">Mode</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>`, { maxWidth: 420 });
        }
    });
};

// Rest of your functions (populateFilters, recomputeViz, drawCluster) remain exactly as they were...
