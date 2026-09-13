const fs = require('fs');
const Web3 = require('web3');

async function searchDataInChain (blockchainAddress, contractAddress, search_value) {
    try {
        const web3 = new Web3(blockchainAddress);
        
        const contractAbi = JSON.parse(fs.readFileSync('./smart-contract/build/contracts_abi_bin/BlockData.abi'));

        console.log(blockchainAddress + '-' + contractAddress);

        const contract = new web3.eth.Contract(contractAbi, contractAddress);

        contract.methods.searchMatchingDataPointsBlockNumbers(search_value).call(function (err, res) {
            // console.log("Data Point At BlockNumber- " + dataAt + ":");
            console.log('All data: ');
            console.log(res);
        });

    } catch (error) {
        console.error("Error fetching data", error);
        throw error; // Propagate the error to the caller
    }
}

const res = searchDataInChain('http://localhost:8548', '0x0A706079DB8fC45Ef957a4f48712Fb5856a24227', 43);
