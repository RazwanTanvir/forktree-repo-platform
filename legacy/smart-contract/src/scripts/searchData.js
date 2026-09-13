//work file

const fs = require('fs');
const Web3 = require('web3');

const deployedContractsFile = './smart-contract/src/scripts/contractInfo.json';
const jsonData = fs.readFileSync(deployedContractsFile);
const contractsInfo = JSON.parse(jsonData);

const blockchainInfo = './smart-contract/src/scripts/blockchaininfo.json';
const portData = fs.readFileSync(blockchainInfo);
const netwrokPortData = JSON.parse(portData);

fs.writeFileSync('./smart-contract/src/scripts/searchresult.txt', '');

async function searchTree(data) {
    try {
        const blockchainDataFile = './smart-contract/src/scripts/storage/chainTreeData.json';
        const forkDetailFile = './smart-contract/src/scripts/storage/forkDetail.json';

        const blockchainData = JSON.parse(fs.readFileSync(blockchainDataFile));
        const forkDetail = JSON.parse(fs.readFileSync(forkDetailFile));

        const adjacencyList = generateAdjacencyList(forkDetail);
        // console.log(adjacencyList);

        const root = '11102'; //root chain (has no parent)
        const destination = '-1'; //to search the whole network

        search_value = data.dataValue;

        const path = dfsPath(adjacencyList, root, destination, search_value);

        if (path) {
            // console.log('Path: ' + path);
            // console.log('DFS Path:', path.join(' -> '));
        } else {
            // console.log('No path found.');
        }
    } catch (error) {
        console.error("Error searching the tree:", error);
        return null;
    }
}

function generateAdjacencyList(data) {
    const adjacencyList = {};

    for (const entry of data) {
        const networkId = entry[0];
        const parentNetworkId = entry[2];

        if (!adjacencyList[networkId]) {
            adjacencyList[networkId] = [];
        }

        if (parentNetworkId !== null) {
            if (!adjacencyList[parentNetworkId]) {
                adjacencyList[parentNetworkId] = [];
            }
            adjacencyList[parentNetworkId].push(networkId);
        }
    }

    return adjacencyList;
}

async function searchDataInChain (blockchainAddress, contractAddress, search_value) {
    try {
        const web3 = new Web3(blockchainAddress);
        
        const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/BlockData.abi'));

        const contract = new web3.eth.Contract(contractAbi, contractAddress);
        
        return new Promise((resolve, reject) => {
            contract.methods.searchMatchingDataPointsBlockNumbers(search_value).call(function(err, res) {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });

    } catch (error) {
        console.error("Error fetching data", error);
        throw error;
    }
}

var resultSet = [] ;

async function dfsPath(adjacencyList, root, destination, search_value, visited = new Set(), path = []) {
    visited.add(root);
    path.push(root);

    if (root === destination) {
        return path;
    }
    var curr_port ;
    var found = false;

    for (const child of adjacencyList[root] || []) {
        if (!visited.has(child)) {
            // console.log('Child node: ' + child);

            //search child netwpok data
            for (const networkPort of netwrokPortData) {
                const {_networkId, _portNumber} = networkPort;
                // console.log(_networkId + '-' + _portNumber);
                if (_networkId == parseInt(child)) {
                    curr_port = _portNumber;
                }
            }

            try {
                
                const address = 'http://localhost:'+curr_port;
                

                for (const contractInfo of contractsInfo) {
                    const { web3Provider, contractAddress } = contractInfo;
                    // console.log('addr: '+web3Provider + ' | Child: ' + address );

                    if (web3Provider == address) {
                        
                        const curr_contractAddress = contractAddress;
                        // console.log('Network: ' + web3Provider + ' - Contract: ' + contractAddress);
                        const foundData = await searchDataInChain(web3Provider, curr_contractAddress, parseInt(search_value));
                        
                        if (foundData.length > 0) {
                            fs.appendFileSync('./smart-contract/src/scripts/searchresult.txt', 'Network: ' + web3Provider + '| Block: ' +  foundData + '| Value: ' + search_value +'\n', 'utf-8');
                            console.log('Network: ' + web3Provider + '| Block: ' +  foundData + '| Value: ' + search_value);
                            found = true;
                        }
                    }
                }
                
                
            } catch (error) {
                console.error('Error fetching data:', error);
            }
            //end search
            const result = await dfsPath(adjacencyList, child, destination, search_value, visited, path);
            if (result) {
                return result;
            }
        }
    }

    path.pop();
    return null;
}


// Example usage:
const searchData = {
    networkId: '11104',
    portNumber: '8548',
    blockNumber: '2',
    dataValue: '99'
};

const result = searchTree(searchData);

// searchDataInChain('http://localhost:8548', '0xa5C46F930ff283539C479E34e9B1999C27F262e5', '43');
// if (result) {
//     console.log('Matching data found:', result);
// } else {
//     console.log('No matching data found.');
// }
