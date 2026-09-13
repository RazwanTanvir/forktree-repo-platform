//working file
const Web3 = require('web3');
const fs = require('fs');

async function addDataToBlockchain(blockchainAddress, contractAddress, dataFilePath) {
    try {
        const web3 = new Web3(blockchainAddress);
        
        const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/BlockData.abi'));

        const contract = new web3.eth.Contract(contractAbi, contractAddress);
        
        const accounts = await web3.eth.getAccounts();
        web3.eth.personal.unlockAccount(accounts[0], "1234567890", 6000);
        // console.log(accounts);

        console.log(`Fetching Experimental Data JSON from: ${dataFilePath}`);

        const rawData = fs.readFileSync(dataFilePath);
        const dataPointsList = JSON.parse(rawData);

        for (const dataPoint of dataPointsList) {
            const { _networkId, _portNumber, _data } = dataPoint;

            await contract.methods.addDataPoint(_networkId, _portNumber, _data).send({ from: accounts[0] });

            console.log(`Data point added: ${_networkId}, ${_portNumber}, ${_data}`);
        }

    } catch (error) {
        console.error("Error interacting with the contract:", error);
    }
}

const dataFilesPath = './smart-contract/src/scripts/config/dataFiles.json';

try {
    const dataFiles = JSON.parse(fs.readFileSync(dataFilesPath));

    const deployedContractsFile = './smart-contract/src/scripts/contractInfo.json';
    const jsonData = fs.readFileSync(deployedContractsFile);
    const contractsInfo = JSON.parse(jsonData);

    for (const contractInfo of contractsInfo) {
        const { web3Provider, contractAddress } = contractInfo;

        const dataFilePath = dataFiles[web3Provider];
        
        if (dataFilePath) {
            addDataToBlockchain(web3Provider, contractAddress, dataFilePath).then(
                console.log(`Data added to contract at ${contractAddress} using data file: ${dataFilePath}`)
            );
        } else {
            console.log(`Data file not found for web3Provider: ${web3Provider}`);
        }
    }
} catch (error) {
    console.error("Error reading dataFiles:", error);
}

