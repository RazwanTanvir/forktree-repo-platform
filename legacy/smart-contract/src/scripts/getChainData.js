//working file

const Web3 = require('web3');
const fs = require('fs');

async function getChainData(blockchainAddress, contractAddress) {
    try {
        const web3 = new Web3(blockchainAddress);
        
        const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/BlockData.abi'));

        const contract = new web3.eth.Contract(contractAbi, contractAddress);
        
        return new Promise((resolve, reject) => {
            contract.methods.getAllDataPoints().call(function(err, res) {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });

    } catch (error) {
        console.error("Error fetching data", error);
        throw error; // Propagate the error to the caller
    }
}

const deployedContractsFile = './smart-contract/src/scripts/contractInfo.json';
const jsonData = fs.readFileSync(deployedContractsFile);
const contractsInfo = JSON.parse(jsonData);

const chainDataDictionary = {}; // Dictionary to store chain data

// Define an async function to use await
async function fetchData() {
    for (const contractInfo of contractsInfo) {
        const { web3Provider, contractAddress } = contractInfo;

        try {
            const chainData = await getChainData(web3Provider, contractAddress);
            chainDataDictionary[web3Provider] = chainData;

            console.log(`Data fetched for ${web3Provider}`);
        } catch (error) {
            console.error(`Error fetching data for ${web3Provider}:`, error);
        }
    }

    // Once all data is fetched, you can use chainDataDictionary as needed
    console.log('All chain data:', chainDataDictionary);
    const jsonString = JSON.stringify(chainDataDictionary, null, 2);
    fs.writeFileSync('./smart-contract/src/scripts/storage/chainTreeData.json', jsonString, 'utf-8');
}

// Call the fetchData function
fetchData();
