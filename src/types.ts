import type {
  MACDResult,
  BandsResult,
  StochasticResult,
  PivotResult,
  DIVResult,
  SuperTrendResult,
  PCResult,
  PriorPivotResult,
  QFLResult,
  DCResult,
} from '@gainium/indicators'

export const DirName = `../../tmp-backtester`

export enum IndicatorEnum {
  rsi = 'RSI',
  adx = 'ADX',
  bbw = 'BBW',
  bb = 'BB',
  macd = 'MACD',
  stoch = 'Stoch',
  cci = 'CCI',
  ao = 'AO',
  stochRSI = 'StochRSI',
  wr = 'WR',
  bullBear = 'BullBear',
  uo = 'UO',
  ic = 'IC',
  tv = 'TV',
  ma = 'MA',
  sr = 'SR',
  qfl = 'QFL',
  mfi = 'MFI',
  psar = 'PSAR',
  vo = 'VO',
  mom = 'MOM',
  bbwp = 'BBWP',
  ecd = 'ECD',
  xo = 'XO',
  mar = 'MAR',
  bbpb = 'BBPB',
  div = 'DIV',
  st = 'ST',
  pc = 'PC',
  atr = 'ATR',
  pp = 'PP',
  adr = 'ADR',
  ath = 'ATH',
  kc = 'KC',
  kcpb = 'KCPB',
  unpnl = 'UNPNL',
  dc = 'DC',
}

