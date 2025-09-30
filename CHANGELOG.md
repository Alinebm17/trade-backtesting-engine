# Changelog

All notable changes to the Gainium Backtester library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
