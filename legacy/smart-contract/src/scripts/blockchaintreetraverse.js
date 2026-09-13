function dfs(graph, startNode, targetData, visited = new Set()) {
    if (!graph[startNode]) {
        return null; // Invalid start node
    }

    if (visited.has(startNode)) {
        return null; // Already visited this node
    }

    visited.add(startNode);

    for (const block of graph[startNode]) {
        const data = block.data;
        if (data === targetData) {
            return block; // Found the block with the target data
        }

        // Recursively search in child nodes
        const result = dfs(graph, data, targetData, visited);
        if (result) {
            return result; // Propagate the result up the call stack
        }
    }

    return null; // Target data not found in this branch
}

function getDataByNetworkId(networkId) {
    const result = [];

    for (const networkData of chainDataGraph) {
        const filteredData = networkData.filter(obj => obj.networkId === networkId);
        result.push(...filteredData);
    }

    return result;
}

// Sample usage
const forkDetailsGraph = [
    { networkId: '33', parentNetworkId: '22', forkBlockNumber: '2' },
    { networkId: '998877', parentNetworkId: '22', forkBlockNumber: '1' },
    { networkId: '9999', parentNetworkId: '33', forkBlockNumber: '3' }
];

const chainDataGraph = [
    [
        { blockNumber: '0', networkId: '22', portNumber: '8541', data: '1' },
        { blockNumber: '1', networkId: '33', portNumber: '9876', data: '2' },
        { blockNumber: '2', networkId: '33', portNumber: '6543', data: '3' },
        { blockNumber: '3', networkId: '33', portNumber: '2109', data: '4' },
        { blockNumber: '4', networkId: '33', portNumber: '2468', data: '5' }
    ]
    
];

const graph = {}; 

for (const forkDetail of forkDetailsGraph) {
    const networkId = forkDetail.networkId;
    const parentNetworkId = forkDetail.parentNetworkId;
    const forkBlockNumber = forkDetail.forkBlockNumber;

    if (!graph[networkId]) {
        graph[networkId] = [];
    }

    if (!graph[parentNetworkId]) {
        graph[parentNetworkId] = [];
    }



    graph[parentNetworkId].push({ data: getDataByNetworkId(parentNetworkId), children: graph[networkId] });
}


const targetData = '4';
const startNode = '33'; 

console.log(graph);

const resultBlock = dfs(graph, startNode, targetData);
console.log("Result Block:", resultBlock);
