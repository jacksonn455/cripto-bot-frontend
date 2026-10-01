# Krypto

> Crypto market intelligence and automated strategies, with every trade and decision visible in one place.

<p align="center">
  <img src="./public/images/krypto-profile.png" alt="Krypto cybernetic dog mascot" width="360">
</p>

## Overview

Krypto is a crypto trading platform for people who want to see how an automated strategy behaves
before trusting it and while it runs. It watches the market, runs a trend-following strategy in
**paper** (simulated) or **live** mode, and shows what it is doing and why: every signal, every
trade, every risk decision, and how the results compare with backtests.

This repository is the Krypto web app. The trading engine runs in a separate backend
(`../backend`); the web app reads its data and sends only three commands: **pause**, **resume**
and the **kill switch**.

> Krypto is an educational project. Past results, including backtests, do not guarantee future
> results. Trading crypto involves risk of loss.

## What Krypto does

- **Monitors the market.** Candles, trend indicators and the market regime for each traded coin.
- **Runs a strategy.** Enters only when trend, momentum and the higher-timeframe regime line up,
  with stop, target and a risk manager that can veto any entry.
- **Explains itself.** When there are no trades, Krypto shows which conditions are missing and
  when the next evaluation happens.
- **Tracks performance.** Win rate, payoff, drawdown, Sharpe/Sortino and more, broken down by
  strategy, coin, time of day and side (long/short).
- **Keeps you in control.** Pause, resume or trigger the kill switch at any moment, with a
  confirmation step for each.

## Key features

### Dashboard
Performance at a glance: equity curve with drawdown, open positions with unrealized PnL, the last
signal for each coin, trading status, and the health of the services behind it.

### Trading & strategies
- **Trades:** a filterable, sortable history with CSV export. Each trade opens a chart of its
  period with entry, exit, stop and target marked.
- **Markets:** candlestick charts with the same moving averages the strategy uses, plus the trades
  taken on each chart.
- **Backtests:** run the strategy on historical data with fees and slippage, walk-forward
  validation and custom parameters. Each result comes with a plain-language reading (promising,
  inconclusive, worse than holding, unstable…) and an always-visible overfitting notice.
- **Funding:** a read-only ranking of perpetual funding rates, as context on market sentiment.

### Performance
Side-by-side comparison of **backtest × paper × live** using the same metrics, so you can tell
whether real behavior matches what testing promised. Small samples are flagged as such.

### Activity & notifications
A live activity feed with entries, exits, risk vetoes, pauses, errors and alerts. It also fills in
what happened while the app was closed. Critical alerts pop up as notifications, and a
"Live" indicator shows the connection state.

### AI analysis
AI agents that read Krypto's data and answer questions such as *"Why were there no trades
today?"* or *"Were the last stops noise or bad entries?"*. They review performance, trades,
signals, risk and market regime. **They never open, close or change trades.**

### Modes, clearly separated
The header always shows which mode Krypto is running in. **LIVE** is highlighted in red as *real
money*. You choose which mode's data to view (paper, live or backtest), and screens never mix
modes unless you are explicitly comparing them.

## Product experience

- Light and dark themes, responsive from phone to desktop.
- Clear empty, loading and error states. If the backend goes offline, Krypto keeps working,
  shows a banner and reconnects on its own.
- Optional password login, recommended whenever the app is reachable by others.

## Technology

Next.js (App Router) · React · TypeScript · Tailwind CSS with shadcn/ui · TanStack Query and
Table · lightweight-charts and Recharts · Zod · Vitest.

The browser never talks to the backend directly: a server-side proxy adds the API key, allows only
the endpoints the app uses and handles backend outages.

## Getting started

Requirements: Node 20+ and pnpm (`corepack enable`).

```bash
cp .env.example .env.local   # point it to your backend if it's not on localhost:8000
pnpm install
pnpm dev                     # http://localhost:3000
```

Start the backend too (`cd ../backend && pnpm start:dev`). Without it, the app still opens and
shows a "backend offline" notice until it comes back.

Main settings (see `.env.example` for all of them):

| Variable | Purpose |
| --- | --- |
| `API_URL` | Backend URL, read at runtime by the server proxy. Required and `https://` in production (`VERCEL_ENV=production`), otherwise the proxy answers `CONFIG_MISSING`. Falls back to `NEXT_PUBLIC_API_URL`, then `http://localhost:8000` in dev/preview. |
| `API_KEY` | Backend control key. Stays on the server, never reaches the browser. |
| `DASHBOARD_PASSWORD` | Turns on the login screen. Without it, anyone with the URL can pause trading. |
| `SESSION_SECRET` | Optional secret for the session cookie. |

Production: `pnpm build && pnpm start`. Deployed on Vercel (functions in `gru1`), with the
backend on an Oracle VM behind Nginx and HTTPS (Let's Encrypt) at `https://krypto.duckdns.org`.
When Nginx answers 502/503/504 without JSON, the proxy turns it into `BACKEND_OFFLINE` /
`BACKEND_TIMEOUT`, so the dashboard shows the "backend offline" notice.

## Development

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm test` | Unit and component tests |
| `pnpm test:contract` | Checks the data contracts against a running backend (read-only) |
| `pnpm typecheck` / `pnpm lint` | TypeScript and ESLint |

## Disclaimer

Krypto is an educational project, not financial advice. It does not promise returns, and no
strategy, backtest or AI analysis can remove the risk of loss. Use paper mode first and only
trade live with money you can afford to lose.
