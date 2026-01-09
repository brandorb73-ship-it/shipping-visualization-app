/**
 * BRANDORB VISUALS - STABLE VERSION
 */
window.clusterMode = 'COUNTRY'; 

// FIXED DATE NORMALIZER
const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    const strVal = String(dateValue).trim();
    const match = strVal.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];
    let d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return strVal;
};

window.downloadPDF = function () {
    const mapEl = document.getElementById('map-frame');
    window.LMap.invalidateSize(true);
    html2canvas(mapEl, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        ignoreElements: el => el.classList.contains("leaflet-control")
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'BrandOrb_RouteMap.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
};

window.populateFilters = function() {
    if (!window.rawData || window.rawData.length < 2) return;
    const h = window.rawData[0];
    const data = window.rawData.slice(1);
    const fill = (id, col, lbl) => {
        const i = h.findIndex(x => x.trim() === col);
        if (i === -1) return;
        const el = document.getElementById(id);
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v).sort();
        el.innerHTML = `<option value="All">All ${lbl}</option>` +
            vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };
    fill('orig-filter','Origin Country','Countries');
    fill('dest-filter','Destination Country','Countries');
    fill('orig-port-filter','Origin Port','Origin Ports');
    fill('dest-port-filter','Destination Port','Destination Ports');
};

