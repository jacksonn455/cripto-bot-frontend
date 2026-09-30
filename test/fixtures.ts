/**
 * Example responses as the backend serializes them (Mongo `.lean()` + JSON), built from the
 * backend's DTOs/services. Keep in sync with backend/src when fields change.
 */

export const botStatusFixture = {
  mode: "PAPER",
  paused: true,
  pauseReason: "MANUAL",
  lastReconciliationAt: "2026-09-29T12:00:00.000Z",
  lastReconciliationOk: true,
  lastCycleAt: "2026-09-29T12:05:00.123Z",
  lastPollAt: "2026-09-29T12:05:00.130Z",
  executionEnabled: true,
  pollIntervalSeconds: 60,
  lastSignalBySymbol: {
    BTCUSDT: { action: "HOLD", reason: "price below EMA200 regime", at: "2026-09-29T12:05:00.123Z" },
    ETHUSDT: { action: "SKIP", reason: "strategy evaluation failed or not enough candle history yet", at: "2026-09-29T12:05:00.456Z" },
  },
  openTrades: 1,
  equity: 9876.54,
  lastError: null,
};

/** Fresh boot: no cycle yet, no reconciliation, not paused (pauseReason omitted). */
export const botStatusBootFixture = {
  mode: "LIVE",
  paused: false,
  lastReconciliationOk: true,
  lastCycleAt: null,
  lastPollAt: null,
  executionEnabled: false,
  pollIntervalSeconds: 60,
  lastSignalBySymbol: {},
  openTrades: 0,
  equity: 0,
  lastError: "Binance timeout",
};

export const botStateFixture = {
  _id: "66f8a1b2c3d4e5f6a7b8c9d0",
  isPaused: true,
  pauseReason: "MANUAL",
  lastReconciliationOk: true,
  updatedAt: "2026-09-29T12:06:00.000Z",
  __v: 0,
};

export const closedTradeFixture = {
  _id: "66f8a1b2c3d4e5f6a7b8c9d1",
  symbol: "BTCUSDT",
  side: "LONG",
  strategy: "TrendRegimeStrategy",
  mode: "PAPER",
  entryPrice: 60000,
  exitPrice: 61200,
  qty: 0.05,
  entryTime: "2026-09-20T10:00:00.000Z",
  exitTime: "2026-09-21T02:00:00.000Z",
  fees: 3,
  pnl: 54,
  pnlPct: 2,
  stopLoss: 57600,
  takeProfit: 63600,
  status: "CLOSED",
  exitReason: "TP",
  maxAdverseExcursion: -12,
  maxFavorableExcursion: 70,
  createdAt: "2026-09-20T10:00:00.500Z",
  updatedAt: "2026-09-21T02:00:00.500Z",
  __v: 0,
};

export const openTradeFixture = {
  _id: "66f8a1b2c3d4e5f6a7b8c9d2",
  symbol: "ETHUSDT",
  side: "LONG",
  strategy: "TrendRegimeStrategy",
  mode: "BACKTEST",
  runId: "bt_1727600000000_ab12cd34",
  entryPrice: 3200,
  qty: 1.2,
  entryTime: "2026-09-28T08:00:00.000Z",
  fees: 0,
  stopLoss: 3072,
  status: "OPEN",
  isSeed: true,
};

export const tradesPageFixture = { items: [closedTradeFixture, openTradeFixture], total: 42, page: 1, limit: 20 };

export const metricsSummaryFixture = {
  tradeCount: 10,
  winCount: 6,
  lossCount: 4,
  winRate: 0.6,
  totalPnl: 321.5,
  avgWin: 90,
  avgLoss: -54.625,
  payoffRatio: 1.6476,
  profitFactor: 2.47,
  expectancy: 32.15,
  avgReturnPct: 0.8,
  maxDrawdown: 120,
  maxDrawdownPct: 0.08,
  sharpe: 0.41,
  sortino: 0.77,
  maxLosingStreak: 2,
  avgHoldTimeMs: 43_200_000,
  exitReasonBreakdown: { TP: 6, SL: 3, TRAILING: 1 },
  pnlHistogram: [
    { bucket: "< -5%", count: 0 },
    { bucket: "-5% a -2%", count: 3 },
    { bucket: "-2% a 0%", count: 1 },
    { bucket: "0% a 2%", count: 2 },
    { bucket: "2% a 5%", count: 4 },
    { bucket: ">= 5%", count: 0 },
  ],
};

export const emptyMetricsSummaryFixture = {
  ...metricsSummaryFixture,
  tradeCount: 0, winCount: 0, lossCount: 0, winRate: 0, totalPnl: 0, avgWin: 0, avgLoss: 0,
  payoffRatio: 0, profitFactor: 0, expectancy: 0, maxDrawdown: 0, maxDrawdownPct: 0, sharpe: 0,
  sortino: 0, maxLosingStreak: 0, avgHoldTimeMs: 0, exitReasonBreakdown: {},
  pnlHistogram: metricsSummaryFixture.pnlHistogram.map((b) => ({ ...b, count: 0 })),
};

export const groupedMetricPageFixture = {
  items: [{ key: "TrendRegimeStrategy", tradeCount: 10, totalPnl: 321.5, winRate: 0.6, profitFactor: 2.47 }],
  total: 1,
};

export const byHourFixture = {
  byHourOfDay: [{ key: "14", tradeCount: 3, totalPnl: -20, winRate: 0.33, profitFactor: 0.5 }],
  byDayOfWeek: [{ key: "2", tradeCount: 3, totalPnl: -20, winRate: 0.33, profitFactor: 0.5 }],
  timezone: "America/Sao_Paulo",
};