export enum ECDTriggerEnum {
  bearish = 'bearish',
  bullish = 'bullish',
  both = 'both',
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

export type TradeResponse = {
  aggId: string
  symbol: string
  price: string
  quantity: string
  firstId: number
  lastId: number
  timestamp: number
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
  startDca = 'startDca',
  stopBot = 'stopBot',
  startBot = 'startBot',
  riskReward = 'riskReward',
}

export type MAResult = {
  ma: number
  maType: string
  price: number
}

type Percentile = {
  percentile?: boolean
  percentileLookback?: number
  percentilePercentage?: number
}

type TrendFilter = {
  trendFilter?: boolean
  trendFilterLookback?: number
  trendFilterType?: TrendFilterOperatorEnum
  trendFilterValue?: number
}

type DivergenceOscillators =
  | IndicatorEnum.adx
  | IndicatorEnum.cci
  | IndicatorEnum.mfi
  | IndicatorEnum.rsi
  | IndicatorEnum.wr
  | IndicatorEnum.macd
  | IndicatorEnum.uo
  | IndicatorEnum.ao
  | IndicatorEnum.mom
  | IndicatorEnum.bbw
  | IndicatorEnum.vo
  | IndicatorEnum.bbpb
  | IndicatorEnum.stoch

export enum RangeType {
  atr = 'ATR',
  tr = 'TR',
  r = 'R',
}

export type IndicatorConfigBackTesting =
  | { type: IndicatorEnum.dc; length: number }
  | {
      type: IndicatorEnum.st
      factor: number
      atrPeriod: number
    }
  | {
      type: IndicatorEnum.ath
      lookback: number
    }
  | {
      type: IndicatorEnum.pp
      ppHighLeft: number
      ppHighRight: number
      ppLowLeft: number
      ppLowRight: number
      ppMult: number
    }
  | {
      type: IndicatorEnum.pc
      pcUp: number
      pcDown: number
    }
  | {
      type: IndicatorEnum.div
      oscillators: DivergenceOscillators[]
      leftBars?: number
      rightBars?: number
      rangeLower?: number
      rangeUpper?: number
    }
  | { type: IndicatorEnum.ecd }
  | {
      type: IndicatorEnum.tv
      checkLevel?: number
      useAsEntryExitPoints?: boolean
    }
  | ({
      type: IndicatorEnum.ao
    } & Percentile)
  | ({
      type: IndicatorEnum.kc | IndicatorEnum.kcpb
      interval: number
      multiplier?: number
      ma?: MAEnum
      range?: RangeType
      rangeLength?: number
    } & Percentile)
  | ({
      type: IndicatorEnum.mom
      interval: number
      source: string
    } & Percentile)
  | {
      type: IndicatorEnum.bbwp
      interval: number
      lookback: number
      source: string
    }
  | ({
      type:
        | IndicatorEnum.rsi
        | IndicatorEnum.adx
        | IndicatorEnum.mfi
        | IndicatorEnum.cci
        | IndicatorEnum.wr
        | IndicatorEnum.atr
        | IndicatorEnum.adr
      interval: number
    } & Percentile)
  | ({
      type: IndicatorEnum.bbw | IndicatorEnum.bb | IndicatorEnum.bbpb
      interval: number
      bbwMult?: number
      bbwMa?: MAEnum
      bbwMaLength?: number
    } & Percentile)
  | ({
      type: IndicatorEnum.macd
      longInterval: number
      shortInterval: number
      signalInterval: number
      maSource?: MAEnum
      maSignal?: MAEnum
    } & Percentile)
  | {
      type: IndicatorEnum.ma
      maType: MAEnum
      interval: number
    }
  | {
      type: IndicatorEnum.stoch
      length: number
      smoothK: number
      smoothD: number
    }
  | {
      type: IndicatorEnum.stochRSI
      length: number
      rsiLength: number
      smoothK: number
      smoothD: number
    }
  | {
      type: IndicatorEnum.sr
      leftBars: number
      rightBars: number
    }
  | {
      type: IndicatorEnum.qfl
      basePeriods: number
      pumpPeriods: number
      pump: number
      baseCrack: number
    }
  | {
      type: IndicatorEnum.psar
      start: number
      inc: number
      max: number
    }
  | ({
      type: IndicatorEnum.vo
      voLong: number
      voShort: number
    } & Percentile)
  | ({
      type: IndicatorEnum.mar
      mar1type: MAEnum
      mar1length: number
      mar2type: MAEnum
      mar2length: number
    } & Percentile &
      TrendFilter)
  | ({
      type: IndicatorEnum.uo
      fast: number
      middle: number
      slow: number
    } & Percentile)

type PercentileResult = {
  percentile?: number
  value: number
  trend?: number
}

export type IndicatorHistory = { time: number } & (
  | { type: IndicatorEnum.pp; value: PriorPivotResult }
  | {
      type:
        | IndicatorEnum.rsi
        | IndicatorEnum.cci
        | IndicatorEnum.ao
        | IndicatorEnum.uo
        | IndicatorEnum.wr
        | IndicatorEnum.adx
        | IndicatorEnum.bbw
        | IndicatorEnum.mfi
        | IndicatorEnum.vo
        | IndicatorEnum.mom
        | IndicatorEnum.mar
        | IndicatorEnum.bbpb
        | IndicatorEnum.kcpb
      value: PercentileResult
    }
  | {
      type:
        | IndicatorEnum.xo
        | IndicatorEnum.bbwp
        | IndicatorEnum.ecd
        | IndicatorEnum.atr
        | IndicatorEnum.adr
        | IndicatorEnum.ath
      value: number
    }
  | { type: IndicatorEnum.st; value: SuperTrendResult }
  | {
      type: IndicatorEnum.div
      value: DIVResult
    }
  | { type: IndicatorEnum.pc; value: PCResult }
  | {
      type: IndicatorEnum.macd
      value: MACDResult
    }
  | {
      type: IndicatorEnum.ma
      value: MAResult
    }
  | { type: IndicatorEnum.tv; value: number }
  | {
      type: IndicatorEnum.bb | IndicatorEnum.kc
      value: { result: BandsResult; price: number }
    }
  | {
      type: IndicatorEnum.stoch | IndicatorEnum.stochRSI
      value: StochasticResult
    }
  | {
      type: IndicatorEnum.sr
      value: PivotResult
    }
  | { type: IndicatorEnum.qfl; value: QFLResult }
  | { type: IndicatorEnum.psar; value: { psar: number; price: number } }
  | { type: IndicatorEnum.dc; value: DCResult }
)

export type SettingsIndicators = {
  type: IndicatorEnum
  indicatorLength: number
  indicatorValue: string
  indicatorCondition: IndicatorStartConditionEnum
  groupId: string
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
  psarStart?: number
  psarInc?: number
  psarMax?: number
  stochRange?: StochRangeEnum
  minPercFromLast?: string
  orderSize?: string
  keepConditionBars?: string
  voLong?: number
  voShort?: number
  uoFast?: number
  uoMiddle?: number
  uoSlow?: number
  momSource?: string
  bbwpLookback?: number
  ecdTrigger?: ECDTriggerEnum
  xOscillator1?:
    | IndicatorEnum.rsi
    | IndicatorEnum.cci
    | IndicatorEnum.mfi
    | IndicatorEnum.vo
  xOscillator2?:
    | IndicatorEnum.rsi
    | IndicatorEnum.cci
    | IndicatorEnum.mfi
    | IndicatorEnum.vo
  xOscillator2length?: number
  xOscillator2Interval?: ExchangeIntervals
  xOscillator2voLong?: number
  xOscillator2voShort?: number
  xoUUID?: string
  percentile?: boolean
  percentileLookback?: number
  percentilePercentage?: number
  mar1length?: number
  mar1type?: MAEnum
  mar2length?: number
  mar2type?: MAEnum
  bbwMult?: number
  bbwMa?: MAEnum
  bbwMaLength?: number
  macdFast?: number
  macdSlow?: number
  macdMaSource?: MAEnum
  macdMaSignal?: MAEnum
  divOscillators?: DivergenceOscillators[]
  divType?: DivTypeEnum
  divMinCount?: number
  trendFilter?: boolean
  trendFilterLookback?: number
  trendFilterType?: TrendFilterOperatorEnum
  trendFilterValue?: number
  factor?: number
  atrLength?: number
  stCondition?: STConditionEnum
  pcUp?: string
  pcDown?: string
  pcCondition?: PCConditionEnum
  pcValue?: string
  ppHighLeft?: number
  ppHighRight?: number
  ppLowLeft?: number
  ppLowRight?: number
  ppMult?: number
  ppValue?: ppValueEnum
  ppType?: ppValueTypeEnum
  showHH?: boolean
  showHL?: boolean
  showLH?: boolean
  showLL?: boolean
  riskAtrMult?: string
  dynamicArFactor?: string
  athLookback?: number
  kcMa?: MAEnum
  kcRange?: RangeType
  kcRangeLength?: number
  unpnlValue?: number
  unpnlCondition?: IndicatorStartConditionEnum
  dcValue?: DCValueEnum
}

export enum DCValueEnum {
  basis = 'basis',
  lower = 'lower',
  upper = 'upper',
}

export enum ppValueTypeEnum {
  price = 'Price Based',
  event = 'Event Based',
  market = 'Market Based',
}

export enum ppValueEnum {
  hh = 'HH',
  hl = 'HL',
  lh = 'LH',
  ll = 'LL',
  anyH = 'Any High',
  anyL = 'Any Low',
  sl = 'SL',
  wl = 'WL',
  sh = 'SH',
  wh = 'WH',
  anySWL = 'anyL',
  anySWH = 'anyH',
  bullMarket = 'BullM',
  bearMarket = 'BearM',
  sBullBoS = 'SBullBoS',
  sBearBoS = 'SBearBoS',
  sBullCHoCH = 'SBullCHoCH',
  sBearCHoCH = 'SBearCHoCH',
  iBullBoS = 'IBullBoS',
  iBearBoS = 'IBearBoS',
  iBullCHoCH = 'IBullCHoCH',
  iBearCHoCH = 'IBearCHoCH',
  IanyBull = 'IAnyBull',
  IanyBear = 'IAnyBear',
  SanyBull = 'SAnyBull',
  SanyBear = 'SAnyBear',
  bullAnyBoS = 'BullAnyBoS',
  bearAnyBoS = 'BearAnyBoS',
  bullAnyCHoCH = 'BullAnyCHoCH',
  bearAnyCHoCH = 'BearAnyCHoCH',
}

export enum PCConditionEnum {
  up = 'UP',
  down = 'DOWN',
}
export enum STConditionEnum {
  up = 'up',
  down = 'down',
  upToDown = 'upToDown',
  downToUp = 'downToUp',
}

export enum TrendFilterOperatorEnum {
  lower = 'lower',
  higher = 'higher',
  between = 'between',
}

export enum DivTypeEnum {
  bull = 'Bullish',
  bear = 'Bearish',
  hbull = 'Hidden Bullish',
  hbear = 'Hidden Bearish',
  abull = 'Any Bullish',
  abear = 'Any Bearish',
}

export enum StochRangeEnum {
  upper = 'upper',
  lower = 'lower',
  both = 'both',
  none = 'none',
}

export enum IndicatorSection {
  tp = 'tp',
  sl = 'sl',
  dca = 'dca',
  controller = 'controller',
}

export enum CloseConditionEnum {
  tp = 'tp',
  techInd = 'techInd',
  manual = 'manual',
  webhook = 'webhook',
  dynamicAr = 'dynamicAr',
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
  trigger = 'trigger',
}

export enum OrderSizeTypeEnum {
  base = 'base',
  quote = 'quote',
  percTotal = 'percTotal',
  percFree = 'percFree',
  usd = 'usd',
}

export enum CooldownUnits {
  seconds = 'seconds',
  minutes = 'minutes',
  hours = 'hours',
  days = 'days',
}

export enum DCAConditionEnum {
  percentage = 'percentage',
  indicators = 'indicators',
  custom = 'custom',
  dynamicAr = 'dynamicAr',
}

export type DCACustom = {
  step: string
  size: string
  uuid: string
}

export enum CooldownOptionsEnum {
  symbol = 'symbol',
  bot = 'bot',
}

export enum BaseSlOnEnum {
  start = 'start',
  avg = 'avg',
}

export enum DCAVolumeType {
  scale = 'scale',
  change = 'change',
}

export enum DcaVolumeRequiredChangeRef {
  tp = 'tp',
  avg = 'avg',
}

export type SettingsIndicatorGroup = {
  id: string
  logic: IndicatorsLogicEnum
  action: IndicatorAction
  section?: IndicatorSection
}

export interface DCABotSettings extends BaseSettings {
  minimumDeviation?: string
  dcaCondition?: DCAConditionEnum
  dcaVolumeBaseOn?: DCAVolumeType
  dcaVolumeRequiredChange?: string
  dcaVolumeMaxValue?: string
  dcaVolumeRequiredChangeRef?: DcaVolumeRequiredChangeRef
  baseSlOn?: BaseSlOnEnum
  dcaCustom?: DCACustom[]
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
  ordersCount: string | number
  activeOrdersCount: string | number
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
  hodlHourly?: boolean
  hodlNextBuy: number
  maxNumberOfOpenDeals?: string
  indicators: SettingsIndicators[]
  indicatorGroups: SettingsIndicatorGroup[]
  type?: DCATypeEnum
  orderSizeType: OrderSizeTypeEnum
  limitTimeout?: string
  useLimitTimeout?: boolean
  cooldownAfterDealStart?: boolean
  cooldownAfterDealStartUnits?: CooldownUnits
  cooldownAfterDealStartInterval?: number
  cooldownAfterDealStartOption?: CooldownOptionsEnum
  cooldownAfterDealStop?: boolean
  cooldownAfterDealStopUnits?: CooldownUnits
  cooldownAfterDealStopInterval?: number
  cooldownAfterDealStopOption?: CooldownOptionsEnum
  moveSL?: boolean
  moveSLTrigger?: string
  moveSLValue?: string
  moveSLForAll?: boolean
  trailingSl?: boolean
  trailingTp?: boolean
  trailingTpPerc?: string
  maxDealsPerPair?: string
  ignoreStartDeals?: boolean
  comboTpBase?: ComboTpBase
  useCloseAfterX?: boolean
  closeAfterX?: string
  useCloseAfterXwin?: boolean
  closeAfterXwin?: string
  useCloseAfterXloss?: boolean
  closeAfterXloss?: string
  useCloseAfterXprofit?: boolean
  closeAfterXprofitValue?: string
  closeAfterXprofitCond?: IndicatorStartConditionEnum
  pair: string[]
  useMulti?: boolean
  useCloseAfterXopen?: boolean
  closeAfterXopen?: string
  botStart?: BotStartTypeEnum
  useBotController?: boolean
  stopType?: CloseDCATypeEnum
  stopStatus?: 'closed' | 'monitoring'
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
  gridLevel?: string
  baseStep?: string
  baseGridLevels?: string
  useActiveMinigrids?: boolean
  comboActiveMinigrids?: string
  closeByTimer?: boolean
  closeByTimerValue?: number
  closeByTimerUnits?: CooldownUnits
  maxDealsPerHigherTimeframe?: string
  useMaxDealsPerHigherTimeframe?: boolean
  feeOrder?: boolean
  useStaticPriceFilter?: boolean
  useCooldown?: boolean
  useVolumeFilterAll?: boolean
  useDynamicPriceFilter?: boolean
  dynamicPriceFilterDeviation?: string
  dynamicPriceFilterOverValue?: string
  dynamicPriceFilterUnderValue?: string
  dynamicPriceFilterPriceType?: DynamicPriceFilterPriceTypeEnum
  pairPrioritization?: PairPrioritizationEnum
  dynamicPriceFilterDirection?: DynamicPriceFilterDirectionEnum
  useRiskReward?: boolean
  riskSlType?: RiskSlTypeEnum
  riskSlAmountPerc?: string
  riskSlAmountValue?: string
  riskUseTpRatio?: boolean
  riskTpRatio?: string
  riskMaxSl?: string
  riskMinSl?: string
  comboUseSmartGrids?: boolean
  comboSmartGridsCount?: string
  riskMinPositionSize?: string
  riskMaxPositionSize?: string
  scaleDcaType?: ScaleDcaTypeEnum
  startDealLogic?: IndicatorsLogicEnum
  stopDealLogic?: IndicatorsLogicEnum
  stopDealSlLogic?: IndicatorsLogicEnum
  stopBotLogic?: IndicatorsLogicEnum
  useRiskReduction?: boolean
  riskReductionValue?: string
  useReinvest?: boolean
  reinvestValue?: string
  startBotPriceCondition?: IndicatorStartConditionEnum
  startBotPriceValue?: string
  stopBotPriceCondition?: IndicatorStartConditionEnum
  stopBotPriceValue?: string
  startBotLogic?: IndicatorsLogicEnum
  botActualStart?: BotStartTypeEnum
  entryOrderAmount?: EntryOrderAmountEnum
  exitOrderAmount?: EntryOrderAmountEnum
  exitOrderSize?: string
  exitOrderCurrency?: ExitOrderCurrencyEnum
  useNoOverlapDeals?: boolean
}

export enum ExitOrderCurrencyEnum {
  base = 'base',
  quote = 'quote',
  position = 'position',
}

export enum EntryOrderAmountEnum {
  predefined = 'predefined',
  webhook = 'webhook',
}

export enum IndicatorsLogicEnum {
  and = 'and',
  or = 'or',
}

export enum ScaleDcaTypeEnum {
  percentage = 'percentage',
  atr = 'atr',
  adr = 'adr',
}

export enum RiskSlTypeEnum {
  perc = 'perc',
  fixed = 'fixed',
}

export enum DynamicPriceFilterDirectionEnum {
  over = 'over',
  under = 'under',
  overAndUnder = 'overAndUnder',
}

export enum PairPrioritizationEnum {
  alphabetical = 'alphabetical',
  random = 'random',
}

export enum DynamicPriceFilterPriceTypeEnum {
  avg = 'avg',
  entry = 'entry',
}

export enum ComboTpBase {
  full = 'full',
  filled = 'filled',
}

export enum BotStartTypeEnum {
  manual = 'manual',
  webhook = 'webhook',
  indicators = 'indicators',
  price = 'price',
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
  grid = 'Grid',
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
  bybitCoinm = 'bybitInverse',
  bybitUsdm = 'bybitLinear',
  paperBybitCoinm = 'paperBybitInverse',
  paperBybitUsdm = 'paperBybitLinear',
  bybitAll = 'bybitAll',
  bybitSpot = 'bybitSpot',
  paperBybitAll = 'paperBybitAll',
  paperBybitSpot = 'paperBybitSpot',
  okx = 'okx',
  okxLinear = 'okxLinear',
  okxInverse = 'okxInverse',
  paperOkx = 'paperOkx',
  paperOkxLinear = 'paperOkxLinear',
  paperOkxInverse = 'paperOkxInverse',
  okxAll = 'okxAll',
  okxSpot = 'okxSpot',
  paperOkxAll = 'paperOkxAll',
  paperOkxSpot = 'paperOkxSpot',
  coinbase = 'coinbase',
  paperCoinbase = 'paperCoinbase',
  kucoinInverse = 'kucoinInverse',
  kucoinLinear = 'kucoinLinear',
  paperKucoinInverse = 'paperKucoinInverse',
  paperKucoinLinear = 'paperKucoinLinear',
  kucoinAll = 'kucoinAll',
  paperKucoinAll = 'paperKucoinAll',
  kucoinSpot = 'kucoinSpot',
  paperKucoinSpot = 'paperKucoinSpot',
  bitget = 'bitget',
  paperBitget = 'paperBitget',
  bitgetUsdm = 'bitgetUsdm',
  bitgetCoinm = 'bitgetCoinm',
  paperBitgetUsdm = 'paperBitgetUsdm',
  paperBitgetCoinm = 'paperBitgetCoinm',
  bitgetAll = 'bitgetAll',
  bitgetSpot = 'bitgetSpot',
  paperBitgetAll = 'paperBitgetAll',
  paperBitgetSpot = 'paperBitgetSpot',
  mexc = 'mexc',
  paperMexc = 'paperMexc',
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
  relatedTo?: string
  minigridId?: string
  levelNumber?: number
  minigridBudget?: number
  grey?: boolean
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

export type FullGrid = DCAGrid & {
  filledTime?: number
  startTime?: number
  dealId?: string
}

export type SplitTime = {
  d: string
  h: string
  min: string
  s: string
}

export type Minigrid = {
  filledBase: number
  filledQuote: number
  symbol: Symbols
  initialOrders: FullGrid[]
  filledOrders: FullGrid[]
  notUsedFilledOrders: FullGrid[]
  activeOrders: FullGrid[]
  id: string
  dealId: string
  dcaOrderId: string
  grids: { buy: number; sell: number }
  status: 'open' | 'close'
  initialBalances: Balance
  currentBalances: Balance
  initialPrice: number
  lastPrice: number
  lastSide: BotOrderSideEnum
  profit: {
    total: number
    totalUsd: number
  }
  avgPrice: number
  createTime: number
  updateTime: number
  closeTime?: number
  assets: { used: Balance; required: Balance }
  settings: {
    topPrice: number
    lowPrice: number
    levels: number
    budget: number
    sellDisplacement: number
    profitCurrency: Currency
    orderFixedIn: Currency
    step: number
  }
  transactions: {
    buy: number
    sell: number
  }
  lockClose: boolean
}

export type PreparedMinigrid = {
  id: string
  status: 'open' | 'close'
  initialPrice: number
  lastPrice: number
  profit: {
    total: number
    totalUsd: number
  }
  avgPrice: number
  createTime: number
  updateTime: number
  closeTime?: number
  transactions: {
    buy: number
    sell: number
  }
  settings: {
    profitCurrency: Currency
  }
}

export type OrderHistory = FullGrid & {
  slLine?: boolean
  avgLine?: boolean
  dealId: string
}

export type Deal = {
  moveSlActivated?: boolean
  symbol: Symbols
  transactions: BacktestingTransaction[]
  transactionsCount: {
    buy: number
    sell: number
  }
  mingrids: Minigrid[]
  initialOrders: FullGrid[]
  id: string
  filledOrders: (FullGrid & { dealId: string })[]
  hiddenOrders: (FullGrid & { dealId: string })[]
  activeOrders: FullGrid[]
  ordersHistory: OrderHistory[]
  finishedOrdersHistory: OrderHistory[]
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
    max: number
  }
  step: number
  duration: number
  splitDuration: SplitTime
  number?: number
  avgPrice: number
  startPrice: number
  liquidationPrice?: number
  closePrice?: number
  lastPrice: number
  lastTime: number
  currentBalance: Balance
  initialBalance: Balance
  slPerc?: number
  changed?: boolean
  bestPrice?: number
  trailingLevel?: number
  trailingMode?: TrailingModeEnum
  bestPriceSet?: boolean
  tpSlTargetFilled?: string[]
  lastFilled: number
  volume: number
  equity: number
  equityInAsset: {
    base: number
    quote: number
  }
  portfolio: {
    base: number
    quote: number
  }
  lastIndex: number
  dynamicAr?: DynamicArPrices[]
  sizes?: Sizes
}

export type PreparedGrid = {
  price: number
  side: BotOrderSideEnum
  id: string
  filledTime?: number
  startTime?: number
  dealId?: string
}

export type PreparedDeal = {
  symbol: Symbols
  transactions: PreparedTransaction[]
  transactionsCount?: {
    buy: number
    sell: number
  }
  mingrids: PreparedMinigrid[]
  id: string
  filledOrders: PreparedGrid[]
  ordersHistory: (PreparedGrid & {
    avgLine?: boolean
  })[]
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
    max: number
  }
  duration: number
  splitDuration: SplitTime
  number?: number
  avgPrice: number
  startPrice: number
  liquidationPrice?: number
  closePrice?: number
  volume: number
  equity: number
  equityInAsset: {
    base: number
    quote: number
  }
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

export enum EdgeBacktestEnum {
  random = 'random',
  randomMulti = 'randomMulti',
}

export type DCABacktestingInput = BacktestingInput<DCABotSettings> & {
  edge?: EdgeBacktestEnum
  previousData?: DCABacktestingResult
}

export type BacktestingInput<T> = {
  exchange: ExchangeEnum
  symbols: Symbols[]
  interval?: ExchangeIntervals
  balances?: Asset[] | null
  from?: number
  to?: number
  slippage?: number
  userFee: number
  prices: Prices
  settings: T
  combo?: boolean
  trades?: boolean
  multi?: boolean
  timezone?: string | null
  fullResult?: boolean
  useFile?: boolean
}

export type LoadDataFn = (
  pair: string,
  baseAsset: string,
  quteAsset: string,
  resolution: ResolutionString,
  periodToUse: PeriodParams,
  exchange: ExchangeEnum,
  index?: number,
  total?: number,
) => Promise<Bar[]>

export type Profit = {
  total: number
  totalUsd: number
  time: number
}

export type ValueChangeHistory = {
  value: number
  time: number
}

export type IndicatorsEvents = {
  type: IndicatorAction
  time: number
  side: BotOrderSideEnum
  price: number
  symbol: string
}

export type BuyAndHoldEquity = {
  value: number
  time: number
}

export type SymbolStatsProfit = {
  total: number
  totalUsd: number
  perc: number
}

export type SymbolStats = {
  pair: string
  deals: {
    profit: number
    loss: number
    open: number
  }
  netProfit: SymbolStatsProfit
  dailyReturn: SymbolStatsProfit
  profitAsset: string
  winRate: number
  profitFactor: string
  maxDealDuration: SplitTime
  avgDealDuration: SplitTime
}

export type PeriodicStats = {
  period: string
  startTime: number
  netResult: number
  drawdown: number
  runup: number
  deals: {
    profit: number
    loss: number
  }
}

export type DCABacktestingResult = {
  // pair: string
  portfolio?: { x: number; y: number }[]
  buyAndHoldEquity?: BuyAndHoldEquity[]
  indicatorsEvents?: IndicatorsEvents[]
  deals: PreparedDeal[]
  profits?: Profit[]
  noData?: boolean
  maxLeverage?: number
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
    maxDrawDownEquityUsd?: number
    maxDrawDownEquityPerc?: number
    initialBalanceUsd: number
    stDevWinningTrade?: number
    stDevLosingTrade?: number
    stDownDevLosingTrade?: number
    annualizedReturn?: number
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
    maxDealDurationTime: number
    periodName?: string
    botWorkingTimeNumber: number
    avgWinningTrade?: number
    maxWinningTrade?: number
    avgLosingTrade?: number
    maxLosingTrade?: number
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
    liquidationEvents?: number
    confidenceGrade?: string
    dealsForConfidenceGrade?: number
    priceDeviation?: number
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
    sharpe: number
    sortino: number
    cwr: number
  }
  interval: ExchangeIntervals
  quoteRate: number
  precision?: number
  _id?: string
  shared?: boolean
  multi?: boolean
  multiPairs?: number
  symbolStats?: SymbolStats[]
  periodicStats?: PeriodicStats[]
  messages?: string[]
}

