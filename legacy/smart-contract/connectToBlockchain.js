// interact_with_contract.js
const Web3 = require('web3');
const fs = require('fs');

metadata_blockchain_address = 'http://localhost:8547';
const web3 = new Web3(metadata_blockchain_address); // Replace with the address of your local Ethereum node

console.log("Connected to chain...");

web3.eth.getAccounts()
.then((accounts) => {
// loop through the accounts and get their balances
    accounts.forEach((account) => {
        web3.eth.getBalance(account)
        .then((balance) => {
            console.log(`Account ${account} balance: ${web3.utils.fromWei(balance, 'ether')} ETH`);
        })
        .catch((error) => {
            console.error('Error getting balance for account ${account}:', error);
        });
    });
    })
    .catch((error) => {
    console.error('Error getting accounts:', error);
});