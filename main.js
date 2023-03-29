var edgesFilePath = 'data/edges.csv';
var nodesFilePath = 'data/nodes.csv';

// SVG Dimensions
var width = 1080;
var height = 720;
var margins = { left: 50, right: 50, top: 30, bottom: 30 };
var networkGraphWidth = width - margins.left - margins.right;
var networkGraphHeight = height - margins.top - margins.bottom;

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
                .attr("transform", "translate( " + margins.left + ", "+ margins.top + ")")

    // Display initial nodes of top artists to select from

    // Show initial network of artist based on selected artist (How many neighbors to show in the beginning?)
    var selectedArtist = nodes[0];

    var artistNetwork = getArtistNetwork(edges, selectedArtist['artist_id']); // edges of 20 similar artists for the selected artist
    console.log('selected artist is: ', selectedArtist);
    console.log('similar artists are: ', artistNetwork);

    selectedArtist.x = Math.random() * networkGraphWidth; 
    selectedArtist.y = Math.random() * networkGraphHeight; 
    let nodesToDisplay = [selectedArtist];
    artistNetwork.forEach(neighbor => {
        let newNode = allNodesMap[neighbor['target_artist_id']];
        newNode.x = Math.random() * networkGraphWidth; 
        newNode.y = Math.random() * networkGraphHeight; 
        nodesToDisplay.push(newNode);
    });
    console.log('all nodes in network: ', nodesToDisplay);
      

    var node = graph
                .selectAll(".node")
                .data(nodesToDisplay)
                .enter()
                .append("g")
                .attr("class", "node");

    var circles = node.append("circle")
                    .attr("cx", (d) => d.x)
                    .attr("cy", (d) => d.y)
                    .attr("r", 25)
                    .attr("fill", "#77a2c9");

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
    
    //Dynamic node size based on number of songs
    
    // Dynamic color of nodes (genre/pin?)

    // Dynamic color and thickness of edges (based on collaboration?)

    // Any other styling for selected node

}).catch(error => {
    
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
