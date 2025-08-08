# Hedge Backtesting - Remaining TODOs

## High Priority Tasks

### 1. Supported Asset Filtering 
**Status**: Not implemented  
**Description**: Filter intervals/exchanges/symbols to only send supported combinations to each DCA tester.  
**Requirements**: 
- Check exchange-specific supported intervals (binanceSupported, bybitSupported, etc.)
- Filter symbols based on exchange capabilities
- Only load data for combinations that both strategies actually support

**Implementation Notes**:
- Use the existing exchange support arrays from `/dash/components/dcabot/components/constants.ts`
- Add method `getSupportedIntervals(exchange, symbols)` 
- Filter `getOtherIntervals()` result to only include supported combinations

### 2. Real Unrealized PnL Calculation
**Status**: Placeholder implementation (returns zeros)  
**Description**: Implement actual unrealized P&L calculation from strategy's open deals.  
**Requirements**:
- Access strategy's internal open deals
- Calculate current price vs average entry price
- Return actual unrealized profit/loss in base currency and USD

**Implementation Notes**:
- May need to expose more strategy internals via DCABacktesting
- Consider adding `getOpenDeals()` method to strategy interface
- Calculate based on current bar price vs deal entry prices

### 3. Hedge Actions Implementation
**Status**: TODO comment exists  
**Description**: Implement actual hedge actions when conditions are met.  
**Requirements**:
- Close deals in both strategies when hedge conditions trigger
- Implement different hedge strategies (close all, close losing, etc.)
- Add hedge action types to settings

**Implementation Notes**:
- Add hedge action methods to DCABacktesting class
- Consider adding `closeAllDeals()`, `closeLosing()` methods
- Update strategy state after hedge actions

## Medium Priority Tasks

### 4. Better Result Combination Logic
**Status**: Basic implementation with some fields set to 0  
**Description**: Properly calculate combined financial metrics.  
**Requirements**:
- Calculate proper percentages for combined results
- Implement proper profit factor calculation
- Combine profit by period arrays correctly

**Implementation Notes**:
- Review DCABacktestingResult structure
- Implement proper averaging/combining for ratios
- Handle edge cases when one strategy has no deals

### 5. Enhanced Hedge Condition Logic
**Status**: Basic TP/SL implementation  
**Description**: Add more sophisticated hedge conditions.  
**Requirements**:
- Time-based conditions (close after X hours)
- Drawdown-based conditions
- Market condition-based triggers

## Low Priority Tasks

### 6. Performance Optimization
**Status**: Not addressed  
**Description**: Optimize data loading and bar processing for large datasets.  
**Requirements**:
- Optimize shared data loading
- Reduce memory usage during bar processing
- Add progress tracking improvements

### 7. Advanced Filtering Options
**Status**: Basic implementation  
**Description**: Add more filtering options for interval combinations.  
**Requirements**:
- Filter by symbol type (spot vs futures)
- Filter by volume/liquidity requirements
- Add custom filtering rules

## Implementation Priority

1. **Supported Asset Filtering** - Critical for real-world usage
2. **Real Unrealized PnL** - Critical for hedge logic
3. **Hedge Actions** - Required for complete functionality
4. **Result Combination** - Important for accurate reporting
5. **Enhanced Conditions** - Nice to have for advanced strategies

## Notes

- Current architecture is solid and extensible
- Bar-by-bar control is working correctly
- Unique interval@symbol@exchange filtering is now implemented
- DCA backtester enhancements are complete and functional

## Files Modified So Far

- `/src/hedge/index.ts` - Main hedge backtesting implementation
- `/src/dca/index.ts` - Enhanced DCA backtester with controlled processing
- `/src/dca/strategy/main.ts` - Strategy interface updates

## Next Steps

1. Implement supported asset filtering using existing exchange constants
2. Add real PnL calculation by exposing strategy internals
3. Implement basic hedge actions (close all deals)
4. Test with real backtesting scenarios
