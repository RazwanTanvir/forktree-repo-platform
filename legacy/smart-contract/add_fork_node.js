// add_fork_node.js
const Web3 = require('web3');
const fs = require('fs');

const web3 = new Web3('http://localhost:8545'); // Replace with the address of your local Ethereum node

console.log("Connected to chain...");

// const abi = JSON.parse(fs.readFileSync('./build/AddRetrieveForks.abi'));
const abi = JSON.parse(fs.readFileSync('./build/MetadataBlockchain.abi'));

// const contractAddress = '0xb8170E43749E89822001F17fA360ccdFa11fd82c'; // Replace with the deployed contract address
// const contractAddress = '0xE6aF269F0154e9400379b2102751406BdEba88c1'; // Replace with the deployed contract address
const contractAddress = '0xFF68b5e65F9881AD8D8D56173b208E211173fB5D'; // Replace with the deployed contract address



//unlocking account
web3.eth.personal.unlockAccount("0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02", "1234567890", 6000);
// web3.eth.personal.unlockAccount("0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b", "1234567890", 6000);

async function add_fork_node(network_id, port_id, parent_n_id, parent_port_id) {
    try {
        const contract = new web3.eth.Contract(abi, contractAddress);
        console.log("Added.")


        // await contract.methods.addFork(1,8546,0,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        await contract.methods.addFork(2,8546,0,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        await contract.methods.addFork(3,8546,1,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        await contract.methods.addFork(4,8546,3,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        await contract.methods.addFork(5,8546,1,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        await contract.methods.addFork(6,8546,5 ,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        await contract.methods.addFork(7,8546,5 ,8545).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        // await contract.methods.addFork(network_id,port_id,parent_n_id ,parent_port_id).send({ from: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02' }); // 0x15A1c9F7aE8F8f3176805316C2bACC99Af3d6f5b 
        
        await contract.methods.totalForks().call(function(err, res){
            console.log("Total forks in metadata blockchain: ");
            console.log(res);
        });

    
    } catch (error) {
        console.error("Error interacting with the contract:", error);
    }
}

network_ids = []
add_fork_node(2,8546,0,8545);