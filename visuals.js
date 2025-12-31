/**
 * BRANDORB VISUALS ENGINE
 * Handles Route Maps (Leaflet) and Cluster Graphs (D3.js)
 */

window.populateFilters = function() {
    if (!window.rawData || window.rawData.length < 1) return;
    const headers = window.rawData[0];
    const data = window.rawData.slice(1);

    const fill = (id, headerName) => {
        const i = headers.indexOf(headerName);
        const el = document.getElementById(id);
        if (i === -1 || !el) return;
        
        // Get unique values, remove empty ones, and sort
        const vals = [...new Set(data.map(r => r[i]))].filter(v => v && v.trim() !== "").sort();
        el.innerHTML = `<option value="All">All ${headerName}s</option>` + 
                       vals.map(v => `<option value="${v}">${v}</option>`).join('');
    };

    fill('orig-filter', 'Origin Country');
    fill('dest-filter', 'Destination Country');
};

window.recomputeViz = function() {
    if (!window.rawData) return;
    
    const search = document.getElementById('ent-search').value.toLowerCase();
    const origF = document.getElementById('orig-filter').value;
    const destF = document.getElementById('dest-filter').value;
    const headers = window.rawData[0];
    const idx = (n) => headers.indexOf(n);

    // Filter logic
    const filtered = window.rawData.slice(1).filter(r => {
        const exporter = (r[idx("Exporter")] || "").toLowerCase();
        const importer = (r[idx("Importer")] || "").toLowerCase();
        const product = (r[idx("PRODUCT")] || "").toLowerCase();
        
        const tMatch = exporter.includes(search) || importer.includes(search) || product.includes(search);
        const oMatch = origF === 'All' || r[idx("Origin Country")] === origF;
        const dMatch = destF === 'All' || r[idx("Destination Country")] === destF;
        
        return tMatch && oMatch && dMatch;
    });

    const frame = document.getElementById('map-frame');
    frame.innerHTML = ""; // Clear existing visualization
    
    if(window.LMap) { 
        window.LMap.remove(); 
        window.LMap = null; 
    }

    if(tab === 'MAP') {
        window.drawMap(filtered, idx);
    } else {
        window.drawCluster(filtered, idx, search);
    }
};

window.drawMap = function(data, idx) {
    window.LMap = L.map('map-frame').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB'
    }).addTo(window.LMap);

    data.forEach(r => {
        const lat1 = parseFloat(r[idx("Origin latitude")]);
        const lng1 = parseFloat(r[idx("Origin longitude")]);
        const lat2 = parseFloat(r[idx("Destination latitude")]);
        const lng2 = parseFloat(r[idx("Destination longitude")]);

        if(!isNaN(lat1) && !isNaN(lat2)) {
            // Create the moving ant-path
            const path = L.polyline.antPath([[lat1, lng1], [lat2, lng2]], {
                color: r[idx("COLOR")] || '#38bdf8',
                weight: 3,
                paused: false,
                reverse: false,
                delay: 1000,
                dashArray: [10, 20]
            }).addTo(window.LMap);

            // Detailed Popup
            path.bindPopup(`
                <div style="color:#1e293b; font-family:'Inter', sans-serif;">
                    <strong style="color:#0ea5e9">${r[idx("Exporter")]}</strong> 
                    <i class="fas fa-arrow-right" style="font-size:10px; margin:0 5px;"></i> 
                    <strong style="color:#f43f5e">${r[idx("Importer")]}</strong>
                    <hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                    <div style="font-size:12px;">
                        <b>Product:</b> ${r[idx("PRODUCT")]}<br>
                        <b>Value:</b> $${r[idx("Value(USD)")]}<br>
                        <b>Quantity:</b> ${r[idx("Quantity")]}<br>
                        <b>Route:</b> ${r[idx("Origin Port")]} to ${r[idx("Destination Port")]}
                    </div>
                </div>
            `);
        }
    });
};

window.drawCluster = function(data, idx, searchTerm) {
    const frame = document.getElementById('map-frame');
    const width = frame.clientWidth;
    const height = frame.clientHeight;

    const svg = d3.select("#map-frame")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const container = svg.append("g");

    // Zoom Handling
    svg.call(d3.zoom().on("zoom", (event) => {
        container.attr("transform", event.transform);
    }));

    let nodes = [];
    let links = [];
    let nodeSet = new Set();

    data.forEach(r => {
        const exp = r[idx("Exporter")];
        const imp = r[idx("Importer")];
        
        if(!nodeSet.has(exp)) {
            nodes.push({ id: exp, type: 'exporter', country: r[idx("Origin Country")] });
            nodeSet.add(exp);
        }
        if(!nodeSet.has(imp)) {
            nodes.push({ id: imp, type: 'importer', country: r[idx("Destination Country")] });
            nodeSet.add(imp);
        }
        links.push({ source: exp, target: imp, product: r[idx("PRODUCT")] });
    });

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(180))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = container.append("g")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", "#475569")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 1.5);

    const node = container.append("g")
        .selectAll("g")
        .data(nodes)
        .enter().append("g")
        .call(d3.drag()
            .on("start", (e, d) => {
                if (!e.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on("drag", (e, d) => {
                d.fx = e.x; d.fy = e.y;
            })
            .on("end", (e, d) => {
                if (!e.active) simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            }));

    node.append("circle")
        .attr("r", d => d.type === 'exporter' ? 14 : 10)
        .attr("fill", d => d.type === 'exporter' ? '#0ea5e9' : '#f43f5e')
        .attr("stroke", d => (searchTerm && d.id.toLowerCase().includes(searchTerm)) ? "#fff" : "#1e293b")
        .attr("stroke-width", d => (searchTerm && d.id.toLowerCase().includes(searchTerm)) ? 4 : 2);

    node.append("text")
        .text(d => d.id)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("pointer-events", "none");

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
};
