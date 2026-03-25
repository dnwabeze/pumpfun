# Complete Configuration Reference

A comprehensive guide to every setting available in the Pump.fun Bot configuration dashboard.

## Table of Contents
1. [RPC Configuration](#rpc-configuration)
2. [Target Configuration](#target-configuration)
3. [Wallet Configuration](#wallet-configuration)
4. [Jito Buying Configuration](#jito-buying-configuration)
5. [Stop Loss / Take Profit](#stop-loss--take-profit)
6. [Wallet Follower Configuration](#wallet-follower-configuration)
7. [Telegram Configuration](#telegram-configuration)
8. [Security Filters](#security-filters)

---

## RPC Configuration

**Purpose:** Connect to Solana network for sending transactions and listening for events.

### RPC_URL
- **Type:** Text (URL)
- **Default:** `https://api.mainnet-beta.solana.com`
- **Required:** ✅ Yes
- **Description:** Your primary RPC endpoint for transaction submission
- **Examples:**
  - Alchemy: `https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
  - Helius: `https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY`
  - QuickNode: `https://solana-mainnet.quiknode.pro/YOUR_TOKEN/`
  - Triton: `https://api.mainnet-beta.solana.com`

### WSS_URL
- **Type:** Text (URL)
- **Default:** `wss://api.mainnet-beta.solana.com`
- **Required:** ✅ Yes (for real-time updates)
- **Description:** WebSocket endpoint for real-time token detection
- **Note:** Must be WSS (secure WebSocket), not HTTP

### SOLANA_RPC_URL
- **Type:** Text (URL)
- **Default:** `https://api.mainnet-beta.solana.com`
- **Required:** ✅ Yes
- **Description:** Alternative RPC endpoint (usually same as RPC_URL)

---

## Target Configuration

**Purpose:** Specify which tokens to monitor and trade based on creator socials.

### TARGET_X
- **Type:** Text (handle)
- **Default:** (empty - matches any)
- **Required:** ❌ No (but one of X or Telegram required)
- **Description:** X/Twitter handle to monitor
- **Examples:**
  - `@pumpdotfun`
  - `pumpdotfun` (with or without @)
  - `https://x.com/pumpdotfun` (full URL)

### TARGET_TELEGRAM
- **Type:** Text (handle/URL)
- **Default:** (empty - matches any)
- **Required:** ❌ No (but one of X or Telegram required)
- **Description:** Telegram channel/group to monitor
- **Examples:**
  - `@pumpcoin`
  - `pumpcoin` (with or without @)
  - `pumpcoin_official`

**Note:** Token must have BOTH target X or Telegram configured AND match them to be purchased.

---

## Wallet Configuration

**Purpose:** Provide Solana wallets for executing trades.

### SOLANA_PRIVATE_KEY
- **Type:** Text (base58 encoded)
- **Default:** (empty)
- **Required:** ✅ Yes
- **Description:** Private key of your main trading wallet
- **Format:** Base58 encoded (typically 88 characters)
- **⚠️ SECURITY:** Never share this key. Keep it secret!
- **How to get:**
  1. Use Phantom Wallet, Magic Eden, or Solana CLI
  2. Export/retrieve your wallet's private key
  3. Paste it in this field

### SOLANA_PRIVATE_KEY_2
- **Type:** Text (base58 encoded)
- **Default:** (empty)
- **Required:** ❌ No (optional)
- **Description:** Private key of second wallet for parallel execution
- **Use case:** Execute from multiple wallets simultaneously

### SOLANA_PRIVATE_KEY_3
- **Type:** Text (base58 encoded)
- **Default:** (empty)
- **Required:** ❌ No (optional)
- **Description:** Private key of third wallet

### SOLANA_PRIVATE_KEY_4
- **Type:** Text (base58 encoded)
- **Default:** (empty)
- **Required:** ❌ No (optional)
- **Description:** Private key of fourth wallet

**Multi-Wallet Strategy:**
- Use 1 wallet: Simple, all trades from one account
- Use 2+ wallets: Parallel execution, less likely to be rate-limited

---

## Jito Buying Configuration

**Purpose:** Configure MEV protection and token purchase settings.

### BUY_AMOUNT_SOL
- **Type:** Number (decimal)
- **Default:** `0.01`
- **Required:** ✅ Yes
- **Description:** Amount of SOL to spend on each token purchase
- **Range:** 0.001 to 1000 (practical: 0.001 to 10)
- **Recommendations:**
  - Conservative: 0.01 SOL
  - Moderate: 0.1 SOL
  - Aggressive: 0.5+ SOL
- **Impact:** Higher = bigger position, higher risk

### JITO_TIP_AMOUNT_SOL
- **Type:** Number (decimal)
- **Default:** `0.001`
- **Required:** ✅ Yes
- **Description:** MEV protection tip to Jito validators
- **Range:** 0.0001 to 1 (practical: 0.0005 to 0.01)
- **Impact:** Higher = faster execution, higher cost
- **Typical multiplier:** 10-20% of buy amount

### JITO_BLOCK_ENGINE_URL
- **Type:** Text (URL)
- **Default:** `https://mainnet.block-engine.jito.wtf/api/v1/bundles`
- **Required:** ✅ Yes
- **Description:** Jito block engine endpoint for MEV bundles
- **Note:** Use provided URL unless Jito updates it

### JITO_DRY_RUN
- **Type:** Checkbox (true/false)
- **Default:** `false`
- **Required:** ❌ No
- **Description:** Test mode - simulates trades without spending SOL
- **Usage:** Enable to test configuration before real trading
- **⚠️ IMPORTANT:** Always test with dry run enabled first!

---

## Stop Loss / Take Profit

**Purpose:** Automatic exit conditions for trades.

### SL_PERCENT
- **Type:** Number (percentage)
- **Default:** `-15`
- **Required:** ✅ Yes
- **Description:** Sell automatically if position drops this much
- **Range:** -1 to -99 (must be negative!)
- **Examples:**
  - `-15` = sell if down 15%
  - `-10` = sell if down 10% (tighter)
  - `-50` = sell if down 50% (looser)
- **Recommendation:** -15 to -25 for beginners

### TP_PERCENT
- **Type:** Number (percentage)
- **Default:** `50`
- **Required:** ✅ Yes
- **Description:** Sell automatically if position gains this much
- **Range:** 1 to 10000 (must be positive!)
- **Examples:**
  - `50` = sell if up 50%
  - `100` = sell if up 100%
  - `500` = sell if up 500%
- **Recommendation:** 50-100% for beginners

### DEV_SELL_ENABLED
- **Type:** Checkbox (true/false)
- **Default:** `false`
- **Required:** ❌ No
- **Description:** Emergency sell if token creator dumps
- **Purpose:** Protect against rug pulls
- **Usage:** Enable to detect and sell on dev dumps
- **Recommendation:** ✅ Enable (true)

---

## Wallet Follower Configuration

**Purpose:** Copy trades from other wallets (advanced feature).

### HELIUS_WS_URL
- **Type:** Text (URL)
- **Default:** (empty)
- **Required:** ❌ No (only if using wallet follower)
- **Description:** Helius WebSocket for wallet monitoring
- **Format:** `wss://mainnet.helius-rpc.com/?api-key=YOUR_KEY`
- **How to get:** Create account at helius.xyz

### FOLLOW_WALLETS
- **Type:** Text (comma-separated list)
- **Default:** (empty)
- **Required:** ❌ No
- **Description:** Wallet addresses to copy trades from
- **Format:** `wallet1,wallet2,wallet3`
- **Example:** `5KkC...,7jKm...,2mPq...`
- **Maximum:** Typically 5-10 wallets (balance needed)

### JITO_TIP_FOLLOW
- **Type:** Number (decimal)
- **Default:** `0.01`
- **Required:** ❌ No
- **Description:** Jito tip for following trades
- **Note:** Usually higher than regular buy tip
- **Recommendation:** 0.01-0.02 SOL

### SLIPPAGE
- **Type:** Number (percentage)
- **Default:** `15`
- **Required:** ❌ No
- **Description:** Max acceptable slippage when copying trades
- **Range:** 0.1 to 100
- **Recommendation:** 15-30%

### PRIORITY_FEE
- **Type:** Number (SOL, in microlamports typically)
- **Default:** `0.0001`
- **Required:** ❌ No
- **Description:** Priority fee for faster transactions
- **Recommendation:** 0.0001-0.001

### STOP_AFTER_FIRST_BUY
- **Type:** Checkbox (true/false)
- **Default:** `false`
- **Required:** ❌ No
- **Description:** Stop following after first successful buy
- **Use case:** "One-shot" mode - find and buy one token only
- **Recommendation:** ❌ false (for continuous trading)

---

## Telegram Configuration

**Purpose:** Get real-time alerts via Telegram.

### FORWARD_BOT_USERNAME
- **Type:** Text (username)
- **Default:** (empty)
- **Required:** ❌ No
- **Description:** Bot username to forward token CA to
- **Format:** `@your_bot_name`
- **Example:** `@pumpfun_sniper_bot`

### TELEGRAM_API_ID
- **Type:** Text (number)
- **Default:** (empty)
- **Required:** ❌ No (only if using Telegram)
- **Description:** Your Telegram API ID
- **How to get:**
  1. Go to https://my.telegram.org/auth
  2. Login with your Telegram account
  3. Go to "API development tools"
  4. Copy your API ID

### TELEGRAM_API_HASH
- **Type:** Text (hash)
- **Default:** (empty)
- **Required:** ❌ No (only if using Telegram)
- **Description:** Your Telegram API hash
- **How to get:** Same place as API ID
- **⚠️ SECURITY:** Keep this secret!

### TELEGRAM_BOT_TOKEN_API
- **Type:** Text (token)
- **Default:** (empty)
- **Required:** ❌ No
- **Description:** Bot token for sending alerts
- **How to get:**
  1. Message @BotFather on Telegram
  2. Create new bot: `/newbot`
  3. Get your token
- **⚠️ SECURITY:** Keep this secret!

### TELEGRAM_CHAT_ID
- **Type:** Text (number)
- **Default:** (empty)
- **Required:** ❌ No
- **Description:** Chat ID where to send alerts
- **How to get:**
  1. Message bot you created
  2. Go to: `https://api.telegram.org/botYOUR_TOKEN/getUpdates`
  3. Find chat_id in response

---

## Security Filters

**Purpose:** Risk management and protecting against scams.

### REQUIRE_WEBSITE
- **Type:** Checkbox (true/false)
- **Default:** `false`
- **Required:** ❌ No
- **Description:** Only trade tokens with websites
- **Purpose:** Filter out potential scams
- **Recommendation:** ✅ true (enable)

### MAX_BUNDLE_SNIPED_SOL
- **Type:** Number (SOL)
- **Default:** `15`
- **Required:** ❌ No
- **Description:** Max SOL from bundle snipers at launch
- **Purpose:** Avoid tokens with heavy initial bundle activity
- **Range:** 1 to 100
- **Recommendation:** 5-15 SOL

### MIN_DEV_BUY_SOL
- **Type:** Number (SOL)
- **Default:** `0.5`
- **Required:** ❌ No
- **Description:** Minimum SOL spent by dev at launch
- **Purpose:** Filter out low-confidence launches
- **Range:** 0.01 to 10
- **Recommendation:** 0.5-2.0 SOL

### KOTH_SELL_MC_SOL
- **Type:** Number (SOL)
- **Default:** `80`
- **Required:** ❌ No
- **Description:** "King of the Hill" - auto-sell at this market cap
- **Purpose:** Take profits at peak market cap
- **Range:** 10 to 1000
- **Recommendation:** 50-100 SOL

---

## Summary Table

| Setting | Type | Required | Default | Range |
|---------|------|----------|---------|-------|
| RPC_URL | URL | ✅ | varies | - |
| TARGET_X | text | ❌ | - | - |
| TARGET_TELEGRAM | text | ❌ | - | - |
| SOLANA_PRIVATE_KEY | text | ✅ | - | - |
| BUY_AMOUNT_SOL | number | ✅ | 0.01 | 0.001-1000 |
| JITO_TIP_AMOUNT_SOL | number | ✅ | 0.001 | 0.0001-1 |
| SL_PERCENT | number | ✅ | -15 | -1 to -99 |
| TP_PERCENT | number | ✅ | 50 | 1-10000 |
| REQUIRE_WEBSITE | bool | ❌ | false | true/false |
| MAX_BUNDLE_SNIPED_SOL | number | ❌ | 15 | 1-100 |

---

## Configuration Examples

### Conservative Starter
```
BUY_AMOUNT_SOL=0.01
JITO_TIP_AMOUNT_SOL=0.001
SL_PERCENT=-15
TP_PERCENT=50
REQUIRE_WEBSITE=true
MAX_BUNDLE_SNIPED_SOL=10
MIN_DEV_BUY_SOL=0.5
JITO_DRY_RUN=true
```

### Moderate Risk
```
BUY_AMOUNT_SOL=0.05
JITO_TIP_AMOUNT_SOL=0.003
SL_PERCENT=-20
TP_PERCENT=100
REQUIRE_WEBSITE=true
MAX_BUNDLE_SNIPED_SOL=7
MIN_DEV_BUY_SOL=1.0
JITO_DRY_RUN=false
```

### Aggressive
```
BUY_AMOUNT_SOL=0.5
JITO_TIP_AMOUNT_SOL=0.01
SL_PERCENT=-30
TP_PERCENT=200
REQUIRE_WEBSITE=false
MAX_BUNDLE_SNIPED_SOL=3
MIN_DEV_BUY_SOL=2.0
FOLLOW_WALLETS=wallet1,wallet2
JITO_DRY_RUN=false
```

---

**Questions? Check QUICK_REFERENCE.md or WEB_INTERFACE_GUIDE.md for more help!**
