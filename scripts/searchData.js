const http = require('http');
const fs = require('fs');
const path = require('path');
const forkTreeService = require('../services/forkTreeService');
const { multiChainEngine } = require('../engine/chainEngine');

function isPortActive(port) {
  return new Promise(resolve => {
    const req = http.request({ host: '127.0.0.1', port, path: '/', method: 'GET', timeout: 500 }, res => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const searchValue = args[0] ? parseInt(args[0], 10) : 43;
  const startNetworkId = args[1] ? parseInt(args[1], 10) : 11102;
  const algorithm = (args[2] || 'DFS').toUpperCase() === 'BFS' ? 'BFS' : 'DFS';

  let startedLocally = false;
  const nodeActive = await isPortActive(8545);
  if (!nodeActive) {
    console.log('[Info] Standalone mode: Starting simulated multi-chain nodes...');
    await multiChainEngine.startAll();
    startedLocally = true;
  }

  try {
    console.log('===========================================================');
    console.log(` BlockchainForkTree: ${algorithm === 'BFS' ? 'Breadth-First Search (BFS)' : 'Depth-First Search (DFS)'}`);
    console.log('===========================================================');
    console.log(`Algorithm:    ${algorithm} (${algorithm === 'BFS' ? 'Level-by-Level' : 'Branch-First'})`);
    console.log(`Target Value: ${searchValue}`);
    console.log(`Root Chain:   ${startNetworkId} (Port 8546)`);
    console.log('-----------------------------------------------------------');

    const result = await forkTreeService.search(algorithm, startNetworkId, searchValue);

    console.log('\n[Traversal Path]');
    result.traversalPath.forEach(step => {
      const mark = step.foundMatch ? ' ★ MATCH FOUND' : '';
      const lvl = step.level !== undefined ? ` [Level ${step.level}]` : '';
      console.log(` Step ${step.step}:${lvl} Network ${step.networkId} (Port ${step.port}) - ${step.name}${mark}`);
    });

    console.log('\n[Matches Discovered]');
    if (result.matches.length > 0) {
      result.matches.forEach(m => {
        console.log(`  ✓ Network: ${m.networkId} (Port ${m.port}) | Block(s): [${m.matchingBlocks.join(', ')}] | Target: ${m.searchValue}`);
      });
    } else {
      console.log(`  ✗ No matching data points found for value ${searchValue}`);
    }

    // Save to searchresult.txt in storage/
    const storageDir = path.join(__dirname, '../storage');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    let fileContent = `=== BlockchainForkTree ${algorithm} Search Result ===\n`;
    fileContent += `Date: ${new Date().toISOString()}\n`;
    fileContent += `Algorithm: ${algorithm}\n`;
    fileContent += `Query Value: ${searchValue} | Root: ${startNetworkId}\n\n`;
    fileContent += `Traversal Path:\n`;
    result.traversalPath.forEach(s => {
      const lvl = s.level !== undefined ? ` [Level ${s.level}]` : '';
      fileContent += ` - Step ${s.step}:${lvl} Net ${s.networkId} (${s.name}) Port ${s.port}${s.foundMatch ? ' [MATCH]' : ''}\n`;
    });
    fileContent += `\nMatches:\n`;
    result.matches.forEach(m => {
      fileContent += `Network: http://localhost:${m.port} | Block: ${m.matchingBlocks.join(', ')} | Value: ${m.searchValue}\n`;
    });

    const outPath = path.join(storageDir, 'searchresult.txt');
    fs.writeFileSync(outPath, fileContent, 'utf-8');
    console.log(`\n✓ Results written to ${outPath}`);
    return result;
  } finally {
    if (startedLocally) {
      await multiChainEngine.stopAll();
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Search failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
