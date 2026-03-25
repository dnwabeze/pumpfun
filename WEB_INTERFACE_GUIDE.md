# Pump.fun Bot Web Interface Guide

Welcome to the Pump.fun Bot Configuration Dashboard! This guide will help you get started with the web-based interface.

## 🚀 Getting Started

### 1. Start the Development Server

```bash
npm run dev
```

The web interface will be available at `http://localhost:3000`

### 2. Configure Your Settings

The interface is organized into logical sections:

#### **RPC Configuration**
- **RPC URL**: Your Solana RPC endpoint (e.g., `https://api.mainnet-beta.solana.com`)
- **WebSocket URL**: WebSocket endpoint for real-time updates
- **Solana RPC URL**: Alternative RPC endpoint

#### **Target Configuration**
- **Target X Handle**: Your Twitter/X handle to monitor (e.g., `@yourhandle`)
- **Target Telegram**: Your Telegram channel to monitor

#### **Wallet Configuration**
- **Main Private Key**: Your primary Solana wallet's private key
- **Additional Keys**: Optional second, third, and fourth wallet keys
- ⚠️ **Security**: Never share your private keys! Keep them confidential.

#### **Jito Buying Configuration**
- **Buy Amount (SOL)**: How much SOL to spend per purchase
- **Jito Tip (SOL)**: MEV protection fee for Jito
- **Jito Block Engine URL**: Your Jito block engine endpoint
- **Dry Run Mode**: Test without actual transactions

#### **Stop Loss / Take Profit**
- **Stop Loss %**: Automatic sell at this loss percentage (e.g., `-15`)
- **Take Profit %**: Automatic sell at this profit percentage (e.g., `50`)
- **Enable Dev Sell Detection**: Auto-sell if developer dumps

#### **Wallet Follower Configuration**
- **Helius WebSocket URL**: For wallet monitoring
- **Wallets to Follow**: Comma-separated list of wallet addresses
- **Jito Tip for Following**: MEV protection for follower trades
- **Slippage %**: Maximum acceptable price slippage
- **Priority Fee**: Network priority fee

#### **Telegram Configuration**
- **Forward Bot Username**: Bot username to receive alerts
- **Telegram API ID**: Your Telegram API ID
- **Telegram API Hash**: Your Telegram API hash

#### **Security Filters**
- **Require Website**: Only trade tokens with websites
- **Max Bundle Sniped (SOL)**: Maximum SOL in opening bundle
- **Min Dev Buy (SOL)**: Minimum SOL dev must have spent
- **KOTH Sell Market Cap (SOL)**: Auto-sell at this market cap

## 💾 Saving & Loading Configuration

### Auto-Save
Your configuration is **automatically saved** to your browser's local storage when you click "Save Configuration".

### Loading Previous Config
When you return to the page, your last saved configuration will be automatically loaded.

### Export Configuration
Click **"Export as .env"** to download your settings as a `.env` file. This is useful for:
- Backing up your configuration
- Running the bot from the command line
- Sharing configurations (minus sensitive data like private keys)

## ▶️ Running the Bot

### Method 1: Web Interface (Recommended)
1. Fill in all required fields
2. Click **"Save Configuration"** to validate and save
3. Click **"▶ Run Bot"** to start the bot

The bot will:
- Start scanning for new tokens
- Monitor your target accounts
- Execute trades based on your configuration
- Send Telegram alerts for important events

### Method 2: Command Line
1. Export your configuration as `.env`
2. Place the `.env` file in your project root
3. Run: `npm run dev` or `node index.js`

## ⚙️ Configuration Tips

### For Beginners
Start with these settings:
```
BUY_AMOUNT_SOL: 0.01 (small amount for testing)
SL_PERCENT: -15 (15% stop loss)
TP_PERCENT: 50 (50% take profit)
JITO_DRY_RUN: true (test without real transactions)
```

### For Advanced Users
- Enable `JITO_DRY_RUN: false` to execute real trades
- Adjust `BUY_AMOUNT_SOL` based on your risk tolerance
- Use multiple wallets for better trade execution
- Monitor your Telegram alerts closely

## 🔒 Security Best Practices

1. **Never share your private keys** with anyone
2. Use environment variables (not hardcoded) for sensitive data
3. Test with small amounts first (`JITO_DRY_RUN: true`)
4. Keep your `.env` file secure
5. Use a dedicated wallet for bot trading
6. Regularly review Telegram alerts

## 🐛 Troubleshooting

### Bot Won't Start
- Check that all required fields are filled
- Verify your RPC URL is valid
- Ensure your private key is correct

### Configuration Not Saving
- Check browser's local storage settings
- Make sure you click "Save Configuration"
- Try exporting/importing the `.env` file

### Telegram Alerts Not Working
- Verify your Telegram API ID and hash
- Check that your bot token is valid
- Ensure Telegram API credentials are correct

### Trades Not Executing
- Enable dry run first to test the connection
- Check your wallet has sufficient SOL
- Verify your Jito configuration
- Check network status and gas fees

## 📊 Features

✅ **Easy Configuration**: Intuitive form interface
✅ **Auto-Save**: Configuration persists between sessions
✅ **Export/Import**: `.env` file support
✅ **Status Monitoring**: See bot status in real-time
✅ **Telegram Alerts**: Get notified of important events
✅ **Multiple Wallets**: Support for up to 4 wallets
✅ **Security Filters**: Advanced risk management options

## 🤝 Support

For issues or questions:
1. Check your configuration is complete
2. Review the console for error messages
3. Test with dry run mode enabled
4. Check Telegram alerts for execution status

## 📝 Additional Resources

- Pump.fun API: https://pumpportal.fun
- Solana RPC Providers: https://docs.solana.com/cluster/rpc-endpoints
- Jito Documentation: https://docs.jito.wtf
- Telegram Bot API: https://core.telegram.org/bots/api

---

**Happy Trading! 🚀**

Remember to trade responsibly and never invest more than you can afford to lose.
