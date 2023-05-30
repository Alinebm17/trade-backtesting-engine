import type {
  FasterMACDResult,
  FasterBandsResult,
  FasterStochasticResult,
  PivotResult,
} from '../indicators/src'

export enum IndicatorsEnum {
  rsi = 'RSI',
  adx = 'ADX',
  bbw = 'BBW',
  macd = 'MACD',
  tv = 'TV',
  ma = 'MA',
  bb = 'BB',
  stoch = 'Stoch',
  stochRSI = 'StochRSI',
  sr = 'SR',
  qfl = 'QFL',
  mfi = 'MFI',
}

export enum TradingviewAnalysisConditionEnum {
  every = 'every',
  entry = 'entry',
}

export enum MAEnum {
  sma = 'sma',
  ema = 'ema',
  wma = 'wma',
  price = 'price',
  dema = 'dema',
  tema = 'tema',
  vwma = 'vwma',
  hma = 'hma',
  rma = 'rma',
}

export enum TradingviewAnalysisSignalEnum {
  strongBuy = 'strongBuy',
  strongSell = 'strongSell',
  buy = 'buy',
  sell = 'sell',
  bothBuy = 'bothBuy',
  bothSell = 'bothSell',
}

export enum rsiValueEnum {
  k = 'k',
  d = 'd',
}

export enum rsiValue2Enum {
  k = 'k',
  d = 'd',
  custom = 'custom',
}

export enum rsiValue2Enum2 {
  k = 'k',
  custom = 'custom',
}

export enum IndicatorStartConditionEnum {
  cd = 'cd',
  cu = 'cu',
  gt = 'gt',
  lt = 'lt',
}

export enum ExchangeIntervals {
  oneM = '1m',
  threeM = '3m',
  fiveM = '5m',
  fifteenM = '15m',
  thirtyM = '30m',
  oneH = '1h',
  twoH = '2h',
  fourH = '4h',
  eightH = '8h',
  oneD = '1d',
  oneW = '1w',
}

export const timeIntervalMap = {
  [ExchangeIntervals.oneM]: 60 * 1000,
  [ExchangeIntervals.threeM]: 3 * 60 * 1000,
  [ExchangeIntervals.fiveM]: 5 * 60 * 1000,
  [ExchangeIntervals.fifteenM]: 15 * 60 * 1000,
  [ExchangeIntervals.thirtyM]: 30 * 60 * 1000,
  [ExchangeIntervals.oneH]: 60 * 60 * 1000,
  [ExchangeIntervals.twoH]: 2 * 60 * 60 * 1000,
  [ExchangeIntervals.fourH]: 4 * 60 * 60 * 1000,
  [ExchangeIntervals.eightH]: 8 * 60 * 60 * 1000,
  [ExchangeIntervals.oneD]: 24 * 60 * 60 * 1000,
  [ExchangeIntervals.oneW]: 7 * 24 * 60 * 60 * 1000,
}

export enum BBCrossingEnum {
  middle = 'middle',
  upper = 'upper',
  lower = 'lower',
}

export enum SRCrossingEnum {
  support = 'support',
  resistance = 'resistance',
}

export enum IndicatorAction {
  startDeal = 'startDeal',
  closeDeal = 'closeDeal',
}

export type MAResult = {
  ma: number
  maType: string
  price: number
}

export type IndicatorConfigBackTesting =
  | {
      type: IndicatorsEnum.tv
      checkLevel?: number
      useAsEntryExitPoints?: boolean
    }
  | {
      type: IndicatorsEnum.rsi | IndicatorsEnum.adx | IndicatorsEnum.mfi
      interval: number
    }
  | {
      type: IndicatorsEnum.bbw
      interval: number
      deviationMultiplier?: number
    }
  | {
      type: IndicatorsEnum.bb
      interval: number
    }
  | {
      type: IndicatorsEnum.macd
      longInterval: number
      shortInterval: number
      signalInterval: number
    }
  | {
      type: IndicatorsEnum.ma
      maType: MAEnum
      interval: number
    }
  | {
      type: IndicatorsEnum.stoch
      length: number
      smoothK: number
      smoothD: number
    }
  | {
      type: IndicatorsEnum.stochRSI
      length: number
      rsiLength: number
      smoothK: number
      smoothD: number
    }
  | {
      type: IndicatorsEnum.sr
      leftBars: number
      rightBars: number
    }
  | {
      type: IndicatorsEnum.qfl
      basePeriods: number
      pumpPeriods: number
      pump: number
      baseCrack: number
    }

