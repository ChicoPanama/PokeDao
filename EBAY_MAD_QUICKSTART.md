# eBay MAD Quick Start

**Copy these values into eBay Developer Portal:**

## 1. eBay Portal Configuration

Go to: https://developer.ebay.com/my/keys → Select "Pokedao" (Production)

### Marketplace Account Deletion Notification

**Endpoint URL:**
```
https://YOUR-DEPLOYED-URL/webhooks/ebay/mad
```
*(Replace with your actual production URL after deployment)*

**Verification Token:**
```
55a9ed6caab78e821aba2cd79115c98ded4d74ec6ac8329b139452184488f3a6
```

---

## 2. Quick Deploy to Render.com (Free)

1. Go to https://render.com
2. New → Web Service → Connect GitHub → Select `ChicoPanama/PokeDao`
3. Settings:
   - **Root Directory**: `api`
   - **Build Command**: `pnpm install`
   - **Start Command**: `pnpm start`
4. Add Environment Variables:
   ```
   EBAY_MAD_VERIFICATION_TOKEN=55a9ed6caab78e821aba2cd79115c98ded4d74ec6ac8329b139452184488f3a6
   EBAY_MAD_ENDPOINT_URL=https://pokedao-api.onrender.com/webhooks/ebay/mad
   DATABASE_URL=<your-db-url>
   REDIS_URL=<your-redis-url>
   ```
5. Deploy
6. Your URL will be: `https://pokedao-api.onrender.com`

Then paste into eBay portal:
```
https://pokedao-api.onrender.com/webhooks/ebay/mad
```

---

## 3. Test Locally First

```bash
cd /Users/arcadio/dev/pokedao/api
pnpm dev

# In another terminal:
curl -X POST http://localhost:3000/webhooks/ebay/mad \
  -H "Content-Type: application/json" \
  -d '{"challengeCode": "test-123"}'
```

Should return: `{"challengeResponse":"..."}`

---

## 4. Verify in eBay Portal

1. Save your configuration
2. Click "Send Test Notification"
3. Wait for ✅ **"Verified"**
4. App status changes to **"Compliant"**
5. Production API unlocked! 🎉

---

**Full Guide**: See [docs/EBAY_MAD_SETUP.md](docs/EBAY_MAD_SETUP.md)
