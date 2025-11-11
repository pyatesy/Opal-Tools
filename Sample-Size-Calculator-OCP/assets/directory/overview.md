# Sample Size Calculator

A powerful tool for calculating sample sizes for A/B tests and experiments using the new Optimizely Stats Engine formula.

## Features

- **Accurate Calculations**: Uses the latest Optimizely Stats Engine formula for precise sample size estimates
- **Flexible Parameters**: Supports custom baseline rates, minimum detectable effects, significance levels, and variant counts
- **Multiple Variants**: Handles tests with 2 or more variants
- **Easy Integration**: Simple API for integration with your experimentation workflow

## How It Works

The tool calculates sample sizes using the formula:

```
n = (2 * (1-significance) * variance * log(1 + sqrt(variance)/theta)) / theta²
```

Where:
- `variance = c1*(1-c1) + c2*(1-c2)` for conversion events
- `theta = |absoluteMDE|`
- `significance = 1 - (significance_percentage / 100)`

## Parameters

- **baselineRate**: Baseline conversion rate (default: 0.1)
- **mde**: Minimum detectable effect as relative value (default: 0.05)
- **significance**: Significance level as percentage (default: 5)
- **variants**: Number of variants in the test (default: 2)

## Output

Returns detailed sample size information including:
- Sample size per variant
- Total sample size across all variants
- Input parameters used
- Formula applied