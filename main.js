var edgesFilePath = 'data/edges.csv';
var nodesFilePath = 'data/nodes.csv';

// SVG Dimensions
var width = 1080;
var height = 720;
var margins = { left: 50, right: 50, top: 50, bottom: 50 };
var networkGraphWidth = width - margins.left - margins.right;
var networkGraphHeight = height - margins.top - margins.bottom;
var radiusScale = d3.scaleLinear().range([5, 25]);
const colors = {'SELECTED': '#E0538F', 'DEFAULT' : '#2E64A2' };

const slider = document.getElementById("similar_count_slider");

Promise.all([
    d3.dsv(",", edgesFilePath, function(edge) {
        return {
            source_artist_id: edge.source_artist_id,
            target_artist_id: edge.target_artist_id,
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
    let edges = allData[0]; // all edges data from csv file
    let nodes = allData[1]; // all node data from the csv file

    let allNodesMap = nodes.reduce((obj, item) => { 
        obj[item['artist_id']] = item;
        return obj;
    }, {}); // map for quick lookup of nodes by id

    var svg = d3.select("body").append("svg")
                .attr("width", width)
                .attr("height", height);

    var graph = svg.append("g")
                .attr("width", width - margins.left - margins.right)
                .attr("height", height - margins.top - margins.bottom)
                .attr("transform", "translate( " + margins.left + ", "+ margins.top + ")");


    // Display initial nodes of top artists to select from

    // Show initial network of artist based on selected artist (How many neighbors to show in the beginning?)
    var selectedArtist = nodes[0];

    
    drawNetworkGraph(graph, edges, allNodesMap, selectedArtist);

    slider.addEventListener("input", function() {
        clearGraph(graph);
        drawNetworkGraph(graph, edges, allNodesMap, selectedArtist, this.value);
    });
    // Dynamic color of nodes (genre/pin?)

    // Dynamic color and thickness of edges (based on collaboration?)

    // Any other styling for selected node

}).catch(error => {
    console.log(error)
});

/**
 * To get the similar artist network from list of edges
 * @param edges: array of all edges
 * @param artist_id: id of the artist to find the network for
 * @param count: number of similar artists to return sorted by priority
 */
function getArtistNetwork(edges, artist_id, count = 20) {
    return edges.filter(edge => edge['source_artist_id'] === artist_id)
            .sort((edge1, edge2) => edge1['priority'] - edge2['priority'])
            .slice(0, count);
}

/**
 * Clear the network by removing all children elements
 * @param graph group node under SVG
 */
function clearGraph(graph) {
    graph.selectAll("*").remove();
}

/**
 * Create the network graph based on selected artist
 * @param {*} graph group node under SVG
 * @param {*} edges all edge information read from CSV file
 * @param {*} allNodesMap map containing information of all nodes read from CSV file
 * @param {*} selectedArtist selected artist
 * @param {*} numberNeighbors number of similar artists to show
 */
function drawNetworkGraph(graph, edges, allNodesMap, selectedArtist, numberNeighbors = 5) {
    let minTracks = maxTracks = selectedArtist['total_tracks'];
    var artistNetwork = getArtistNetwork(edges, selectedArtist['artist_id'], numberNeighbors); 
    console.log('selected artist is: ', selectedArtist);
    console.log('similar artists are: ', artistNetwork);

    selectedArtist.x = Math.random() * networkGraphWidth; 
    selectedArtist.y = Math.random() * networkGraphHeight; 
    let nodesToDisplay = [selectedArtist];
    artistNetwork.forEach(neighbor => {
        let newNode = allNodesMap[neighbor['target_artist_id']];
        newNode.x = Math.random() * networkGraphWidth; 
        newNode.y = Math.random() * networkGraphHeight; 
        minTracks = Math.min(minTracks, newNode['total_tracks']);
        maxTracks = Math.max(maxTracks, newNode['total_tracks']);
        nodesToDisplay.push(newNode);
    });
    console.log('all nodes in network: ', nodesToDisplay);
    radiusScale.domain([minTracks, maxTracks]);


    var node = graph
                .selectAll(".node")
                .data(nodesToDisplay)
                .enter()
                .append("g")
                .attr("class", "node");

    //Dynamic node size based on number of songs
    node.append("circle")
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("r", (d) => radiusScale(d['total_tracks']))
        .attr("fill", (d) => {
            return (d['artist_id'] == selectedArtist['artist_id']) ? colors.SELECTED : colors.DEFAULT; 
        });

    node.append("text")
        .attr("stroke", "black")
        .attr("font-size", "15px")
        .attr("x", (d) => d.x )
        .attr("y", (d) => d.y - 30 )
        .attr("text-anchor", "middle")
        .text(function(d) {
            return d['artist_name'];
    });

    var path = graph
                .selectAll("path")
                .data(artistNetwork)
                .enter()
                .append("path");

    path.attr("d", function(d) {
        var source = allNodesMap[d['source_artist_id']];
        var target = allNodesMap[d['target_artist_id']];
        var line =  "M" + source.x + "," + source.y + "L" + target.x + "," + target.y;
        return line;
    });
}