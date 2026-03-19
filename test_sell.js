require('dotenv').config();
const jitoBuyer = require('./jito_buyer');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function test() {
    console.log("--- Jito Sell Test ---");
    rl.question("Enter the Mint Address of the token you want to sell: ", async (mint) => {
        rl.question("Enter percentage to sell (e.g. 100): ", async (percent) => {
            console.log(`Attempting to sell ${percent}% of ${mint}...`);
            await jitoBuyer.sellToken(mint, parseFloat(percent));
            console.log("Test execution completed. Check logs for bundle status.");
            rl.close();
        });
    });
}

if (!process.env.SOLANA_PRIVATE_KEY) {
    console.error("Please set SOLANA_PRIVATE_KEY in .env");
    process.exit(1);
}

test();
