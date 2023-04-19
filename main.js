var edgesFilePath = 'data/edges.csv';
var nodesFilePath = 'data/nodes.csv';

// SVG Dimensions
var width = 1080;
var height = 720;
var margins = { left: 50, right: 50, top: 50, bottom: 50 };
var networkGraphWidth = width - margins.left - margins.right;
var networkGraphHeight = height - margins.top - margins.bottom;
var radiusScale = d3.scaleLinear().range([5, 25]);
const colors = { 'SELECTED': '#E0538F', 'DEFAULT': '#2E64A2', 'EXPANDED': '#95D134'};
var nodes, edges, allNodesMap, artistEdges;
var sliderValue;
var graphData, graph, selectedArtist, graphDataMap, recommendationsDiv;
var recommendations = [];
var expandedArtists = [];
var force;

const slider = document.getElementById("similar_count_slider");

let tip = d3.tip().attr('class', 'd3-tip').attr("id", "tooltip");

const search = document.getElementById("search");

Promise.all([
    d3.dsv(",", edgesFilePath, function (edge) {
        return {
            source: edge.source_artist_id,
            target: edge.target_artist_id,
            priority: parseInt(edge.priority)
        };
    }),
    d3.dsv(",", nodesFilePath, (node) => {
        return {
            artist_id: node.artist_id,
            artist_name: node.artist_name,
            avg_duration: parseFloat(node.avg_duration),
            avg_familiarity: parseFloat(node.avg_familiarity),
            avg_hotness: parseFloat(node.avg_hotttnesss),
            total_tracks: parseInt(node.total_tracks)
        };
    })
]).then(allData => {
    edges = allData[0]; // all edges data from csv file
    nodes = allData[1]; // all node data from the csv file
    let minTracks = maxTracks = nodes[0]['total_tracks'];
    allNodesMap = nodes.reduce((obj, item, idx) => {
        item['index'] = idx;
        item.children = null;
        obj[item['artist_id']] = item;
        minTracks = Math.min(minTracks, item['total_tracks']);
        maxTracks = Math.max(maxTracks, item['total_tracks']);
        return obj;
    }, {}); // map for quick lookup of nodes by id

    radiusScale.domain([minTracks, maxTracks]);

    var svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

    graph = svg.append("g")
        .attr("width", networkGraphWidth)
        .attr("height", networkGraphHeight)
        .attr("transform", "translate( " + margins.left + ", " + margins.top + ")");

    recommendationsDiv = d3.select("body")
                           .append("div")
                           .attr("id", "recommendations-div")
    // Show initial network of artist based on selected artist (How many neighbors to show in the beginning?)
    selectedArtist = nodes[0];
    sliderValue = 5;

    fetchGraphData(selectedArtist);
    graphDataMap = buildGraphDataMap({});
    drawGraph();
    displayRecommendations();

    // List of artists to display
    var selectTag = d3.select("select");

    var options = selectTag.selectAll('option')
        .data(nodes.slice(0, 10000));

    options.enter()
        .append('option')
        .attr('value', function (d) {
            return d.artist_name;
        })
        .attr('id', function (d) {
            return d.artist_id;
        })
        .text(function (d) {
            return d.artist_name
        });

    search.addEventListener("click", function () {
        var e = document.getElementById("artists")
        var text = e.options[e.selectedIndex]
        selectedArtist = allNodesMap[text.id]
        recommendations = [];
        clearGraph();
        fetchGraphData(selectedArtist);
        graphDataMap = buildGraphDataMap({});
        drawGraph();
    })

    // Display initial nodes of top artists to select from

    var topDiv = d3.select("#top_artists");
    var topArtistList = nodes.sort((a, b) => b.avg_familiarity - a.avg_familiarity);

    var disc = topDiv
        .selectAll(".disc")
        .data(topArtistList.slice(0, 9))
        .enter()
        .append("button")
        .style("padding", "5px")
        .style("margin", "5px")
        .attr("id", (d) => d.artist_id)
        .attr("class", "disc")
        .on("click", function (d) {
            selectedArtist = allNodesMap[d.artist_id]
            recommendations = [];
            clearGraph();
            fetchGraphData(selectedArtist);
            graphDataMap = buildGraphDataMap({});
            drawGraph();
            displayRecommendations();
        });

    disc.append("text")
        .attr("stroke", "black")
        .attr("font-size", "11px")
        .attr("text-anchor", "middle")
        .text(function (d) {
            return d['artist_name'];
        });

    //   Slider 
    slider.addEventListener("input", function () {
        sliderValue = this.value;
        recommendations = [];
        clearGraph();
        fetchGraphData(selectedArtist);
        graphDataMap = buildGraphDataMap({});
        drawGraph();
        displayRecommendations();
    });


    // Dynamic color of nodes (genre/pin?)

    // Dynamic color and thickness of edges (based on collaboration?)

    // Any other styling for selected node

    // tooltip for nodes
    tip.html(function (d) {
        return getTooltipStats(d);
    });
    graph.call(tip);


}).catch(error => {
    console.log(error)
});

