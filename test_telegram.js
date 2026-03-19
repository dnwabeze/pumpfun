require('dotenv').config();
const axios = require('axios');

async function sendTest() {
    const token = process.env.TELEGRAM_BOT_TOKEN_API;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error("❌ Error: TELEGRAM_BOT_TOKEN_API or TELEGRAM_CHAT_ID is missing in your .env file!");
        process.exit(1);
    }

    console.log(`Sending test message to Chat ID: ${chatId}...`);

    try {
        const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: "✅ *SYSTEM ONLINE*\n\nThis is a live test message from your Pump.fun Sniper Bot perfectly configuring your BotFather API connection!",
            parse_mode: "Markdown",
            disable_web_page_preview: true
        });
        
        console.log("✅ Success! The test message was delivered perfectly. Check your Telegram app!");
    } catch (err) {
        if (err.response && err.response.data) {
            console.error(`❌ Telegram API rejected the message:`, err.response.data.description);
        } else {
            console.error(`❌ Network Error:`, err.message);
        }
    }
}

sendTest();
