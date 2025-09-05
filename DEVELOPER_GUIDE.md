# Developer Guide - @gainium/backtester

This comprehensive guide covers the architecture, implementation details, and advanced usage of the Gainium Backtester library based on the actual codebase.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Concepts](#core-concepts)
- [Strategy Implementation](#strategy-implementation)
- [Data Management](#data-management)
- [Advanced Usage](#advanced-usage)
- [Helper Utilities](#helper-utilities)
- [API Reference](#api-reference)

## Architecture Overview

The Gainium Backtester is built with a modular, extensible architecture that supports multiple trading strategy types while maintaining high performance and type safety.

### Core Architecture

```
┌─────────────────────────────────────────┐
│              Client Code                │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│           Strategy Engines              │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐│
│  │   DCA   │ │  Grid   │ │   Hedge     ││
│  └─────────┘ └─────────┘ └─────────────┘│
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│         Base Backtesting Engine         │
│  • Data Loading & Processing            │
│  • Period Calculation                   │
│  • File Management                      │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│          Helper Utilities               │
│  • MathHelper (rounding, formatting)    │
│  • Time Functions                       │
│  • Bot Utilities                        │
└─────────────────────────────────────────┘
```

### Key Components

1. **Base Backtesting Class** - Provides common functionality for data loading and processing
2. **Strategy Engines** - DCA, Grid, and Hedge implementations extending the base class
3. **Helper Modules** - Mathematical utilities, time functions, and bot-specific helpers
4. **Type System** - Comprehensive TypeScript definitions with 30+ indicator types
5. **File Management** - CSV-based data persistence with external sorting capabilities

## Core Concepts

### Base Backtesting Class

The foundation class provides core functionality:

```typescript
class Backtesting {
  public exchange: ExchangeEnum
  public period: PeriodParams
  protected readonly symbols: Map<string, Symbols> = new Map()
  public interval: ExchangeIntervals
  protected readonly math: MathHelper = new MathHelper()
  
  constructor(input: BacktestingInput<unknown>, fileName: string) {
    // Initialize exchange, symbols, intervals, and time periods
  }
  
  // Calculate time periods for backtesting
  public calculatePeriod(interval: ExchangeIntervals, from?: number): PeriodParams
  
  // Load market data for backtesting
  public async _loadData(int?: ExchangeIntervals, ...): Promise<FullBar[]>
  
  // Sort and persist data to files
  public async sortData(updateProgress?, random?: boolean)
}
```

### Data Flow

1. **Initialization** - Set up exchange, symbols, intervals, and time periods
2. **Data Loading** - Load market data via `_loadData()` method
3. **Data Processing** - Sort and optionally persist data using external sorting
4. **Strategy Execution** - Process candles through strategy-specific logic
5. **Result Generation** - Calculate comprehensive performance metrics

### Time Period Management

```typescript
interface PeriodParams {
  to: number        // End timestamp (seconds)
  from: number      // Start timestamp (seconds)
  countBack: number // Number of periods to look back
  firstDataRequest: boolean
}
```

## Strategy Implementation

### DCA Strategy Architecture

The DCA backtester extends the base class with sophisticated strategy management:

```typescript
class DCABacktesting extends Backtesting {
  public strategy?: StrategyInterface
  private latestBars: Map<string, FullBar> = new Map()
  private settings: DCABotSettings
  
  constructor(input: DCABacktestingInput) {
    super(input, v4()) // Generate unique filename
    
    // Initialize strategy based on settings
    const strategy = getStrategyBySettings(settings, edge)
    if (strategy) {
      this.strategy = new CombinedStrategy(input, this.fileName, ...strategy)
    }
  }
  
  // Main backtesting method
  public async test(bars?, updateProgress?, loadDataCallBack?) {
    // Load data for multiple timeframes if indicators are used
    // Process data through strategy
    // Return comprehensive results
  }
  
  // Process individual bars for controlled execution
  public async processBar(bar: FullBar, checkPortfolio: boolean): Promise<void>
  
  // Get current unrealized P&L
  public getCurrentUnrealizedPnL(): { unrealizedProfit: number; usage: number }
}
```

### Grid Strategy Architecture

Grid strategies implement price-level based trading:

```typescript
class DCABacktesting extends Backtesting { // Note: Grid uses DCA class name
  private strategy: StrategyInterface
  
  constructor(input: GRIDBacktestingInput) {
    super(input, '') // Grid doesn't use file persistence
    this.strategy = new Strategy({
      settings,
      symbol: symbols[0],
      userFee,
      prices,
      interval,
      trades,
      fullResult,
    })
  }
  
  public async test(_data?: FullBar[], updateProgress?, loadDataCallBack?) {
    const data = _data || (await this._loadData())
    this.strategy.loadData(data)
    return this.strategy.test(updateProgress)
  }
}
```

### Hedge Strategy Architecture

Hedge strategies coordinate long and short positions:

```typescript
class HedgeBacktesting extends Backtesting {
  private longBacktester: DCABacktesting
  private shortBacktester: DCABacktesting
  private sharedSettings?: HedgeBotSettings
  
  constructor({ longSettings, shortSettings, sharedSettings }: HedgeBacktestingInput) {
    super({ ...longSettings }, v4())
    
    this.sharedSettings = sharedSettings
    this.longBacktester = new DCABacktesting(longSettings)
    this.shortBacktester = new DCABacktesting(shortSettings)
  }
  
  // Get combined interval requirements from both strategies
  public getOtherIntervals() {
    // Returns intervals for both long and short strategies
  }
  
  public async test(bars?: { long: ..., short: ... }) {
    // Process both strategies simultaneously
    // Implement shared P&L monitoring
    // Generate combined results
  }
}
```

## Data Management

### File-Based Data Persistence

The backtester supports file-based data storage for large datasets:

```typescript
// Data is stored in CSV format with external sorting
const saveFile = async (
  fileName: string,
  data: FullBar[],
  interval?: ExchangeIntervals,
  sort?: boolean,
  updateProgress?: (value: number, text: string) => void,
  random?: boolean,
) => {
  // Save to CSV file
  // Optionally sort using external sorting library
  // Clean up temporary files
}
```

### Multi-Timeframe Data Loading

```typescript
// DCA strategies can load multiple timeframes for indicators
const isIndicators = (
  this.settings.startCondition === StartConditionEnum.ti ||
  this.settings.dealCloseCondition === CloseConditionEnum.techInd ||
  // ... other indicator-based conditions
) && this.edge !== EdgeBacktestEnum.random

if (isIndicators) {
  // Load data for each required timeframe
  for (const oi of otherIntervals) {
    await this._loadData(oi.interval, undefined, periodParams, i, total)
  }
}
```

## Advanced Usage

### Controlled Bar Processing

For real-time or controlled backtesting:

```typescript
// Initialize strategy for controlled processing
await backtester.initializeForControlledProcessing(bars)

// Process bars one by one
for (const bar of marketData) {
  await backtester.processBar(bar, shouldCheckPortfolio)
  
  // Monitor unrealized P&L
  const pnl = backtester.getCurrentUnrealizedPnL()
  console.log('Unrealized P&L:', pnl.unrealizedProfit)
}
```

### Multi-Symbol Backtesting

```typescript
const symbols = [
  { 
    pair: 'BTCUSDT',
    baseAsset: { name: 'BTC' },
    quoteAsset: { name: 'USDT' }
  },
  // ... more symbols
]

const backtester = new DCABacktesting({
  symbols,
  settings: dcaSettings,
  // ... other config
})
```

### Edge Testing and Randomization

```typescript
// Test with random price prioritization
const backtester = new DCABacktesting({
  settings: {
    ...dcaSettings,
    pairPrioritization: PairPrioritizationEnum.random
  },
  edge: EdgeBacktestEnum.random
})
```

## Helper Utilities

### MathHelper Class

The MathHelper provides precise financial calculations:

```typescript
export class MathHelper {
  // Round numbers with precision control
  round(num: number, precision = 2, down = false, up = false): number
  
  // Convert from exponential notation
  convertFromExponential(num: number | string, precision = 2): string
  
  // Format numbers in human-friendly notation (K, M, B)
  friendly(n: number): string
  
  // Mathematical operations with precision handling
  remainder(a: number, b: number): number
}
```

Usage examples:

```typescript
const math = new MathHelper()

// Precise rounding for financial calculations
const profit = math.round(1234.56789, 2) // 1234.57

// Human-readable formatting
const volume = math.friendly(1500000) // "1.5M"

// Handle exponential notation
const price = math.convertFromExponential(1.23e-5, 8) // "0.0000123"
```

### Indicator Support

The backtester supports 30+ technical indicators:

```typescript
export enum IndicatorEnum {
  rsi = 'RSI',
  adx = 'ADX',
  bbw = 'BBW',
  bb = 'BB',
  macd = 'MACD',
  stoch = 'Stoch',
  // ... 25+ more indicators
  qfl = 'QFL',     // Recently fixed in v1.1.1
  dc = 'DC',       // Donchian Channels
}
```

## API Reference

### Core Classes

#### `Backtesting` (Base Class)

```typescript
abstract class Backtesting {
  public exchange: ExchangeEnum
  public interval: ExchangeIntervals
  public period: PeriodParams
  protected readonly symbols: Map<string, Symbols>
  protected readonly math: MathHelper
  
  constructor(input: BacktestingInput<unknown>, fileName: string)
  
  // Calculate period parameters
  calculatePeriod(interval: ExchangeIntervals, from?: number): PeriodParams
  
  // Load market data
  async _loadData(
    int?: ExchangeIntervals,
    from?: number,
    periodParam?: PeriodParams,
    index?: number,
    total?: number,
    random?: boolean
  ): Promise<FullBar[]>
  
  // Sort data with progress callback
  async sortData(
    updateProgress?: (value: number, text: string) => void,
    random?: boolean
  ): Promise<void>
  
  // Control execution
  set stop(value: boolean)
  get stop(): boolean
}
```

#### `DCABacktesting`

```typescript
class DCABacktesting extends Backtesting {
  public strategy?: StrategyInterface
  private settings: DCABotSettings
  
  constructor(input: DCABacktestingInput)
  
  // Main testing method
  async test(
    bars?: { bar: FullBar[]; interval: ExchangeIntervals }[],
    updateProgress?: (value: number, text: string) => void,
    loadDataCallBack?: () => void
  ): Promise<DCABacktestingResult | undefined>
  
  // Controlled processing methods
  async processBar(bar: FullBar, checkPortfolio: boolean): Promise<void>
  async initializeForControlledProcessing(bars: ...): Promise<boolean>
  
  // Get strategy intervals
  getOtherIntervals(): IntervalRequirement[] | undefined
  
  // P&L monitoring
  getCurrentUnrealizedPnL(): { unrealizedProfit: number; usage: number }
  
  // Deal management
  closeAllDeals(): void
}
```

#### `HedgeBacktesting`

```typescript
class HedgeBacktesting extends Backtesting {
  private longBacktester: DCABacktesting
  private shortBacktester: DCABacktesting
  private sharedSettings?: HedgeBotSettings
  
  constructor(input: HedgeBacktestingInput)
  
  // Combined testing
  async test(bars?: {
    long: { bar: FullBar[]; interval: ExchangeIntervals }[]
    short: { bar: FullBar[]; interval: ExchangeIntervals }[]
  }): Promise<HedgeBacktestingResult | undefined>
  
  // Get intervals for both strategies
  getOtherIntervals(): {
    long: { intervals: ..., symbols: ..., exchange: ... }
    short: { intervals: ..., symbols: ..., exchange: ... }
  }
}
```

### Data Types

#### `FullBar`

```typescript
interface FullBar {
  time: number    // Unix timestamp in milliseconds
  open: number    // Opening price
  high: number    // Highest price
  low: number     // Lowest price
  close: number   // Closing price
  volume: number  // Trading volume
  symbol: string  // Trading pair symbol
}
```

#### `ExchangeIntervals`

```typescript
enum ExchangeIntervals {
  oneM = '1m',
  fiveM = '5m',
  fifteenM = '15m',
  thirtyM = '30m',
  oneH = '1h',
  fourH = '4h',
  oneD = '1d',
  // ... more intervals
}
```

This developer guide provides accurate information based on the actual codebase implementation. For specific implementation details, refer to the source code in the respective strategy and helper modules.