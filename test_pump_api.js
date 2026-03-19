const axios = require('axios');

async function test() {
    // A random dev wallet (example)
    const devWallet = "39xPzB4a9jR5VwA8B1Wn1oU6QhR3M2h2QhZ4x2Bw1Yv3"; // Just a random pubkey for testing API structure, if it 404s we know the structure at least
    try {
        const response = await axios.get(`https://frontend-api.pump.fun/balances/${devWallet}`);
        console.log("Balances:", response.data);
    } catch (e) {
        console.log("Failed balances.");
    }

    try {
        // pump frontend actually uses: https://frontend-api.pump.fun/coins/user-created-coins/{pubkey}?offset=0&limit=10
        const res2 = await axios.get(`https://frontend-api.pump.fun/coins/user-created-coins/${devWallet}?offset=0&limit=10`);
        console.log("Created Coins:", res2.data.length);
        if (res2.data.length > 0) {
            console.log(res2.data[0]);
        }
    } catch (e) {
        console.log("Failed created coins:", e.message);
    }
}
test();
