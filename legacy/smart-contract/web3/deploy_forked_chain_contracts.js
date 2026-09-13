// deploy_contract.js
const Web3 = require('web3');
const fs = require('fs');

const web3_port8545 = new Web3('http://localhost:8545'); // Replace with the address of your local Ethereum node
const web3_port8546 = new Web3('http://localhost:8546'); // Replace with the address of your local Ethereum node
const web3_port8547 = new Web3('http://localhost:8547'); // Replace with the address of your local Ethereum node
// const web3_port8548 = new Web3('http://localhost:8545'); // Replace with the address of your local Ethereum node


const bytecode = fs.readFileSync('./build/MetadataBlockchain.bin').toString();
const abi = JSON.parse(fs.readFileSync('./build/MetadataBlockchain.abi'));

async function deployContract() {
    try {
        const accounts = await web3_port8545.eth.getAccounts();
        const contract = new web3_port8545.eth.Contract(abi);

        const deployment = contract.deploy({ data: bytecode });
        const gas = await deployment.estimateGas();
        const instance = await deployment.send({ from: accounts[0], gas: gas });

        console.log("Contract deployed at address:", instance.options.address);
    } catch (error) {
        console.error("Error deploying the contract:", error);
    }
}

deployContract();
