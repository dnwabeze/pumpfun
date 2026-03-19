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

let connection;
let wallet;

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
    if (!process.env.SOLANA_PRIVATE_KEY) {
        console.warn("⚠️ SOLANA_PRIVATE_KEY not set in .env! Jito Buying disabled.");
        return false;
    }
    try {
        connection = new Connection(RPC_URL, "confirmed");
        const privKey = process.env.SOLANA_PRIVATE_KEY.trim();
        let decoded;
        if (privKey.includes('[')) {
            // JSON string array
            decoded = Uint8Array.from(JSON.parse(privKey));
        } else {
            // Base58 wrapper
            decoded = bs58.decode(privKey);
        }
        wallet = Keypair.fromSecretKey(decoded);
        console.log(`✅ Loaded Solana Wallet: ${wallet.publicKey.toBase58()}`);
        return true;
    } catch (e) {
        logError("❌ Failed to parse SOLANA_PRIVATE_KEY:", e.message);
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
    if (!wallet) return;

    try {
        console.log(`[JitoBuyer] Creating buy transaction for ${mintAddress}...`);
        
        // 0. Balance Check
        const balance = await connection.getBalance(wallet.publicKey);
        const buyAmountSol = parseFloat(process.env.BUY_AMOUNT_SOL || "0.01");
        const tipAmountSol = parseFloat(process.env.JITO_TIP_AMOUNT_SOL || "0.001");
        const priorityFeeSol = parseFloat(process.env.PRIORITY_FEE || "0.0001");
        const totalNeeded = buyAmountSol + tipAmountSol + priorityFeeSol + 0.005;

        if (process.env.JITO_DRY_RUN !== 'true' && balance / 1e9 < totalNeeded) {
            logError(`❌ [JitoBuyer] Insufficient Balance for ${mintAddress}!`, {
                currentBalance: balance / 1e9,
                totalNeeded: totalNeeded,
                buyAmount: buyAmountSol,
                tipAmount: tipAmountSol
            });
            return;
        }

        // 1. Get Buy Transaction from PumpPortal with retry logic
        const localTradeParams = {
            "publicKey": wallet.publicKey.toBase58(),
            "action": "buy",
            "mint": mintAddress,
            "denominatedInSol": "true",
            "amount": buyAmountSol,
            "slippage": parseFloat(process.env.SLIPPAGE || "15"),
            "priorityFee": priorityFeeSol,
            "pool": "pump"
        };

        console.log(`[JitoBuyer] 🧪 Trade Params: ${localTradeParams.amount} SOL | Slippage: ${localTradeParams.slippage}%`);
        
        let response;
        const maxRetries = 5;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                response = await axios.post(`https://pumpportal.fun/api/trade-local`, localTradeParams, {
                    responseType: 'arraybuffer'
                });
                break; // Success!
            } catch (error) {
                let errorData = error.message;
                if (error.response?.data) {
                    try {
                        errorData = JSON.parse(new TextDecoder().decode(error.response.data));
                    } catch(e) {
                        errorData = new TextDecoder().decode(error.response.data);
                    }
                }

                if (attempt < maxRetries) {
                    console.log(`⚠️ [JitoBuyer] PumpPortal simulation failed (Attempt ${attempt}/${maxRetries}). Retrying in 300ms...`);
                    await new Promise(r => setTimeout(r, 300));
                } else {
                    logError(`❌ [JitoBuyer] PumpPortal API Error after ${maxRetries} attempts`, errorData);
                    return;
                }
            }
        }

        const tx1Bytes = new Uint8Array(response.data);
        const tx1 = VersionedTransaction.deserialize(tx1Bytes);
        tx1.sign([wallet]);
        const tx1Base58 = bs58.encode(tx1.serialize());

        // 2. Create Tip Transaction
        const tipAccount = TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];
        const tipLamports = Math.floor(tipAmountSol * 1e9);

        const { blockhash } = await connection.getLatestBlockhash('finalized');

        const tipInstruction = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new PublicKey(tipAccount),
            lamports: tipLamports
        });

        const messageV0 = new TransactionMessage({
            payerKey: wallet.publicKey,
            recentBlockhash: blockhash,
            instructions: [tipInstruction]
        }).compileToV0Message();

        const tx2 = new VersionedTransaction(messageV0);
        tx2.sign([wallet]);
        const tx2Base58 = bs58.encode(tx2.serialize());

        // 3. Send Bundle
        const payload = {
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [[ tx1Base58, tx2Base58 ]]
        };

        if (process.env.JITO_DRY_RUN === 'true') {
            console.log(`[JitoBuyer] 🧪 DRY RUN MODE ACTIVE - NOT sending.`);
            return;
        }

        let bundleId = null;
        let success = false;
        
        // Try multiple Jito regions if one fails
        const enginesToTry = process.env.JITO_BLOCK_ENGINE_URL ? [process.env.JITO_BLOCK_ENGINE_URL] : JITO_REGIONS;

        for (const engine of enginesToTry) {
            try {
                console.log(`[JitoBuyer] Sending bundle to Jito (${new URL(engine).hostname})...`);
                const jitoRes = await axios.post(engine, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                });

                if (jitoRes.data?.error) {
                    console.error(`❌ [JitoBuyer] Jito Error (${new URL(engine).hostname}):`, jitoRes.data.error);
                    continue; // Try next engine
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
            logError(`❌ [JitoBuyer] All Jito RPC attempts failed.`, "Check connectivity and tip amount.");
            return;
        }

        console.log(`✅ [JitoBuyer] Bundle sent! ID: ${bundleId}`);
        console.log(`Verify: https://explorer.jito.wtf/bundle/${bundleId}`);

        // 4. Wait for confirmation
        const landed = await checkBundleStatus(bundleId);
        if (landed) {
            console.log(`🎉 [JitoBuyer] Bundle landed successfully!`);
        } else {
            logError(`⚠️ [JitoBuyer] Bundle ${bundleId} did not land within timeout.`, {
                reason: "Likely slippage exceeded or high competition. Check Jito explorer for details.",
                explorer: `https://explorer.jito.wtf/bundle/${bundleId}`
            });
        }

    } catch (error) {
        logError("❌ [JitoBuyer] Unexpected error during buyToken:", error.stack || error.message);
    }
}

// Initialize on module load
const isEnabled = init();

module.exports = {
    buyToken,
    isEnabled
};