window.recomputeViz = function() {
    if (!window.rawData) return;
    const h = window.rawData[0];
    const idx = n => h.findIndex(x => x.trim() === n);

    const search = document.getElementById('ent-search').value.toLowerCase();
    const of = document.getElementById('orig-filter').value;
    const df = document.getElementById('dest-filter').value;
    const op = document.getElementById('orig-port-filter').value;
    const dp = document.getElementById('dest-port-filter').value;

    const rows = window.rawData.slice(1).filter(r => {
        const s = ((r[idx("Exporter")]||"")+(r[idx("Importer")]||"")+(r[idx("PRODUCT")]||"")).toLowerCase();
        return (of==='All'||r[idx("Origin Country")]===of) &&
               (df==='All'||r[idx("Destination Country")]===df) &&
               (op==='All'||r[idx("Origin Port")]===op) &&
               (dp==='All'||r[idx("Destination Port")]===dp) &&
               s.includes(search);
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = "";
    if (window.LMap) { window.LMap.remove(); window.LMap=null; }

    if (window.currentTab === 'MAP') {
        const groups = {};
        rows.forEach(r=>{
            const k = `${r[idx("Exporter")]}|${r[idx("Importer")]}|${r[idx("Origin Port")]}|${r[idx("Destination Port")]}`;
            if(!groups[k]) groups[k]=[];
            groups[k].push(r);
        });
        window.drawMap(Object.values(groups), idx);
    } else {
        frame.insertAdjacentHTML('afterbegin', `
        <div class="viz-controls">
            <button class="toggle-btn ${window.clusterMode==='COUNTRY'?'active':''}"
                onclick="window.clusterMode='COUNTRY'; recomputeViz()">Group by Country</button>
            <button class="toggle-btn ${window.clusterMode==='PRODUCT'?'active':''}"
                onclick="window.clusterMode='PRODUCT'; recomputeViz()">Group by Product</button>
        </div>`);
        window.drawCluster(rows, idx);
    }
};

window.drawMap = function(groups, idx) {
    const routeLayers = [];
    window.LMap = L.map('map-frame').setView([20,0],2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(window.LMap);

    groups.forEach((g,i)=>{
        window.buildColorLegend(routeLayers);
        const f = g[0];
        const j=i*0.015;
        const o=[+f[idx("Origin latitude")]+j,+f[idx("Origin longitude")]+j];
        const d=[+f[idx("Destination latitude")]+j,+f[idx("Destination longitude")]+j];
        if(isNaN(o[0])||isNaN(d[0])) return;

        const ant=L.polyline.antPath([o,d],{
            color:f[idx("COLOR")]||'#0ea5e9',
            weight:2.5,delay:1000,dashArray:[10,20]
        }).addTo(window.LMap);

        routeLayers.push({color:f[idx("COLOR")]||'#0ea5e9',layer:ant});

        L.circleMarker(o,{radius:4,color:'#0f172a',fillColor:'#0ea5e9',fillOpacity:1}).addTo(window.LMap);
        L.circleMarker(d,{radius:4,color:'#0f172a',fillColor:'#f43f5e',fillOpacity:1}).addTo(window.LMap);

        const rows=g.map(r=>`
<tr>
<td>${formatDate(r[idx("Date")])}</td>
<td>${r[idx("Weight(Kg)")]||'-'}</td>
<td>$${r[idx("Amount($)")]||'-'}</td>
<td>${r[idx("PRODUCT")]}</td>
<td>${r[idx("Mode of Transportation")]||'-'}</td>
</tr>`).join("");

        ant.bindPopup(`
<div style="width:380px">
<b>${f[idx("Exporter")]} → ${f[idx("Importer")]}</b><br>
${f[idx("Origin Port")]} → ${f[idx("Destination Port")]}
<table class="popup-table">${rows}</table>
</div>`);
    });
};

window.drawCluster = function(data, idx) {
    const frame=document.getElementById('map-frame');
    const svg=d3.select(frame).append("svg").attr("width","100%").attr("height","100%");
    const g=svg.append("g");
    svg.call(d3.zoom().on("zoom",e=>g.attr("transform",e.transform)));

    let nodes=[],links=[],set=new Set();
    data.forEach(r=>{
        const e=r[idx("Exporter")], i=r[idx("Importer")];
        const gp=window.clusterMode==='COUNTRY'?r[idx("Origin Country")]:r[idx("PRODUCT")];
        const dp=window.clusterMode==='COUNTRY'?r[idx("Destination Country")]:r[idx("PRODUCT")];
        [gp,dp,e,i].forEach(x=>{if(x&&!set.has(x)){nodes.push({id:x,type:x===e?'exp':x===i?'imp':'parent'});set.add(x)}});
        links.push({source:gp,target:e,type:'link'},{source:dp,target:i,type:'link'});
        links.push({source:e,target:i,type:'trade',rows:[r]});
    });

    const sim=d3.forceSimulation(nodes)
        .force("link",d3.forceLink(links).id(d=>d.id).distance(100))
        .force("charge",d3.forceManyBody().strength(-300))
        .force("center",d3.forceCenter(frame.clientWidth/2,frame.clientHeight/2));

    const link=g.append("g").selectAll("line").data(links).enter().append("line")
        .attr("stroke",d=>d.type==='trade'?'#94a3b8':'#e2e8f0')
        .attr("stroke-width",2);

    // 🔹 INVISIBLE CLICK LAYER (NEW)
    const clickLayer=g.append("g").selectAll("line")
        .data(links.filter(d=>d.type==='trade'))
        .enter().append("line")
        .attr("stroke","transparent")
        .attr("stroke-width",10)
        .style("cursor","pointer");

    const node=g.append("g").selectAll("g").data(nodes).enter().append("g")
        .call(d3.drag().on("start",(e,d)=>{sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y})
        .on("end",(e,d)=>{sim.alphaTarget(0);d.fx=null;d.fy=null}));

    node.append("circle")
        .attr("r",d=>d.type==='parent'?22:14)
        .attr("fill",d=>d.type==='parent'?'#1e293b':d.type==='exp'?'#0ea5e9':'#f43f5e')
        .attr("stroke","#fff").attr("stroke-width",2);

    node.append("text").text(d=>d.id)
        .attr("y",35).attr("text-anchor","middle")
        .style("font-size","9px").style("font-weight","bold");

    // 🔹 POPUP CLICK HANDLER MOVED HERE
    clickLayer.on("click",(e,d)=>{
        const rows=d.rows;
        d3.selectAll(".cluster-pop").remove();
        d3.select("#map-frame").append("div")
            .attr("class","cluster-pop")
            .style("left",e.offsetX+"px")
            .style("top",e.offsetY+"px")
            .html(`
<span class="pop-close" onclick="this.parentElement.remove()">×</span>
<strong>${rows[0][idx("Exporter")]} → ${rows[0][idx("Importer")]}</strong>
<table class="popup-table">
${rows.map(r=>`
<tr>
<td>${formatDate(r[idx("Date")])}</td>
<td>${r[idx("Quantity")]||'-'}</td>
<td>$${r[idx("Amount($)")]||'-'}</td>
<td>${r[idx("PRODUCT")]}</td>
</tr>`).join("")}
</table>`);
    });

    sim.on("tick",()=>{
        link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y)
            .attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
        clickLayer.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y)
            .attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
        node.attr("transform",d=>`translate(${d.x},${d.y})`);
    });
};

window.buildColorLegend = function(routes) {
    const container=document.getElementById("map-frame");
    document.getElementById("color-legend")?.remove();
    const legend=document.createElement("div");
    legend.className="color-legend";
    legend.id="color-legend";
    [...new Set(routes.map(r=>r.color))].forEach(c=>{
        const r=document.createElement("div");
        r.className="color-legend-item";
        r.innerHTML=`<div class="color-legend-swatch" style="background:${c}"></div>${c}`;
        r.onclick=()=>routes.forEach(x=>x.color===c?x.layer.addTo(window.LMap):window.LMap.removeLayer(x.layer));
        legend.appendChild(r);
    });
    container.appendChild(legend);
};
