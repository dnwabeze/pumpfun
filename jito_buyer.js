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
        console.log(`📡 [Solana] Connecting to RPC: ${new URL(RPC_URL).hostname}`);
        connection = new Connection(RPC_URL, "confirmed");
        return wallets.length > 0;
    } catch (e) {
        logError("❌ Failed to initialize Solana connection:", e.message);
        return false;
    }
}

async function checkBundleStatus(bundleId, retries = 5) {
    let enginesToTry = [...JITO_REGIONS];
    if (process.env.JITO_BLOCK_ENGINE_URL) {
        enginesToTry = [process.env.JITO_BLOCK_ENGINE_URL, ...JITO_REGIONS.filter(r => r !== process.env.JITO_BLOCK_ENGINE_URL)];
    }

    for (let i = 0; i < retries; i++) {
        const engine = enginesToTry[i % enginesToTry.length];
        try {
            await new Promise(r => setTimeout(r, 2000)); // wait 2s
            const response = await axios.post(engine, {
                jsonrpc: "2.0",
                id: 1,
                method: "getBundleStatuses",
                params: [[bundleId]]
            }, { timeout: 5000 });
            
            const result = response.data?.result;
            const status = result?.value?.[0];
            
            if (status) {
                console.log(`[JitoBuyer] Bundle ${bundleId} status: ${status.confirmation_status} | Slot: ${status.slot}`);
                if (status.confirmation_status === 'finalized' || status.confirmation_status === 'confirmed') {
                    return true;
                }
            } else {
                console.log(`[JitoBuyer] Waiting for bundle ${bundleId} to land... (Attempt ${i+1}/${retries} via ${new URL(engine).hostname})`);
            }
        } catch (e) {
            if (e.response?.status === 429) {
                // Rate limited, wait a bit longer and try next engine
                // console.warn(`[JitoBuyer] Rate limited on ${new URL(engine).hostname}, retrying next...`);
                await new Promise(r => setTimeout(r, 1000));
            } else {
                // console.error(`Error checking bundle status: ${e.message}`);
            }
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

                let response;
                let lastError;
                for (let i = 0; i < 3; i++) {
                    try {
                        response = await axios.post(`https://pumpportal.fun/api/trade-local`, localTradeParams, {
                            responseType: 'arraybuffer',
                            timeout: 10000
                        });
                        break;
                    } catch (e) {
                        lastError = e;
                        if (e.response?.status === 400) {
                            // If 400, might be too new, wait and retry
                            await new Promise(r => setTimeout(r, 1000));
                            continue;
                        }
                        throw e;
                    }
                }

                if (!response) throw lastError;

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

        // Try the entire region-cycling process up to 3 times
        for (let attempt = 0; attempt < 3 && !success; attempt++) {
            if (attempt > 0) {
                // console.log(`[JitoBuyer] Retrying all regions for Buy (Attempt ${attempt + 1}/3)...`);
                await new Promise(r => setTimeout(r, 500));
            }

            for (const engine of enginesToTry) {
                try {
                    // console.log(`[JitoBuyer] Sending bundle with ${txsToBundle.length} transactions to Jito (${new URL(engine).hostname})...`);
                    const jitoRes = await axios.post(engine, payload, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000
                    });

                    if (jitoRes.data?.error) {
                        // console.error(`❌ [JitoBuyer] Jito Error (${new URL(engine).hostname}):`, jitoRes.data.error);
                        continue;
                    }

                    bundleId = jitoRes.data?.result;
                    if (bundleId) {
                        success = true;
                        break;
                    }
                } catch (jitoError) {
                    // const errorMsg = jitoError.response?.data || jitoError.message;
                    // console.error(`⚠️ [JitoBuyer] Connection failed for ${new URL(engine).hostname}: ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
                }
            }
        }

        if (!success) {
            logError(`❌ [JitoBuyer] All Jito RPC attempts failed after 3 global retries for buy bundle.`);
            return false;
        }

        console.log(`✅ [JitoBuyer] Bundle sent! ID: ${bundleId}`);
        console.log(`Verify: https://explorer.jito.wtf/bundle/${bundleId}`);

        const landed = await checkBundleStatus(bundleId);
        if (landed) {
            console.log(`🎉 [JitoBuyer] Multi-wallet bundle landed successfully!`);
            return true;
        } else {
            logError(`⚠️ [JitoBuyer] Bundle ${bundleId} did not land.`, {
                reason: "Congestion or slippage. Check Jito explorer.",
                explorer: `https://explorer.jito.wtf/bundle/${bundleId}`
            });
            return false;
        }

    } catch (error) {
        logError("❌ [JitoBuyer] Unexpected error in multi-wallet buyToken:", error.stack || error.message);
        return false;
    }
}

async function getTokenBalance(connection, walletPublicKey, mintAddress, retries = 10) {
    const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
    
    const [ataAddress] = PublicKey.findProgramAddressSync(
        [
            new PublicKey(walletPublicKey).toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            new PublicKey(mintAddress).toBuffer()
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    );

    // console.log(`[BALANCE_DEBUG] Checking ATA: ${ataAddress.toBase58()} for wallet ${walletPublicKey}`);

    for (let i = 0; i < retries; i++) {
        try {
            const balanceResponse = await connection.getTokenAccountBalance(ataAddress, "confirmed");
            if (balanceResponse && balanceResponse.value) {
                return balanceResponse.value.amount;
            }
        } catch (e) {
            // Log the error for diagnosis
            if (i === 0 || i === retries - 1) {
                // console.log(`[BALANCE_DEBUG] Attempt ${i+1}: ${e.message}`);
            }

            // Treat almost any error during the first few seconds as "not found yet"
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 1000)); // wait 1s
                continue;
            }
        }

        // Secondary fallback
        try {
            const accounts = await connection.getParsedTokenAccountsByOwner(
                new PublicKey(walletPublicKey),
                { programId: TOKEN_PROGRAM_ID }
            );
            const target = accounts.value.find(acc => acc.account.data.parsed.info.mint === mintAddress);
            if (target) return target.account.data.parsed.info.tokenAmount.amount;
        } catch (e) {}

        if (i < retries - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return 0;
}

