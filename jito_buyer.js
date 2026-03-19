const { Connection, Keypair, VersionedTransaction, PublicKey, SystemProgram, TransactionMessage } = require('@solana/web3.js');
const bs58 = require('bs58').default || require('bs58');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const JITO_REGIONS = [
    "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles",
    "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles",
    "https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles",
    "https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles"
];

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const JITO_ENGINE = process.env.JITO_BLOCK_ENGINE_URL || JITO_REGIONS[0]; // Default to Amsterdam for Nigeria
const ERROR_LOG_FILE = path.join(__dirname, 'buy_errors.log');

const TIP_ACCOUNTS = [
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5", // jitotip1
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe", // jitotip2
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY", // jitotip3
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49", // jitotip4
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh", // jitotip5
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt", // jitotip6
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL", // jitotip7
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"  // jitotip8
];

let wallets = [];

function logError(message, details = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${message}\n`;
    if (details) {
        logMessage += `Details: ${typeof details === 'object' ? JSON.stringify(details, null, 2) : details}\n`;
    }
    logMessage += `------------------------------------------------------\n`;
    
    console.error(message);
    fs.appendFileSync(ERROR_LOG_FILE, logMessage);
}

function init() {
    const keys = [
        process.env.SOLANA_PRIVATE_KEY,
        process.env.SOLANA_PRIVATE_KEY_2,
        process.env.SOLANA_PRIVATE_KEY_3,
        process.env.SOLANA_PRIVATE_KEY_4
    ].filter(k => k && k.trim() !== "" && !k.includes("your_"));

    if (keys.length === 0) {
        console.warn("⚠️ No valid SOLANA_PRIVATE_KEYs set in .env! Jito Buying disabled.");
        return false;
    }

    wallets = [];
    for (const privKey of keys) {
        try {
            let decoded;
            if (privKey.includes('[')) {
                decoded = Uint8Array.from(JSON.parse(privKey));
            } else {
                decoded = bs58.decode(privKey.trim());
            }
            const keypair = Keypair.fromSecretKey(decoded);
            wallets.push(keypair);
            console.log(`✅ Loaded Solana Wallet: ${keypair.publicKey.toBase58()}`);
        } catch (e) {
            logError(`❌ Failed to parse a private key:`, e.message);
        }
    }

    try {
        connection = new Connection(RPC_URL, "confirmed");
        return wallets.length > 0;
    } catch (e) {
        logError("❌ Failed to initialize Solana connection:", e.message);
        return false;
    }
}

async function checkBundleStatus(bundleId, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            await new Promise(r => setTimeout(r, 2000)); // wait 2s
            const response = await axios.post(JITO_ENGINE, {
                jsonrpc: "2.0",
                id: 1,
                method: "getBundleStatuses",
                params: [[bundleId]]
            });
            
            const result = response.data?.result;
            const status = result?.value?.[0];
            
            if (status) {
                console.log(`[JitoBuyer] Bundle ${bundleId} status: ${status.confirmation_status} | Slot: ${status.slot}`);
                if (status.confirmation_status === 'finalized' || status.confirmation_status === 'confirmed') {
                    return true;
                }
            } else {
                console.log(`[JitoBuyer] Waiting for bundle ${bundleId} to land... (Attempt ${i+1}/${retries})`);
            }
        } catch (e) {
            console.error(`Error checking bundle status: ${e.message}`);
        }
    }
    return false;
}

async function buyToken(mintAddress) {
    if (wallets.length === 0) return;

    try {
        console.log(`[JitoBuyer] 🚀 Starting multi-wallet buy for ${mintAddress} (${wallets.length} wallets)...`);
        
        const buyAmountSol = parseFloat(process.env.BUY_AMOUNT_SOL || "0.01");
        const tipAmountSol = parseFloat(process.env.JITO_TIP_AMOUNT_SOL || "0.001");
        const priorityFeeSol = parseFloat(process.env.PRIORITY_FEE || "0.0001");
        const slippage = parseFloat(process.env.SLIPPAGE || "15");
        
        const txsToBundle = [];
        let tipPayer = null;

        // 1. Prepare Buy Transactions for each wallet
        for (const wallet of wallets) {
            try {
                const balance = await connection.getBalance(wallet.publicKey);
                const totalNeeded = buyAmountSol + priorityFeeSol + 0.005 + (tipPayer === null ? tipAmountSol : 0);

                if (balance / 1e9 < totalNeeded) {
                    console.log(`⚠️ [JitoBuyer] Skipped ${wallet.publicKey.toBase58()} - Insufficient Balance (${(balance/1e9).toFixed(4)} SOL)`);
                    continue;
                }

                if (tipPayer === null) tipPayer = wallet; // First wallet with balance pays the tip

                const localTradeParams = {
                    "publicKey": wallet.publicKey.toBase58(),
                    "action": "buy",
                    "mint": mintAddress,
                    "denominatedInSol": "true",
                    "amount": buyAmountSol,
                    "slippage": slippage,
                    "priorityFee": priorityFeeSol,
                    "pool": "pump"
                };

                const response = await axios.post(`https://pumpportal.fun/api/trade-local`, localTradeParams, {
                    responseType: 'arraybuffer'
                });

                const txBytes = new Uint8Array(response.data);
                const tx = VersionedTransaction.deserialize(txBytes);
                tx.sign([wallet]);
                txsToBundle.push(bs58.encode(tx.serialize()));
                
                console.log(`✅ [JitoBuyer] Prepared buy for ${wallet.publicKey.toBase58()} (${buyAmountSol} SOL)`);
            } catch (err) {
                console.error(`❌ [JitoBuyer] Failed to prepare buy for ${wallet.publicKey.toBase58()}:`, err.message);
            }
        }

        if (txsToBundle.length === 0) {
            logError("❌ [JitoBuyer] No wallets had sufficient balance to buy.");
            return;
        }

        // 2. Create Tip Transaction (from the designated tipPayer)
        const tipAccount = TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];
        const tipLamports = Math.floor(tipAmountSol * 1e9);
        const { blockhash } = await connection.getLatestBlockhash('finalized');

        const tipInstruction = SystemProgram.transfer({
            fromPubkey: tipPayer.publicKey,
            toPubkey: new PublicKey(tipAccount),
            lamports: tipLamports
        });

        const messageV0 = new TransactionMessage({
            payerKey: tipPayer.publicKey,
            recentBlockhash: blockhash,
            instructions: [tipInstruction]
        }).compileToV0Message();

        const tipTx = new VersionedTransaction(messageV0);
        tipTx.sign([tipPayer]);
        txsToBundle.push(bs58.encode(tipTx.serialize()));

        // 3. Send Bundle
        const payload = {
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [txsToBundle]
        };

        if (process.env.JITO_DRY_RUN === 'true') {
            console.log(`[JitoBuyer] 🧪 DRY RUN MODE ACTIVE - ${txsToBundle.length - 1} buys + 1 tip NOT sent.`);
            return;
        }

        let bundleId = null;
        let success = false;
        let enginesToTry = [...JITO_REGIONS];
        if (process.env.JITO_BLOCK_ENGINE_URL) {
            enginesToTry = [process.env.JITO_BLOCK_ENGINE_URL, ...JITO_REGIONS.filter(r => r !== process.env.JITO_BLOCK_ENGINE_URL)];
        }

        for (const engine of enginesToTry) {
            try {
                console.log(`[JitoBuyer] Sending bundle with ${txsToBundle.length} transactions to Jito (${new URL(engine).hostname})...`);
                const jitoRes = await axios.post(engine, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                });

                if (jitoRes.data?.error) {
                    console.error(`❌ [JitoBuyer] Jito Error (${new URL(engine).hostname}):`, jitoRes.data.error);
                    continue;
                }

                bundleId = jitoRes.data?.result;
                if (bundleId) {
                    success = true;
                    break;
                }
            } catch (jitoError) {
                const errorMsg = jitoError.response?.data || jitoError.message;
                console.error(`⚠️ [JitoBuyer] Connection failed for ${new URL(engine).hostname}: ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
            }
        }

        if (!success) {
            logError(`❌ [JitoBuyer] All Jito RPC attempts failed for multi-wallet bundle.`);
            return;
        }

        console.log(`✅ [JitoBuyer] Bundle sent! ID: ${bundleId}`);
        console.log(`Verify: https://explorer.jito.wtf/bundle/${bundleId}`);

        const landed = await checkBundleStatus(bundleId);
        if (landed) {
            console.log(`🎉 [JitoBuyer] Multi-wallet bundle landed successfully!`);
        } else {
            logError(`⚠️ [JitoBuyer] Bundle ${bundleId} did not land.`, {
                reason: "Congestion or slippage. Check Jito explorer.",
                explorer: `https://explorer.jito.wtf/bundle/${bundleId}`
            });
        }

    } catch (error) {
        logError("❌ [JitoBuyer] Unexpected error in multi-wallet buyToken:", error.stack || error.message);
    }
}

// Initialize on module load
const isEnabled = init();

module.exports = {
    buyToken,
    isEnabled
};
