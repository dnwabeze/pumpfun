const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=6194510d-e061-473e-b269-54d1446e9a5a";
const JITO_TIP_ACCOUNTS = [
  "96g9sBYppSbhCfsEnUooSgn9ZNf98G6c6N9P64J3S8a3",
  "UwmNCyFxAMmXiU1y5iP8M9r8WzWcUPkXwQ2t5m14Xp1",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvVkY",
  "3AVi9Tg9Uo68tJFUvo24H1TUS17Uv4R2W3u3D2m8iYvN",
  "DttWaMuVvTiduZRnguLF7QsBtf21QGFKscD6A5D5P6pX",
  "7EusVw5q8U9aTqK3VzM8GwwXnd1K7XX5KLYs4jJq1y91",
  "BpoXJbXm92rK62DszYv6vJ2U2Zq1rQo7m2rQhK67C2Tq",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zv6GQGDYm4"
];

const wallets = {
  wallet1: "BbgGpLZKj8ut8rPJnXS8gbGeFmMthDTw57NMahuDhXZc",
  wallet2: "71vphCrBxhByFf4n9G3F9DewpVMiZHewSqV49eSUiAHy",
  wallet3: "4ARMfAemt3qEfRnDuS9AypTjGR3wpHmu6nd4UxxAnz8Z"
};

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

async function getSignatures(address, limit = 50) {
  return rpcCall("getSignaturesForAddress", [address, { limit }]);
}

async function getTransactions(signatures) {
  const results = [];
  for (const sig of signatures) {
    results.push(await rpcCall("getTransaction", [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]));
  }
  return results;
}

async function run() {
  console.log("Fetching signatures for wallets...");
  const sigs1 = await getSignatures(wallets.wallet1, 50);
  const sigs2 = await getSignatures(wallets.wallet2, 50);
  const sigs3 = await getSignatures(wallets.wallet3, 50);

  console.log(`Fetched ${sigs1.length}, ${sigs2.length}, ${sigs3.length} signatures.`);

  // Let's find common blocks to see if they end up in the same block
  const blocks1 = new Set(sigs1.map(s => s.slot));
  const blocks2 = new Set(sigs2.map(s => s.slot));
  const blocks3 = new Set(sigs3.map(s => s.slot));

  const commonSlots = [...blocks1].filter(x => blocks2.has(x) || blocks3.has(x));
  console.log("Common slots between wallet 1 and others:", commonSlots);
  const common23 = [...blocks2].filter(x => blocks3.has(x));
  console.log("Common slots between wallet 2 and 3:", common23);

  // Focus on top few common slots if any, or just fetch the parsed transactions for the latest common slots
  const allCommon = [...new Set([...commonSlots, ...common23])].sort((a,b) => b-a).slice(0, 5);
  
  if (allCommon.length === 0) {
      console.log("No common slots found in the last 50 transactions. They might not be trading right now.");
      return;
  }
  
  console.log("Analyzing transactions in common slots:", allCommon);

  const targets = [];
  [sigs1, sigs2, sigs3].forEach(sigs => {
    sigs.forEach(s => {
      if (allCommon.includes(s.slot)) {
        targets.push(s.signature);
      }
    });
  });

  const uniqueTargets = [...new Set(targets)];
  console.log(`Fetching ${uniqueTargets.length} transactions for analysis...`);

  // Fetch in chunks of 10 max
  const txs = [];
  for (let i = 0; i < uniqueTargets.length; i += 10) {
    const chunk = uniqueTargets.slice(i, i + 10);
    const result = await getTransactions(chunk);
    txs.push(...result);
  }

  // Analyze the parsed transactions
  txs.forEach((tx, idx) => {
    if (!tx || !tx.transaction) return;
    const sig = uniqueTargets[idx];
    console.log(`\nTransaction: ${sig} | Slot: ${tx.slot} | Index: ${tx.transaction.message.instructions ? tx.transaction.message.instructions.length : 'N/A'}`);
    
    // Check which wallet signed it
    const accounts = tx.transaction.message.accountKeys.map(k => k.pubkey);
    let signer = null;
    tx.transaction.message.accountKeys.forEach(k => {
      if (k.signer && Object.values(wallets).includes(k.pubkey)) {
        signer = k.pubkey;
        const name = Object.keys(wallets).find(key => wallets[key] === k.pubkey);
        console.log(`Signer: ${name} (${k.pubkey})`);
      }
    });

    // Check for Jito tips
    let paidTip = false;
    tx.transaction.message.instructions.forEach(ix => {
      if (ix.programId === "11111111111111111111111111111111" && ix.parsed && ix.parsed.type === "transfer") {
        const dest = ix.parsed.info.destination;
        if (JITO_TIP_ACCOUNTS.includes(dest)) {
          console.log(`*** PAID JITO TIP: ${ix.parsed.info.lamports / 1e9} SOL to ${dest} ***`);
          paidTip = true;
        }
      }
    });

    // Check token balance changes to see what token was bought
    const preBalances = tx.meta.preTokenBalances || [];
    const postBalances = tx.meta.postTokenBalances || [];
    
    postBalances.forEach(post => {
      if (post.owner === signer) {
        const pre = preBalances.find(p => p.accountIndex === post.accountIndex);
        const preAmt = pre ? parseFloat(pre.uiTokenAmount.uiAmountString) : 0;
        const postAmt = parseFloat(post.uiTokenAmount.uiAmountString);
        if (postAmt > preAmt) {
          console.log(`Token acquired: ${post.mint} (+${postAmt - preAmt})`);
        }
      }
    });
  });
}

run().catch(console.error);
