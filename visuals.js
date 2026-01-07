/**
 * BRANDORB VISUALS - STABLE VERSION
 */

window._playbackDrawnKeys = new Set();
window._allRouteGroups = null;

// ================= PLAYBACK STATE =================
window.playback = {
    enabled: false,
    unit: 'MONTH',
    speed: 800,
    timer: null,
    frames: [],
    currentIndex: 0
};

window.clusterMode = 'COUNTRY';
window.currentTab = 'MAP';

// ================= DATE HELPERS =================
window.getMonthKey = function(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
};

const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    const strVal = String(dateValue).trim();
    const match = strVal.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];
    const d = new Date(dateValue);
    if (!isNaN(d)) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return strVal;
};

// ================= FILTERS =================
window.populateFilters = function() {
    if (!window.rawData || window.rawData.length < 2) return;
    const h = window.rawData[0].map(v => v.trim());
    const data = window.rawData.slice(1);

    const fill = (id, col, lbl) => {
        const i = h.indexOf(col);
        if (i === -1) return;
        const el = document.getElementById(id);
        const vals = [...new Set(data.map(r => r[i]).filter(Boolean))].sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` +
            vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };

    fill('orig-filter', 'Origin Country', 'Countries');
    fill('dest-filter', 'Destination Country', 'Countries');
    fill('orig-port-filter', 'Origin Port', 'Origin Ports');
    fill('dest-port-filter', 'Destination Port', 'Destination Ports');
};

// ================= MAIN RECOMPUTE =================
window.recomputeViz = function() {
    if (!window.rawData) return;

    const h = window.rawData[0].map(v => v.trim());
    const idx = n => h.indexOf(n);

    const search = document.getElementById('ent-search')?.value.toLowerCase() || '';
    const origF = document.getElementById('orig-filter')?.value || 'All';
    const destF = document.getElementById('dest-filter')?.value || 'All';
    const opF = document.getElementById('orig-port-filter')?.value || 'All';
    const dpF = document.getElementById('dest-port-filter')?.value || 'All';

    const filteredRows = window.rawData.slice(1).filter(r => {
        return (
            (origF === 'All' || r[idx("Origin Country")] === origF) &&
            (destF === 'All' || r[idx("Destination Country")] === destF) &&
            (opF === 'All' || r[idx("Origin Port")] === opF) &&
            (dpF === 'All' || r[idx("Destination Port")] === dpF) &&
            ((r[idx("Exporter")] + r[idx("Importer")] + r[idx("PRODUCT")]).toLowerCase().includes(search))
        );
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = `
        <div class="viz-controls" style="margin-bottom:6px;">
            <button class="toggle-btn ${window.currentTab==='MAP'?'active':''}" onclick="window.currentTab='MAP'; recomputeViz();">Map View</button>
            <button class="toggle-btn ${window.currentTab==='CLUSTER'?'active':''}" onclick="window.currentTab='CLUSTER'; recomputeViz();">Cluster View</button>
        </div>
    `;

    if (window.currentTab === 'MAP') {
        window.playback.frames = [];
        window.playback.currentIndex = 0;

        const monthGroups = {};
        filteredRows.forEach(r => {
            const m = getMonthKey(formatDate(r[idx("Date")]));
            if (!m) return;
            (monthGroups[m] ||= []).push(r);
        });

        window.playback.frames = Object.keys(monthGroups).sort().map(k => monthGroups[k]);

        const groups = {};
        filteredRows.forEach(r => {
            const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}|${r[idx("Origin Port")]}|${r[idx("Destination Port")]}`;
            (groups[key] ||= []).push(r);
        });

        frame.insertAdjacentHTML('beforeend', `
            <div class="viz-controls">
                <button class="toggle-btn ${window.playback.enabled ? 'active' : ''}"
                    onclick="window.playback.enabled=!window.playback.enabled; recomputeViz();">
                    ▶ Playback (Monthly)
                </button>
            </div>
        `);

        window._allRouteGroups = Object.values(groups);
        window._playbackDrawnKeys.clear();

        if (!window.playback.enabled) {
            window.drawMap(window._allRouteGroups, idx);
        } else {
            window.startPlayback(idx);
        }

    } else if (window.currentTab === 'CLUSTER') {
        window.drawCluster(filteredRows, idx);
    }
};