async function sellToken(mintAddress, amountPercentage = 100) {
    if (wallets.length === 0) return;

    try {
        console.log(`[JitoBuyer] 📉 Starting multi-wallet SELL for ${mintAddress} (${wallets.length} wallets)...`);
        
        const tipAmountSol = parseFloat(process.env.JITO_TIP_AMOUNT_SOL || "0.001");
        const priorityFeeSol = parseFloat(process.env.PRIORITY_FEE || "0.0001");
        const slippage = parseFloat(process.env.SLIPPAGE || "15");
        
        const txsToBundle = [];
        let tipPayer = null;

        for (const wallet of wallets) {
            try {
                if (tipPayer === null) {
                    const solBalance = await connection.getBalance(wallet.publicKey);
                    if (solBalance / 1e9 > tipAmountSol + priorityFeeSol + 0.005) {
                        tipPayer = wallet;
                    }
                }
                
                console.log(`✅ [JitoBuyer] Preparing sell for ${wallet.publicKey.toBase58()} (${amountPercentage}%)...`);

                const localTradeParams = {
                    "publicKey": wallet.publicKey.toBase58(),
                    "action": "sell",
                    "mint": mintAddress,
                    "denominatedInSol": "false",
                    "amount": amountPercentage === 100 ? "100%" : `${amountPercentage}%`,
                    "slippage": slippage,
                    "priorityFee": priorityFeeSol,
                    "pool": "pump"
                };

                let response;
                for (let i = 0; i < 3; i++) {
                    try {
                        response = await axios.post(`https://pumpportal.fun/api/trade-local`, localTradeParams, {
                            responseType: 'arraybuffer',
                            timeout: 10000
                        });
                        break;
                    } catch (e) {
                        if (e.response?.status === 400 && i < 2) {
                            await new Promise(r => setTimeout(r, 1000));
                            continue;
                        }
                        throw e;
                    }
                }

                const txBytes = new Uint8Array(response.data);
                const tx = VersionedTransaction.deserialize(txBytes);
                tx.sign([wallet]);
                txsToBundle.push(bs58.encode(tx.serialize()));
                
                console.log(`✅ [JitoBuyer] Prepared sell for ${wallet.publicKey.toBase58()} (${amountPercentage}%)`);
            } catch (err) {
                console.error(`❌ [JitoBuyer] Failed to prepare sell for ${wallet.publicKey.toBase58()}:`, err.message);
            }
        }

        if (txsToBundle.length === 0) {
            console.log("❌ [JitoBuyer] No wallets had tokens to sell.");
            return;
        }

        if (!tipPayer) {
            console.error("❌ [JitoBuyer] No wallet has enough SOL to pay the Jito tip for selling.");
            return;
        }

        // 2. Create Tip Transaction
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
            console.log(`[JitoBuyer] 🧪 DRY RUN MODE ACTIVE - ${txsToBundle.length - 1} sells + 1 tip NOT sent.`);
            return;
        }

        let bundleId = null;
        let enginesToTry = [...JITO_REGIONS];
        if (process.env.JITO_BLOCK_ENGINE_URL) {
            enginesToTry = [process.env.JITO_BLOCK_ENGINE_URL, ...JITO_REGIONS.filter(r => r !== process.env.JITO_BLOCK_ENGINE_URL)];
        }

        let success = false;
        
        // Try the entire region-cycling process up to 3 times
        for (let attempt = 0; attempt < 3 && !success; attempt++) {
            if (attempt > 0) {
                // console.log(`[JitoBuyer] Retrying all regions (Attempt ${attempt + 1}/3)...`);
                await new Promise(r => setTimeout(r, 500));
            }

            for (const engine of enginesToTry) {
                try {
                    const jitoRes = await axios.post(engine, payload, { timeout: 15000 });
                    if (jitoRes.data && jitoRes.data.result) {
                        bundleId = jitoRes.data.result;
                        success = true;
                        break;
                    }
                } catch (error) {
                    // console.warn(`[JitoBuyer] Failed to send to ${new URL(engine).hostname}: ${error.message}`);
                }
            }
        }

        if (!success) {
            console.error("❌ [JitoBuyer] All Jito RPC attempts failed after 3 global retries for multi-wallet sell bundle.");
            return;
        }

        console.log(`✅ [JitoBuyer] Sell bundle sent! ID: ${bundleId}`);
        const landed = await checkBundleStatus(bundleId);
        if (landed) {
            console.log(`🎉 [JitoBuyer] Multi-wallet sell bundle landed successfully!`);
        } else {
            console.log(`⚠️ [JitoBuyer] Sell bundle did not land.`);
        }

    } catch (error) {
        console.error("❌ [JitoBuyer] Unexpected error in sellToken:", error.message);
    }
}

// Initialize on module load
const isEnabled = init();

module.exports = {
    buyToken,
    sellToken,
    isEnabled
};
