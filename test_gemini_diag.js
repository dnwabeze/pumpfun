require('dotenv').config();
const axios = require('axios');

async function test() {
    const key = process.env.AI_API_KEY;
    const endpoints = ['v1', 'v1beta'];
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];

    for (const v of endpoints) {
        for (const m of models) {
            const url = `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${key}`;
            console.log(`Testing: ${v} / ${m}...`);
            try {
                const res = await axios.post(url, {
                    contents: [{ parts: [{ text: "hi" }] }]
                });
                console.log(`✅ SUCCESS! ${v}/${m} works.`);
                return;
            } catch (e) {
                console.log(`❌ FAILED: ${v}/${m} (${e.response?.status || e.message})`);
                if (e.response && e.response.data) {
                    console.log(`   Detail: ${JSON.stringify(e.response.data.error.message)}`);
                }
            }
        }
    }
}
test();
