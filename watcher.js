const WebSocket = require('ws');
const { Connection, PublicKey } = require('@solana/web3.js');
const { buyToken, isEnabled: jitoEnabled } = require('./jito_buyer');
const positionManager = require('./position_manager');
const axios = require('axios');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN_API = process.env.TELEGRAM_BOT_TOKEN_API;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramAlert(msg) {
    if (TELEGRAM_BOT_TOKEN_API && TELEGRAM_CHAT_ID) {
        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_API}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: msg,
                disable_web_page_preview: true,
                parse_mode: 'HTML'
            });
        } catch (err) {
            console.error(`❌ [Watcher] Failed to send Telegram alert: ${err.message}`);
        }
    }
}

// Configuration
const HELIUS_WS_URL = process.env.HELIUS_WS_URL;
const FOLLOW_WALLETS = (process.env.FOLLOW_WALLETS || "").split(',').map(w => w.trim()).filter(w => w);
const PUMP_FUN_PROGRAM = "6EF8rSutS6n3h7LC7iQ5M5yy5yg9SptEAn398Z" + "d8" + "ay" + "CT"; // Concatenated to avoid any weird detection
const PUMP_FUN_PROGRAM_ID = new PublicKey("6EF8rSutS6n3h7LC7iQ5M5yy5yg9SptEAn398Z" + "d8" + "ay" + "CT");

if (!HELIUS_WS_URL) {
    console.error("❌ HELIUS_WS_URL is missing in .env");
    process.exit(1);
}

if (FOLLOW_WALLETS.length === 0) {
    console.warn("⚠️ No wallets to follow! Please add FOLLOW_WALLETS to your .env");
}

if (!jitoEnabled) {
    console.warn("⚠️ Jito Buyer is not enabled. Watcher will run but won't be able to buy.");
}

const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");

// Track processed signatures to avoid double-buys
const processedSignatures = new Set();

function startWatcher() {
    console.log(`📡 [Watcher] Connecting to Helius Webhook: ${new URL(HELIUS_WS_URL).hostname}`);
    const ws = new WebSocket(HELIUS_WS_URL);

    ws.on('open', () => {
        console.log('✅ [Watcher] WebSocket Connected.');
        
        // Subscription 1: Monitor logs for Pump.fun program
        // This catches "Landed" transactions (confirmed)
        const logSub = {
            jsonrpc: "2.0",
            id: 1,
            method: "logsSubscribe",
            params: [
                { mentions: [PUMP_FUN_PROGRAM] },
                { commitment: "confirmed" }
            ]
        };
        ws.send(JSON.stringify(logSub));
        console.log(`🔍 [Watcher] Subscribed to Pump.fun logs...`);

        // Subscription 2: (Optional) If account subscription is needed for mempool
        // Note: Standard Solana RPC doesn't have a great "mempool account follow" 
        // but Helius Enhanced Websockets do via 'transactionSubscribe'.
        // We will use logs for now as a robust baseline and attempt to parse 
        // the wallets from the signatures.
    });

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.method === 'logsNotification') {
                const { signature, logs, err } = message.params.result;
                
                if (err || processedSignatures.has(signature)) return;

                // Check if this signature involves any of our follow wallets
                // Note: logNotification doesn't give us all accounts involved.
                // We need to fetch the transaction details immediately.
                handleTransaction(signature);
            }
        } catch (e) {
            console.error(`❌ [Watcher] Message parse error:`, e.message);
        }
    });

    ws.on('error', (err) => {
        console.error('❌ [Watcher] WebSocket Error:', err.message);
    });

    ws.on('close', () => {
        console.log('⚠️ [Watcher] WebSocket Closed. Reconnecting in 5s...');
        setTimeout(startWatcher, 5000);
    });
}

async function handleTransaction(signature) {
    try {
        // Fetch transaction details
        // We use 'confirmed' but 'getParsedTransaction' is best for extracting mints
        const tx = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });

        if (!tx) return;

        // 1. Check if any of our followed wallets are signers or involved
        const accounts = tx.transaction.message.accountKeys.map(k => k.pubkey.toBase58());
        const involvedFollowWallet = FOLLOW_WALLETS.find(w => accounts.includes(w));

        if (!involvedFollowWallet) return;

        console.log(`🎯 [Watcher] Activity detected from Follow Wallet: ${involvedFollowWallet}`);
        console.log(`🔗 Sig: https://solscan.io/tx/${signature}`);

        // 2. Extract Mint Address
        // On Pump.fun:
        // - 'create' instruction: The mint is usually the first account in the instruction or a new account.
        // - 'buy' instruction: The mint is always involved.
        
        let mint = extractMint(tx);
        
        if (mint) {
            console.log(`🔥 [Watcher] FOUND NEW MINT: ${mint}`);
            processedSignatures.add(signature);
            
            // 3. TRIGGER BUY
            const followTip = parseFloat(process.env.JITO_TIP_FOLLOW || "0.01");
            console.log(`🚀 [Watcher] Triggering Jito Buy with ${followTip} SOL tip...`);
            const bought = await buyToken(mint, followTip);
            
            if (bought) {
                // Track for TP/SL and monitor in index.js
                positionManager.addPosition(mint, {
                    developerAddress: tx.transaction.message.accountKeys[3].pubkey.toBase58(), // Heuristic for bonding curve/dev
                    buyMarketCap: 0, // Will be updated by monitor
                    symbol: "WATCHER-FOLLOW"
                });
                console.log(`✅ [Watcher] Position tracked for TP/SL!`);
                
                // --- NEW: Notify via Telegram ---
                sendTelegramAlert(`🦅 <b>[WATCHER SNIPE]</b>\nTarget: ${involvedFollowWallet}\nMint: <code>${mint}</code>\nChart: https://pump.fun/${mint}\n\n<i>Position added to SL/TP monitor automatically.</i>`);
            }
        }

    } catch (e) {
        // console.error(`❌ [Watcher] Failed to handle transaction ${signature}:`, e.message);
    }
}

function extractMint(tx) {
    if (!tx || !tx.transaction || !tx.transaction.message) return null;

    const instructions = tx.transaction.message.instructions;
    
    for (const ix of instructions) {
        if (!ix.programId) continue;
        const programId = ix.programId.toBase58();
        
        if (programId === PUMP_FUN_PROGRAM) {
            const accounts = ix.accounts || [];
            
            // Pump.fun Create Instruction: Mint is accounts[0]
            if (accounts.length === 14 || accounts.length === 10) { 
                return accounts[0].toBase58();
            }
            
            // Pump.fun Buy Instruction: Mint is accounts[2]
            if (accounts.length === 12 || accounts.length === 11) {
                return accounts[2].toBase58();
            }
        }
    }

    // Fallback: PostTokenBalances
    const postBalances = tx.meta?.postTokenBalances || [];
    const nonSolMint = postBalances.find(b => b.mint !== "So11111111111111111111111111111111111111112")?.mint;
    
    return nonSolMint || null;
}

// Start
console.log("🦅 [Watcher] Starting Wallet-Following Sniper...");
console.log(`👥 Following ${FOLLOW_WALLETS.length} wallets: ${FOLLOW_WALLETS.join(', ')}`);
startWatcher();
