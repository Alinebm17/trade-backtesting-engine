# Contributing to @gainium/backtester

Thank you for your interest in contributing to the Gainium Backtester! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)

## Development Setup

### Prerequisites

- Node.js 16+ 
- npm 8+
- TypeScript 4.5+
- Git

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backtester
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Verify setup**
   ```bash
   npm run lint
   npm run type-check
   ```

### Available Scripts

```bash
# Development
npm run build              # Build TypeScript to JavaScript
npm run build:watch        # Build with watch mode
npm run clean              # Clean build artifacts

# Code Quality
npm run lint               # Run ESLint
npm run lint:fix           # Fix ESLint issues
npm run format             # Format code with Prettier
npm run format:check       # Check code formatting

# Testing
npm run type-check         # TypeScript type checking
```

## Project Structure

```
backtester/
├── src/
│   ├── index.ts          # Main entry point and exports
│   ├── types.ts          # Core type definitions
│   ├── dca/              # DCA strategy implementation
│   │   ├── index.ts      # DCA backtesting engine
│   │   └── strategy/     # Strategy implementations
│   ├── grid/             # Grid strategy implementation
│   ├── hedge/            # Hedge strategy implementation
│   └── helper/           # Utility functions and helpers
├── dist/                 # Compiled JavaScript output
├── scripts/              # Build and utility scripts
├── package.json          # Package configuration
├── tsconfig.json         # TypeScript configuration
├── eslint.config.mjs     # ESLint configuration
└── .prettierrc.js        # Prettier configuration
```

### Key Components

- **Strategy Engines**: Core backtesting logic for each strategy type
- **Type Definitions**: Comprehensive TypeScript interfaces and types
- **Helper Functions**: Utilities for calculations, data processing, and analysis
- **Context Management**: Strategy state and execution context handling

## Coding Standards

### TypeScript Guidelines

- **Strict Mode**: Always use TypeScript strict mode
- **Type Safety**: No `any` types - use proper type definitions
- **Explicit Returns**: Always specify return types for functions
- **Interface Usage**: Prefer interfaces over types for object shapes

```typescript
// ✅ Good
interface BacktestingSettings {
  interval: ExchangeIntervals
  startTime: number
  endTime: number
}

function processBacktest(settings: BacktestingSettings): BacktestingResult {
  // Implementation
}

// ❌ Bad
function processBacktest(settings: any): any {
  // Implementation
}
```

### Code Style

- **ESLint**: Follow the project's ESLint configuration
- **Prettier**: Use Prettier for consistent formatting
- **Naming**: Use descriptive names for variables and functions
- **Comments**: Add JSDoc comments for public APIs

```typescript
/**
 * Executes a DCA strategy backtest with the provided settings
 * @param settings - The DCA strategy configuration
 * @param candleData - Historical price data for backtesting
 * @returns Promise resolving to comprehensive backtest results
 */
async function runDCABacktest(
  settings: DCABotSettings,
  candleData: FullBar[]
): Promise<DCABacktestingResult> {
  // Implementation
}
```

### File Organization

- **Single Responsibility**: Each file should have a single, clear purpose
- **Barrel Exports**: Use index.ts files for clean module exports
- **Consistent Imports**: Group imports (external, internal, relative)

```typescript
// External dependencies
import { v4 } from 'uuid'

// Internal dependencies
import { ExchangeIntervals, FullBar } from '../types'
import { StrategyContextManager } from './strategy/context'

// Relative imports
import './strategy'
```

## Testing Guidelines

### Test Structure

While the project doesn't currently have a comprehensive test suite, contributions should consider:

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test strategy combinations and workflows
- **Performance Tests**: Ensure backtesting performance remains optimal

### Test Data

- Use realistic market data for testing
- Include edge cases (market crashes, extreme volatility)
- Test with different timeframes and instruments

## Pull Request Process

### Before Submitting

1. **Code Quality Checks**
   ```bash
   npm run lint
   npm run type-check
   npm run format:check
   ```

2. **Build Verification**
   ```bash
   npm run clean
   npm run build
   ```

3. **Documentation Updates**
   - Update relevant documentation
   - Add JSDoc comments for new APIs
   - Update CHANGELOG.md if applicable

### PR Guidelines

1. **Clear Description**: Explain what your PR does and why
2. **Small, Focused Changes**: Keep PRs focused on a single feature or fix
3. **Commit Messages**: Use clear, descriptive commit messages
4. **Breaking Changes**: Clearly document any breaking changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Code builds successfully
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Manual testing completed

## Documentation
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (if needed)
```

## Issue Reporting

### Bug Reports

When reporting bugs, include:

- **Environment**: Node.js version, TypeScript version
- **Steps to Reproduce**: Clear steps to reproduce the issue
- **Expected vs Actual**: What you expected vs what happened
- **Code Sample**: Minimal code that demonstrates the issue

### Feature Requests

For feature requests, include:

- **Use Case**: Why is this feature needed?
- **Implementation Ideas**: Any thoughts on implementation
- **Examples**: Similar features in other libraries

### Performance Issues

For performance issues, include:

- **Benchmark Data**: Before/after performance metrics
- **Test Data**: Dataset used for testing
- **System Specs**: Hardware and environment details

## Architecture Guidelines

### Strategy Implementation

When implementing new strategies:

1. **Extend Base Classes**: Use the existing Backtesting base class
2. **Type Safety**: Define comprehensive types for settings and results
3. **Context Management**: Use the strategy context system properly
4. **Performance**: Consider memory usage and execution time

### Adding New Features

1. **Backwards Compatibility**: Maintain API compatibility when possible
2. **Configuration**: Make features configurable via settings
3. **Documentation**: Document new features thoroughly
4. **Types**: Export new types for external consumers

## Getting Help

- **Code Questions**: Ask in development discussions
- **Architecture Decisions**: Consult with the core team
- **Performance Issues**: Profile and document before proposing changes

## Recognition

Contributors will be acknowledged in:
- Project documentation
- Release notes for significant contributions
- Internal team recognition

Thank you for contributing to the Gainium Backtester!