import { ApprovedModelInputRecord } from '../security/privacy/modelInputContract.js';

export interface AnomalyDetectionResult {
  timeBucket: string;
  region: string;
  conditionCategory: string;
  caseCount: number | null;
  suppressed: boolean;
  baselineMean: number;
  zScore: number | null;
  statisticalAlert: boolean;
  fixedThresholdAlert: boolean;
  severity: 'NORMAL' | 'ELEVATED' | 'OUTBREAK_ANOMALY';
}

export interface AnomalyDetectorConfig {
  baselineWindowWeeks?: number;
  zScoreThreshold?: number;
  fixedCaseThreshold?: number;
}

/**
 * AnomalyDetector
 *
 * Consumes ONLY approved aggregate model-input records.
 * Implements:
 * 1. Seasonal baseline + Statistical detection (moving average + Z-score / Poisson exceedance).
 * 2. Simple fixed threshold detector for comparative benchmark.
 *
 * PRIVACY INVARIANT:
 * Consumes ONLY aggregate records. Does not accept individual patient records.
 * Suppressed cells (caseCount === null) are never treated as 0; they are safely skipped
 * without corrupting baseline statistics.
 */
export class AnomalyDetector {
  private readonly windowSize: number;
  private readonly zScoreThreshold: number;
  private readonly fixedThreshold: number;

  constructor(config?: AnomalyDetectorConfig) {
    this.windowSize = config?.baselineWindowWeeks ?? 6;
    this.zScoreThreshold = config?.zScoreThreshold ?? 3.0;
    this.fixedThreshold = config?.fixedCaseThreshold ?? 85;
  }

  /**
   * Evaluates a temporal sequence of aggregate records.
   */
  detectAnomalies(records: ApprovedModelInputRecord[]): AnomalyDetectionResult[] {
    const results: AnomalyDetectionResult[] = [];
    const historicalCounts: number[] = [];

    for (const record of records) {
      // Suppressed cells are unavailable (null). Never guess or replace with 0.
      if (record.caseCount === null || record.suppressed) {
        results.push({
          timeBucket: record.timeBucket,
          region: record.region,
          conditionCategory: record.conditionCategory,
          caseCount: null,
          suppressed: true,
          baselineMean: historicalCounts.length > 0 ? this.calculateMean(historicalCounts) : 0,
          zScore: null,
          statisticalAlert: false,
          fixedThresholdAlert: false,
          severity: 'NORMAL',
        });
        continue;
      }

      const currentCount = record.caseCount;

      // Calculate baseline from historical window
      let baselineMean = currentCount;
      let zScore = 0;
      let statisticalAlert = false;

      if (historicalCounts.length >= 3) {
        const window = historicalCounts.slice(-this.windowSize);
        baselineMean = this.calculateMean(window);
        const stdDev = this.calculateStdDev(window, baselineMean);

        // Effective standard deviation with minimum Poisson variance floor
        const effectiveStdDev = Math.max(stdDev, Math.sqrt(baselineMean), 1.0);
        zScore = (currentCount - baselineMean) / effectiveStdDev;

        statisticalAlert = zScore >= this.zScoreThreshold;
      }

      // Simple fixed threshold check
      const fixedThresholdAlert = currentCount > this.fixedThreshold;

      let severity: 'NORMAL' | 'ELEVATED' | 'OUTBREAK_ANOMALY' = 'NORMAL';
      if (statisticalAlert) {
        severity = 'OUTBREAK_ANOMALY';
      } else if (zScore >= 2.0 || fixedThresholdAlert) {
        severity = 'ELEVATED';
      }

      results.push({
        timeBucket: record.timeBucket,
        region: record.region,
        conditionCategory: record.conditionCategory,
        caseCount: currentCount,
        suppressed: false,
        baselineMean: Math.round(baselineMean * 10) / 10,
        zScore: Math.round(zScore * 100) / 100,
        statisticalAlert,
        fixedThresholdAlert,
        severity,
      });

      // Update historical observations for baseline
      // Prevent outbreak spikes from contaminating the baseline window
      if (!statisticalAlert) {
        historicalCounts.push(currentCount);
      } else {
        historicalCounts.push(baselineMean);
      }
    }

    return results;
  }

  private calculateMean(values: number[]): number {
    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}
