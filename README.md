Trade Backtesting engine for trading strategies, supporting DCA (Dollar Cost Averaging), Grid, and Hedge trading strategies with comprehensive performance analysis.

## Features

- 🚀 **High-Performance Backtesting** - Optimized for speed and accuracy
- 📈 **Multiple Strategy Types** - DCA, Grid, and Hedge trading strategies
- 📊 **Comprehensive Analysis** - Financial metrics, performance ratios, and risk analysis
- 🔧 **TypeScript Support** - Full type safety with comprehensive type definitions
- 📦 **Modular Architecture** - Easy to extend and customize
- 🧪 **Technical Indicators** - Integration with @gainium/indicators library

## Installation

```bash
npm install @gainium/backtester
```

## Quick Start

### DCA Strategy Backtesting

```typescript
import DCABacktesting from '@gainium/backtester/dist/dca'
import { DCABotSettings, ExchangeIntervals } from '@gainium/backtester/dist/types'

const settings: DCABotSettings = {
  // Your DCA strategy configuration
  interval: ExchangeIntervals.fiveM,
  // ... other settings
}

const backtester = new DCABacktesting(settings)

// Run backtest with your candle data
const results = await backtester.test(candleData)
console.log('Backtest Results:', results)
```

### Grid Strategy Backtesting

```typescript
import GridBacktesting from '@gainium/backtester/dist/grid'

const gridBacktester = new GridBacktesting({
  // Grid strategy configuration
  interval: ExchangeIntervals.oneM,
  // ... other settings
})

const results = await gridBacktester.test(candleData)
```

### Hedge Strategy Backtesting

```typescript
import HedgeBacktesting from '@gainium/backtester/dist/hedge'

const hedgeBacktester = new HedgeBacktesting({
  longSettings: { /* DCA settings for long side */ },
  shortSettings: { /* DCA settings for short side */ },
  sharedSettings: { /* Hedge-specific settings */ }
})

const results = await hedgeBacktester.test({
  long: longCandleData,
  short: shortCandleData
})
```

## Strategy Types

### DCA (Dollar Cost Averaging)
- Time-based or indicator-based entry conditions
- Multiple safety order levels
- Dynamic position sizing
- Take profit and stop loss management

### Grid Trading
- Price range-based grid setup
- Automatic buy/sell orders at grid levels
- Profit taking on grid completion
- Configurable grid spacing and levels

### Hedge Trading
- Combined long and short DCA strategies
- Risk management across both sides
- Correlation-based position sizing
- Advanced portfolio analysis

## API Documentation

### Core Classes

- `DCABacktesting` - DCA strategy backtesting engine
- `GridBacktesting` - Grid strategy backtesting engine  
- `HedgeBacktesting` - Hedge strategy backtesting engine
- `Backtesting` - Base class for all backtesting engines

### Result Types

- `DCABacktestingResult` - Comprehensive DCA backtest results
- `GridBacktestingResult` - Grid strategy performance metrics
- `HedgeBacktestingResult` - Hedge strategy analysis

## Project Structure

```
src/
├── index.ts          # Main exports
├── types.ts          # Type definitions
├── dca/             # DCA backtesting implementation
├── grid/            # Grid backtesting implementation
├── hedge/           # Hedge backtesting implementation
└── helper/          # Utility functions
```

## Requirements

- Node.js 16+
- TypeScript 4.5+
- @gainium/indicators (peer dependency)

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and release notes.

## License

Private - Gainium Trading Platform

## Support

For support and documentation, visit the Gainium platform or contact the development team.