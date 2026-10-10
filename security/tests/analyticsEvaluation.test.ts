import { describe, it, expect } from 'vitest';
import {
  generateSyntheticEpidemicData,
  toApprovedModelInputRecords,
} from '../src/analytics/mockSeasonalData.js';
import { AnomalyDetector } from '../src/analytics/anomalyDetector.js';
import { runComparativeEvaluation } from '../src/analytics/evaluateModel.js';
import { validateApprovedModelInputs } from '../src/security/privacy/modelInputContract.js';

describe('Phase 5 Anomaly Detection & Model Evaluation Tests', () => {
  it('generates 52 weeks of compliant mock surveillance data with seasonal wave and injected outbreak', () => {
    const data = generateSyntheticEpidemicData();
    expect(data).toHaveLength(52);

    // Validate that ALL records conform to the Phase 5 approved model-input contract
    const validated = validateApprovedModelInputs(toApprovedModelInputRecords(data));
    expect(validated).toHaveLength(52);

    // Verify injected outbreak at week 40
    const week40 = data.find((d) => d.timeBucket === '2026-W40');
    expect(week40).toBeDefined();
    expect(week40?.caseCount).toBe(118);
    expect(week40?.isOutbreakTrue).toBe(true);

    // Verify seasonal variation
    const winterWeek = data.find((d) => d.timeBucket === '2026-W02');
    const summerWeek = data.find((d) => d.timeBucket === '2026-W26');
    expect(winterWeek?.baselineExpected).toBeGreaterThan(summerWeek?.baselineExpected!);
  });

  it('runs anomaly detector on aggregate-only inputs and correctly flags the outbreak', () => {
    const data = generateSyntheticEpidemicData();
    const detector = new AnomalyDetector();
    const results = detector.detectAnomalies(data);

    expect(results).toHaveLength(52);

    // Baseline weeks before outbreak should have no statistical alerts
    const baselineResults = results.slice(0, 38);
    const falseAlerts = baselineResults.filter((r) => r.statisticalAlert);
    expect(falseAlerts).toHaveLength(0);

    // Outbreak at week 40 must be detected
    const week40Result = results.find((r) => r.timeBucket === '2026-W40');
    expect(week40Result).toBeDefined();
    expect(week40Result?.statisticalAlert).toBe(true);
    expect(week40Result?.severity).toBe('OUTBREAK_ANOMALY');
    expect(week40Result?.zScore).toBeGreaterThanOrEqual(3.0);
  });

  it('handles suppressed small cells (caseCount: null) gracefully without corruption or false alerts', () => {
    const data = generateSyntheticEpidemicData();
    // Inject a suppressed cell in week 15
    data[14] = {
      ...data[14],
      caseCount: null,
      suppressed: true,
    };

    const detector = new AnomalyDetector();
    const results = detector.detectAnomalies(data);

    const suppressedResult = results[14];
    expect(suppressedResult.caseCount).toBeNull();
    expect(suppressedResult.suppressed).toBe(true);
    expect(suppressedResult.statisticalAlert).toBe(false);
    expect(suppressedResult.severity).toBe('NORMAL');
  });

  it('evaluates Statistical Model vs Fixed Threshold covering detection delay and false alerts', () => {
    const report = runComparativeEvaluation();

    expect(report.datasetLength).toBe(52);
    expect(report.outbreakOnsetWeek).toBe('2026-W40');

    // Statistical model evaluation
    const stat = report.statisticalModelEvaluation;
    expect(stat.detectionDelayWeeks).toBe(0); // Prompt detection with 0 weeks delay!
    expect(stat.falseAlertCount).toBe(0); // 0 false alerts during normal baseline
    expect(stat.truePositives).toBeGreaterThanOrEqual(2);

    // Fixed threshold evaluation
    const fixed = report.fixedThresholdEvaluation;
    expect(fixed.detectorName).toContain('Fixed Threshold');
    expect(fixed.detectionDelayWeeks).toBe(0);

    // Recommendation confirms comparative performance
    expect(report.recommendation).toContain('Statistical Baseline Model');
  });
});
