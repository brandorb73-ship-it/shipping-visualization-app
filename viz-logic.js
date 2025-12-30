window.viz = {
    activeMap: null,
    simulation: null,

    init: async function(url, title) {
        document.getElementById('list-view').style.display = 'none';
        document.getElementById('viz-view').style.display = 'block';
        document.getElementById('viz-title').innerText = title;
        
        const container = document.getElementById('map-element');
        container.innerHTML = "";
        
        if(this.activeMap) { this.activeMap.remove(); this.activeMap = null; }

        try {
            const csvUrl = url.includes("google.com") ? url.replace(/\/edit.*$/, '/export?format=csv') : url;
            const res = await fetch(csvUrl);
            const text = await res.text();
            // Parsing CSV rows
            const rows = text.split('\n').filter(r => r.trim()).slice(1).map(l => l.split(','));

            if(window.ui.currentTab === 'MAP') {
                this.renderRouteMap(rows);
            } else {
                this.renderClusterGraph(rows);
            }
        } catch (e) {
            console.error("Viz Error:", e);
            alert("Error loading data. Verify the CSV link is accessible.");
        }
    },

    renderRouteMap: function(data) {
        this.activeMap = L.map('map-element').setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(this.activeMap);

        data.forEach(r => {
            // Updated Indices based on Sample Sheet:
            // 95: Origin Lat, 96: Origin Lng, 97: Dest Lat, 98: Dest Lng
            // 13: Importer (Recipient), 45: Customs Declaration Number (ID)
            const oLat = parseFloat(r[95]), oLng = parseFloat(r[96]), 
                  dLat = parseFloat(r[97]), dLng = parseFloat(r[98]);

            if(!isNaN(oLat) && !isNaN(dLat)) {
                L.polyline([[oLat, oLng], [dLat, dLng]], {
                    color: '#38bdf8', weight: 2, opacity: 0.5
                }).addTo(this.activeMap);

                L.circleMarker([dLat, dLng], {
                    radius: 5, color: '#0f172a', fillColor: '#38bdf8', fillOpacity: 1
                }).addTo(this.activeMap)
                  .bindPopup(`<b>Recipient:</b> ${r[13]}<br><b>ID:</b> ${r[45] || 'N/A'}`);
            }
        });
    },

    renderClusterGraph: function(data) {
        const container = document.getElementById('map-element');
        const width = container.clientWidth, height = 600;
        const svg = d3.select("#map-element").append("svg").attr("width", width).attr("height", height);
        const g = svg.append("g");

        svg.call(d3.zoom().on("zoom", (event) => g.attr("transform", event.transform)));

        let nodes = [], links = [], nodeSet = new Set();
        
        data.forEach(r => {
            // Index 8: Exporter (Source), Index 13: Importer (Target)
            const source = r[8], target = r[13];
            if(source && target) {
                if(!nodeSet.has(source)) { nodes.push({id: source, type: 'src'}); nodeSet.add(source); }
                if(!nodeSet.has(target)) { nodes.push({id: target, type: 'tgt'}); nodeSet.add(target); }
                links.push({source: source, target: target});
            }
        });

        this.simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(180))
            .force("charge", d3.forceManyBody().strength(-400))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = g.append("g").selectAll("line").data(links).enter().append("line")
            .attr("stroke", "#cbd5e1").attr("stroke-width", 1);

        const nodeGroup = g.append("g").selectAll("g").data(nodes).enter().append("g");

        nodeGroup.append("circle")
            .attr("r", 10)
            .attr("fill", d => d.type === 'src' ? '#38bdf8' : '#0f172a');

        nodeGroup.append("text")
            .text(d => d.id)
            .attr("x", 14).attr("y", 4)
            .style("font-size", "11px").style("font-weight", "600").style("fill", "#334155");

        this.simulation.on("tick", () => {
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
        });
    }
};
