// standalone utility for calculating sample size
// code based on https://www.optimizely.com/sample-size-calculator

export enum DEFAULT_VALUES {
  conversion = 0.03,
  effect = 0.2,
  significance = 0.95,
}

function isNumeric(n: any) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

export function roundToSigFigs(n: number) {
  const s = Math.round(n);
  const t = Math.pow(10, 2 - Math.floor(Math.log(s) / Math.LN10) - 1);
  const a = Math.round(s * t) / t;
  return Math.round(a);
}

export function sampleSizeEstimate(
  conversionDecimal: number = DEFAULT_VALUES.conversion,
  effectDecimal: number = DEFAULT_VALUES.effect,
  significanceDecimal: number = DEFAULT_VALUES.significance
): number | null {
  const significance = 1 - significanceDecimal;
  const absoluteMDE = conversionDecimal * effectDecimal; // baselineConversionRate * relativeMDE
  const c1 = conversionDecimal;
  const c2 = conversionDecimal - absoluteMDE;
  const c3 = conversionDecimal + absoluteMDE;
  const theta = Math.abs(absoluteMDE);
  let sampleEstimate;
  // Note: This is the variance estimate for conversion events.
  // If you want to have a sample size calculation for revenue,
  // customers should provide variance
  const variance1 = c1 * (1 - c1) + c2 * (1 - c2);
  const variance2 = c1 * (1 - c1) + c3 * (1 - c3);
  // looking for greatest absolute value of two possible sample estimates.
  // two possibilities based on swapping c2 for c3
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
    !isNumeric(sampleEstimate) ||
    !isFinite(sampleEstimate) ||
    sampleEstimate < 0
  ) {
    return null;
  }
  return roundToSigFigs(sampleEstimate);
}

function formatNumber(n: number): number {
  const str = n.toString();
  if (/e-/.test(str)) {
    return 0.0001;
  }
  const parts = str.split('.');
  let integerPart = parts[0];
  const fractionalPart = parts[1];
  integerPart = integerPart === '' ? '0' : integerPart;
  let l;
  if (integerPart.length === 2) {
    if (fractionalPart.length > 3) {
      const h = Math.pow(10, 4);
      l = Math.round(Number(`${integerPart}.${fractionalPart}`) * h) / h;
    } else l = Number(str);
    return l;
  }
  return n;
}

export function validateParameter(
  value: number,
  parameter: keyof typeof DEFAULT_VALUES
): number | null {
  if (!(parameter in DEFAULT_VALUES)) {
    throw new Error(`Invalid parameter: ${parameter}`);
  }
  const i = Number(DEFAULT_VALUES[parameter]);
  if (!isNaN(value)) {
    switch (parameter) {
      case 'conversion':
      case 'effect':
        value <= 0
          ? (value = i)
          : value > 0 && value < 1 && (value = formatNumber(value));
        break;
      case 'significance':
        (value < 80 || value > 99) && (value = i);
        break;
    }
    return value;
  }
  return i;
}

export function addThousandsDelim(value: number): string {
  return new Intl.NumberFormat().format(value);
}
