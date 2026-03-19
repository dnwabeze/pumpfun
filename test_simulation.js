require('dotenv').config();
const positionManager = require('./position_manager');
const jitoBuyer = require('./jito_buyer');

// Mock settings for testing
process.env.SL_PERCENT = "-10";
process.env.TP_PERCENT = "20";
process.env.DEV_SELL_ENABLED = "true";
process.env.JITO_DRY_RUN = "true"; // IMPORTANT: Always dry run for tests

const SL_PERCENT = -10;
const TP_PERCENT = 20;

async function runSimulation() {
    console.log("--- 🧪 SL/TP & Dev Sell Simulation ---");
    
    const mockMint = "TestMint12345678901234567890123456789012";
    const devAddress = "DevWallet123456789012345678901234567890";
    
    console.log("1. Adding mock position (Buy at 100 SOL Market Cap)...");
    positionManager.addPosition(mockMint, {
        developerAddress: devAddress,
        buyMarketCap: 100,
        symbol: "SIM"
    });

    // Helper to simulate a trade event
    async function simulateTrade(mc, trader, txType, label) {
        console.log(`\n[EVENT: ${label}] MC: ${mc} SOL | Trader: ${trader === devAddress ? 'DEVELOPER' : 'Other'} | Type: ${txType}`);
        
        const position = positionManager.getPosition(mockMint);
        if (!position) {
            console.log("Position already closed/sold.");
            return;
        }

        // --- Logic copied from index.js for verification ---
        if (trader === position.developerAddress && txType === 'sell') {
            console.log(`🚨 [DEV SELL] Developer sold! Triggering EMERGENCY SELL.`);
            await jitoBuyer.sellToken(mockMint);
            positionManager.removePosition(mockMint);
            return;
        }

        const pnlPercent = ((mc - position.buyMarketCap) / position.buyMarketCap) * 100;
        console.log(`Current PnL: ${pnlPercent.toFixed(2)}%`);

        if (pnlPercent >= TP_PERCENT) {
            console.log(`💰 [TAKE PROFIT] Hit TP! Selling...`);
            await jitoBuyer.sellToken(mockMint);
            positionManager.removePosition(mockMint);
        } else if (pnlPercent <= SL_PERCENT) {
            console.log(`📉 [STOP LOSS] Hit SL! Selling...`);
            await jitoBuyer.sellToken(mockMint);
            positionManager.removePosition(mockMint);
        }
    }

    // Test cases
    await simulateTrade(105, "OtherWallet", "buy", "Small gain");
    await simulateTrade(125, "OtherWallet", "buy", "TP Threshold check");
    
    // Reset for SL test
    positionManager.addPosition(mockMint, { developerAddress: devAddress, buyMarketCap: 100, symbol: "SIM" });
    await simulateTrade(85, "OtherWallet", "sell", "SL Threshold check");

    // Reset for Dev Sell test
    positionManager.addPosition(mockMint, { developerAddress: devAddress, buyMarketCap: 100, symbol: "SIM" });
    await simulateTrade(100, devAddress, "sell", "Dev Sell check");

    console.log("\nSimulation finished. Check logs above for 'Triggering' messages.");
    console.log("Note: Actual sell calls were logged as DRY RUN.");
}

runSimulation();
