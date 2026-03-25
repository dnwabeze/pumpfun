# Quick Reference Guide - Pump.fun Bot Web Interface

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Start the dev server
npm run dev

# 2. Open in browser
# http://localhost:3000

# 3. Fill in your RPC URL and private key
# 4. Click "Save Configuration"
# 5. Click "▶ Run Bot"
```

## 📋 Essential Configuration

| Setting | Example | Required |
|---------|---------|----------|
| RPC_URL | https://api.mainnet-beta.solana.com | ✅ Yes |
| SOLANA_PRIVATE_KEY | 5K8kZ... (your private key) | ✅ Yes |
| TARGET_X | @pumpcoinmemes | ❌ No* |
| TARGET_TELEGRAM | @pumpcoinchannel | ❌ No* |
| BUY_AMOUNT_SOL | 0.01 | ✅ Yes (default) |

*At least one target required for token detection

## 🎮 Dashboard Controls

| Button | Action | When to Use |
|--------|--------|------------|
| Save Configuration | Saves to browser local storage | After any changes |
| Export as .env | Downloads .env file | Backup or CLI use |
| ▶ Run Bot | Starts the trading bot | When ready to trade |

## 💰 Trading Parameters

| Parameter | Default | Safe Range | Tips |
|-----------|---------|-----------|------|
| BUY_AMOUNT_SOL | 0.01 | 0.001 - 1.0 | Start small |
| JITO_TIP_AMOUNT_SOL | 0.001 | 0.0005 - 0.01 | Higher = faster |
| SL_PERCENT | -15 | -5 to -50 | Negative number! |
| TP_PERCENT | 50 | 10 to 500 | Positive number |

## 🔒 Security Settings

| Filter | Purpose | Recommended |
|--------|---------|------------|
| REQUIRE_WEBSITE | Block scams | ✅ true |
| MAX_BUNDLE_SNIPED_SOL | Avoid snipers | 10-15 SOL |
| MIN_DEV_BUY_SOL | Min dev commitment | 0.5-2.0 SOL |
| KOTH_SELL_MC_SOL | Auto-exit at peak | 50-100 SOL |

## ⚠️ Important Reminders

- **NEVER share private keys** publicly
- **Always test with dry run first** (`JITO_DRY_RUN: true`)
- **Start with small amounts** (0.01 SOL)
- **Monitor Telegram alerts** constantly
- **Keep wallet funded** with enough SOL for trades + fees
- **Backup your .env** file regularly

## 🆘 Common Issues

| Problem | Solution |
|---------|----------|
| Bot won't start | Check RPC URL and private key |
| Configuration lost | Check browser local storage |
| Trades not executing | Enable dry run first, check SOL balance |
| Telegram no alerts | Verify Telegram API credentials |
| High slippage | Increase JITO_TIP_AMOUNT_SOL |

## 📊 Monitoring Your Bot

**Telegram Alerts Show:**
- 🟢 [BUY INITIATED] - Buy executed
- 💰 [TAKE PROFIT] - Sold for profit
- 📉 [STOP LOSS] - Cut losses
- 👑 [KOTH SECURED] - Sold at peak
- 🚨 [DEV DUMP] - Dev rug detected
- ❌ [BUY FAILED] - Trade execution failed

## 🎯 Beginner Strategy

```
BUY_AMOUNT_SOL=0.01
JITO_TIP_AMOUNT_SOL=0.001
SL_PERCENT=-15
TP_PERCENT=50
REQUIRE_WEBSITE=true
MAX_BUNDLE_SNIPED_SOL=10
MIN_DEV_BUY_SOL=0.5
JITO_DRY_RUN=true (FIRST!)
```

Start with dry run for 24+ hours, then switch to real trading.

## 🏆 Advanced Strategy

```
BUY_AMOUNT_SOL=0.1
JITO_TIP_AMOUNT_SOL=0.005
SL_PERCENT=-10
TP_PERCENT=100
REQUIRE_WEBSITE=true
MAX_BUNDLE_SNIPED_SOL=5 (stricter)
MIN_DEV_BUY_SOL=1.0 (higher confidence)
FOLLOW_WALLETS=wallet1,wallet2
JITO_DRY_RUN=false
```

For experienced traders with larger capital.

## 📞 Support Resources

- **Docs**: Read `WEB_INTERFACE_GUIDE.md`
- **Issues**: Check `SETUP_SUMMARY.md`
- **RPC Providers**: https://docs.solana.com/cluster/rpc-endpoints
- **Jito Docs**: https://docs.jito.wtf

## 🔗 Key URLs

| Service | URL |
|---------|-----|
| Pump.fun | https://pump.fun |
| Solana RPC | https://api.mainnet-beta.solana.com |
| Jito Block Engine | https://mainnet.block-engine.jito.wtf |
| Helius RPC | https://mainnet.helius-rpc.com |

---

**Ready to trade? Start with:** `npm run dev` → Fill form → Save → Run! 🚀
