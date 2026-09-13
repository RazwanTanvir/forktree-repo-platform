@echo off
cd /d "E:\Study Abroad\USA\Baylor\Study\Courses\Master Thesis\BlockchainForkTree\port8545"

start /B cmd /c "geth --datadir=./datadir --allow-insecure-unlock --http --http.api "eth,net,web3,personal" --http.corsdomain "*" --http.addr "0.0.0.0" --http.port 8545 --networkid 11 --nodiscover --ipcdisable --nat "any" --miner.etherbase "0x163f57598de9cc708e9497aa50b6d5e5ed368d02" --mine console"

timeout /t 5

start cmd /k cd /d "E:\Study Abroad\USA\Baylor\Study\Courses\Master Thesis\BlockchainForkTree\port8546" ^& geth --datadir=./datadir --allow-insecure-unlock --http --http.api "eth,net,web3,personal" --http.corsdomain "*" --http.addr "0.0.0.0" --http.port 8546 --networkid 22 --nodiscover --ipcdisable --nat "any" --miner.etherbase "0xd26ea6b5b6f1b3d7e6f0dbe55342a9f901429b51" --port 30304 --authrpc.port 8552 --mine console"

timeout /t 5

start cmd /k cd /d "E:\Study Abroad\USA\Baylor\Study\Courses\Master Thesis\BlockchainForkTree\port8547" ^& geth --datadir=./datadir --allow-insecure-unlock --http --http.api "eth,net,web3,personal" --http.corsdomain "*" --http.addr "0.0.0.0" --http.port 8547 --networkid 33 --nodiscover --ipcdisable --nat "any" --miner.etherbase "0xF01cA47D01714a87382df244168CaC6eE98B9435" --port 30305 --authrpc.port 8553 --mine console

timeout /t 5

start cmd /k cd /d "E:\Study Abroad\USA\Baylor\Study\Courses\Master Thesis\BlockchainForkTree\port8548" ^& geth --datadir=./datadir --allow-insecure-unlock --http --http.api "eth,net,web3,personal" --http.corsdomain "*" --http.addr "0.0.0.0" --http.port 8548 --networkid 998877 --nodiscover --ipcdisable --nat "any" --miner.etherbase "0xD27972f889CB55d5Dc117B8445D93387fBde4459" --port 30306 --authrpc.port 8554 --mine console

timeout /t 5