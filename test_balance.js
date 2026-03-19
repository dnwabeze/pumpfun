const { Connection, PublicKey } = require('@solana/web3.js');

const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=1de956b9-37f9-460d-bc01-83da701467cc"; // using a typical format or their env URL

async function run() {
    const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
    const wallet = new PublicKey("BP1m37jwAVZW6vgxMokyiLM1zWXt7xSfgXUeXso6ToQ3");
    const mint = new PublicKey("ALVHhoi4DQjei19QsViQydgxo6enx8jXYMzXiQkZpump");
    
    console.log(`Checking balance for ${wallet.toBase58()} on mint ${mint.toBase58()}...`);

    const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    
    try {
        const accounts = await connection.getParsedTokenAccountsByOwner(
            wallet,
            { programId: TOKEN_PROGRAM_ID }
        );
        
        console.log(`Found ${accounts.value.length} token accounts using Token Program.`);
        
        const target = accounts.value.find(acc => acc.account.data.parsed.info.mint === mint.toBase58());
        if (target) {
            console.log("SUCCESS! Target account found:");
            console.log(JSON.stringify(target.account.data.parsed.info.tokenAmount, null, 2));
        } else {
            console.log("❌ Token not found in wallet's token accounts.");
            console.log("List of mints found in wallet:");
            accounts.value.forEach(acc => {
                console.log(` - ${acc.account.data.parsed.info.mint} : ${acc.account.data.parsed.info.tokenAmount.uiAmount}`);
            });
        }
    } catch (e) {
        console.error("RPC Error:", e.message);
    }
}

require('dotenv').config();
run();