/**
 * Build a map of all current nodes in the network
 * The id of the nodes are the keys in the map
 * The node objects are the values
 * @param currentMap existing map to add the nodes to
 */
function buildGraphDataMap(currentMap) {
    graphData.forEach(node => {
        currentMap[node['artist_id']] = node;
    });
    return currentMap;
}


/**
 * Function to get nodes and edges in the form required for force simulation
 * @param {*} selectedArtist node that was selected
 */
function fetchGraphData(selectedArtist) {
    selectedArtist.children = [];
    graphData = [selectedArtist];
    artistEdges = getArtistNetwork(selectedArtist['artist_id'], sliderValue);
    artistEdges.forEach(edge => {
        var target = allNodesMap[edge['target']];
        graphData.push(target);
        selectedArtist.children.push(target);
        recommendations.push(target);
    });
}

/**
 * Function to get the data to show in the tooltip
 * @param {*} hoveredNode node which is currently hovered
 * @returns 
 */
function getTooltipStats(hoveredNode) {
    return "Artist Name: " + hoveredNode['artist_name'] +
        "<br> Average Duration: " + parseFloat(hoveredNode['avg_duration']).toFixed(2) +
        "<br> Average Hotness: " + parseFloat(hoveredNode['avg_hotness']).toFixed(2) +
        "<br> Average Familiarity: " + parseFloat(hoveredNode['avg_familiarity']).toFixed(2) +
        "<br> Total Tracks: " + hoveredNode['total_tracks'];
}

/**
 * To get the similar artist network from list of edges
 * @param artist_id: id of the artist to find the network for
 * @param count: number of similar artists to return sorted by priority
 */
function getArtistNetwork(artist_id, count = 20) {
    let filtered = edges.filter(edge => edge['source'] === artist_id);

    //create a deep copy of the edges because forceSimulation modifies these edges
    let neighbors = JSON.parse(JSON.stringify(filtered))
    .sort((edge1, edge2) => edge1['priority'] - edge2['priority'])
    .slice(0, count);
    return neighbors;
}

/**
 * Handle the tick event for force simulation
 */
function tick() {
    path.attr("d", function (d) {
        var dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            dr = Math.sqrt(dx * dx + dy * dy);
        var test = "M" +
            d.source.x + "," +
            d.source.y + "A" +
            dr + "," + dr + " 0 0,1 " +
            d.target.x + "," +
            d.target.y;
        return test;
    });

    node.attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
    });
}


/**
 * Clear the network by removing all children elements
 * @param graph group node under SVG
 */
function clearGraph() {
    graph.selectAll("*").remove();
}

/**
 * Function to plot the nodes, add force simulation, path, etc
 */
