require('dotenv').config();
const WebSocket = require('ws');
const axios = require('axios');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');
const jitoBuyer = require('./jito_buyer');
const positionManager = require('./position_manager');

const SL_PERCENT = parseFloat(process.env.SL_PERCENT || "-15");
const TP_PERCENT = parseFloat(process.env.TP_PERCENT || "50");
const DEV_SELL_ENABLED = process.env.DEV_SELL_ENABLED === 'true';

const normalizeSocial = (url) => {
    if (!url) return '';
    return url.toLowerCase().trim()
        .replace('https://twitter.com/', 'https://x.com/')
        .replace('http://twitter.com/', 'https://x.com/')
        .replace('http://x.com/', 'https://x.com/')
        .replace('www.', '');
};

const targetX = normalizeSocial(process.env.TARGET_X);
const targetTelegram = normalizeSocial(process.env.TARGET_TELEGRAM);

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const forwardBot = process.env.FORWARD_BOT_USERNAME;
const sessionFile = 'session.txt';

// State
let tokensChecked = 0;
let emptySocials = 0;
let errorsFetch = 0;
let client;

const IPFS_GATEWAYS = [
    'https://cf-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
];

async function fetchMetadata(uri, retries = 3) {
    if (!uri) return null;
    let pathsToTry = [uri];
    if (uri.includes('/ipfs/')) {
        const hash = uri.split('/ipfs/')[1];
        pathsToTry = IPFS_GATEWAYS.map(gw => gw + hash);
    }

    for (let attempt = 0; attempt < retries; attempt++) {
        for (const fetchUri of pathsToTry) {
            try {
                const response = await axios.get(fetchUri, { timeout: 8000 });
                if (response.data) return response.data;
            } catch (err) {}
        }
        if (attempt < retries - 1) await new Promise(r => setTimeout(r, 2000));
    }
    console.log(`   [DEBUG] Persistent failure fetching metadata: ${uri}`);
    return null;
}

async function initTelegram() {
    let sessionString = '';
    if (fs.existsSync(sessionFile)) {
        sessionString = fs.readFileSync(sessionFile, 'utf8');
    }
    const stringSession = new StringSession(sessionString);
    
    client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text('Please enter your phone number (+...): '),
        password: async () => await input.text('Please enter your password (if any): '),
        phoneCode: async () => await input.text('Please enter the code you received: '),
        onError: (err) => console.log(err),
    });

    console.log('✅ Telegram Userbot connected and logged in!');
    fs.writeFileSync(sessionFile, client.session.save());
}

async function handleNewToken(data) {
    tokensChecked++;
    if (tokensChecked % 10 === 0) {
        console.log(`[STATUS] Scanned: ${tokensChecked} | No Socials: ${emptySocials} | Meta Fetch Errors: ${errorsFetch}`);
    }

    const mintAddress = data.mint;
    const name = data.name;
    const symbol = data.symbol;
    let twitter = data.twitter || '';
    let telegram = data.telegram || '';

    if (!twitter && !telegram && data.uri) {
        const meta = await fetchMetadata(data.uri);
        if (meta) {
            twitter = meta.twitter || '';
            telegram = meta.telegram || '';
        } else {
            errorsFetch++;
            return;
        }
    }

    if (!twitter && !telegram) {
        emptySocials++;
        return;
    }

    let matchX = false;
    let matchTg = false;

    const twitterNorm = normalizeSocial(twitter);
    const telegramNorm = normalizeSocial(telegram);

    if (targetX && twitterNorm && twitterNorm.includes(targetX)) {
        matchX = true;
    }
    
    if (targetTelegram && telegramNorm && telegramNorm.includes(targetTelegram)) {
        matchTg = true;
    }

    if (matchX || matchTg) {
        console.log('\n======================================================');
        console.log('🚨 TARGET SOCIALS DETECTED ON NEW TOKEN! 🚨');
        console.log(`Mint Address: ${mintAddress}`);
        console.log(`Name: ${name} (${symbol})`);
        console.log(`X/Twitter: ${twitter || 'None'}`);
        console.log(`Telegram: ${telegram || 'None'}`);
        console.log(`Trade Link: https://pump.fun/${mintAddress}`);
        console.log('======================================================\n');

        if (jitoBuyer.isEnabled) {
            console.log(`[BUY] Triggering buy for ${mintAddress}...`);
            jitoBuyer.buyToken(mintAddress);
            
            // Add to position manager
            // Note: We'll get the initial market cap from the next trade event or assume it's low
            positionManager.addPosition(mintAddress, {
                developerAddress: data.traderPublicKey,
                buyMarketCap: data.marketCapSol || 0,
                symbol: symbol
            });

            // Subscribe to trades for this token
            if (globalWs && globalWs.readyState === WebSocket.OPEN) {
                globalWs.send(JSON.stringify({
                    method: "subscribeTokenTrade",
                    keys: [mintAddress]
                }));
                console.log(`[MONITOR] Subscribed to trades for ${mintAddress}`);
            }
        }

        if (client && forwardBot) {
            try {
                await client.sendMessage(forwardBot, { message: mintAddress });
                console.log(`✈️  Forwarded mint address to ${forwardBot}`);
            } catch (err) {
                console.error(`❌ Failed to forward to Telegram: ${err.message}`);
            }
        }
    } else {
        console.log(`\n[SOCIALS ATTACHED] Name: ${name} (${symbol})`);
        console.log(`└─ Mint: ${mintAddress}`);
        console.log(`   ├─ X/Twitter: ${twitter || 'None'}`);
        console.log(`   └─ Telegram:  ${telegram || 'None'}`);
    }
}