export const compareModesFixture = [
  { mode: "BACKTEST", runId: "bt_1727600000000_ab12cd34", summary: metricsSummaryFixture },
  { mode: "PAPER", runId: null, summary: { ...metricsSummaryFixture, winRate: 0.42, profitFactor: 1.1, avgReturnPct: 0.1 } },
  { mode: "LIVE", runId: null, summary: emptyMetricsSummaryFixture },
];

export const equityCurveFixture = [
  {
    _id: "66f8a1b2c3d4e5f6a7b8c9e0",
    mode: "BACKTEST",
    runId: "bt_1727600000000_ab12cd34",
    timestamp: "2026-01-01T00:00:00.000Z",
    balance: 10000,
    equity: 10000,
    openPositions: 0,
    __v: 0,
  },
];

export const backtestRunResponseFixture = {
  runId: "bt_1727600000000_ab12cd34",
  summary: metricsSummaryFixture,
  tradeCount: 10,
  paramVariationsTestedForStrategy: 3,
};

export const backtestRunFixture = {
  _id: "66f8a1b2c3d4e5f6a7b8c9f0",
  runId: "bt_1727600000000_ab12cd34",
  strategy: "TrendRegimeStrategy",
  params: { strategy: "TrendRegimeStrategy", symbol: "BTCUSDT", timeframe: "1h", feesPct: 0.001, slippagePct: 0.0005, initialBalance: 10000 },
  paramsHash: "a1b2c3",
  symbols: ["BTCUSDT"],
  timeframe: "1h",
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-06-01T00:00:00.000Z",
  feesPct: 0.001,
  slippagePct: 0.0005,
  summary: metricsSummaryFixture,
  walkForwardWindows: [
    { from: "2026-01-01T00:00:00.000Z", to: "2026-03-01T00:00:00.000Z", summary: metricsSummaryFixture, tradeCount: 4 },
  ],
  createdAt: "2026-09-29T11:00:00.000Z",
  paramVariationsTestedForStrategy: 3,
  __v: 0,
};

export const strategiesFixture = {
  strategies: [
    {
      name: "TrendRegimeStrategy",
      params: [
        { key: "emaFast", description: "EMA rápida (períodos)", min: 2, max: 200, integer: true, value: 20 },
        { key: "emaSlow", description: "EMA lenta (períodos)", min: 3, max: 400, integer: true, value: 50 },
        { key: "emaRegime", description: "EMA do filtro de regime (períodos)", min: 10, max: 400, integer: true, value: 200 },
        { key: "atrStopMultiplier", description: "Stop = entrada − N × ATR", min: 0.1, max: 20, integer: false, value: 2 },
        { key: "allowShort", description: "Entradas Short (espelho das regras Long): 0 = desligado, 1 = ligado", min: 0, max: 1, integer: true, value: 0 },
      ],
    },
  ],
  live: { strategy: "TrendRegimeStrategy", symbols: ["BTCUSDT", "ETHUSDT"], timeframe: "1h", regimeTimeframe: "4h" },
};

export const fundingRankingItemsFixture = [
  {
    symbol: "DOGEUSDT",
    rate: 0.0003,
    annualizedRatePct: 32.85,
    nextFundingTime: "2026-09-29T16:00:00.000Z",
    timestamp: "2026-09-29T12:00:00.000Z",
  },
];

export const fundingPageFixture = {
  items: fundingRankingItemsFixture,
  total: 922,
  page: 1,
  limit: 50,
  scannedAt: "2026-09-29T12:00:00.000Z",
  stats: {
    count: 922, positive: 618, negative: 37, zero: 267, medianAnnualizedPct: 5.475, averageAnnualizedPct: 7.53,
    extremeCount: 40, extremeThresholdPct: 50, baselineRate: 0.0001,
  },
  watch: [
    { symbol: "BTCUSDT", rate: 0.0000605, annualizedRatePct: 6.63, nextFundingTime: "2026-09-29T16:00:00.000Z", timestamp: "2026-09-29T12:00:00.000Z" },
  ],
};

export const balancesFixture = [
  { asset: "USDT", free: 9876.54, locked: 0 },
  { asset: "BTC", free: 0.05, locked: 0 },
];

export const candlesFixture = [
  {
    symbol: "BTCUSDT",
    interval: "1h",
    openTime: 1727600400000,
    open: 60000,
    high: 60500,
    low: 59800,
    close: 60300,
    volume: 123.4,
    closeTime: 1727603999999,
    quoteVolume: 7_400_000,
    trades: 5400,
    isClosed: true,
  },
];

export const signalsPageFixture = {
  items: [
    {
      _id: "66f8a1b2c3d4e5f6a7b8c9aa",
      strategy: "TrendRegimeStrategy",
      symbol: "BTCUSDT",
      signal: "ENTER_LONG",
      reason: "EMA20 cruzou acima da EMA50",
      price: 60300,
      indicators: { emaFast: 60100.5, emaSlow: 60050.2, rsi: 57.7, atr: 450.1, emaRegime: 59000 },
      candleTime: "2026-09-29T13:59:59.999Z",
      approved: false,
      rejectReason: "RR_TOO_LOW",
      mode: "PAPER",
      __v: 0,
    },
    {
      _id: "66f8a1b2c3d4e5f6a7b8c9ab",
      strategy: "TrendRegimeStrategy",
      symbol: "ETHUSDT",
      signal: "ENTER_LONG",
      indicators: { rsi: 60 },
      candleTime: "2026-09-29T12:59:59.999Z",
      approved: true,
      mode: "BACKTEST",
      runId: "bt_1",
    },
  ],
  total: 2,
  page: 1,
  limit: 50,
};

export const killSwitchFixture = { canceledOrders: 2, closedPositions: 1 };

/** GET /backtest/runs page wrapper. */
export const runsPage = (items: unknown[]) => ({ items, total: items.length, page: 1, limit: 200 });
