#!/usr/bin/env bash
# Script to launch 7 Geth --dev nodes for BlockchainForkTree on macOS and Linux

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BASE_DIR="$DIR/../.geth_nodes"
mkdir -p "$BASE_DIR"

echo "=== Launching 7 Geth --dev nodes ==="

declare -a PORTS=(8545 8546 8547 8548 8549 8550 8551)
declare -a CHAIDS=(11101 11102 11103 11104 11105 11106 11107)

for i in "${!PORTS[@]}"; do
  PORT="${PORTS[$i]}"
  CHAIN_ID="${CHAIDS[$i]}"
  DATADIR="$BASE_DIR/node_$PORT"
  mkdir -p "$DATADIR"

  echo "Starting node on port $PORT (Network ID: $CHAIN_ID)..."
  geth --dev --datadir "$DATADIR" \
       --networkid "$CHAIN_ID" \
       --http --http.port "$PORT" \
       --http.addr "127.0.0.1" \
       --http.corsdomain "*" \
       --http.api "eth,net,web3" \
       --ipcdisable \
       > "$DATADIR/geth.log" 2>&1 &
  echo $! > "$DATADIR/geth.pid"
done

echo "All 7 Geth nodes started in background."
echo "To stop them, run: kill \$(cat $BASE_DIR/node_*/geth.pid 2>/dev/null) 2>/dev/null || true"
