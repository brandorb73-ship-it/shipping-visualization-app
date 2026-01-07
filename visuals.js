/**
 * BRANDORB VISUALS – STABLE + SIMPLIFIED PLAYBACK
 */

/* ================= GLOBAL STATE ================= */
window.clusterMode = 'COUNTRY';
window.LMap = null;
window.routeLayers = [];
window.playbackTimer = null;

/* ================= DATE HELPERS ================= */
function getMonthKey(v) {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d)) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatDate(v) {
    if (!v) return 'N/A';
    const d = new Date(v);
    if (isNaN(d)) return v;
    return d.toISOString().slice(0,10);
}

/* ================= FILTER DROPDOWNS ================= */
window.populateFilters = function () {
    if (!window.rawData) return;

    const h = window.rawData[0];
    const rows = window.rawData.slice(1);

    function fill(id, col, label) {
        const i = h.indexOf(col);
        if (i === -1) return;
        const el = document.getElementById(id);
        const vals = [...new Set(rows.map(r => r[i]).filter(Boolean))].sort();
        el.innerHTML =
            `<option value="All">All ${label}</option>` +
            vals.map(v => `<option>${v}</option>`).join('');
    }

    fill('orig-filter', 'Origin Country', 'Countries');
    fill('dest-filter', 'Destination Country', 'Countries');
    fill('orig-port-filter', 'Origin Port', 'Origin Ports');
    fill('dest-port-filter', 'Destination Port', 'Destination Ports');
};

