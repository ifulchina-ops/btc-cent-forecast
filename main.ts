// btc-cent-forecast-01 entry: "Damped Pull" (Node 22, standard library only).
//
// Forecast = last close + 0.5 * (EWMA60 - last close), where EWMA60 is the
// exponentially weighted moving average of the case's closes with a 60-minute
// half-life. In words: pull the persistence guess halfway toward the recent
// hourly average. Bitcoin's 1-minute closes mean-revert over a 4-hour horizon
// in choppy regimes (the pull wins there) and the 0.5 damping keeps the
// damage small in trending regimes (the pull loses a little there).
//
// Backtest (practice cases p00-p04, actuals taken from the next case's
// checkpoint close; p05's actual is not in the kit):
//   persistence            47,054.66 cents MAE
//   this model (EWMA60 a0.5) 50,198.48 cents MAE  <- worse on these 5 trending cases
// Walk-forward over 84 checkpoints inside the six practice windows
// (every 4h, target = close 240 min later):
//   persistence            38,118.32 cents MAE
//   this model (EWMA60 a0.5) 35,245.98 cents MAE  <- 7.5% better, wins 6/6 blocks
// The 5 practice endpoints are one trending day; the 84-point walk-forward
// covers choppy and trending stretches alike and is the better guide to a
// fresh 48h final window, so the damped pull is the entry. It is a single
// robust parameter pair (half-life 60, alpha 0.5) fitted on no more than a
// coarse grid — no per-case tuning, no overfit structure.
//
// Deterministic: pure arithmetic over the input prices, no randomness, no
// clock, no network. Runs in milliseconds per case (one pass over 4,320
// closes), far inside the 8s cap.
//
// Reads $MAKEFUN_INPUT_DIR else /input, writes $MAKEFUN_OUTPUT_DIR else
// /output, one <id>.out per <id>.in in name order:
//   {"forecasts":[{"case":"<id>","price":<number>}]}
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** The largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;

/** Half-life of the EWMA, in minutes. */
const HALF_LIFE_MIN = 60;
/** Damping: how far toward the EWMA the last close is pulled (0 = persistence). */
const ALPHA = 0.5;
/** Safety rail: the pull never moves the guess more than 5% off the last close
 *  (never binds on the practice cases — largest pull there is $229 on a
 *  ~$74k price, 0.3% — it only guards pathological inputs). */
const MAX_PULL_FRACTION = 0.05;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/** EWMA of the closes with the given half-life (minutes), seeded on the first close. */
function ewma(prices: number[], halfLifeMin: number): number {
  const a = 1 - 0.5 ** (1 / halfLifeMin);
  let e = prices[0] as number;
  for (let i = 1; i < prices.length; i++) {
    e = a * (prices[i] as number) + (1 - a) * e;
  }
  return e;
}

/** The forecast for one market: last close pulled halfway toward its 60-min EWMA. */
function forecast(m: CaseMarket): number {
  if (!Array.isArray(m.prices) || m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const last = m.prices[m.prices.length - 1] as number;
  if (typeof last !== 'number' || !Number.isFinite(last)) throw new Error(`market ${m.id}'s last price is not a finite number`);
  const pull = ALPHA * (ewma(m.prices, HALF_LIFE_MIN) - last);
  const cap = MAX_PULL_FRACTION * last;
  return price5(last + Math.max(-cap, Math.min(cap, pull)));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
