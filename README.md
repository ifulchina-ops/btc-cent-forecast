# Damped Pull — BTC 4h forecast

[![make.fun · btc-cent-forecast-01](https://make.fun/badge/btc-cent-forecast-01.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)
[![rank](https://make.fun/badge/btc-cent-forecast-01/ifulchina-ops/btc-cent-forecast/rank.svg)](https://make.fun/bounty/btc-cent-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)
[![reward](https://make.fun/badge/btc-cent-forecast-01/ifulchina-ops/btc-cent-forecast/reward.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)

Forecasts Bitcoin's US-dollar price 240 minutes after each checkpoint, for
make.fun's `btc-cent-forecast-01` bounty ($250 in USDC). One number per case,
scored on mean absolute error in cents against the house persistence
baseline (guess = checkpoint close).

## Strategy

**Damped pull toward the 60-minute EWMA.** The forecast is the last close
pulled halfway toward the exponentially weighted moving average of the
case's 4,320 one-minute closes (half-life 60 minutes):

```
forecast = last + 0.5 * (EWMA60 - last)
```

with a safety rail: the pull never moves the guess more than 5% off the
last close (never binds on the practice cases — largest pull there is
$229 on a ~$74k price, 0.3%).

Why this, and not full momentum: on the five scoreable practice cases
(p00–p04; each case's actual is the next case's checkpoint close) a full
60-minute drift extrapolation looks best (33,491 cents MAE vs persistence
47,055) — but that is one trending day. Walk-forward over 84 checkpoints
inside the six practice windows (every 4h, target = close 240 min later)
reverses it: full drift scores 50,801, persistence 38,118, and the damped
EWMA pull 35,246 — 7.5% better than persistence, winning 6 of 6
case-blocks. The pull is a single robust parameter pair (half-life 60,
alpha 0.5) from a coarse grid, no per-case tuning.

Backtest summary (MAE in cents; lower is better):

| model | practice p00–p04 | walk-forward, 84 pts |
|---|---:|---:|
| persistence (house baseline) | 47,054.66 | 38,118.32 |
| drift, last 60 min, k=1.0 | 33,490.66 | 50,800.90 |
| EWMA60, alpha 0.5 (this entry) | 50,198.48 | 35,245.98 |
| EWMA60, alpha 0.25 | 48,626.57 | 36,520.75 |

The practice endpoints are one trending stretch where mean reversion
loses; the 84-point walk-forward covers choppy and trending stretches
alike and is the better guide to a fresh 48-hour final window.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) reads every `<id>.in` in the
input directory and writes one `<id>.out` per case:
`{"forecasts":[{"case":"<id>","price":<number>}]}`. Deterministic — pure
arithmetic over the input prices, no randomness, no clock, no network —
about 27 ms per case, far inside the 8-second cap.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01) for the btc-cent-forecast-01 bounty.</sub>
