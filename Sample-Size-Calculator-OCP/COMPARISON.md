# Sample Size Calculation Comparison

## Side-by-Side Code Comparison

### Existing Code (ExistingSampleSizeCalc.js)
```javascript
export const sampleSizeEstimate = (processedModels: ModelCache): number | null => {
    const relativeMDE = processedModels.effect;
    const significance = 1 - processedModels.significance / 100;
    const baselineConversionRate = processedModels.conversion;
    const absoluteMDE = baselineConversionRate * relativeMDE;
    const c1 = baselineConversionRate;
    const c2 = baselineConversionRate - absoluteMDE;
    const c3 = baselineConversionRate + absoluteMDE;
    const theta = Math.abs(absoluteMDE);
    let sampleEstimate; 
// Note: This is the variance estimate for conversion events. If you want to have a sample size calculation for revenue, customers should provide variance    
const variance1 = c1 * (1 - c1) + c2 * (1 - c2);    
const variance2 = c1 * (1 - c1) + c3 * (1 - c3);    
// looking for greatest absolute value of two possible sample estimates. two possibilities based on swapping c2 for c3    
const sampleEstimate1 =        (2 *            (1 - significance) *            variance1 *            Math.log(1 + Math.sqrt(variance1) / theta)) /        (theta * theta);    const sampleEstimate2 =        (2 *            (1 - significance) *            variance2 *            Math.log(1 + Math.sqrt(variance2) / theta)) /        (theta * theta);    if (Math.abs(sampleEstimate1) >= Math.abs(sampleEstimate2)) {        sampleEstimate = sampleEstimate1;    } else {        sampleEstimate = sampleEstimate2;    }    if (        !isNumeric(sampleEstimate) ||        !isFinite(sampleEstimate) ||        sampleEstimate < 0    ) {        return null;    }    
return roundToSigFigs(sampleEstimate);
};
```

### New Code (calculateSampleSizeInternal in OpalToolFunction.ts)
```typescript
private calculateSampleSizeInternal(processedModels: any): number | null {
    const relativeMDE = processedModels.effect;
    const significance = 1 - processedModels.significance / 100; // This convert the SIGNIFICNACE to a Confidence Level
    const baselineConversionRate = processedModels.conversion;
    const absoluteMDE = baselineConversionRate * relativeMDE;
    const c1 = baselineConversionRate;
    const c2 = baselineConversionRate - absoluteMDE;
    const c3 = baselineConversionRate + absoluteMDE;
    const theta = Math.abs(absoluteMDE);
    let sampleEstimate;

    // Variance estimate for conversion events
    const variance1 = c1 * (1 - c1) + c2 * (1 - c2);
    const variance2 = c1 * (1 - c1) + c3 * (1 - c3);

    // Calculate two possible sample estimates
    const sampleEstimate1 =
        (2 *
            (1 - significance) *
            variance1 *
            Math.log(1 + Math.sqrt(variance1) / theta)) /
        (theta * theta);
    const sampleEstimate2 =
        (2 *
            (1 - significance) *
            variance2 *
            Math.log(1 + Math.sqrt(variance2) / theta)) /
        (theta * theta);

    if (Math.abs(sampleEstimate1) >= Math.abs(sampleEstimate2)) {
      sampleEstimate = sampleEstimate1;
    } else {
      sampleEstimate = sampleEstimate2;
    }

    if (
      !this.isNumeric(sampleEstimate) ||
      !isFinite(sampleEstimate) ||
      sampleEstimate < 0
    ) {
      return null;
    }

    return this.roundToSigFigs(sampleEstimate);
}
```

## Key Differences

### 1. **Code Formatting**
- **Existing**: Minified/compressed code with everything on fewer lines
- **New**: Properly formatted with clear line breaks and indentation

### 2. **Helper Functions**
- **Existing**: Uses external functions `isNumeric()` and `roundToSigFigs()` (not shown in file)
- **New**: Implements helper methods as private class methods:
  - `this.isNumeric()` - checks if value is a valid number
  - `this.roundToSigFigs()` - rounds to significant figures (default: 3)

### 3. **Comments**
- **Existing**: 
  - "Note: This is the variance estimate for conversion events. If you want to have a sample size calculation for revenue, customers should provide variance"
  - "looking for greatest absolute value of two possible sample estimates. two possibilities based on swapping c2 for c3"
- **New**: 
  - "This convert the SIGNIFICNACE to a Confidence Level" (note: typo in "SIGNIFICNACE")
  - "Variance estimate for conversion events"
  - "Calculate two possible sample estimates"

### 4. **Function Signature**
- **Existing**: `export const sampleSizeEstimate = (processedModels: ModelCache): number | null`
- **New**: `private calculateSampleSizeInternal(processedModels: any): number | null`

### 5. **Validation Logic**
- **Existing**: `!isNumeric(sampleEstimate) || !isFinite(sampleEstimate) || sampleEstimate < 0`
- **New**: `!this.isNumeric(sampleEstimate) || !isFinite(sampleEstimate) || sampleEstimate < 0`
- **Difference**: Uses `this.isNumeric()` instead of external `isNumeric()`

### 6. **Return Statement**
- **Existing**: `return roundToSigFigs(sampleEstimate);`
- **New**: `return this.roundToSigFigs(sampleEstimate);`
- **Difference**: Uses `this.roundToSigFigs()` instead of external `roundToSigFigs()`

## Algorithm Comparison

The **core algorithm is identical**:
1. ✅ Same calculation of `relativeMDE`, `significance`, `baselineConversionRate`
2. ✅ Same calculation of `absoluteMDE`, `c1`, `c2`, `c3`, `theta`
3. ✅ Same variance calculations (`variance1`, `variance2`)
4. ✅ Same sample estimate formulas (`sampleEstimate1`, `sampleEstimate2`)
5. ✅ Same comparison logic (choosing the larger absolute value)
6. ✅ Same validation checks
7. ✅ Same rounding approach

## Summary

The implementations are **functionally equivalent**. The main differences are:
- **Code organization**: New code is better formatted and uses class methods
- **Helper functions**: New code includes implementations of `isNumeric()` and `roundToSigFigs()` as private methods
- **Comments**: Slightly different, with the new code having a typo ("SIGNIFICNACE")
- **Type safety**: Existing code uses `ModelCache` type, new code uses `any`

The mathematical logic and calculations are **identical** between both implementations.