export enum FuturesStrategyEnum {
  long = 'LONG',
  short = 'SHORT',
  neutral = 'NEUTRAL',
}

export type Settings = {
  pair: string
  name: string
  topPrice: string | number
  lowPrice: string | number
  levels: string | number
  gridStep: string | number
  budget: string | number
  ordersInAdvance?: string | number
  useOrderInAdvance: boolean
  prioritize: 'gridStep' | 'level'
  profitCurrency: Currency
  orderFixedIn: Currency
  sellDisplacement: string | number
  gridType: GridType
  tpSl?: boolean
  tpSlCondition?: TpSlCondition
  tpSlAction?: TpSlAction
  sl?: boolean
  slCondition?: TpSlCondition
  slAction?: TpSlAction
  tpPerc?: string | number
  slPerc?: string | number
  tpTopPrice?: string | number
  slLowPrice?: string | number
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
  amountFreeBaseBuy: number
  amountFreeQuoteBuy: number
  amountFreeBaseSell: number
  amountFreeQuoteSell: number
  priceBuy: string
  priceSell: string
  profit: string
  profitUsd: number
  freeProfit: number
  freeProfitUsd: number
  baseAsset: string
  quoteAsset: string
  profitAsset: string
  index: number
  idBuy: string
  idSell: string
  cummulativeProfitBase: number
  cummulativeProfitQuote: number
  cummulativeProfitUsdt: number
  executor: string
}

