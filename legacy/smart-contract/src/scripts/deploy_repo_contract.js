//working file
// deploy_contract.js
const Web3 = require('web3');
const fs = require('fs');

const contractAddressList= {};

async function deployRepoContract(web3Provider, accountPassword) {
    try {
        const web3 = new Web3(web3Provider);

        const bytecode = fs.readFileSync('./smart-contract/build/contracts_abi_bin/storeforkevent.bin').toString();
        const abi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/storeforkevent.abi'));

        // Unlock the account for deployment
        const accounts = await web3.eth.getAccounts();
        await web3.eth.personal.unlockAccount(accounts[0], accountPassword, 6000);

        const contract = new web3.eth.Contract(abi);

        const deployment = contract.deploy({ data: bytecode });
        const gas = await deployment.estimateGas();
        const instance = await deployment.send({ from: accounts[0], gas: gas });

        var deployedContract = []
        const contractInfo = {
            web3Provider: web3Provider,
            contractAddress: instance.options.address
        };
        deployedContract.push(contractInfo);

        const jsonString = JSON.stringify(deployedContract, null, 2);
        fs.writeFileSync('./smart-contract/src/scripts/repoContractInfo.json', jsonString, 'utf-8');

        // contractAddressList[web3Provider] = instance.options.address;
        console.log("Contract deployed at address for (" + web3Provider + "): ", instance.options.address);
        return instance.options.address;
    } catch (error) {
        console.error("Error deploying the contract:", error);
    }
}

/* Function call */
// Example usage for deploying to a different blockchain
const web3Provider = 'http://localhost:8545'; // Replace with the address of your different Ethereum node
const accountPassword = '1234567890'; // Replace with the password for the account

const addr1 = deployRepoContract(web3Provider, accountPassword);