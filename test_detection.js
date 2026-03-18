require('dotenv').config();
const WebSocket = require('ws');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const forwardBot = process.env.FORWARD_BOT_USERNAME;
const sessionFile = 'session.txt';

let client;
let hasForwarded = false;

async function initTelegram() {
    let sessionString = '';
    if (fs.existsSync(sessionFile)) {
        sessionString = fs.readFileSync(sessionFile, 'utf8');
    }
    const stringSession = new StringSession(sessionString);
    
    client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    console.log('--- Connecting to Telegram ---');
    await client.connect(); // Assumes session.txt is valid for non-interactive test

    if (!await client.isUserAuthorized()) {
        console.error('❌ Telegram session is not authorized. Please run test_telegram.js first to login.');
        process.exit(1);
    }

    console.log('✅ Telegram connected!');
}

async function startTestScanner() {
    await initTelegram();

    console.log('Connecting to PumpPortal WebSocket to detect a random token...');
    const ws = new WebSocket('wss://pumpportal.fun/api/data');

    ws.on('open', function open() {
        console.log('✅ Connected to PumpPortal! Subscribing to new tokens...');
        ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    });

    ws.on('message', async function message(data) {
        if (hasForwarded) return;

        try {
            const parsedData = JSON.parse(data);
            if (parsedData.signature && parsedData.mint) {
                const mintAddress = parsedData.mint;
                const name = parsedData.name;
                const symbol = parsedData.symbol;

                console.log('\n======================================================');
                console.log('🎯 RANDOM TOKEN DETECTED (TEST MODE)');
                console.log(`Mint Address: ${mintAddress}`);
                console.log(`Name: ${name} (${symbol})`);
                console.log('======================================================\n');

                if (client && forwardBot) {
                    try {
                        hasForwarded = true;
                        console.log(`✈️  Attempting to forward mint address to ${forwardBot}...`);
                        await client.sendMessage(forwardBot, { message: mintAddress });
                        console.log(`✅ Forwarded successfully!`);
                        console.log('Test complete. Exiting...');
                        process.exit(0);
                    } catch (err) {
                        console.error(`❌ Failed to forward to Telegram: ${err.message}`);
                        hasForwarded = false; // Allow retry if it failed
                    }
                }
            } else if (parsedData.message) {
                console.log(`[PumpPortal] ${parsedData.message}`);
            }
        } catch (e) {
            console.error("Error parsing message:", e);
        }
    });

    ws.on('close', () => console.log('❌ Connection closed.'));
    ws.on('error', err => console.error('WebSocket error:', err));
}

if (!apiId || !apiHash || !forwardBot) {
    console.error('❌ Missing credentials in .env');
    process.exit(1);
}

startTestScanner();
