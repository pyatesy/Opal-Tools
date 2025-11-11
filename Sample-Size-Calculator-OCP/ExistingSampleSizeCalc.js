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