function drawGraph() {


    // Set the colors for the links and circles for the top nodes
  var topLinkColor = "yellow";
  var topCircleColor = "orange";


    if (force != null)
        force.stop();
    force = d3.forceSimulation()
        .nodes(d3.values(graphDataMap))
        .force("link", d3.forceLink(artistEdges).id(d => d['artist_id']).distance(150).strength(0.1))
        .force('center', d3.forceCenter(networkGraphWidth / 2, networkGraphHeight / 2))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .force("charge", d3.forceManyBody().strength(-700))
        .alphaTarget(0.1)
        .on("tick", tick);
/*  path = graph.append("g")
        .selectAll("path")
        .data(artistEdges)
        .enter()
        .append("path") */
        
        var nodes = force.nodes();
        var topNodes = nodes.sort((a, b) => b.total_tracks - a.total_tracks).slice(0, 5);


    path = graph.append("g")
        .selectAll("path")
        .data(artistEdges)
        .enter()
        .append("path")
        .attr("class", (d) => {
            if (topNodes.includes(d.source) && topNodes.includes(d.target)) {
                  return "top-link"; // add a class for top nodes
              } else {
                  return "default-link"; // add a class for all other nodes
              }
          })
          .attr("stroke-width", (d) => {
              if (topNodes.includes(d.source) && topNodes.includes(d.target)) {
                  return 4; // set a larger stroke width for paths connecting two top nodes
              } else {
                  return 2; // set the default stroke width for all other paths
              }
          });

    node = graph.selectAll(".node")
        .data(force.nodes())
        .enter().append("g")
        .attr("class", "node")
        .on("dblclick", update)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide);
 /*  node.append("circle")
        .attr("id", function (d) {
            return d.id;
        })
        .attr("r", function (d) {
            return radiusScale(d['total_tracks']);
        })
        .attr("fill", (d) => {
            if (d['artist_id'] == selectedArtist['artist_id']) return colors.SELECTED;
            else if (d['children'] != null) return colors.EXPANDED;
            return colors.DEFAULT;
        }) */
    nnode.append("circle")
    .attr("id", function(d) {
      return d.id;
    })
    .attr("r", function(d) {
      return radiusScale(d.total_tracks);
    })
    .attr("fill", (d) => {
      if (topNodes.includes(d)) {
        return topCircleColor;
      } else if (d['artist_id'] == selectedArtist['artist_id']) {
        return colors.SELECTED;
      } else if (d['children'] != null) {
        return colors.EXPANDED;
      } else {
        return colors.DEFAULT;
      }
    });


    node.append("text")
        .attr("stroke", "black")
        .attr("font-size", "12px")
        .attr("x", 10)
        .attr("y", -5)
        .text(function (d) {
            return (d.artist_name);
        });

    force.alpha(0.1).restart()
}

/**
 * Function to display recommendations based on
 * selected and expanded nodes.
 */
function displayRecommendations(){
    const topRecommendations = {};
    for (const artist of recommendations) {
        if(artist != selectedArtist && expandedArtists.indexOf(artist) == -1){
            artistName = artist["artist_name"];
            topRecommendations[artistName] = topRecommendations[artistName] ? topRecommendations[artistName] + 1 : 1;
        }
    }
    // Sort to get top 5 recommendations
    var items = Object.keys(topRecommendations).map(function(key) {
        return [key, topRecommendations[key]];
    });
    items.sort(function(first, second) {
        return second[1] - first[1];
    });
    recommendationsToDisplay = items.slice(0, 5);
    console.log(recommendationsToDisplay);
    // TO DO: improve the display of 'recommendationsToDisplay' in UI
    var recommendationsDiv = d3.select("#recommendations-div")
    recommendationsDiv.selectAll("*").remove();
    recommendationsDiv.append("h3")
                      .text("Top-5 Artist Recommendations");
    recommendationsDiv.append("table")
                      .selectAll("tr")
                      .data(recommendationsToDisplay)
                      .enter()
                      .append("tr")
                      .append("td")
                      .text(function(d){ return d[0]; });
    console.log("out")
}

/**
 * Function to handle double click event of a node
 * @param d node that was clicked
 */
function update(d) {
    if (d.children != null) {
        var idx = expandedArtists.indexOf(d);
        if (idx !== -1) {
            expandedArtists.splice(idx, 1);
        }
        d.children.forEach(child => {
            var index = recommendations.indexOf(child);
            if (index !== -1) {
                recommendations.splice(index, 1);
            }
        });
        let childrenToDelete = d.children.map(child => child['artist_id']);
        artistEdges = artistEdges.filter(edge => {
            return !(edge['source']['artist_id'] == d['artist_id'] && childrenToDelete.includes(edge['target']['artist_id']))
        });
        var edgeTargets = artistEdges.map(edge => edge['target']['artist_id']);
        graphData = graphData.filter(node => {
            let key = node['artist_id'];
            return edgeTargets.includes(key) || key == selectedArtist['artist_id']
        });
        graphDataMap = buildGraphDataMap({});
        d.children = null;
        clearGraph();
        drawGraph();
        displayRecommendations();
    }
    else {
        // get data of similar artists
        expandedArtists.push(d);
        let newArtistEdges = getArtistNetwork(d['artist_id'], sliderValue);
        d.children = [];
        newArtistEdges.forEach(edge => {
            var target = allNodesMap[edge['target']];
            if (graphData.filter(node => node['artist_id'] === target['artist_id']).length == 0) {
                graphData.push(target);
            }
            d.children.push(target);
            recommendations.push(target);
        });
        artistEdges = artistEdges.concat(newArtistEdges);
        graphDataMap = buildGraphDataMap(graphDataMap);
        clearGraph();
        drawGraph();
        displayRecommendations();
    }
}
