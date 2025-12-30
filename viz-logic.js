window.viz = {
    activeMap: null,

    init: async function(url, title) {
        console.log("Initializing Viz for:", title);
        
        // Switch screens
        document.getElementById('list-view').style.display = 'none';
        document.getElementById('viz-view').style.display = 'block';
        document.getElementById('viz-title').innerText = title;
        
        const container = document.getElementById('map-element');
        container.innerHTML = ""; // Clear existing
        
        if(this.activeMap) { this.activeMap.remove(); this.activeMap = null; }

        try {
            const csvUrl = url.includes("google.com") ? url.replace(/\/edit.*$/, '/export?format=csv') : url;
            const res = await fetch(csvUrl);
            const text = await res.text();
            const rows = text.split('\n').filter(r => r.trim()).slice(1).map(l => l.split(','));

            // Check if we are in Map or Cluster mode
            if(window.ui.currentTab === 'MAP') {
                this.renderMap(rows);
            } else {
                this.renderCluster(rows);
            }
        } catch (e) {
            console.error("Data Load Error:", e);
        }
    },

    renderMap: function(data) {
        this.activeMap = L.map('map-element').setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(this.activeMap);

        data.forEach(r => {
            // Using indices from your Sample Sheet
            const oLat = parseFloat(r[95]), oLng = parseFloat(r[96]), 
                  dLat = parseFloat(r[97]), dLng = parseFloat(r[98]);

            if(!isNaN(oLat) && !isNaN(dLat)) {
                // Draw Route Line
                L.polyline([[oLat, oLng], [dLat, dLng]], {color: '#38bdf8', weight: 2}).addTo(this.activeMap);
                // Draw Destination Marker
                L.circleMarker([dLat, dLng], {radius: 5, color: '#0f172a', fillColor: '#38bdf8', fillOpacity: 1})
                  .addTo(this.activeMap)
                  .bindPopup(`<b>Importer:</b> ${r[13]}<br><b>Customs ID:</b> ${r[45]}`);
            }
        });
    },

    renderCluster: function(data) {
        const container = document.getElementById('map-element');
        const width = container.clientWidth, height = 600;
        const svg = d3.select("#map-element").append("svg").attr("width", width).attr("height", height);
        const g = svg.append("g");
        svg.call(d3.zoom().on("zoom", (e) => g.attr("transform", e.transform)));

        let nodes = [], links = [], nodeSet = new Set();
        data.forEach(r => {
            const src = r[8], tgt = r[13]; // Exporter to Importer
            if(src && tgt) {
                if(!nodeSet.has(src)) { nodes.push({id: src, type: 'exporter'}); nodeSet.add(src); }
                if(!nodeSet.has(tgt)) { nodes.push({id: tgt, type: 'importer'}); nodeSet.add(tgt); }
                links.push({source: src, target: tgt});
            }
        });

        const sim = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width/2, height/2));

        const link = g.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "#cbd5e1");
        const node = g.append("g").selectAll("g").data(nodes).enter().append("g");

        node.append("circle").attr("r", 10).attr("fill", d => d.type === 'exporter' ? '#38bdf8' : '#0f172a');
        node.append("text").text(d => d.id).attr("x", 14).attr("y", 4).style("font-size", "11px").style("font-weight", "600");

        sim.on("tick", () => {
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });
    }
};
