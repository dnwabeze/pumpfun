require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const forwardBot = process.env.FORWARD_BOT_USERNAME;
const sessionFile = 'session.txt';

async function testConnection() {
    if (!apiId || !apiHash || !forwardBot) {
        console.error('❌ Error: TELEGRAM_API_ID, TELEGRAM_API_HASH, or FORWARD_BOT_USERNAME is missing in .env!');
        process.exit(1);
    }

    let sessionString = '';
    if (fs.existsSync(sessionFile)) {
        sessionString = fs.readFileSync(sessionFile, 'utf8');
    }
    const stringSession = new StringSession(sessionString);
    
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    console.log('--- Telegram Login ---');
    await client.start({
        phoneNumber: async () => await input.text('Please enter your phone number (+...): '),
        password: async () => await input.text('Please enter your password (if any): '),
        phoneCode: async () => await input.text('Please enter the code you received: '),
        onError: (err) => console.log(err),
    });

    console.log('✅ Logged in successfully!');
    fs.writeFileSync(sessionFile, client.session.save());

    console.log(`Sending test message to ${forwardBot}...`);
    try {
        await client.sendMessage(forwardBot, { message: 'Connection Test: It Works! 🚀' });
        console.log('✅ Message sent! Check your Telegram bot.');
    } catch (err) {
        console.error(`❌ Failed to send message: ${err.message}`);
    }

    process.exit(0);
}

testConnection();
