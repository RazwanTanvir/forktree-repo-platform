// Import web3.js and contract ABI
// Initialize Web3 and contract instance

const Web3 = require('web3');
const fs = require('fs');

const web3 = new Web3('http://localhost:8545'); // Replace with the address of your local Ethereum node

console.log("Connected to chain...");


const abi = JSON.parse(fs.readFileSync('./build/MetadataBlockchain.abi'));

// const contractAddress = '0xb8170E43749E89822001F17fA360ccdFa11fd82c'; // Replace with the deployed contract address
const contractAddress = '0xE6aF269F0154e9400379b2102751406BdEba88c1'; // Replace with the deployed contract address

//unlocking account
web3.eth.personal.unlockAccount("0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02", "1234567890", 6000);
const contract = new web3.eth.Contract(abi, contractAddress);


const form = document.getElementById('contractInteractionForm');
const inputDataField = document.getElementById('inputData');
const dataDisplay = document.getElementById('dataDisplay');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const inputData = inputDataField.value;
    
    // Call your smart contract function here and store the result
    const totalForks = await contract.methods.totalForks().call();
    

    // Display the result in the UI
    dataDisplay.innerHTML = 'Result: ${100}';
});