let globalWs;

async function startScanner() {
    if (!apiId || !apiHash) {
        console.error('❌ Error: TELEGRAM_API_ID and TELEGRAM_API_HASH are missing in .env!');
        process.exit(1);
    }
    
    await initTelegram();

    console.log(`Target X Handle: ${targetX || 'None'}`);
    console.log(`Target Telegram Handle: ${targetTelegram || 'None'}`);
    console.log(`SL: ${SL_PERCENT}% | TP: ${TP_PERCENT}% | Dev Sell: ${DEV_SELL_ENABLED}`);
    console.log('Connecting to PumpPortal WebSocket...');

    const ws = new WebSocket('wss://pumpportal.fun/api/data');
    globalWs = ws;

    ws.on('open', function open() {
        console.log('✅ Connected to PumpPortal Data Stream!');
        ws.send(JSON.stringify({ method: "subscribeNewToken" }));
        
        // Re-subscribe to existing positions
        const openPositions = positionManager.getAllPositions();
        const mints = Object.keys(openPositions);
        if (mints.length > 0) {
            ws.send(JSON.stringify({
                method: "subscribeTokenTrade",
                keys: mints
            }));
            console.log(`[MONITOR] Re-subscribed to trades for ${mints.length} existing positions.`);
        }
    });

    ws.on('message', async function message(data) {
        try {
            const parsedData = JSON.parse(data);
            
            // New Token Detection
            if (parsedData.method === "subscribeNewToken" || (parsedData.signature && parsedData.mint && !parsedData.txType)) {
                handleNewToken(parsedData);
            } 
            
            // Trade Monitoring
            else if (parsedData.txType) {
                const mint = parsedData.mint;
                const position = positionManager.getPosition(mint);
                
                if (position) {
                    const currentMC = parsedData.marketCapSol;
                    const trader = parsedData.traderPublicKey;
                    const txType = parsedData.txType;

                    // Update initial MC if it was 0
                    if (position.buyMarketCap === 0 && currentMC > 0) {
                        position.buyMarketCap = currentMC;
                        positionManager.addPosition(mint, position);
                        console.log(`[MONITOR] Set initial Market Cap for ${position.symbol}: ${currentMC.toFixed(2)} SOL`);
                    }

                    // 1. Check Dev Sell
                    if (DEV_SELL_ENABLED && trader === position.developerAddress && txType === 'sell') {
                        console.log(`🚨 [DEV SELL] Developer sold ${position.symbol}! Triggering EMERGENCY SELL.`);
                        await jitoBuyer.sellToken(mint);
                        positionManager.removePosition(mint);
                        return;
                    }

                    // 2. Check SL/TP
                    if (position.buyMarketCap > 0) {
                        const pnlPercent = ((currentMC - position.buyMarketCap) / position.buyMarketCap) * 100;
                        
                        if (pnlPercent >= TP_PERCENT) {
                            console.log(`💰 [TAKE PROFIT] ${position.symbol} hit TP: ${pnlPercent.toFixed(2)}%! Selling...`);
                            await jitoBuyer.sellToken(mint);
                            positionManager.removePosition(mint);
                        } else if (pnlPercent <= SL_PERCENT) {
                            console.log(`📉 [STOP LOSS] ${position.symbol} hit SL: ${pnlPercent.toFixed(2)}%! Selling...`);
                            await jitoBuyer.sellToken(mint);
                            positionManager.removePosition(mint);
                        }
                    }
                }
            }
            
            else if (parsedData.message) {
                console.log(`[PumpPortal] ${parsedData.message}`);
            }
        } catch (e) {
            console.error("Error parsing message:", e);
        }
    });

    ws.on('close', function close() {
        console.log('❌ Disconnected from PumpPortal. Reconnecting in 5 seconds...');
        setTimeout(startScanner, 5000);
    });

    ws.on('error', err => console.error('WebSocket error:', err));
}

startScanner();
