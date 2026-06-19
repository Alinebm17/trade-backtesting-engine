# backtester (`@gainium/backtester`)

## 📚 Platform knowledge base

A curated, auto-updated AI-agent knowledge base for the **whole Gainium platform** lives in the
private repo **`gainium-0-knowledge`** (`github.com/aressanch/gainium-0-knowledge`).
Local checkouts — Mac: `~/Git/Gainium Local/0-knowledge` · VPS: `/root/git/0-knowledge`.

Consult it before non-trivial work: `ARCHITECTURE.md` (service graph + danger boundaries),
`subsystems/<area>.md` (how each area works & breaks), `bug-patterns/`, `runbooks/`,
`domain/glossary.md`. Query 3.7k historical bugs by symptom:
`python3 <kb>/_raw/scripts/bugs.py find "<terms>"`. It is auto-enriched daily from agent session digests.

**Library, not a service.** Strategy backtest engines (DCA / grid / combo / hedge), published as a github npm
dep. Map: [`../0-knowledge/ARCHITECTURE.md`](../0-knowledge/ARCHITECTURE.md).

## Run / test
- build `npm run build` · watch `build:watch` · lint `npm run lint` · `update:indicators` syncs the indicators dep

## Coupling — shared backtest engine (load-bearing)
This is the engine behind **all DCA/grid/hedge bot backtests**, run in two places:
- **Backend (server-side):** main-app's `backtest` worker (port 7515) — `main-app/core/src/backtest/process/backtester.ts`
  + `backtestWrapper/{dca,grid}.ts` import `@gainium/backtester/dist/{dca,grid,hedge,types}`.
- **Frontend (client-side):** both dashboards run backtests in-browser with the same engine —
  `main-dash-redesign/core/src/lib/backtester/*` and `main-dash/helper/backetsting/*`.
- Depends on `@gainium/indicators`.

⚠ **A change to the engine math or the `DCABacktestingInput`/`GRIDBacktestingInput`/result types ripples to
main-app's backtest worker AND both dashboards' client-side backtest** — they must produce identical results.
(The removed `bot-presets` service was one extra consumer; main-app's AI **agent** backtest is separate
in-tree code under `main-app/src/agents/agentBacktest*`, not this lib.)

## Rules
- Pure library; no ports. Treat engine output + input/result types as a cross-service contract (server↔client parity).
- main-app's `backtest` worker (`main-app/src/backtest`, port 7515) is the **runner** that drives this engine —
  not a separate implementation.