export type IndicatorHistory = { time: number } & (
  | {
      type:
        | IndicatorsEnum.rsi
        | IndicatorsEnum.adx
        | IndicatorsEnum.bbw
        | IndicatorsEnum.mfi
      value: number
    }
  | {
      type: IndicatorsEnum.macd
      value: FasterMACDResult
    }
  | {
      type: IndicatorsEnum.ma
      value: MAResult
    }
  | { type: IndicatorsEnum.tv; value: number }
  | {
      type: IndicatorsEnum.bb
      value: { result: FasterBandsResult; price: number }
    }
  | {
      type: IndicatorsEnum.stoch | IndicatorsEnum.stochRSI
      value: FasterStochasticResult
    }
  | {
      type: IndicatorsEnum.sr
      value: PivotResult
    }
  | { type: IndicatorsEnum.qfl; value: boolean }
)

export type SettingsIndicators = {
  type: IndicatorsEnum
  indicatorLength: number
  indicatorValue: string
  indicatorCondition: IndicatorStartConditionEnum
  uuid: string
  indicatorInterval: ExchangeIntervals
  signal?: TradingviewAnalysisSignalEnum
  condition?: TradingviewAnalysisConditionEnum
  rsiValue?: rsiValueEnum
  rsiValue2?: rsiValue2Enum
  rsiValue2a?: rsiValue2Enum2
  valueInsteadof?: number
  checkLevel?: number
  maType?: MAEnum
  maCrossingValue?: MAEnum
  maCrossingLength?: number
  maCrossingInterval?: ExchangeIntervals
  maUUID?: string
  bbCrossingValue?: BBCrossingEnum
  stochSmoothK?: number
  stochSmoothD?: number
  stochUpper?: string
  stochLower?: string
  stochRSI?: number
  srCrossingValue?: SRCrossingEnum
  leftBars?: number
  rightBars?: number
  basePeriods?: number
  pumpPeriods?: number
  pump?: number
  interval?: number
  baseCrack?: number
  indicatorAction: IndicatorAction
  section?: IndicatorSection
}

export enum IndicatorSection {
  tp = 'tp',
  sl = 'sl',
}

export enum CloseConditionEnum {
  tp = 'tp',
  techInd = 'techInd',
  manual = 'manual',
  webhook = 'webhook',
}

export enum StartConditionEnum {
  asap = 'ASAP',
  manual = 'Manual',
  tradingviewSignals = 'TradingviewSignals',
  timer = 'Timer',
  ti = 'TechnicalIndicators',
}

export type Currency = 'quote' | 'base'

export interface BaseSettings {
  name: string
  profitCurrency: Currency
  orderFixedIn: Currency
}

export enum StrategyEnum {
  long = 'LONG',
  short = 'SHORT',
}

export enum OrderTypeEnum {
  limit = 'LIMIT',
  market = 'MARKET',
}

export enum DCATypeEnum {
  regular = 'regular',
  terminal = 'terminal',
}

export enum OrderSizeTypeEnum {
  base = 'base',
  quote = 'quote',
  percTotal = 'percTotal',
  percFree = 'percFree',
}

export enum CooldownUnits {
  seconds = 'seconds',
  minutes = 'minutes',
  hours = 'hours',
  days = 'days',
}

