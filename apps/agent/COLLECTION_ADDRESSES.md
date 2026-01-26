# NFT Collection Addresses & Symbols

**Generated:** 2026-01-25
**Purpose:** Reference for Pokemon card NFT collection identifiers across platforms

---

## Magic Eden (Solana)

### Collector Crypt Partnership

Collector Crypt is Magic Eden's primary partner for tokenized Pokemon cards.

| Collection | Symbol | Contract Address | Status |
|------------|--------|------------------|--------|
| **Collector Crypt** | `collector_crypt` | `CCryptWBYktukHDQ2vHGtVcmtjXxYzvw8XNVY64YN2Yf` | Active |

### API Endpoints

```bash
# Get collection stats
GET https://api-mainnet.magiceden.dev/v2/collections/collector_crypt/stats

# Get active listings
GET https://api-mainnet.magiceden.dev/v2/collections/collector_crypt/listings?limit=100

# Get recent activities (sales)
GET https://api-mainnet.magiceden.dev/v2/collections/collector_crypt/activities?offset=0&limit=100
```

### Response Example
```json
{
  "symbol": "collector_crypt",
  "floorPrice": 1500000000,  // lamports (1.5 SOL)
  "listedCount": 234,
  "volumeAll": 45678000000000
}
```

### Authentication
```bash
# Optional - for higher rate limits
Authorization: Bearer YOUR_API_KEY
```

---

## Courtyard (Polygon)

### Contract Details

| Field | Value |
|-------|-------|
| **Network** | Polygon Mainnet |
| **Chain ID** | 137 |
| **Contract** | `0x251be3a17af4892035c37ebf5890f4a4d889dcad` |
| **Standard** | ERC-721 |

### API Endpoints

```bash
# Get Pokemon listings
GET https://api.courtyard.io/v1/listings?category=pokemon

# Search listings
GET https://api.courtyard.io/v1/listings/search?q=charizard&category=pokemon
```

### Grade Filtering
```bash
# Filter by grade
GET https://api.courtyard.io/v1/listings?category=pokemon&gradeCompany=PSA&grade=10
```

---

## rip.fun (Base Chain)

### Network Details

| Field | Value |
|-------|-------|
| **Network** | Base (Ethereum L2) |
| **Chain ID** | 8453 |
| **Status** | Closed Beta |
| **Contract** | TBD - Platform in beta |

### RPC Providers

```bash
# Alchemy
https://base-mainnet.g.alchemy.com/v2/{API_KEY}

# QuickNode
https://api.quicknode.com/base/mainnet/{API_KEY}

# Public RPC
https://mainnet.base.org
```

### Discovery Method
When platform exits beta:
1. Use block explorer to find contract address
2. Query `Transfer` events for sales
3. Call `tokenURI` for metadata

---

## Implementation: Update crypto-worker.ts

### Current Code (Outdated)
```typescript
// apps/agent/src/workers/crypto-worker.ts
const POKEMON_COLLECTIONS = [
  'pokemon_1',        // Placeholder - doesn't exist
  'pokemon_base_set', // Placeholder - doesn't exist
];
```

### Updated Code (Correct)
```typescript
// Magic Eden collections (Solana)
const MAGIC_EDEN_COLLECTIONS = [
  {
    symbol: 'collector_crypt',
    name: 'Collector Crypt',
    description: 'Tokenized graded Pokemon cards',
    contractAddress: 'CCryptWBYktukHDQ2vHGtVcmtjXxYzvw8XNVY64YN2Yf'
  }
];

// Courtyard filters (Polygon)
const COURTYARD_FILTERS = {
  category: 'pokemon',
  // Optional grade filters
  gradeCompanies: ['PSA', 'CGC', 'BGS', 'SGC']
};
```

---

## Price Conversion

### SOL to USD
```typescript
// CoinGecko API (already in codebase)
const solPrice = await fetch(
  'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
).then(r => r.json());

const usdPrice = lamports / 1e9 * solPrice.solana.usd;
```

### Polygon/MATIC to USD
```typescript
const maticPrice = await fetch(
  'https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd'
).then(r => r.json());

const usdPrice = weiAmount / 1e18 * maticPrice['matic-network'].usd;
```

---

## Verification Links

- Magic Eden Collection: https://magiceden.us/marketplace/collector_crypt
- Courtyard: https://courtyard.io
- Collector Crypt: https://collectorcrypt.com
- Base Chain Explorer: https://basescan.org

---

## Future Collections to Monitor

### Magic Eden Launchpad
Recent and upcoming Pokemon drops:
1. **Genesis Drop** - 110 graded cards
2. **Firedancer Drop** - Tokenized collectibles
3. **The Heist Pokemon Drop** - Themed collection

Check launchpad: https://magiceden.us/launchpad

### Other Potential Collections
- Generic Pokemon search: `https://api-mainnet.magiceden.dev/v2/marketplace/search?q=pokemon`
- Monitor for new collections via activities endpoint

---

## Sources

- [Magic Eden x Collector Crypt](https://help.magiceden.io/en/articles/8498560-exploring-magic-eden-x-collector-crypt)
- [Collector Crypt Marketplace](https://magiceden.us/marketplace/collector_crypt)
- [Courtyard Documentation](https://docs.courtyard.io/)
- [Base Chain RPC Providers](https://www.quicknode.com/builders-guide/best/top-10-base-rpc-providers)
