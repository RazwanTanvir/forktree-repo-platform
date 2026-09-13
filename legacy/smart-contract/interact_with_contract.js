// interact_with_contract.js
const Web3 = require('web3');
const fs = require('fs');

metadata_blockchain_address = 'http://localhost:8545';
const web3 = new Web3(metadata_blockchain_address); // Replace with the address of your local Ethereum node

console.log("Connected to chain...");

// web3.eth.getAccounts()
// .then((accounts) => {
// // loop through the accounts and get their balances
//     accounts.forEach((account) => {
//         web3.eth.getBalance(account)
//         .then((balance) => {
//             console.log(`Account ${account} balance: ${web3.utils.fromWei(balance, 'ether')} ETH`);
//         })
//         .catch((error) => {
//             console.error('Error getting balance for account ${account}:', error);
//         });
//     });
//     })
//     .catch((error) => {
//     console.error('Error getting accounts:', error);
// });


// const abi = JSON.parse(fs.readFileSync('./build/AddRetrieveForks.abi'));
const abi = JSON.parse(fs.readFileSync('./build/MetadataBlockchain.abi'));

// const contractAddress = '0xb8170E43749E89822001F17fA360ccdFa11fd82c'; // Replace with the deployed contract address
const contractAddress = '0xFF68b5e65F9881AD8D8D56173b208E211173fB5D'; // Replace with the deployed contract address

//unlocking account
web3.eth.personal.unlockAccount("0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02", "1234567890", 6000);
web3.eth.personal.unlockAccount("0x15a1c9f7ae8f8f3176805316c2bacc99af3d6f5b", "1234567890", 6000);

async function interactWithContract() {
    try {
        const contract = new web3.eth.Contract(abi, contractAddress);

        // await contract.methods.addFork(1,8546,0,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        // await contract.methods.addFork(2,8546,0,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        // await contract.methods.addFork(3,8546,1,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        // await contract.methods.addFork(4,8546,3,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        // await contract.methods.addFork(5,8546,1,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        // await contract.methods.addFork(6,8546,5,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        // await contract.methods.addFork(7,8546,5,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        /* 
            Finding total forks registered in metadata blockchain
        */
       console.log("Total forks- ");
        await contract.methods.totalForks().call(function(err, res){
            console.log("Total forks in metadata blockchain: ");
            console.log(res);
        });

        /*
            Finding forkId stored in metadata blockchain from networkId. Returns a networkId (integer)
            Param: networkId (integer)
            Returns: networkId (integer)
        */
        contract.methods.findForkId(4).call(function(err, res){
            console.log("findForkId- ");
            console.log(res);
        });

        /*
            Getting detail information about a fork. 
            Param: forkId (integer)
            Returns: ForkData (struct)
        */
        contract.methods.getForkData(0).call(function(err, res){
            console.log("Fork Data- ");
            console.log(res);
        });


        /*
            Ideally finding the route of a blockchain from root chain.  
            Param: source netwrorkId (integer) & destination networkId (integer)
            Returns: A special string containing the path from source blockchain to destination blockchain
        */
       source = 0
       destination = 6
        await contract.methods.findPath(source, destination).call(function(err, res){

            stack = []
            for( i=0; i< res.length; i++){
                if (res[i+1] == '+') {
                    stack[res[i]] = 1;
                } if (res[i+1] == '-'){
                    stack[res[i]] = 0;
                }
            }

            result = []
            console.log("Path: ");
            for (var key in stack) {
                value = stack[key];
                if (value != 0) {
                    result.push(key);
                }
                
            }
            console.log(result);
        });

    } catch (error) {
        console.error("Error interacting with the contract:", error);
    }
}

// async function connectToBlockchain(network_id) {
//     try{
//         const contract = new web3.eth.Contract(abi, contractAddress);
        

//     } catch(error) {

//     }
// }

let portNumber = 0;

try {
    const contract = new web3.eth.Contract(abi, contractAddress);

    contract.methods.totalForks().call(function(err, res){
        console.log("Total forks: ");
        console.log(res);
    });

    contract.methods.getForkData(0).call(function(err, res){
        portNumber = res.parentPort;

        console.log(portNumber);

        let netStr = 'http://localhost:'.concat(portNumber);
        console.log(netStr);

        const chain2 = new Web3(netStr); 
        chain2.eth.getAccounts().then(console.log);
    });
} catch (error) {
    console.error("Error interacting with the contract:", error);
}



/*Function calls*/
  interactWithContract();
