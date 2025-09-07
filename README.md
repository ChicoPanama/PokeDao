# 🃏 PokeDAO

PokeDAO is an intelligent trading assistant for collectible cards.  
It is built to be the Bloomberg Terminal of Pokémon cards: a single platform where collectors and investors can discover new listings, understand true market value, and make informed decisions quickly.

---

## 🌍 What Is PokeDAO?

PokeDAO unifies scattered card market data into one streamlined experience.  
Instead of checking multiple sites, users receive a real-time feed of listings combined with clear valuations and insights.  

The platform highlights opportunities the moment they appear, explains the context behind each card, and provides simple calls to action such as **Buy**, **Watch**, or **Avoid**. Whether through the Telegram bot or the web dashboard, PokeDAO makes it easier for collectors and investors to stay ahead of the market.

---

## ⚡ What Powers It

At its core, PokeDAO is powered by a continuous data pipeline and intelligent analysis. Scrapers collect and normalize card information from sources like Collector Crypt, with plans to expand to eBay, PSA, and TCGPlayer. This data flows into an analysis layer that identifies rarity, compares pricing trends, and evaluates potential growth.  

The Telegram bot delivers instant alerts when new cards appear, while the dashboard provides a deeper view into listings, watchlists, and historical pricing. Behind the scenes, the system is supported by a modern stack including Node.js, PostgreSQL, Redis, and Docker for reliability and scale.

---

## ✨ Why PokeDAO?

PokeDAO brings speed by delivering alerts the moment cards are listed.  
It adds clarity through transparent, data-driven valuations.  
And it provides confidence by helping collectors and investors act with information they can trust.

---

## 🛠️ Tech Stack

| Layer       | Technology                                                           |
|-------------|----------------------------------------------------------------------|
| Backend     | Node.js API, Prisma ORM, PostgreSQL                                  |
| Workers     | Python/Node.js scraping jobs                                         |
| Analysis    | DeepSeek with fallback summarization                                 |
| Bot         | Aiogram (Python) or Telegraf (Node.js)                               |
| Frontend    | Next.js + Tailwind                                                   |
| Infra       | Docker, Redis, Vercel/Render                                         |

---

## 🤝 Community

PokeDAO is built for collectors and investors who believe trading cards deserve the same level of intelligence and accessibility as any financial market. It is open, collaborative, and driven by the people who use it.

---

## 📜 License

Open-source under the **MIT License**.  

---

## 📜 License

This project is licensed under the **MIT License**.  
