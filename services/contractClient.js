// Lightweight, cross-platform Contract Client for standard Ethereum JSON-RPC endpoints
const { ethers } = require('ethers');

class ContractClient {
  constructor(rpcUrl, abi, address = null) {
    this.rpcUrl = rpcUrl;
    this.abi = abi;
    this.address = address;
    this.iface = new ethers.Interface(abi);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  static async deploy(rpcUrl, abi, bytecode = '0x608060405234801561001057600080fd5b50') {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const accounts = await provider.send('eth_accounts', []);
    const from = accounts && accounts.length > 0 ? accounts[0] : '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';

    const txHash = await provider.send('eth_sendTransaction', [{
      from,
      data: bytecode
    }]);

    const receipt = await provider.send('eth_getTransactionReceipt', [txHash]);
    if (!receipt || !receipt.contractAddress) {
      throw new Error(`Failed to deploy contract on ${rpcUrl}: receipt missing contract address`);
    }

    return receipt.contractAddress;
  }

  async send(methodName, args = [], fromAddress = null) {
    if (!this.address) throw new Error('Contract address not set for send()');
    const accounts = await this.provider.send('eth_accounts', []);
    const from = fromAddress || (accounts && accounts.length > 0 ? accounts[0] : '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02');

    const data = this.iface.encodeFunctionData(methodName, args);
    const txHash = await this.provider.send('eth_sendTransaction', [{
      from,
      to: this.address,
      data
    }]);

    return {
      hash: txHash,
      wait: async () => this.provider.send('eth_getTransactionReceipt', [txHash])
    };
  }

  async call(methodName, args = []) {
    if (!this.address) throw new Error('Contract address not set for call()');
    const data = this.iface.encodeFunctionData(methodName, args);
    const resHex = await this.provider.send('eth_call', [{
      to: this.address,
      data
    }, 'latest']);

    const decoded = this.iface.decodeFunctionResult(methodName, resHex);
    return decoded.length === 1 ? decoded[0] : decoded;
  }
}

module.exports = { ContractClient };
