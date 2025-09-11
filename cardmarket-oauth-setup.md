# CardMarket OAuth Setup Guide

## 🔐 Secure API Access Setup

### Step 1: Create CardMarket Developer Account

1. **Visit CardMarket API Portal**
   - Go to: https://www.cardmarket.com/en/Magic/Account/API
   - Login to your CardMarket account
   - Navigate to "API" section

2. **Create New Application**
   - Click "Create New App"
   - Fill application details:
     - **Name**: PokeDao Pokemon Data Extractor
     - **Description**: Pokemon TCG data extraction for analysis
     - **Website**: Your project URL
     - **Callback URL**: Not required for desktop apps

### Step 2: OAuth 1.0 Credentials

After creating your app, you'll receive:

```
Consumer Key:        [32-character string]
Consumer Secret:     [64-character string]
Access Token:        [32-character string]
Access Token Secret: [64-character string]
```

### Step 3: Environment Configuration

1. **Create .env file in project root**:
```bash
cp .env.example .env
```

2. **Add your CardMarket credentials**:
```env
# CardMarket API Configuration
CARDMARKET_CONSUMER_KEY=your_consumer_key_here
CARDMARKET_CONSUMER_SECRET=your_consumer_secret_here
CARDMARKET_ACCESS_TOKEN=your_access_token_here
CARDMARKET_ACCESS_TOKEN_SECRET=your_access_token_secret_here
```

3. **Verify .env is in .gitignore**:
```bash
echo ".env" >> .gitignore
```

### Step 4: Test Connection

```bash
node test-cardmarket-integration.js
```

### 🔒 Security Best Practices

1. **Never commit credentials to git**
   - Always use environment variables
   - Keep .env in .gitignore
   - Use different credentials for dev/prod

2. **Rate Limiting**
   - CardMarket allows ~120 requests/minute
   - Our config uses 2 requests/second (safe limit)
   - Implement exponential backoff for errors

3. **Error Handling**
   - Always handle OAuth errors gracefully
   - Log errors without exposing credentials
   - Implement retry logic for network issues

### 📊 API Limits

- **Requests**: 120 per minute
- **Daily Limit**: ~100,000 requests (varies by account)
- **Response Size**: Max 1MB per request
- **Timeout**: 30 seconds

### 🎯 Pokemon TCG Specific

CardMarket Game ID for Pokemon: **6**

Available endpoints:
- `/games/6/expansions` - Pokemon sets
- `/products?game=6` - Pokemon products
- `/products/{id}/articles` - Market prices

### 🔧 Troubleshooting

**OAuth Error 401**: Invalid credentials
- Verify all 4 OAuth values are correct
- Check for extra spaces in .env file
- Ensure account has API access

**Rate Limit Error 429**: Too many requests
- Wait 60 seconds before retrying
- Reduce requests per second in config
- Implement proper delay between calls

**SSL Certificate Error**:
- Ensure system time is correct
- Update Node.js to latest version
- Check firewall/proxy settings

### 📞 Support

- **CardMarket API Docs**: https://api.cardmarket.com/ws/documentation/API_2.0/API_2.0_Overview
- **OAuth 1.0 Spec**: https://oauth.net/1/
- **Rate Limits**: https://api.cardmarket.com/ws/documentation/API_2.0/Rate_Limits