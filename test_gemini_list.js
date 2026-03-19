require('dotenv').config();
const axios = require('axios');

async function test() {
    const key = process.env.AI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    
    console.log(`Listing models for key...`);
    try {
        const res = await axios.get(url);
        console.log("✅ Models found:");
        res.data.models.forEach(m => console.log(` - ${m.name}`));
    } catch (e) {
        console.log(`❌ FAILED: ${e.response?.status || e.message}`);
        if (e.response && e.response.data) {
            console.log(`   Detail: ${JSON.stringify(e.response.data)}`);
        }
    }
}
test();