// ================= DRAW MAP =================
window.drawMap = function(groups, idx) {
    if (!window.LMap) {
        window.LMap = L.map('map-frame').setView([20,0],2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png')
            .addTo(window.LMap);
    }

    const routeLayers = [];

    groups.forEach((group, gIdx) => {
        const f = group[0];
        const lat1 = +f[idx("Origin latitude")];
        const lon1 = +f[idx("Origin longitude")];
        const lat2 = +f[idx("Destination latitude")];
        const lon2 = +f[idx("Destination longitude")];
        if (isNaN(lat1) || isNaN(lat2)) return;

        const j = gIdx * 0.015;
        const ant = L.polyline.antPath(
            [[lat1+j, lon1+j], [lat2+j, lon2+j]],
            { color: f[idx("COLOR")] || '#0ea5e9', weight: 2.5, delay: 1000, dashArray: [10,20] }
        ).addTo(window.LMap);

        routeLayers.push({ color: f[idx("COLOR")] || '#0ea5e9', layer: ant });

        L.circleMarker([lat1+j, lon1+j], { radius:4, color:'#0f172a', fillColor:'#0ea5e9', fillOpacity:1 }).addTo(window.LMap);
        L.circleMarker([lat2+j, lon2+j], { radius:4, color:'#0f172a', fillColor:'#f43f5e', fillOpacity:1 }).addTo(window.LMap);

        const tableRows = group.map(s => `
<tr>
<td>${formatDate(s[idx("Date")])}</td>
<td>${s[idx("Weight(Kg)")] || '-'}</td>
<td>$${s[idx("Amount($)")] || '-'}</td>
<td>${s[idx("PRODUCT")]}</td>
<td>${s[idx("Mode of Transportation")] || '-'}</td>
</tr>`).join('');

        ant.bindPopup(`
<div style="width:380px; font-family:sans-serif; max-height:280px; overflow-y:auto;">
<div style="margin-bottom:8px; border-top:4px solid ${f[idx("COLOR")] || '#0ea5e9'}; padding-top:6px;">
<b>Exporter:</b> ${f[idx("Exporter")]} (${f[idx("Origin Country")]})<br>
<b>Importer:</b> ${f[idx("Importer")]} (${f[idx("Destination Country")]})<br>
<b>Ports:</b> ${f[idx("Origin Port")]} → ${f[idx("Destination Port")]}
</div>
<table class="popup-table" style="width:100%;border-collapse:collapse;table-layout:fixed;">
<thead><tr style="background:#f8fafc;">
<th>Date</th><th>Weight</th><th>Amount</th><th>PRODUCT</th><th>Mode</th>
</tr></thead><tbody>${tableRows}</tbody>
</table></div>`, { maxWidth: 420 });
    });

    window.buildColorLegend(routeLayers);
};

// ================= PLAYBACK AUTO FOCUS =================
window.playbackAutoFocus = function(groups, idx) {
    const g = groups[0][0];
    const b = [
        [+g[idx("Origin latitude")], +g[idx("Origin longitude")]],
        [+g[idx("Destination latitude")], +g[idx("Destination longitude")]]
    ];
    window.LMap.fitBounds(b, { padding:[60,60], maxZoom:5 });

    setTimeout(() => {
        const last = Object.values(window.LMap._layers).reverse().find(l => l.openPopup);
        if (last) last.openPopup();
    }, 400);
};

// ================= PLAYBACK =================
window.startPlayback = function(idx) {
    if (!window.playback.frames.length) return;
    if (window.playback.timer) clearInterval(window.playback.timer);

    window.playback.currentIndex = 0;
    window._playbackDrawnKeys.clear();
    window.LMap && window.LMap.eachLayer(l => l instanceof L.Polyline && window.LMap.removeLayer(l));

    window.playback.timer = setInterval(() => {
        if (window.playback.currentIndex >= window.playback.frames.length) {
            clearInterval(window.playback.timer);
            return;
        }

        const rows = window.playback.frames[window.playback.currentIndex];
        const newGroups = {};

        rows.forEach(r => {
            const key = `${r[idx("Exporter")]}|${r[idx("Importer")]}|${r[idx("Origin Port")]}|${r[idx("Destination Port")]}`;
            if (!window._playbackDrawnKeys.has(key)) {
                (newGroups[key] ||= []).push(r);
                window._playbackDrawnKeys.add(key);
            }
        });

        if (Object.keys(newGroups).length) {

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
