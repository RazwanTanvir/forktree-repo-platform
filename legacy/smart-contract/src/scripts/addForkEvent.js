// const Web3 = require('web3');
// const fs = require('fs');

// async function addForkEvent(blockchainAddress, contractAddress, dataFilePath) {
//     try {
//         const web3 = new Web3(blockchainAddress);
        
//         const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/storeforkevent.abi'));

//         const contract = new web3.eth.Contract(contractAbi, contractAddress);
        
//         const accounts = await web3.eth.getAccounts();
//         web3.eth.personal.unlockAccount(accounts[0], "1234567890", 6000);
//         console.log(accounts);

//         console.log("Fetching Experimental Data JSON:");

//         // Read the JSON file synchronously (you may want to use the asynchronous version in a real application)
//         const rawData = fs.readFileSync(dataFilePath);
//         const dataPointsList = JSON.parse(rawData);

//         for (const dataPoint of dataPointsList) {
//             // Destructure values from the data point object
//             const { _networkId, _portNumber, _data } = dataPoint;

//             // Make the function call for each data point
//             await contract.methods.addDataPoint(_networkId, _portNumber, _data).send({ from: accounts[0] });

//             console.log(`Data point added: ${_networkId}, ${_portNumber}, ${_data}`);
//         }

//         const dataAt = 2;
//         contract.methods.getDataPointByIndex(dataAt).call(function(err, res){
//             console.log("Data Point At BlockNumber- " + dataAt + ":");
//             console.log(res);
//         });

//     } catch (error) {
//         console.error("Error interacting with the contract:", error);
//     }
// }

// const blockchainAddress1 = 'http://localhost:8545';
// const contractAddress1 = '0xE5A371F1D8aA6cA501757A552D7B6C9F7d1C3090'; // Contract Address for Blockchain 1
// const dataFilePath1 = './src/scripts/dataPoints.json';

// // Interact with the first blockchain
// addForkEvent(blockchainAddress1, contractAddress1, dataFilePath1).then(
//     console.log(contractAddress1)
// );