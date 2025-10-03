# eBay Marketplace Account Deletion (MAD) Setup Guide

This guide walks you through deploying the eBay MAD endpoint and configuring it in the eBay Developer Portal to unlock Production API access.

---

## What Was Built

✅ **MAD Webhook Endpoint**: `/webhooks/ebay/mad`
✅ **Verification Handler**: Responds to eBay's one-time challenge
✅ **Deletion Handler**: Processes user deletion requests (GDPR compliant)
✅ **Environment Configuration**: Secure token storage
✅ **Error Handling**: Proper logging and retry support

**Location**: `api/src/routes/webhooks/ebay-mad.ts`

---

## Step 1: Deploy Your API to Production

You need a **publicly accessible HTTPS URL**. Choose one option:

### Option A: Deploy to Render.com (Recommended - Free Tier Available)

1. Go to https://render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repo: `ChicoPanama/PokeDao`
4. Configure:
   - **Name**: `pokedao-api`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `api`
   - **Build Command**: `pnpm install`
   - **Start Command**: `pnpm start`
   - **Instance Type**: Free

5. Add Environment Variables (click "Advanced" → "Add Environment Variable"):
   ```
   DATABASE_URL=<your-production-postgres-url>
   REDIS_URL=<your-production-redis-url>
   EBAY_MAD_VERIFICATION_TOKEN=55a9ed6caab78e821aba2cd79115c98ded4d74ec6ac8329b139452184488f3a6
   EBAY_MAD_ENDPOINT_URL=https://pokedao-api.onrender.com/webhooks/ebay/mad
   ```

6. Click "Create Web Service"
7. Wait for deployment (5-10 minutes)
8. Your endpoint will be: `https://pokedao-api.onrender.com/webhooks/ebay/mad`

### Option B: Deploy to Railway.app

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `ChicoPanama/PokeDao`
5. Add environment variables (same as Render)
6. Deploy

### Option C: Deploy to Vercel (if you have Next.js setup)

```bash
vercel --prod
```

### Option D: Use Your Own Server

If you have a VPS with SSL:

```bash
# On your server
cd /path/to/pokedao
git pull origin main
cd api
pnpm install
pnpm build

# Update .env with production values
nano .env

# Start with PM2
pm2 start dist/index.js --name pokedao-api
pm2 save
```

---

## Step 2: Test the Endpoint Locally First

Before deploying, test that the endpoint works:

### Start Your Local API

```bash
cd /Users/arcadio/dev/pokedao/api
pnpm install
pnpm dev
```

### Test Verification Challenge

```bash
curl -X POST http://localhost:3000/webhooks/ebay/mad \
  -H "Content-Type: application/json" \
  -d '{
    "challengeCode": "test-challenge-123"
  }'
```

**Expected Response:**
```json
{
  "challengeResponse": "a1b2c3d4e5f6..."
}
```

If you see this, the verification handler works! ✅

### Test Deletion Request

```bash
curl -X POST http://localhost:3000/webhooks/ebay/mad \
  -H "Content-Type: application/json" \
  -d '{
    "notificationId": "test-123",
    "metadata": {
      "userId": "test-user-456"
    }
  }'
```

**Expected Response:**
```json
{
  "ack": "success"
}
```

If you see this, the deletion handler works! ✅

---

## Step 3: Configure eBay Developer Portal

Once deployed to production:

1. Go to: https://developer.ebay.com/my/keys
2. Select your app: **"Pokedao"** (Production environment)
3. Scroll to **"Marketplace Account Deletion Notification"**
4. Fill in:

   **Marketplace account deletion notification endpoint:**
   ```
   https://YOUR-DEPLOYED-URL/webhooks/ebay/mad
   ```
   Example: `https://pokedao-api.onrender.com/webhooks/ebay/mad`

   **Verification token:**
   ```
   55a9ed6caab78e821aba2cd79115c98ded4d74ec6ac8329b139452184488f3a6
   ```

5. Click **"Save"**

---

## Step 4: Verify with eBay

1. After saving, click **"Send Test Notification"**
2. eBay will send a verification challenge to your endpoint
3. Your endpoint will calculate the response hash and return it
4. If successful, you'll see: ✅ **"Verified"**
5. Your eBay app status will change from **"Non Compliant"** to **"Compliant"**

---

## Step 5: Production Access Unlocked!

Once verified:
- ✅ Production API access enabled
- ✅ Higher rate limits
- ✅ Real user data access
- ✅ No sandbox restrictions

---

## Troubleshooting

### "Endpoint URL must be HTTPS"
- Make sure your deployed URL starts with `https://` (not `http://`)
- Render, Railway, and Vercel provide free SSL automatically

### "Verification failed"
- Double-check the verification token matches exactly
- Ensure the endpoint URL in .env matches what you entered in eBay portal
- Check your API logs for errors

### "Connection timeout"
- Your endpoint might not be publicly accessible
- Check firewall rules
- Verify the URL is correct (no typos)

### "500 Internal Server Error"
- Check your API logs: `pm2 logs` or view logs in Render/Railway dashboard
- Ensure environment variables are set correctly
- Verify DATABASE_URL and REDIS_URL are valid

---

## Security Notes

🔒 **Keep the verification token secret!**
- Never commit it to git (it's in `.env`, which is gitignored)
- Only share it with eBay's portal
- Rotate it annually for best security

🔒 **Data Deletion is Permanent!**
- The endpoint will delete user data when eBay sends a deletion request
- Audit logs are kept for compliance
- No way to recover deleted data

---

## Testing in Production

After eBay verifies your endpoint, test a real deletion:

**Manual Test:**
```bash
curl -X POST https://YOUR-DEPLOYED-URL/webhooks/ebay/mad \
  -H "Content-Type: application/json" \
  -d '{
    "notificationId": "prod-test-123",
    "publishedDate": "2025-10-02T10:30:00Z",
    "attemptNumber": 1,
    "metadata": {
      "userId": "test-user-production"
    }
  }'
```

Check your API logs to see the deletion was processed.

---

## Configuration Summary

For your records:

| Field | Value |
|-------|-------|
| **Endpoint URL** | `https://YOUR-DEPLOYED-URL/webhooks/ebay/mad` |
| **Verification Token** | `55a9ed6caab78e821aba2cd79115c98ded4d74ec6ac8329b139452184488f3a6` |
| **eBay App Name** | Pokedao |
| **eBay App ID** | `ArcadioP-Pokedao-PRD-c3c559702-e00ba59f` |
| **Alert Email** | `chicopanama@yahoo.com` |

---

## Next Steps

After eBay MAD compliance:

1. ✅ Update eBay Finding API credentials to Production keys
2. ✅ Test collecting real eBay comps (not sandbox data)
3. ✅ Integrate eBay data into your JustTCG pipeline
4. ✅ Start building Phase 2 signal generation

---

## Questions?

If verification fails or you need help:
1. Check API logs for errors
2. Review this guide's troubleshooting section
3. Verify environment variables are correct
4. Test locally first before production deployment

**eBay MAD Documentation**: https://developer.ebay.com/marketplace-account-deletion

---

**Deployment Checklist:**

- [ ] API deployed to production HTTPS URL
- [ ] Environment variables configured
- [ ] Local testing passed (verification + deletion)
- [ ] eBay Developer Portal configured
- [ ] Test notification sent and verified
- [ ] App status shows "Compliant"
- [ ] Production API access working

You're ready to go! 🚀
