# Delta Quant — Custom Indicator Trading Bot

A browser-based crypto futures trading bot for **Delta Exchange India** (`api.india.delta.exchange`), built with React + TypeScript + Tailwind. The core feature is a Monaco-powered code editor where you write your own indicator logic in JS, backtest it on real candles, then plug it into a paper or live trading engine.

> ⚠️ **This runs entirely in your browser with no backend.** Your API secret is stored in `localStorage` and used to sign requests directly from your machine. That's convenient (no server to maintain, free to host) but it means: never deploy a build of this app to a public URL with your real keys typed in, and never share access to a deployed instance that has your keys saved. Run it on `localhost`, or host it privately and keep the URL to yourself.

---

## 1. What's inside

- **Indicator Editor** — Monaco (VS Code) editor with a default EMA+RSI template. Built-in helpers: `sma`, `ema`, `rsi`, `macd`, `bollingerBands`, `atr`, `supertrend`, `vwap`, `heikinAshi`, `crossOver`, `crossUnder`. Code compiles in a restricted sandbox (`new Function`, no `fetch`/`document`/`window` access).
- **Backtest ("Test" button)** — runs your indicator over the last 500 candles, plots BUY/SELL markers and any series you return on a candlestick chart, shows win rate / PnL / drawdown stats.
- **Pine Script → JS** — best-effort converter for simple scripts (`ta.ema`, `ta.rsi`, `input.int`, `ta.crossover`, etc). Complex scripts will need manual cleanup — it flags everything it couldn't convert with `// TODO manual port`.
- **Save/Load/Export** — indicators persist in IndexedDB (via Dexie) and can be exported/imported as JSON files.
- **Dashboard** — activate a saved indicator as a bot: pick symbol/resolution, position size, leverage, SL%/TP%, daily loss limit, paper or live mode. Live mode requires an explicit confirmation dialog.
- **Bot Engine** — polls candles every N seconds (default 30s), re-runs your indicator, and on a BUY/SELL signal either simulates a paper trade or places a real bracket order (`POST /v2/orders` with `bracket_stop_loss_price` / `bracket_take_profit_price`).
- **Positions / Trade Log / Settings** — live position table, full trade history, and where you paste your Delta API key + secret.

---

## 2. Running it locally

You need [Node.js](https://nodejs.org) 18+ installed.

```bash
# 1. Unzip the project, then from inside the folder:
npm install

# 2. Start the dev server
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Go to **Settings**, paste your Delta Exchange India API key + secret (the screenshot you shared — leave **Trading permission unchecked** until you've paper-traded successfully), save, and you're live with real market data.

To build a production bundle:

```bash
npm run build      # outputs to /dist
npm run preview    # serve that build locally to sanity-check it
```

---

## 3. Free hosting — kaise host karein (free me)

Chunki yeh app **pure frontend** hai (no backend/database server chahiye — sab kuch IndexedDB + localStorage browser mein hi store hota hai), aap isse kisi bhi **static site hosting** par **free** mein deploy kar sakte hain. Sabse aasan aur reliable options neeche hain.

### Option A — Vercel (sabse recommended, sabse easy)

1. Code ko GitHub repo mein push karein (private repo rakhna better hai).
2. [vercel.com](https://vercel.com) par GitHub se sign in karein.
3. "Add New Project" → apna repo select karein.
4. Framework preset apne aap "Vite" detect ho jayega. Build command: `npm run build`, Output directory: `dist`.
5. Deploy click karein — 1-2 minute mein live URL mil jayega (e.g. `your-bot.vercel.app`).
6. Free tier ka koyi card nahi lagta, generous bandwidth milta hai.

### Option B — Netlify

1. GitHub repo connect karein netlify.com par.
2. Build command: `npm run build`, publish directory: `dist`.
3. Deploy — free tier mein bhi custom domain attach kar sakte hain.

### Option C — Cloudflare Pages

1. Cloudflare dashboard → Pages → connect to Git.
2. Build command: `npm run build`, output: `dist`.
3. Cloudflare ka free tier bahut generous hai aur global CDN bhi milta hai — speed ke liye best.

### Option D — GitHub Pages (sabse zero-cost, thoda manual)

```bash
npm install -D gh-pages
```
`package.json` mein add karein:
```json
"scripts": {
  "deploy": "vite build --base=/your-repo-name/ && gh-pages -d dist"
}
```
Phir `npm run deploy` chalayein.

### ⚠️ Hosting karte waqt yeh zaroor dhyan rakhein

- **Apni API key/secret kabhi bhi code mein hardcode na karein** — humne already isse `localStorage`-based banaya hai, to aap deploy karne ke baad bhi browser mein hi Settings page se keys daalenge, code mein nahi.
- Agar aap is deployed link ko kisi aur ke saath share karte hain, toh **wo bhi apni hi keys daalenge** (alag-alag log alag-alag keys use karenge, ek hi browser storage shared nahi hota) — lekin phir bhi best practice yeh hai ki **deployed link sirf apne liye private rakhein**, public mein share na karein, kyunki agar koyi aapke browser tab tak pohonch jaaye (e.g. screen-share ya shared computer) toh wo aapki saved keys dekh sakta hai.
- Free static hosts (Vercel/Netlify/Cloudflare) sab HTTPS by default dete hain, jo zaroori hai.
- Koyi bhi backend/database cost nahi lagti kyunki sab kuch browser-side hai — yeh completely **$0/month** rahega normal use ke liye.

---

## 4. Important safety notes

- **Always paper trade first.** Switch the Dashboard's mode toggle to "Live" only after you've watched the bot run in paper mode across different market conditions.
- **The Pine Script converter is best-effort.** It pattern-matches common idioms; it is not a real Pine interpreter. Review every converted indicator's `// TODO manual port` lines before trusting it.
- **The indicator sandbox is not a security boundary.** It blocks the obvious dangerous globals (`fetch`, `document`, `window`, `localStorage`) but still runs in the same JS realm as the page. Only paste in indicator code you wrote yourself or fully trust.
- **Daily loss limit is enforced bot-side**, not exchange-side — if you close the browser tab, the bot stops running (there's no server keeping it alive), so it can't lose more than what happened while the tab was open.

---

## 5. Project structure

```
src/
  components/        Shared UI (Panel, Button, Badge…), chart, param sliders, layout
  indicators/         Default EMA+RSI template (as a source string for Monaco)
  lib/
    taLib.ts          Indicator math: ema, rsi, macd, bollingerBands, atr, supertrend, vwap…
    indicatorRunner.ts Sandboxed compiler for user-pasted JS indicators
    pineConverter.ts   Best-effort Pine Script → JS converter
    backtest.ts        Runs an indicator over historical candles, computes stats
    deltaApi.ts        Delta Exchange India REST client (HMAC-SHA256 signed)
    botEngine.ts        Live polling loop: candles → indicator → paper/live order
    db.ts               IndexedDB persistence (Dexie) for indicators/trades/bots
    store.ts            Zustand global app state
  pages/              Dashboard, Indicator Editor, Positions, Trade Log, Settings
  types/              Shared TypeScript types
```