/* ================= MAIN RECOMPUTE ================= */
window.recomputeViz = function () {
    if (!window.rawData) return;

    clearInterval(window.playbackTimer);

    const h = window.rawData[0];
    const idx = c => h.indexOf(c);

    const search = document.getElementById('ent-search')?.value.toLowerCase() || '';
    const oC = document.getElementById('orig-filter')?.value || 'All';
    const dC = document.getElementById('dest-filter')?.value || 'All';
    const oP = document.getElementById('orig-port-filter')?.value || 'All';
    const dP = document.getElementById('dest-port-filter')?.value || 'All';

    const rows = window.rawData.slice(1).filter(r => {
        if (oC !== 'All' && r[idx('Origin Country')] !== oC) return false;
        if (dC !== 'All' && r[idx('Destination Country')] !== dC) return false;
        if (oP !== 'All' && r[idx('Origin Port')] !== oP) return false;
        if (dP !== 'All' && r[idx('Destination Port')] !== dP) return false;
        const blob = (r[idx('Exporter')] + r[idx('Importer')] + r[idx('PRODUCT')]).toLowerCase();
        return blob.includes(search);
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = '';

    if (window.currentTab === 'CLUSTER') {
        drawCluster(rows, idx);
        return;
    }

    drawRouteMap(rows, idx);
};

/* ================= ROUTE MAP ================= */
function drawRouteMap(rows, idx) {

    document.getElementById('map-frame').innerHTML = `
        <div class="viz-controls">
            <button class="toggle-btn" onclick="startPlayback()">▶ Playback (Monthly)</button>
            <button class="toggle-btn" onclick="stopPlayback()">⏹ Stop</button>
        </div>
        <div id="leaflet-map" style="height:100%"></div>
    `;

    window.LMap = L.map('leaflet-map').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    renderRoutes(rows, idx);
}

/* ================= ROUTE DRAW ================= */
function renderRoutes(rows, idx, autoPopup = false) {
    window.routeLayers.forEach(l => window.LMap.removeLayer(l));
    window.routeLayers = [];

    const groups = {};
    rows.forEach(r => {
        const k = `${r[idx('Exporter')]}|${r[idx('Importer')]}|${r[idx('Origin Port')]}|${r[idx('Destination Port')]}`;
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
    });

    let popupQueue = [];

    Object.values(groups).forEach((g, i) => {
        const f = g[0];

        const oLat = +f[idx('Origin latitude')];
        const oLon = +f[idx('Origin longitude')];
        const dLat = +f[idx('Destination latitude')];
        const dLon = +f[idx('Destination longitude')];
        if (isNaN(oLat) || isNaN(dLat)) return;

        const color = f[idx('COLOR')] || '#0ea5e9';

        /* === ROUTE LINE === */
        const line = L.polyline.antPath(
            [[oLat, oLon], [dLat, dLon]],
            { color, weight: 2.5, delay: 800 }
        ).addTo(window.LMap);

        /* === START / END DOTS === */
        L.circleMarker([oLat, oLon], {
            radius: 4,
            color: '#0f172a',
            fillColor: '#0ea5e9',
            fillOpacity: 1,
            weight: 1
        }).addTo(window.LMap);

        L.circleMarker([dLat, dLon], {
            radius: 4,
            color: '#0f172a',
            fillColor: '#f43f5e',
            fillOpacity: 1,
            weight: 1
        }).addTo(window.LMap);

        /* === POPUP CONTENT === */
        const table = g.map(r => `
            <tr>
<td>${formatDate(s[idx("Date")])}</td>
<td>${s[idx("Weight(Kg)")] || '-'}</td>
<td>$${s[idx("Amount($)")] || '-'}</td>
<td>${s[idx("PRODUCT")]}</td>
<td>${s[idx("Mode of Transportation")] || '-'}</td>
</tr>`).join('');

        const popupHTML = `
<div style="width:380px; font-family:sans-serif; max-height:280px; overflow-y:auto;">
<div style="margin-bottom:8px; border-top:4px solid ${f[idx("COLOR")] || '#0ea5e9'}; padding-top:6px;">
<b>Exporter:</b> ${f[idx("Exporter")]} (${f[idx("Origin Country")]})<br>
<b>Importer:</b> ${f[idx("Importer")]} (${f[idx("Destination Country")]})<br>
<b>Ports:</b> ${f[idx("Origin Port")]} → ${f[idx("Destination Port")]}</div>
<table class="popup-table" style="width:100%;border-collapse:collapse;table-layout:fixed;">
<thead><tr style="background:#f8fafc;">
<th>Date</th><th>Weight</th><th>Amount</th><th>PRODUCT</th><th>Mode</th></tr>
</thead><tbody>${tableRows}</tbody></table></div>`, {maxWidth:420});
                       </table>
            </div>
        `;

        line.bindPopup(popupHTML);
        window.routeLayers.push(line);
        popupQueue.push(line);
    });

    /* === AUTO POPUP SEQUENCE (FOR PLAYBACK) === */
    if (autoPopup && popupQueue.length) {
        let i = 0;
        const openNext = () => {
            if (i > 0) popupQueue[i - 1].closePopup();
            if (i >= popupQueue.length) return;
            popupQueue[i].openPopup();
            i++;
            setTimeout(openNext, 1200);
        };
        openNext();
    }
}

/* ================= PLAYBACK ================= */
function startPlayback() {
    stopPlayback();

    const h = window.rawData[0];
    const idx = c => h.indexOf(c);

    const byMonth = {};
    window.rawData.slice(1).forEach(r => {
        const m = getMonthKey(r[idx('Date')]);
        if (!m) return;
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push(r);
    });

    const months = Object.keys(byMonth).sort();
    let accumulated = [];
    let i = 0;

    window.playbackTimer = setInterval(() => {
        if (i >= months.length) return stopPlayback();
        accumulated = accumulated.concat(byMonth[months[i]]);
        renderRoutes(accumulated, idx, true);
        i++;
    }, 1800);
}

// ================= CLUSTER =================
window.drawCluster = function(data, idx) {
    const frame = document.getElementById('map-frame');
    const width = frame.clientWidth, height = frame.clientHeight;
    const svg = d3.select("#map-frame").append("svg").attr("width","100%").attr("height","100%");
    const g = svg.append("g");
    svg.call(d3.zoom().on("zoom",(e)=>g.attr("transform",e.transform)));

    let nodes=[], links=[], nodeSet = new Set();
    if (!window._tradeAgg) window._tradeAgg = {};

    data.forEach(r=>{
        const exp = r[idx("Exporter")], imp = r[idx("Importer")];
        const gp = window.clusterMode==='COUNTRY'? r[idx("Origin Country")] : r[idx("PRODUCT")];
        const dp = window.clusterMode==='COUNTRY'? r[idx("Destination Country")] : r[idx("PRODUCT")];
        if (!exp || !imp || !gp) return;
        [gp,dp].forEach(p=>{if(!nodeSet.has(p)){nodes.push({id:p,type:'parent'}); nodeSet.add(p);}});
        if(!nodeSet.has(exp)){nodes.push({id:exp,type:'exp'}); nodeSet.add(exp);}
        if(!nodeSet.has(imp)){nodes.push({id:imp,type:'imp'}); nodeSet.add(imp);}

        const tradeKey = exp + '→' + imp;
        if (!window._tradeAgg[tradeKey]) window._tradeAgg[tradeKey] = {source:exp,target:imp,type:'trade',rows:[]};
        window._tradeAgg[tradeKey].rows.push(r);

        if(window.clusterMode!=='COUNTRY') links.push({source:exp,target:imp,type:'trade',data:r});
        links.push({source:gp,target:exp,type:'link'},{source:dp,target:imp,type:'link'});
    });

    if(window.clusterMode==='COUNTRY'){
        Object.values(window._tradeAgg).forEach(l=>links.push(l));
        window._tradeAgg = {};
    }

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d=>d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width/2,height/2));

    const link = g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke", d=>d.type==='link'?"#e2e8f0":"#94a3b8").attr("stroke-width",2);

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start",(e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y;})
        .on("drag",(e,d)=>{d.fx=e.x; d.fy=e.y;}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0); d.fx=null; d.fy=null;}));

    node.append("circle").attr("r",d=>d.type==='parent'?22:14).attr("fill",d=>d.type==='parent'?'#1e293b':(d.type==='exp'?'#0ea5e9':'#f43f5e')).attr("stroke","#fff").attr("stroke-width",2);

    node.append("foreignObject").attr("width",30).attr("height",30).attr("x",-15).attr("y",-15).style("pointer-events","none").html(d=>{
        let iconClass="fa-globe";
        if(d.type==='exp') iconClass='fa-building';
        if(d.type==='imp') iconClass='fa-store';
        return `<div style="display:flex; align-items:center; justify-content:center; width:30px; height:30px;"><i class="fas ${iconClass}" style="color:white; font-size:${d.type==='parent'?'16px':'12px'};"></i></div>`;
    });

    node.append("text").text(d=>d.id).attr("y",35).attr("text-anchor","middle").style("font-size","9px").style("font-weight","bold");

    link.filter(d=>d.type==='trade').on("click",(e,d)=>{
        const rows = d.rows || [d.data];
        d3.selectAll(".cluster-pop").remove();
        d3.select("#map-frame").append("div").attr("class","cluster-pop")
            .style("left",e.offsetX+"px").style("top",e.offsetY+"px")
            .html(`
<span class="pop-close" onclick="this.parentElement.remove()">×</span>
<strong>${rows[0][idx("Exporter")]} → ${rows[0][idx("Importer")]}</strong>
<table class="popup-table" style="margin-top:6px;">
<tr><th>Date</th><th>Qty</th><th>Value</th><th>Product</th></tr>
${rows.map(r=>`<tr>
<td>${formatDate(r[idx("Date")])}</td>
<td>${r[idx("Quantity")]||'-'}</td>
<td>$${r[idx("Amount($)")]}</td>
<td>${r[idx("PRODUCT")]}</td>
</tr>`).join('')}
</table>`); 
    });

    sim.on("tick",()=>{
        link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
        node.attr("transform",d=>`translate(${d.x},${d.y})`);
    });
};

// ================= COLOR LEGEND =================
window.buildColorLegend = function(routes){
    const container = document.getElementById("map-frame");
    document.getElementById("color-legend")?.remove();

    const legend = document.createElement("div");
    legend.className="color-legend";
    legend.id="color-legend";

    const colors = [...new Set(routes.map(r=>r.color))];
    colors.forEach(color=>{
        const row = document.createElement("div");
        row.className="color-legend-item";
        row.dataset.color=color;
        row.innerHTML=`<div class="color-legend-swatch" style="background:${color}"></div><span>${color}</span>`;
        row.onclick = ()=>{
            const active = !row.classList.contains("inactive");
            document.querySelectorAll(".color-legend-item").forEach(i=>i.classList.add("inactive"));
            if(active){
                routes.forEach(r=>{ if(r.color===color) r.layer.addTo(window.LMap); else window.LMap.removeLayer(r.layer); });
                row.classList.remove("inactive");
            } else {
                routes.forEach(r=>r.layer.addTo(window.LMap));
                document.querySelectorAll(".color-legend-item").forEach(i=>i.classList.remove("inactive"));
            }
        };
        legend.appendChild(row);
    });

    container.appendChild(legend);
};
