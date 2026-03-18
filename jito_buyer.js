const { Connection, Keypair, VersionedTransaction, PublicKey, SystemProgram, TransactionMessage } = require('@solana/web3.js');
const bs58 = require('bs58').default || require('bs58');
const axios = require('axios');
require('dotenv').config();

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const JITO_ENGINE = process.env.JITO_BLOCK_ENGINE_URL || "https://mainnet.block-engine.jito.wtf/api/v1/bundles";

const TIP_ACCOUNTS = [
    "96gYZGLnJYVFmbjzopPSU6QiCRg1uPXqkEw",
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvVkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "DfXygSm4jcyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjv",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "DttWaMuVvTiduZRnguLF7FsBog82KNTAA1D2RMYfC2eR",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeMgRwjLFmZ"
];

let connection;
let wallet;

function init() {
    if (!process.env.SOLANA_PRIVATE_KEY) {
        console.warn("⚠️ SOLANA_PRIVATE_KEY not set in .env! Jito Buying disabled.");
        return false;
    }
    try {
        connection = new Connection(RPC_URL, "confirmed");
        const privKey = process.env.SOLANA_PRIVATE_KEY.trim();
        let decoded;
        if (privKey.includes('[')) {
            // JSON string array
            decoded = Uint8Array.from(JSON.parse(privKey));
        } else {
            // Base58 wrapper
            decoded = bs58.decode(privKey);
        }
        wallet = Keypair.fromSecretKey(decoded);
        console.log(`✅ Loaded Solana Wallet: ${wallet.publicKey.toBase58()}`);
        return true;
    } catch (e) {
        console.error("❌ Failed to parse SOLANA_PRIVATE_KEY:", e.message);
        return false;
    }
}

async function buyToken(mintAddress) {
    if (!wallet) return;

    try {
        console.log(`[JitoBuyer] Creating buy transaction for ${mintAddress}...`);
        
        // 1. Get Buy Transaction from PumpPortal
        const localTradeParams = {
            "publicKey": wallet.publicKey.toBase58(),
            "action": "buy",
            "mint": mintAddress,
            "denominatedInSol": "true",
            "amount": process.env.BUY_AMOUNT_SOL || 0.01,
            "slippage": parseFloat(process.env.SLIPPAGE || "15"),
            "priorityFee": parseFloat(process.env.PRIORITY_FEE || "0.0001"),
            "pool": "pump"
        };

        console.log(`[JitoBuyer] 🧪 Trade Params - Buy: ${localTradeParams.amount} SOL | Slippage: ${localTradeParams.slippage}% | Priority Fee: ${localTradeParams.priorityFee} SOL | Jito Tip: ${process.env.JITO_TIP_AMOUNT_SOL} SOL`);
        
        const response = await axios.post(`https://pumpportal.fun/api/trade-local`, localTradeParams, {
            responseType: 'arraybuffer' // important for getting the binary transaction
        });

        const tx1Bytes = new Uint8Array(response.data);
        const tx1 = VersionedTransaction.deserialize(tx1Bytes);
        tx1.sign([wallet]);
        const tx1Base58 = bs58.encode(tx1.serialize());

        // 2. Create Tip Transaction
        const tipAccount = TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];
        const tipAmountSol = parseFloat(process.env.JITO_TIP_AMOUNT_SOL || "0.001");
        const tipLamports = Math.floor(tipAmountSol * 1e9);

        const { blockhash } = await connection.getLatestBlockhash('finalized');

        const tipInstruction = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new PublicKey(tipAccount),
            lamports: tipLamports
        });

        const messageV0 = new TransactionMessage({
            payerKey: wallet.publicKey,
            recentBlockhash: blockhash,
            instructions: [tipInstruction]
        }).compileToV0Message();

        const tx2 = new VersionedTransaction(messageV0);
        tx2.sign([wallet]);
        const tx2Base58 = bs58.encode(tx2.serialize());

        // 3. Send Bundle
        console.log(`[JitoBuyer] Sending bundle with ${tipAmountSol} SOL tip to Jito...`);
        const payload = {
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [
                [ tx1Base58, tx2Base58 ]
            ]
        };

        if (process.env.JITO_DRY_RUN === 'true') {
            console.log(`[JitoBuyer] 🧪 DRY RUN MODE ACTIVE - Bundle successfully constructed and signed, but NOT sent.`);
            console.log(`[JitoBuyer] 🧪 Buy Amount: ${process.env.BUY_AMOUNT_SOL} SOL | Jito Tip: ${tipAmountSol} SOL | Slippage: ${process.env.SLIPPAGE}% | Priority Fee: ${process.env.PRIORITY_FEE} SOL`);
            return;
        }

        const jitoRes = await axios.post(JITO_ENGINE, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const bundleId = jitoRes.data?.result;
        console.log(`✅ [JitoBuyer] Bundle sent successfully! ID: ${bundleId}`);
        console.log(`Verify bundle at: https://explorer.jito.wtf/bundle/${bundleId}`);

    } catch (error) {
        console.error("❌ [JitoBuyer] Error buying token:", error.message);
        if (error.response?.data) {
             try {
                const text = new TextDecoder().decode(error.response.data);
                console.error("Response:", text);
             } catch(e) {
                console.error("Response:", error.response.data);
             }
        }
    }
}

// Initialize on module load
const isEnabled = init();

module.exports = {
    buyToken,
    isEnabled
};
