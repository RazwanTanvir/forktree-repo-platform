// // const Web3 = require('web3');
// // const fs = require('fs');

// // var forkDetailList = [];
// // var chainDataList = [];

// // async function getForkDetails(blockchainAddress, contractAddress) {
// //     //getAllForkDetails
// //     //get chain data from root (networkid 22) and child (networkid 33, 998877)blockchains
// //     //
// //     try {
// //         const web3 = new Web3(blockchainAddress);
        
// //         const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/storeforkevent.abi'));

// //         const contract = new web3.eth.Contract(contractAbi, contractAddress);
        
// //         forkDetailList = await contract.methods.getAllForkDetails().call();
// //         // return forkDetailList;
// //         // console.log(forkDetailList);

// //     } catch (error) {
// //         console.error("Error fetching data", error);
// //     }
// // }


// // async function getChainData(blockchainAddress, contractAddress) {
// //     try {
// //         const web3 = new Web3(blockchainAddress);
        
// //         const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/BlockData.abi'));

// //         const contract = new web3.eth.Contract(contractAbi, contractAddress);
        
// //         var chainData = await contract.methods.getAllDataPoints().call();
// //         chainDataList.push(chainData);
// //         console.log(chainDataList);
// //         console.log("-------------------------------------------");
// //     } catch (error) {
// //         console.error("Error fetching data", error);
// //     }
// // }



// // const blockchainAddress1 = 'http://localhost:8545';
// // const contractAddress1 = '0x359d49F7090E6e3E6e119e1CbAcFDdc21209766f'; // Contract Address for Blockchain 1

// // getForkDetails(blockchainAddress1, contractAddress1);


// // const deployedContractsFile = './smart-contract/src/scripts/contractInfo.json';
// // const jsonData = fs.readFileSync(deployedContractsFile);
// // const contractsInfo = JSON.parse(jsonData);

// // for (const contractInfo of contractsInfo) {
// //     const { web3Provider, contractAddress } = contractInfo;
// //     const blockchainAddress1 = web3Provider;
// //     const contractAddress1 = contractAddress;
// //     // console.log(blockchainAddress1 + '-' + contractAddress);
// //     getChainData(blockchainAddress1, contractAddress1);
// // }

// // console.log(forkDetailList);
// // console.log(chainDataList);

// const Web3 = require('web3');
// const fs = require('fs');

// var forkDetailList = [];
// const chainDataList = new Map();

// async function getForkDetails(blockchainAddress, contractAddress) {
//     try {
//         const web3 = new Web3(blockchainAddress);
//         const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/storeforkevent.abi'));
//         const contract = new web3.eth.Contract(contractAbi, contractAddress);
//         // console.log(contractAddress);
//         return await contract.methods.getAllForkDetails().call();
//     } catch (error) {
//         console.error("Error fetching fork details", error);
//         throw error;
//     }
// }

// async function getChildren(blockchainAddress, contractAddress, networkId) {
//     try {
//         const web3 = new Web3(blockchainAddress);
//         const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/storeforkevent.abi'));
//         const contract = new web3.eth.Contract(contractAbi, contractAddress);
//         // console.log(contractAddress);
//         return await contract.methods.getAdjacencyList(networkId).call();
//     } catch (error) {
//         console.error("Error fetching children", error);
//         throw error;
//     }
// }

// async function getChainData(blockchainAddress, contractAddress) {
//     try {
//         const web3 = new Web3(blockchainAddress);
//         const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/BlockData.abi'));
//         const contract = new web3.eth.Contract(contractAbi, contractAddress);
//         // console.log('getChainData-' + contractAddress);
//         return await contract.methods.getAllDataPoints().call();
//     } catch (error) {
//         console.error("Error fetching chain data", error);
//         throw error;
//     }
// }

// async function fetchData() {
//     const blockchainAddress1 = 'http://localhost:8545';
//     const contractAddress1 = '0x359d49F7090E6e3E6e119e1CbAcFDdc21209766f';

//     try {
//         forkDetailList = await getForkDetails(blockchainAddress1, contractAddress1);

//         const deployedContractsFile = './smart-contract/src/scripts/contractInfo.json';
//         const jsonData = fs.readFileSync(deployedContractsFile);
//         const contractsInfo = JSON.parse(jsonData);

//         const promises = contractsInfo.map(async (contractInfo) => {
//             // console.log(contractInfo);
//             const { web3Provider, contractAddress } = contractInfo;
//             const blockchainAddress2 = web3Provider;
//             const contractAddress2 = contractAddress;
//             portNumber = blockchainAddress2.substr(blockchainAddress2.length - 4);
//             // console.log(portNumber);
//             const chainData = await getChainData(blockchainAddress2, contractAddress2);
//             chainDataList.set(portNumber, chainData);
//             // console.log(chainDataList)
//         });

//         await Promise.all(promises);
        
//         //add separate data in chains then test
//         console.log(chainDataList.get('8547'));

//         // const rootChainId = '22';
//         // const processingChain = await getChildren(blockchainAddress1, contractAddress1, rootChainId);
//         // currentChain = processingChain[0];
//         // var i = 0;
//         // while (currentChain != '' && i != processingChain.length) {
//         //     currentChain = processingChain[i];
//         //     if (processingChain != '') {
//         //         //process here
//         //         console.log('Processing-' + currentChain);


//         //         //end processing
//         //         processingChain[0] = '';
//         //         i++;
//         //     }
//         // }
//         // console.log('Child of root-' + processingChain);

//     //    for (const fork of forkDetailList) {
//     //     console.log(fork.networkId);
//     //    }



//     //    for (const chainData of chainDataList) {
//     //     console.log(chainData);
//     //     console.log("-----------------------------------------");
//     //    }

//         // console.log("Fork Details:", forkDetailList);
//         // console.log("Chain Data List:", chainDataList);

//     } catch (error) {
//         console.error("Error fetching data:", error);
//     }
// }

// fetchData();

