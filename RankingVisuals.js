/**
 * BRANDORB RANKING VISUALS - FINAL STABLE VERSION
 */
window.currentView = 'EXPORTER';
window.sortCol = 'Amount($)';
window.sortAsc = false;

window.switchReport = function(view) {
    window.currentView = view;
    window.sortCol = 'Amount($)';
    window.sortAsc = false;
    document.getElementById('btn-exp').classList.toggle('active', view === 'EXPORTER');
    document.getElementById('btn-imp').classList.toggle('active', view === 'IMPORTER');
    renderRanking();
};

window.handleSort = function(col) {
    if (window.sortCol === col) window.sortAsc = !window.sortAsc;
    else { window.sortCol = col; window.sortAsc = false; }
    renderRanking();
};

window.renderRanking = function() {
    const data = window.rankingData;
    const container = document.getElementById('table-container');
    const searchTerm = document.getElementById('rank-search').value.toLowerCase();
    if (!data) return;

    const mainCol = window.currentView === 'EXPORTER' ? 'Exporter' : 'Importer';

    // 1. Filter Logic
    let filtered = data.filter(row => {
        const name = String(row[mainCol] || "").toLowerCase();
        const country = String(row['Country'] || "").toLowerCase();
        return row[mainCol] && (name.includes(searchTerm) || country.includes(searchTerm));
    });

    // 2. Sort Logic
    const cleanNum = (v) => parseFloat(String(v || "0").replace(/[$,]/g, "")) || 0;
    filtered.sort((a, b) => {
        let valA = a[window.sortCol], valB = b[window.sortCol];
        let nA = cleanNum(valA), nB = cleanNum(valB);
        if (!isNaN(nA) && !isNaN(nB) && window.sortCol !== mainCol && window.sortCol !== 'Country') {
            return window.sortAsc ? nA - nB : nB - nA;
        }
        return window.sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });

    // 3. Totals
    const totalW = filtered.reduce((s, r) => s + cleanNum(r['Weight(Kg)']), 0);
    const totalA = filtered.reduce((s, r) => s + cleanNum(r['Amount($)']), 0);
    const totalQ = filtered.reduce((s, r) => s + cleanNum(r['Quantity']), 0);
    const totalT = filtered.reduce((s, r) => s + cleanNum(r['Transactions']), 0);

    const getArr = (c) => window.sortCol !== c ? '<i class="fas fa-sort sort-icon"></i>' : (window.sortAsc ? '<i class="fas fa-sort-up"></i>' : '<i class="fas fa-sort-down"></i>');

    // 4. Build Table
    let html = `<table>
        <thead>
            <tr>
                <th onclick="handleSort('${mainCol}')">${mainCol} ${getArr(mainCol)}</th>
                <th onclick="handleSort('Weight(Kg)')">Weight (Kg) ${getArr('Weight(Kg)')}</th>
                <th onclick="handleSort('Amount($)')">Amount ($) ${getArr('Amount($)')}</th>
                <th onclick="handleSort('Quantity')">Qty ${getArr('Quantity')}</th>
                <th onclick="handleSort('Transactions')">Txns ${getArr('Transactions')}</th>
                <th onclick="handleSort('Country')">Country ${getArr('Country')}</th>
                <th>Risk Status</th>
                <th>Notes</th>
                <th>URL</th>
            </tr>
        </thead>
        <tbody>` + filtered.map(row => `
            <tr>
                <td><strong>${row[mainCol]}</strong></td>
                <td>${cleanNum(row['Weight(Kg)']).toLocaleString()}</td>
                <td>$${cleanNum(row['Amount($)']).toLocaleString()}</td>
                <td>${row['Quantity'] || 0}</td>
                <td>${row['Transactions'] || 0}</td>
                <td>${row['Country'] || '-'}</td>
                <td><span class="risk-badge ${getRiskClass(row['Risk Status'])}">${row['Risk Status'] || 'N/A'}</span></td>
                <td style="font-size:11px; color:#64748b; max-width:150px;">${row['Notes'] || ''}</td>
                <td><a href="${row['URL']}" target="_blank" style="color:#0ea5e9; font-weight:bold; text-decoration:none;">VIEW</a></td>
            </tr>`).join('') + `
        </tbody>
        <tfoot>
            <tr>
                <td>TOTALS (${filtered.length} Items)</td>
                <td>${totalW.toLocaleString()}</td>
                <td>$${totalA.toLocaleString()}</td>
                <td>${totalQ.toLocaleString()}</td>
                <td>${totalT.toLocaleString()}</td>
                <td colspan="4"></td>
            </tr>
        </tfoot>
    </table>`;
    container.innerHTML = html;
};

function getRiskClass(s) {
    if (!s) return "";
    const val = s.toLowerCase();
    return val.includes('high') ? 'risk-high' : val.includes('medium') ? 'risk-medium' : 'risk-low';
}

window.exportPDF = function() {
    const element = document.getElementById('print-area');
    const opt = { margin: 0.5, filename: `BrandOrb_Ranking_${window.currentView}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' } };
    html2pdf().set(opt).from(element).save();
};

window.downloadCSV = function() {
    const mainCol = window.currentView === 'EXPORTER' ? 'Exporter' : 'Importer';
    let csv = `Name,Weight,Amount,Quantity,Transactions,Country,Risk,Notes\n`;
    window.rankingData.filter(r => r[mainCol]).forEach(r => {
        csv += `"${r[mainCol]}","${r['Weight(Kg)']||0}","${r['Amount($)']||0}","${r['Quantity']||0}","${r['Transactions']||0}","${r['Country']||''}","${r['Risk Status']||''}","${r['Notes']||''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Ranking_${window.currentView}.csv`; a.click();
};
