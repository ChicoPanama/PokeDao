# 🚀 Deploy PokeDAO API to Render.com (10 Minutes)

Follow these exact steps to deploy and unlock eBay production access.

---

## Prerequisites

✅ You already have:
- GitHub account with PokeDAO repo
- eBay Developer Account
- This takes **10 minutes total**

---

## Step 1: Create Render Account (2 minutes)

1. Go to: **https://render.com**
2. Click **"Get Started"**
3. Sign up with **GitHub** (recommended - easiest integration)
4. Authorize Render to access your repositories

---

## Step 2: Create PostgreSQL Database (3 minutes)

**Render provides free PostgreSQL!**

1. In Render dashboard, click **"New +"** → **"PostgreSQL"**
2. Settings:
   - **Name**: `pokedao-db`
   - **Database**: `pokedao`
   - **User**: `pokedao`
   - **Region**: Oregon (US West)
   - **Plan**: **Free**

3. Click **"Create Database"**
4. Wait 1-2 minutes for provisioning
5. Copy the **"Internal Database URL"** (looks like: `postgresql://pokedao:...@...render.com/pokedao`)
   - Save this! You'll need it in Step 4

---

## Step 3: Get Free Redis (2 minutes)

**Upstash (Recommended - Free Forever)**

1. Go to: **https://console.upstash.com**
2. Sign up with GitHub (easiest)
3. Click **"Create Database"**
4. Settings:
   - **Name**: `pokedao-redis`
   - **Type**: **Regional**
   - **Region**: `us-east-1` (closest to Render)
   - **Eviction**: Enable
   - **TLS**: Enable

5. Click **"Create"**
6. On the database page:
   - Scroll to **"Connect"** section
   - Copy the **Redis URL** (looks like: `rediss://default:...@...upstash.io:6379`)
   - Save this! You'll need it in Step 4

**Alternative: Redis Cloud**
- Go to https://redis.com/try-free/
- Create free 30MB database
- Use connection string in Step 4

---

## Step 4: Deploy API (3 minutes)

1. Click **"New +"** → **"Web Service"**
2. Connect to GitHub:
   - Click **"Connect account"** (if not already connected)
   - Select **"ChicoPanama/PokeDao"**
   - Click **"Connect"**

3. Configure Service:
   - **Name**: `pokedao-api`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `api`
   - **Runtime**: Node
   - **Build Command**: `pnpm install`
   - **Start Command**: `pnpm start`
   - **Plan**: **Free**

4. **Add Environment Variables** (click "Advanced"):

   Click **"Add Environment Variable"** for each:

   ```
   Name: NODE_ENV
   Value: production
   ```

   ```
   Name: DATABASE_URL
   Value: <paste the Internal Database URL from Step 2>
   ```

   ```
   Name: REDIS_URL
   Value: <paste the Internal Redis URL from Step 3>
   ```

   ```
   Name: EBAY_MAD_VERIFICATION_TOKEN
   Value: 55a9ed6caab78e821aba2cd79115c98ded4d74ec6ac8329b139452184488f3a6
   ```

   ```
   Name: EBAY_MAD_ENDPOINT_URL
   Value: https://pokedao-api.onrender.com/webhooks/ebay/mad
   ```

   ```
   Name: JUSTTCG_API_KEY
   Value: tcg_0c712a0f573d487184689f13a0a7a6a9
   ```

   ```
   Name: DEEPSEEK_API_KEY
   Value: sk-b2b1b770275140a8872e98ba46a52cff
   ```

   ```
   Name: EBAY_APP_ID
   Value: ArcadioP-Pokedao-PRD-c3c559702-e00ba59f
   ```

5. Click **"Create Web Service"**

6. Wait 5-8 minutes for deployment
   - You'll see build logs in real-time
   - When it says **"Live"**, it's ready!

7. Your API URL will be: **`https://pokedao-api.onrender.com`**

---

## Step 5: Test the Endpoint (1 minute)

Once deployment shows "Live":

