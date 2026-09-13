const Web3 = require('web3');
const fs = require('fs');

async function addForkEvent(blockchainAddress, portNumber, contractAddress, dataFilePath) {
    try {
        const web3 = new Web3(blockchainAddress);
        
        const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/storeforkevent.abi'));

        const contract = new web3.eth.Contract(contractAbi, contractAddress);
        
        const accounts = await web3.eth.getAccounts();
        web3.eth.personal.unlockAccount(accounts[0], "1234567890", 6000);
        // console.log(accounts);

        console.log("Fetching Experimental Data JSON:");

        // Read the JSON file synchronously (you may want to use the asynchronous version in a real application)
        const rawData = fs.readFileSync(dataFilePath);
        const dataPointsList = JSON.parse(rawData);

        for (const dataPoint of dataPointsList) {
            // Destructure values from the data point object
            const { networkId, parentNetworkId, forkBlockNumber } = dataPoint;

            // Make the function call for each data point
            await contract.methods.addForkDetail(networkId, portNumber, parentNetworkId, forkBlockNumber).send({ from: accounts[0] });
            console.log("Fork event added from forkdata.json");

            // console.log(`Fork point added: ${_networkId}, ${_portNumber}`);
        }

    } catch (error) {
        console.error("Error interacting with the contract:", error);
    }
}

// const blockchainAddress = 'http://localhost:8545';
// const contractAddress = '0x76428ba0Fb2e0977567795ACCeE0c23bf339d024'; // Contract Address for Blockchain 1


const deployedContractsFile = './smart-contract/src/scripts/repoContractInfo.json';
const jsonData = fs.readFileSync(deployedContractsFile);
const contractsInfo = JSON.parse(jsonData);

for (const contractInfo of contractsInfo) {
    // Destructure values from the contractInfo object
    const { web3Provider, contractAddress } = contractInfo;
    console.log(web3Provider + ' : '+ contractAddress);

    addForkEvent(web3Provider, 8545, contractAddress, './smart-contract/src/scripts/forkdata.json');
}





