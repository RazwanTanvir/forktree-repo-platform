const Web3 = require('web3');
const fs = require('fs');


async function getForkData(blockchainAddress, contractAddress) {
    try {
        const web3 = new Web3(blockchainAddress);
        
        const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/storeforkevent.abi'));
        

        const contract = new web3.eth.Contract(contractAbi, contractAddress);
        
        contract.methods.getAllForkDetails().call(function(err, res){
            console.log('All data: ');
            console.log(res);

            const jsonString = JSON.stringify(res, null, 2);
            fs.writeFileSync('./smart-contract/src/scripts/storage/forkDetail.json', jsonString, 'utf-8');
        });

    } catch (error) {
        console.error("Error fetching data", error);
    }
}

const deployedContractsFile = './smart-contract/src/scripts/repoContractInfo.json';
const jsonData = fs.readFileSync(deployedContractsFile);
const contractsInfo = JSON.parse(jsonData);

for (const contractInfo of contractsInfo) {
    // Destructure values from the contractInfo object
    const { web3Provider, contractAddress } = contractInfo;
    console.log(web3Provider + ' : '+ contractAddress);

    getForkData(web3Provider, contractAddress);
}



