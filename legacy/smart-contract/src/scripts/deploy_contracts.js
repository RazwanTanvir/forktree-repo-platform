//working file


// deploy_contract.js
const Web3 = require('web3');
const fs = require('fs');

var contractAddressList = [];

async function deployContract(web3Provider, accountPassword) {
    try {
        const web3 = new Web3(web3Provider);

        const bytecode = fs.readFileSync('./smart-contract/build/contracts_abi_bin/addchaindata.bin').toString();
        const abi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/addchaindata.abi'));

        // Unlock the account for deployment
        const accounts = await web3.eth.getAccounts();
        await web3.eth.personal.unlockAccount(accounts[0], accountPassword, 6000);

        const contract = new web3.eth.Contract(abi);

        const deployment = contract.deploy({ data: bytecode });
        const gas = await deployment.estimateGas();
        const instance = await deployment.send({ from: accounts[0], gas: gas });

        // contractAddressList[web3Provider] = instance.options.address;
        console.log("Contract deployed at address for (" + web3Provider + "): ", instance.options.address);
        return instance.options.address;
    } catch (error) {
        console.error("Error deploying the contract:", error);
    }
}

async function main() {
    try {
        const config = JSON.parse(fs.readFileSync('smart-contract\\src\\scripts\\config\\web3Config.json'));
        const providers = config.providers;

        for (const provider of providers) {
            const { web3Provider, accountPassword } = provider;

            try {
                const contractAddress = await deployContract(web3Provider, accountPassword);                
                const contractInfo = {
                    web3Provider: web3Provider,
                    contractAddress: contractAddress
                };
                contractAddressList.push(contractInfo);
            } catch (error) {
                console.error("Error deploying contract for", web3Provider, ":", error);
            }
        }

        // Write the contract info to a JSON file
        const jsonString = JSON.stringify(contractAddressList, null, 2);
        fs.writeFileSync('./smart-contract/src/scripts/contractInfo.json', jsonString, 'utf-8');
    } catch (error) {
        console.error("Error reading web3 configuration:", error);
    }
}

main();