```bash
curl https://pokedao-api.onrender.com/health
```

Should return:
```json
{"status":"ok","redis":"PONG"}
```

Test the MAD endpoint:
```bash
curl -X POST https://pokedao-api.onrender.com/webhooks/ebay/mad \
  -H "Content-Type: application/json" \
  -d '{"challengeCode":"test-123"}'
```

Should return:
```json
{"challengeResponse":"a1b2c3d4..."}
```

✅ If both work, you're ready for eBay!

---

## Step 6: Configure eBay Developer Portal (2 minutes)

1. Go to: **https://developer.ebay.com/my/keys**

2. Select your app: **"Pokedao"**

3. Make sure you're in **"Production"** environment (not Sandbox)

4. Scroll to **"Marketplace Account Deletion Notification"**

5. Fill in:

   **Marketplace account deletion notification endpoint:**
   ```
   https://pokedao-api.onrender.com/webhooks/ebay/mad
   ```

   **Verification token:**
   ```
   55a9ed6caab78e821aba2cd79115c98ded4d74ec6ac8329b139452184488f3a6
   ```

6. Click **"Save"**

7. Click **"Send Test Notification"**

8. Wait 5-10 seconds

9. You should see: ✅ **"Verified"**

10. Your app status will change from **"Non Compliant"** → **"Compliant"**

---

## Step 7: Update Production Keys (1 minute)

Now that you're compliant, get your production eBay keys:

1. In eBay Developer Portal, go to **"Application Keys"**
2. Switch to **"Production"** tab
3. Copy your **Production App ID** (not Sandbox)
4. Update in Render:
   - Go to Render dashboard → `pokedao-api` → "Environment"
   - Update `EBAY_APP_ID` with production value
   - Click "Save Changes"

---

## 🎉 Done! Production Unlocked!

You now have:
- ✅ Production API deployed with HTTPS
- ✅ eBay MAD compliance verified
- ✅ Production eBay API access
- ✅ Free hosting (Render free tier)
- ✅ Auto-deployment on git push

**Your API is live at:** `https://pokedao-api.onrender.com`

**Available endpoints:**
- `GET /health` - Health check
- `GET /api/cards` - List cards
- `GET /feed` - Recent listings
- `POST /webhooks/ebay/mad` - eBay compliance (verified!)

---

## Troubleshooting

### Build Failed
- Check Render logs for specific error
- Make sure `api/package.json` has `pnpm start` script
- Verify pnpm is being used (not npm)

### Health Check Failing
- Check DATABASE_URL is correct (internal URL, not external)
- Check REDIS_URL is correct (internal URL)
- View logs in Render dashboard

### eBay Verification Failed
- Verify endpoint URL is exact: `https://pokedao-api.onrender.com/webhooks/ebay/mad`
- Verify token is exact (no extra spaces)
- Check Render logs to see if eBay's test request arrived

### Still "Non Compliant"
- Wait 5-10 minutes after verification
- Try logging out and back into eBay Developer Portal
- Verify you're in "Production" environment (not Sandbox)

---

## Cost

**Free Forever Plan:**
- **Render API**: Free (750 hours/month - enough for 24/7)
- **Render PostgreSQL**: Free (1GB storage, 90 day data retention)
- **Upstash Redis**: Free (10,000 commands/day, 256MB storage)

**Total: $0/month** ✅

**Paid Plans (optional later):**
- Render Starter: $7/month (better performance, more hours)
- Render Professional: $25/month (custom domains, more resources)
- Upstash Pro: $10/month (100K commands/day)

For now, free tier is perfect for development and production testing!

---

## Next Steps After Deployment

1. ✅ Test collecting eBay comps with production API
2. ✅ Integrate eBay data into JustTCG pipeline
3. ✅ Build Phase 2: Signal Generation
4. ✅ Deploy Telegram bot for posting signals

---

**Need Help?**

Check Render docs: https://render.com/docs
Or review logs in Render dashboard under "Logs" tab

---

**Congratulations! You're production-ready! 🚀**
