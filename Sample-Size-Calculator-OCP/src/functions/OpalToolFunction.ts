import { logger } from '@zaiusinc/app-sdk';
import { ToolFunction, tool, ParameterType, OptiIdAuthData } from '@optimizely-opal/opal-tool-ocp-sdk';
import { storage } from '@zaiusinc/app-sdk';
import { throwDeprecation } from 'process';
import * as fs from 'fs';
import * as path from 'path';

// Define interfaces for the parameters of each function
interface SampleSizeCalculatorParameters {
  baselineRate: number;
  mde: number;
  significance: number;
  variants: number;
  visitors: number;
  frequency: string;
}

/**
 * Class that implements the Opal tool functions. Requirements:
 * - Must extend the ToolFunction class from the SDK
 * - Name must match the value of entry_point property from app.yml manifest
 * - Name must match the file name
 */
export class OpalToolFunction extends ToolFunction {

  /**
   * Optional: Override the ready() method to check if the function is ready to process requests
   * The /ready endpoint will call this method and return the status
   */
  protected async ready(): Promise<boolean> {
    // Add any initialization checks here
    // For example: check if external services are available, configuration is valid, etc.
    return true;
  }

  /**
   * Optional: Bearer token authentication
   * Uncomment this method to validate bearer tokens before processing requests
   */
  /*
  protected async validateBearerToken(): Promise<boolean> {
    const bearerToken = (await storage.settings.get('bearer_token')).bearer_token as string;
    if (bearerToken && this.request.headers.get('Authorization') !== `Bearer ${bearerToken}`) {
      logger.warn('Invalid or missing bearer token', JSON.stringify(this.request));
      return false;
    }
    return true;
  }
  */

  @tool({
    name: 'calculate_sample_size',
    description: 'Calculate sample size for A/B tests and experiments',
    parameters: [
      {
        name: 'baselineRate',
        type: ParameterType.Number,
        description: 'Baseline conversion rate (default: 0.1)',
        required: false
      },
      {
        name: 'mde',
        type: ParameterType.Number,
        description: 'Minimum detectable effect as relative value (default: 0.05)',
        required: false
      },
      {
        name: 'significance',
        type: ParameterType.Number,
        description: 'Significance level as percentage (default: 95)',
        required: false
      },
      {
        name: 'variants',
        type: ParameterType.Integer,
        description: 'Number of variants in the test (default: 2)',
        required: false
      },
      {
        name: 'visitors',
        type: ParameterType.Integer,
        description: 'Number of Visitors in the test (default: 10000)',
        required: false
      },
      {
        name: 'frequency',
        type: ParameterType.String,
        description: 'Frequency of the Visitor count (Monthly, Weekly, Daily) (default: monthly)',
        required: false
      }
    ],
    endpoint: '/calculate_sample_size'
  })
  public async calculateSampleSize(params: SampleSizeCalculatorParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Sample Size Calculator tool called');

      // Extract parameters with defaults
      const baselineRate = params.baselineRate || 0.1;
      const mde = params.mde || 0.05;
      const significance = params.significance || 95;
      const variants = params.variants || 2;
      const visitorsCount = params.visitors || 10000;
      const visitorsFrequency = params.frequency || 'monthly';
      let visitorsCountDays = 0 as number;
      let visitorsCountDaysPerVariant = 0 as number;

      const processedModels = {
        effect: mde,
        significance,
        conversion: baselineRate,
      };

      const sampleSize = this.calculateSampleSizeInternal(processedModels);

      if (sampleSize === null) {
        return {
          success: false,
          message: 'Invalid calculation parameters - unable to compute sample size'
        };
      }

      // Apply variant multiplier
      const variantMultiplier = variants > 2 ? variants : 1;
      const adjustedSampleSize = sampleSize * variantMultiplier;
      const totalSampleSize = adjustedSampleSize * variants;

      // Return the result with a number of days / weeks that a test will take to run
      if (visitorsFrequency.toLowerCase() === 'monthly') {
        // Visitor Count supplied is per month so we need to convert it to days
        visitorsCountDays = visitorsCount / 30;
      } else if (visitorsFrequency.toLowerCase() === 'weekly') {
        // Visitor Count supplied is per week so we need to convert it to days
        visitorsCountDays = visitorsCount / 7;
      } else if (visitorsFrequency.toLowerCase() === 'daily') {
        visitorsCountDays = visitorsCount;
      }

      // Assuming that the traffic is split between the variants equally
      visitorsCountDaysPerVariant = visitorsCountDays / variants;

      const daysToRun = adjustedSampleSize / visitorsCountDaysPerVariant;
      const weeksToRun = daysToRun / 7;
      const monthsToRun = daysToRun / 30;

      return {
        success: true,
        data: {
          sampleSizePerVariant: adjustedSampleSize,
          totalSampleSize: Math.round(totalSampleSize),
          daysToRun: Math.round(daysToRun),
          weeksToRun: Math.round(weeksToRun),
          monthsToRun: Math.round(monthsToRun),
          variantMultiplier: Math.round(variantMultiplier),
          visitorsCount: Math.round(visitorsCount),
          visitorsFrequency: visitorsFrequency.charAt(0).toUpperCase() + visitorsFrequency.slice(1),
          visitorsCountDays: Math.round(visitorsCountDays),
          baselineRate,
          expectedLift: mde,
          significance,
          variants,
          formula: `Sample Size Calculator Tool Formula Version ${this.getAppVersion()}`
        }
      };

    } catch (error: any) {
      logger.error('Error in Sample Size Calculator tool:', error);
      return {
        success: false,
        message: `Error calculating sample size: ${error.message}`
      };
    }
  }

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

  private isNumeric(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  private roundToSigFigs(n: number) {
    const s = Math.round(n);
    const t = Math.pow(10, 2 - Math.floor(Math.log(s) / Math.LN10) - 1);
    const a = Math.round(s * t) / t;
    return Math.round(a);
  }

  private getAppVersion(): string {
    try {
      // Try to read app.yml from the project root
      const appYmlPath = path.join(__dirname, '../../app.yml');
      if (fs.existsSync(appYmlPath)) {
        const appYmlContent = fs.readFileSync(appYmlPath, 'utf-8');
        // Parse version from YAML (simple regex match)
        const versionMatch = appYmlContent.match(/version:\s*(.+)/);
        if (versionMatch && versionMatch[1]) {
          return versionMatch[1].trim();
        }
      }
      // Fallback: try reading from dist directory (after build)
      const distAppYmlPath = path.join(__dirname, '../app.yml');
      if (fs.existsSync(distAppYmlPath)) {
        const appYmlContent = fs.readFileSync(distAppYmlPath, 'utf-8');
        const versionMatch = appYmlContent.match(/version:\s*(.+)/);
        if (versionMatch && versionMatch[1]) {
          return versionMatch[1].trim();
        }
      }
    } catch (error) {
      logger.warn('Failed to read app.yml version:', error);
    }
    // Default fallback version
    return '1.0.0';
  }
}