export interface DCABotSettings extends BaseSettings {
  strategy: StrategyEnum
  baseOrderSize: string
  baseOrderPrice?: string
  startOrderType: OrderTypeEnum
  useLimitPrice?: boolean
  startCondition: StartConditionEnum
  tpPerc: string
  slPerc: string
  orderSize: string
  step: string
  ordersCount: string
  activeOrdersCount: string
  volumeScale: string
  stepScale: string
  useTp: boolean
  useSl: boolean
  useSmartOrders: boolean
  minOpenDeal?: string
  maxOpenDeal?: string
  useDca: boolean
  hodlDay: string
  hodlAt: string
  hodlNextBuy: number
  maxNumberOfOpenDeals?: string
  indicators: SettingsIndicators[]
  type?: DCATypeEnum
  orderSizeType: OrderSizeTypeEnum
  limitTimeout?: string
  useLimitTimeout?: boolean
  cooldownAfterDealStart?: boolean
  cooldownAfterDealStartUnits?: CooldownUnits
  cooldownAfterDealStartInterval?: number
  cooldownAfterDealStop?: boolean
  cooldownAfterDealStopUnits?: CooldownUnits
  cooldownAfterDealStopInterval?: number
  moveSL?: boolean
  moveSLTrigger?: string
  moveSLValue?: string
  trailingSl?: boolean
  trailingTp?: boolean
  trailingTpPerc?: string
  maxDealsPerPair?: string
  useCloseAfterX?: boolean
  closeAfterX?: string
  pair: string[]
  useMulti?: boolean
  useCloseAfterXopen?: boolean
  closeAfterXopen?: string
  botStart?: BotStartTypeEnum
  useBotController?: boolean
  stopType?: CloseDCATypeEnum
  dealCloseCondition?: CloseConditionEnum
  dealCloseConditionSL?: CloseConditionEnum
  useMinTP?: boolean
  minTp?: string
  closeDealType?: CloseDCATypeEnum
  terminalDealType?: TerminalDealTypeEnum
  useMultiTp?: boolean
  multiTp?: MultiTP[]
  useMultiSl?: boolean
  multiSl?: MultiTP[]
  marginType?: BotMarginTypeEnum
  leverage?: number
  futures?: boolean
  coinm?: boolean
}

export enum BotStartTypeEnum {
  manual = 'manual',
  webhook = 'webhook',
}

export enum CloseDCATypeEnum {
  /** Do nothing */
  leave = 'leave',
  /** Cancel orders */
  cancel = 'cancel',
  /** Close deals by LIMIT */
  closeByLimit = 'closeByLimit',
  /** Close deals by Market */
  closeByMarket = 'closeByMarket',
}

export enum TerminalDealTypeEnum {
  simple = 'simple',
  smart = 'smart',
  import = 'import',
}

export type MultiTP = {
  _id?: string
  target: string
  amount: string
  uuid: string
}

export enum BotMarginTypeEnum {
  inherit = 'inherit',
  cross = 'cross',
  isolated = 'isolated',
}

export enum BotOrderSideEnum {
  buy = 'BUY',
  sell = 'SELL',
}

export enum DCAOrderTypeEnum {
  tp = 'TP order',
  sl = 'SL order',
  bo = 'Start order',
  dca = 'DCA order',
}

export type GridBreakpoint = {
  price: number
  displacedPrice: number
}

export enum BotTypesEnum {
  dca = 'dca',
  grid = 'grid',
}

export type Symbols = {
  pair: string
  exchange: ExchangeEnum
  baseAsset: {
    minAmount: number
    maxAmount: number
    step: number
    name: string
  }
  quoteAsset: {
    minAmount: number
    name: string
  }
  maxOrders: number
  priceAssetPrecision: number
}

export type Prices = {
  symbol: string
  price: number
  exchange?: ExchangeEnum | 'all'
}[]

export enum ExchangeEnum {
  binance = 'binance',
  kucoin = 'kucoin',
  ftx = 'ftx',
  bybit = 'bybit',
  binanceUS = 'binanceUS',
  ftxUS = 'ftxUS',
  paperBinance = 'paperBinance',
  paperKucoin = 'paperKucoin',
  paperFtx = 'paperFtx',
  paperBybit = 'paperBybit',
  binanceCoinm = 'binanceCoinm',
  binanceUsdm = 'binanceUsdm',
  paperBinanceCoinm = 'paperBinanceCoinm',
  paperBinanceUsdm = 'paperBinanceUsdm',
  binanceAll = 'binanceAll',
  binanceSpot = 'binanceSpot',
  paperBinanceAll = 'paperBinanceAll',
  paperBinanceSpot = 'paperBinanceSpot',
}

export type DCAGrid = {
  qty: number
  price: number
  note?: string
  side: BotOrderSideEnum
  id: string
  priceDeviation?: string
  avgPrice?: number
  requiredPrice?: number
  type?: DCAOrderTypeEnum
  base?: number
  quote?: number
  tpSlTarget?: string
  label?: string
}

export type Asset = {
  asset: string
  free: string
  locked: string
  exchange?: string
  exchangeName?: string
  exchangeUUID?: string
}

export enum TrailingModeEnum {
  ttp = 'ttp',
  tsl = 'tsl',
}

export const enum PositionSide {
  BOTH = 'BOTH',
  SHORT = 'SHORT',
  LONG = 'LONG',
}

export type FullGrid = DCAGrid & { filledTime?: number }

export type SplitTime = {
  d: string
  h: string
  min: string
  s: string
}

