const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=6194510d-e061-473e-b269-54d1446e9a5a";

async function rpcCall(method, params) {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params
  };
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function run() {
  const blockNumber = 407894988;
  console.log(`Fetching block ${blockNumber}...`);
  const block = await rpcCall("getBlock", [blockNumber, { transactionDetails: "signatures", maxSupportedTransactionVersion: 0 }]);
  
  if (!block || !block.signatures) {
    console.log("Could not fetch block signatures.");
    return;
  }

  const sig1 = "Ux4tN7mb6LFFiF9dV6aLMwhzVXrR5A55JCcGrCSCESsn1jf2HMa9L42geGHAdnk3fwfj1d8zUZkq4SuiHjmndGH"; // Wallet 1
  const sig2 = "4ndaPWWwKbjRRxWNSkXkk2Ub2NQQWCNVsdyovKAuTAJXcj8CiynGXP8ZC4hJ4qRDD9JZJ8FxXe26eTiZEWykWZob"; // Wallet 2
  const sig3 = "5U9M1ejvUBwMo5SmyyCcs48oYzJFLn23bNbhqhnp7pM3vJwfLHM8wNVmdKa8eGmLXKJ4WHxhogKbwnm1Fu3nfUrg"; // Wallet 3

  const index1 = block.signatures.indexOf(sig1);
  const index2 = block.signatures.indexOf(sig2);
  const index3 = block.signatures.indexOf(sig3);

  console.log(`Wallet 1 (BbgGp...) transaction index: ${index1}`);
  console.log(`Wallet 2 (71vph...) transaction index: ${index2}`);
  console.log(`Wallet 3 (4ARMf...) transaction index: ${index3}`);

  const sorted = [
    { name: "Wallet 1 (BbgGp...)", index: index1, amount: "103.5M" },
    { name: "Wallet 2 (71vph...)", index: index2, amount: "81.1M" },
    { name: "Wallet 3 (4ARMf...)", index: index3, amount: "64.7M" }
  ].sort((a, b) => a.index - b.index);

  console.log("\nOrder of execution in the block:");
  sorted.forEach((item, i) => {
    console.log(`${i + 1}. ${item.name} at index ${item.index} (bought ${item.amount})`);
  });
  
  // also check if any transaction around them paid Jito tip, Jito bundles are contiguous
  const minIndex = Math.min(index1, index2, index3);
  const maxIndex = Math.max(index1, index2, index3);
  console.log(`\nBundle spans from index ${minIndex} to ${maxIndex} (length: ${maxIndex - minIndex + 1})`);
}

run().catch(console.error);
