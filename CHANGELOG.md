# Changelog

All notable changes to the Gainium Backtester library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.3] - 2026-06-10

### Changed
- DCA/combo per-bar deal processing performance.

## [1.6.2] - 2026-06-06

### Changed
- Expose order origin. 

## [1.6.1] - 2026-04-06

### Changed
- Long Wick logic

## [1.6.0] - 2026-04-03

### Added
- Long Wick
- Session

## [1.5.2] - 2026-03-02

### Changed 
- Kraken support

## [1.5.1] - 2026-02-09

### Fixed 
- Short required change calculation

## [1.5.0] - 2026-01-15

### Added 
- Separate max deal limits when using dynamic price filter over and under

## [1.4.6] - 2026-01-12

### Fixed 
- Wrong combined profit hedge bot.
- Wrong close time by combined settings. 

## [1.4.5] - 2026-01-06

### Fixed 
- Wrong candle combinations when have multiple exchanges. 

## [1.4.4] - 2025-12-23

### Fixed 
- AVP issue with group and section indicator logic

## [1.4.3] - 2025-12-17

### Fixed 
- AVP ignored when have another SL indicator

## [1.4.2] - 2025-11-12

### Fixed 
- Wrong order of DCA by indicators

## [1.4.1] - 2025-11-06

### Fixed 
- Stop loss with AVP

## [1.4.0] - 2025-11-05

### Added 
- Fixed Stop Loss in Risk Reward

## [1.3.3] - 2025-10-27

### Fixed 
- Trailing TP

## [1.3.2] - 2025-10-20

### Fixed 
- Hyperliquid USD rates

## [1.3.1] - 2025-10-16

### Fixed 
- Multi TP/ Multi SL processing

## [1.3.0] - 2025-10-09

### Added 
- Order Blocks & Fair Value Gaps (FVG only)

## [1.2.2] - 2025-09-30

### Changed 
- DCA settings update

## [1.2.1] - 2025-09-30

### Fixed 
- Find USD rate for USDC pairs

## [1.2.0] - 2025-09-24

### Added
- Hyperliquid integration

## [1.1.3] - 2025-09-23

### Changed
- Indicators update (QFL fix)

## [1.1.2] - 2025-09-22

### Fixed
- Hedge backtest with different symbols
- Load many candles

## [1.1.1] - 2025-09-05

### Changed
- Indicators update (QFL fix)

## [1.1.0] - 2025-09-04

### Changed
- Hedge backtest

## [1.0.10] - 2025-08-19

### Fixed
- Indicators (Donchian Channels offset)

## [1.0.9] - 2025-07-18

### Fixed
- Set maximum size exceeded

## [1.0.8] - 2025-07-02

### Changed
- Updated all dependencies to their latest versions
- Updated package-lock.json with latest dependency versions

### Fixed
- Fixed Prettier configuration and formatting issues

## [1.0.7] - 2025-06-30

### Changed
- Migrated package manager from Yarn to npm
- Removed yarn.lock in favor of package-lock.json
- Updated npm scripts to use npm instead of yarn commands
- Updated dependency management scripts for npm compatibility

## [1.0.6] - 2025-06-30

### Added
- Initial release of Gainium Backtester
- Professional backtesting engine for trading strategies
- Support for DCA (Dollar Cost Averaging) strategies
- Support for Grid trading strategies
- TypeScript support with comprehensive type definitions
- High-performance backtesting capabilities
- Integration with @gainium/indicators library