export type PreparedTransaction = {
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
  _id: string
}

export type Grid = {
  price: number
  side: BotOrderSideEnum
  qty: number
  id: string
}

export type FullGridWithTime = FullGrid & { filledTime: number }

export type GridBacktestingResult = {
  buyAndHoldEquity?: BuyAndHoldEquity[]
  values: ValueChangeHistory[]
  firstUsdRate: number
  lastUsdRate: number
  transaction: PreparedTransaction[]
  filledOrders?: Grid[]
  orders: (PreparedGrid & { qty: number })[]
  ordersHistory?: (PreparedGrid & {
    avgLine?: boolean
  })[]
  noData?: boolean
  financial: {
    freeProfitTotal: number
    freeProfitTotalUsd: number
    profitTotal: string
    profitTotalUsd: number
    profitTotalPerc: number
    budgetUsd: number
    avgNetDaily: string
    avgNetDailyUsd: number
    avgNetDailyPerc: number
    annualizedReturn?: number
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
    botWorkingTimeNumber: number
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
    sharpe: number
    sortino: number
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

export type FullBar = Bar & { symbol: string }

export type SavedBar = FullBar & { interval: ExchangeIntervals }

export type DynamicArPrices = { id: string; value: number }

export type Sizes = {
  base: number
  dca: number[]
}
