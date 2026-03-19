require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const SOCIALDATA_API_KEY = process.env.SOCIALDATA_API_KEY;
const AI_API_KEY = process.env.AI_API_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_API;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MIN_LIKES = parseInt(process.env.MIN_LIKES_THRESHOLD || "5");

const PLAYBOOK_FILE = 'alpha_playbook.json';
const PROCESSED_FILE = 'processed_tweets.json';
const LAST_RUN_FILE = 'last_radar_run.json';
const MAX_TWEET_AGE_MINUTES = 4320; // 3 days
const MIN_SCAN_GAP_MINUTES = 15; // Hard protection against restart loops

let playbook = [];
let processedTweets = new Set();

if (fs.existsSync(PLAYBOOK_FILE)) {
    playbook = JSON.parse(fs.readFileSync(PLAYBOOK_FILE, 'utf8'));
}

if (fs.existsSync(PROCESSED_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
        processedTweets = new Set(data);
    } catch (e) {
        processedTweets = new Set();
    }
}

function saveProcessed() {
    // Keep only last 2000 to save space
    const list = Array.from(processedTweets).slice(-2000);
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(list));
}

async function sendTelegramAlert(msg) {
    if (BOT_TOKEN && CHAT_ID) {
        try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: CHAT_ID,
                text: msg,
                disable_web_page_preview: true,
                parse_mode: 'Markdown'
            });
        } catch (err) {
            console.error(`❌ Discovery Alert failed: ${err.message}`);
        }
    }
}

async function analyzeTweet(tweet) {
    if (!AI_API_KEY) return null;

    const prompt = `
Analyze this tweet. Is it an announcement for a NEW launch?
Identify if it is a TOKEN LAUNCH (Solana/BNB) or a PRODUCT LAUNCH (website, software, app) WITHOUT a token.

Tweet: "${tweet.full_text}"

Return JSON:
{
  "isLaunch": true,
  "type": "token_launch" OR "product_launch",
  "hasToken": true OR false,
  "confidenceScore": 90,
  "reason": "Short explanation of why this was flagged",
  "name": "Project Name",
  "symbol": "Ticker if any"
}
Otherwise return {"isLaunch": false}.
Return ONLY JSON.
`;

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${AI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }]
            }
        );

        const resultText = response.data.candidates[0].content.parts[0].text;
        const cleanJson = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (err) {
        console.error("AI Analysis Error:", err.message);
        return null;
    }
}

let isRadarRunning = false;

async function runRadar() {
    if (isRadarRunning) {
        console.log("⚠️ [X-RADAR] Scan already in progress, skipping this cycle.");
        return;
    }
    
    if (!SOCIALDATA_API_KEY) {
        console.error("❌ SOCIALDATA_API_KEY missing.");
        return;
    }

    // Hard protection against restart loops
    if (fs.existsSync(LAST_RUN_FILE)) {
        try {
            const { lastRun } = JSON.parse(fs.readFileSync(LAST_RUN_FILE, 'utf8'));
            const minutesSinceLastRun = (Date.now() - lastRun) / (1000 * 60);
            if (minutesSinceLastRun < MIN_SCAN_GAP_MINUTES) {
                console.log(`⏳ [X-RADAR] Too soon since last run (${minutesSinceLastRun.toFixed(1)}m). Skipping to protect quota.`);
                return;
            }
        } catch (e) {}
    }

    isRadarRunning = true;
    console.log("🔍 [X-RADAR] Scanning for direct launch keywords...");
    
    // Save current run time
    fs.writeFileSync(LAST_RUN_FILE, JSON.stringify({ lastRun: Date.now() }));

    // SINGLE consolidated query to save 75% of API calls
    const bigQuery = '("launching on pump.fun" OR "launching on bnb" OR "stealth launch solana" OR "stealth launch bnb" OR "dropping on pump.fun")';
    const queries = [bigQuery];

    for (const query of queries) {
        try {
            const res = await axios.get(`https://api.socialdata.tools/twitter/search`, {
                params: { query: query, type: 'Latest' },
                headers: { 'Authorization': `Bearer ${SOCIALDATA_API_KEY}` }
            });

            const tweets = (res.data.tweets || []).slice(0, 15);
            console.log(`   Fetched ${tweets.length} candidates. Analyzing top 4 with 15s delays...`);

            let analyzedCount = 0;
            for (const tweet of tweets) {
                if (analyzedCount >= 4) break; 

                // 1. Deduplication
                if (processedTweets.has(tweet.id_str)) continue;

                // 2. Freshness Check (3 days)
                const createdAt = new Date(tweet.created_at);
                const now = new Date();
                const ageMinutes = (now - createdAt) / (1000 * 60);
                if (ageMinutes > MAX_TWEET_AGE_MINUTES) continue;

                // 3. Pre-filters (Engagement)
                if (tweet.favorite_count < MIN_LIKES) continue;
                if (tweet.user.followers_count < 100) continue;

                // 4. Ultra Rate Limiting (60s before first, 30s after)
                const waitTime = analyzedCount === 0 ? 60000 : 30000;
                console.log(`⏳ Waiting ${waitTime/1000}s for AI quota...`);
                await new Promise(r => setTimeout(r, waitTime));
                
                analyzedCount++;

                try {
                    const analysis = await analyzeTweet(tweet);
                    if (analysis && analysis.isLaunch && analysis.confidenceScore > 75) {
                        process.stdout.write('🎯 '); 
                        
                        const typeLabel = analysis.type === 'token_launch' ? '🚀 TOKEN LAUNCH' : '🛠️ PRODUCT LAUNCH';
                        const tokenInfo = analysis.hasToken ? `*Ticker:* $${analysis.symbol}\n` : `*No Token Detected (Product Only)*\n`;

                        const alertMsg = `🦅 *RADAR DETECTION: ${typeLabel}*\n\n` +
                            `*Project:* ${analysis.name}\n` +
                            tokenInfo + 
                            `*Reason:* ${analysis.reason}\n\n` +
                            `*Time:* ${ageMinutes.toFixed(0)} minutes ago\n` +
                            `*Tweet:* [View on X](https://x.com/${tweet.user.screen_name}/status/${tweet.id_str})\n\n` +
                            `🤖 _AI Analysis powered by Gemini_`;
                        
                        await sendTelegramAlert(alertMsg);
                        
                        processedTweets.add(tweet.id_str);
                        saveProcessed();
                    }
                } catch (aiErr) {
                    const is429 = aiErr.response?.status === 429 || aiErr.message?.includes('429');
                    if (is429) {
                        console.error("⛔ EXTREME RATE LIMIT: Gemini is blocked. Sleeping for 15 MINUTES...");
                        await new Promise(r => setTimeout(r, 900000)); // 15 minute backoff
                        break; 
                    } else {
                        console.error("AI Error:", aiErr.message);
                    }
                }
            }
        } catch (err) {
            console.error(`Search failed: ${err.message}`);
        }
    }
    isRadarRunning = false;
}

// Run immediately with a jitter to avoid instant 429s on restarts
console.log("🚦 [X-RADAR] Bot starting in 10 seconds (Rate limit protection)...");
setTimeout(() => {
    runRadar();
}, 10000);

const interval = parseInt(process.env.DISCOVERY_INTERVAL_MIN || "20");
setInterval(runRadar, interval * 60 * 1000);

// Global Error Handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