export type Deal = {
  initialOrders: FullGrid[]
  id: string
  filledOrders: FullGrid[]
  activeOrders: FullGrid[]
  status: 'open' | 'closed'
  startTime: number
  closedTime?: number
  profit: {
    total: number
    totalUsd: number
    perc: number
  }
  usage: {
    current: Balance
    max: Balance
  }
  levels: {
    all: number
    complete: number
  }
  duration: number
  splitDuration: SplitTime
  number?: number
  avgPrice: number
  startPrice: number
  closePrice?: number
  currentBalance: Balance
  initialBalance: Balance
  slPerc?: number
  changed?: boolean
  bestPrice?: number
  trailingLevel?: number
  trailingMode?: TrailingModeEnum
  bestPriceSet?: boolean
  tpSlTargetFilled?: string[]
}

type Balance = {
  base: number
  quote: number
}

export interface Bar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type DCABacktestingInput = BacktestingInput<DCABotSettings>

export type BacktestingInput<T> = {
  exchange: ExchangeEnum
  symbol: Symbols
  interval?: ExchangeIntervals
  balances?: Asset[] | null
  from?: number
  to?: number
  slippage?: number
  userFee: number
  prices: Prices
  settings: T
}

export type LoadDataFn = (
  pair: string,
  resolution: ResolutionString,
  periodToUse: PeriodParams,
  exchange: ExchangeEnum,
) => Promise<Bar[]>

export type DCABacktestingResult = {
  // pair: string
  deals: Deal[]
  financial: {
    netProfitTotal: number
    netProfitTotalUsd: number
    netProfitTotalPerc: number
    grossProfit: number
    grossProfitUsd: number
    grossProfitPerc: number
    grossLoss: number
    grossLossUsd: number
    grossLossPerc: number
    avgGrossProfit: number
    avgGrossProfitUsd: number
    avgGrossProfitPerc: number
    avgGrossLoss: number
    avgGrossLossUsd: number
    avgGrossLossPerc: number
    avgNetProfit: number
    avgNetProfitUsd: number
    avgNetProfitPerc: number
    avgNetDaily: number
    avgNetDailyUsd: number
    avgNetDailyPerc: number
    unrealizedPnL: number
    unrealizedPnLUsd: number
    unrealizedPnLPerc: number
    maxDealProfit: number
    maxDealLoss: number
    maxDealProfitUsd: number
    maxDealProfitPerc: number
    maxDealLossUsd: number
    maxDealLossPerc: number
    maxRunUp: number
    maxRunUpUsd: number
    maxRunUpPerc: number
    maxDrawDown: number
    maxDrawDownUsd: number
    maxDrawDownPerc: number
  }
  duration: {
    avgDealDuration: number
    avgSplitDealDuration: SplitTime
    firstDataTime: number
    lastDataTime: number
    loadingDataTime: number
    processingDataTime: number
    botWorkingTime: SplitTime
    maxDealDuration: SplitTime
    periodName?: string
  }
  usage: {
    maxTheoreticalUsage: number
    maxRealUsage: number
    avgRealUsage: number
  }
  numerical: {
    all: number
    profit: number
    loss: number
    open: number
    closed: number
    maxConsecutiveWins: number
    maxConsecutiveLosses: number
    maxDCATriggered: number
    avgDCATriggered: number
    dealsPerDay: number
    coveredPriceDeviation: number
    actualPriceDeviation: number
  }
  ratios: {
    profitFactor: number
    profitByPeriod: number[]
    buyAndHold: {
      value: number
      valueUsd: number
      perc: number
    }
    periodRatio: number
  }
  interval: ExchangeIntervals
  quoteRate: number
  precision?: number
  _id?: string
  shared?: boolean
}

export enum FuturesStrategyEnum {
  long = 'LONG',
  short = 'SHORT',
  neutral = 'NEUTRAL',
}

export type Settings = {
  pair: string
  name: string
  topPrice: string
  lowPrice: string
  levels: string
  gridStep: string
  budget: string
  ordersInAdvance?: string
  useOrderInAdvance: boolean
  prioritize: 'gridStep' | 'level'
  profitCurrency: Currency
  orderFixedIn: Currency
  sellDisplacement: string
  gridType: GridType
  tpSl?: boolean
  tpSlCondition?: TpSlCondition
  tpSlAction?: TpSlAction
  sl?: boolean
  slCondition?: TpSlCondition
  slAction?: TpSlAction
  tpPerc?: string
  slPerc?: string
  tpTopPrice?: string
  slLowPrice?: string
  updatedBudget?: boolean
  startPrice?: string
  useStartPrice?: boolean
  marginType?: BotMarginTypeEnum
  leverage?: number
  futures?: boolean
  coinm?: boolean
  newProfit?: boolean
  strategy?: StrategyEnum
  futuresStrategy?: FuturesStrategyEnum
}

