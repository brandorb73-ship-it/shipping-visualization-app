window.viz = {
    activeMap: null,

    init: async function(url, title) {
        document.getElementById('list-view').style.display = 'none';
        document.getElementById('viz-view').style.display = 'block';
        document.getElementById('viz-title').innerText = title;
        
        const container = document.getElementById('map-element');
        container.innerHTML = "";
        if(this.activeMap) { this.activeMap.remove(); this.activeMap = null; }

        const csvUrl = url.includes("google.com") ? url.replace(/\/edit.*$/, '/export?format=csv') : url;
        const res = await fetch(csvUrl);
        const text = await res.text();
        const data = text.split('\n').slice(1).map(line => line.split(','));

        if(window.ui.currentTab === "MAP") this.drawMap(data);
        else this.drawCluster(data);
    },

    drawMap: function(data) {
        this.activeMap = L.map('map-element').setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(this.activeMap);

        data.forEach(r => {
            const oLat = parseFloat(r[2]), oLng = parseFloat(r[3]), dLat = parseFloat(r[4]), dLng = parseFloat(r[5]);
            if(!isNaN(oLat)) {
                // Shipment Line
                L.polyline([[oLat, oLng], [dLat, dLng]], {color: '#38bdf8', weight: 2}).addTo(this.activeMap);
                // Destination Point with Label
                L.circleMarker([dLat, dLng], {radius: 5, color: '#0f172a', fillOpacity: 1}).addTo(this.activeMap)
                 .bindPopup(`<b>Shipment:</b> ${r[0]}<br><b>Recipient:</b> ${r[1]}`);
            }
        });
    },

    drawCluster: function(data) {
        const container = document.getElementById('map-element');
        const width = container.clientWidth, height = 500;
        const svg = d3.select("#map-element").append("svg").attr("width", width).attr("height", height);
        
        let nodes = [], links = [], nodeSet = new Set();
        data.forEach(r => {
            if(r[0] && r[1]) {
                if(!nodeSet.has(r[0])) { nodes.push({id: r[0]}); nodeSet.add(r[0]); }
                if(!nodeSet.has(r[1])) { nodes.push({id: r[1]}); nodeSet.add(r[1]); }
                links.push({source: r[0], target: r[1]});
            }
        });

        const sim = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = svg.append("g").selectAll("line").data(links).enter().append("line").attr("stroke", "#999");
        const node = svg.append("g").selectAll("g").data(nodes).enter().append("g");

        node.append("circle").attr("r", 8).attr("fill", "#38bdf8");
        node.append("text").text(d => d.id).attr("x", 12).attr("y", 4).style("font-size", "12px");

        sim.on("tick", () => {
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });
    }
};
