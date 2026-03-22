const WebSocket = require('ws');
const { Connection, PublicKey } = require('@solana/web3.js');
const { buyToken, isEnabled: jitoEnabled } = require('./jito_buyer');
const positionManager = require('./position_manager');
const axios = require('axios');
const bs58 = require('bs58').default || require('bs58');
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

        // Subscription: Monitor EACH follow wallet directly
        // This is much more reliable than monitoring the whole program
        FOLLOW_WALLETS.forEach((wallet, index) => {
            const walletSub = {
                jsonrpc: "2.0",
                id: index + 1,
                method: "logsSubscribe",
                params: [
                    { mentions: [wallet] },
                    { commitment: "confirmed" }
                ]
            };
            ws.send(JSON.stringify(walletSub));
            console.log(`🔍 [Watcher] Monitoring wallet: ${wallet}`);
        });

        // Keep-alive heartbeat
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ jsonrpc: "2.0", method: "ping" }));
            }
        }, 30000);
    });

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);

            if (message.method === 'logsNotification') {
                const { signature, logs, err } = message.params.result.value;
                console.log(`📡 [Watcher] Activity on followed wallet! Signature: ${signature.substring(0, 8)}...`);

                if (err || processedSignatures.has(signature)) return;
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
            // --- NEW: Prevent buying the same token multiple times ---
            const currentPositions = positionManager.getPositions();
            if (currentPositions[mint] || processedSignatures.has(signature)) {
                return;
            }

            console.log(`🔥 [Watcher] FOUND NEW MINT: ${mint}`);
            processedSignatures.add(signature);
            
            // 3. TRIGGER BUY
            if (STOP_AFTER_FIRST_BUY && hasBought) return; // Final check before buy
            
            const followTip = parseFloat(process.env.JITO_TIP_FOLLOW || "0.01");
            console.log(`🚀 [Watcher] Triggering Jito Buy with ${followTip} SOL tip...`);
            
            // Notify Initiation
            sendTelegramAlert(`🟢 <b>[WATCHER INITIATED]</b>\nTarget: ${involvedFollowWallet}\nMint: <code>${mint}</code>\nTip: ${followTip} SOL\nChart: https://pump.fun/${mint}`);
            
            const bought = await buyToken(mint, followTip);
            
            if (bought) {
                if (STOP_AFTER_FIRST_BUY) hasBought = true; // Lock further buys

                // Track for TP/SL and monitor in index.js
                positionManager.addPosition(mint, {
                    developerAddress: tx.transaction.message.accountKeys[3].pubkey.toBase58(), // Heuristic for bonding curve/dev
                    buyMarketCap: 0, // Will be updated by monitor
                    symbol: "WATCHER-FOLLOW"
                });
                console.log(`✅ [Watcher] Position tracked for TP/SL!`);

                sendTelegramAlert(`🎉 <b>[SNIPE SUCCESS]</b>\nSuccessfully bought <code>${mint}</code>!\n<i>Position added to SL/TP monitor automatically.</i>`);
            } else {
                sendTelegramAlert(`❌ <b>[SNIPE FAILED]</b>\nBundle did not land for <code>${mint}</code>.\nCheck logs for details.`);
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

        if (programId === PUMP_FUN_PROGRAM && ix.data) {
            const data = bs58.decode(ix.data);
            const discriminator = data.slice(0, 8).toString('hex');

            // Discriminators:
            // create: 181ec828051c0777
            // buy: 66063d1201daebea
            // sell: 33e685a4017f83ad

            const isCreate = discriminator === "181ec828051c0777";
            const isBuy = discriminator === "66063d1201daebea";

            if (isCreate || isBuy) {
                const accounts = ix.accounts || [];
                // Create: Mint is accounts[0]
                if (isCreate && (accounts.length === 14 || accounts.length === 10)) {
                    return accounts[0].toBase58();
                }
                // Buy: Mint is accounts[2]
                if (isBuy && (accounts.length === 12 || accounts.length === 11)) {
                    return accounts[2].toBase58();
                }
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