export type GridType = 'geometric' | 'arithmetic'

export type TpSlCondition = 'valueChanged' | 'priceReached'

export type TpSlAction = 'stop' | 'stopAndSell'

export type BacktestingTransaction = {
  _id: string
  updateTime: number
  side: BotOrderSideEnum
  amountBaseBuy: string
  amountQuoteBuy: string
  amountBaseSell: string
  amountQuoteSell: string
  priceBuy: string
  priceSell: string
  profit: string
  profitUsd: number
  baseAsset: string
  quoteAsset: string
  profitAsset: string
  index: number
}

export type Grid = {
  price: number
  side: BotOrderSideEnum
  qty: number
  id: string
}

export type GridBacktestingResult = {
  transaction: BacktestingTransaction[]
  orders: Grid[]
  financial: {
    profitTotal: string
    profitTotalUsd: number
    profitTotalPerc: number
    budgetUsd: number
    avgNetDaily: string
    avgNetDailyUsd: number
    avgNetDailyPerc: number
    avgTransactionProfit: string
    avgTransactionProfitUsd: number
    avgTransactionProfitPerc: number
    initialBalances: string
    initialBalancesByAsset: {
      base: string
      quote: string
    }
    initialBalancesUsd: number
    currentBalances: string
    currentBalancesByAsset: {
      base: string
      quote: string
    }
    currentBalancesUsd: number
    valueChange: string
    valueChangeUsd: number
    valueChangePerc: number
    startPrice: string
    lastPrice: string
    breakevenPrice: number
  }
  duration: {
    firstDataTime: number
    lastDataTime: number
    loadingDataTime: number
    processingDataTime: number
    botWorkingTime: SplitTime
    periodName?: string
  }
  numerical: {
    all: number
    transactionsPerDay: number
    buy: number
    sell: number
  }
  ratios: {
    profitByPeriod: number[]
    buyAndHold: {
      value: number
      valueUsd: number
      perc: number
    }
    periodRatio: number
  }
  interval?: ExchangeIntervals
  quoteRate: number
  precision?: number
  _id?: string
  shared?: boolean
  position: {
    count: number
    qty: number
    price: number
    side: string
    pnl: {
      value: number
      perc: number
    }
  }
}

export type Precision = {
  base: number
  quote: number
  price: number
}

export type GRIDBacktestingInput = BacktestingInput<Settings>

export type OrderData = {
  userId: string
  botId: string
  id: string
  clientOrderId: string
  cummulativeQuoteQty: string
  executedQty: string
  icebergQty: string
  isWorking: boolean
  orderId?: number
  origQty: string
  price: string
  side: string
  status: string
  stopPrice: string
  symbol: string
  baseAsset: string
  quoteAsset: string
  time: number
  timeInForce: string
  type: string
  updateTime: number
  transactTime: number
  typeOrder:
    | 'swap'
    | 'regular'
    | 'dealStart'
    | 'dealTP'
    | 'dealRegular'
    | 'stop'
    | 'stab'
  dealId: string
  exchangeUUID: string
  exchange: ExchangeEnum
  paperContext?: boolean
  tpSlTarget?: string
}

export const tvIntervalMap = {
  [ExchangeIntervals.oneM]: '1',
  [ExchangeIntervals.threeM]: '3',
  [ExchangeIntervals.fiveM]: '5',
  [ExchangeIntervals.fifteenM]: '15',
  [ExchangeIntervals.thirtyM]: '30',
  [ExchangeIntervals.oneH]: '60',
  [ExchangeIntervals.twoH]: '120',
  [ExchangeIntervals.fourH]: '240',
  [ExchangeIntervals.eightH]: '480',
  [ExchangeIntervals.oneD]: '1D',
  [ExchangeIntervals.oneW]: '1W',
}

export interface PeriodParams {
  from: number
  to: number
  countBack: number
  firstDataRequest: boolean
}

export declare type Nominal<T, Name extends string> = T & {
  [Symbol.species]: Name
}
export declare type ResolutionString = Nominal<string, 'ResolutionString'>
