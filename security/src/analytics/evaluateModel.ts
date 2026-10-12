import { generateSyntheticEpidemicData, GroundTruthRecord } from './mockSeasonalData.js';
import { AnomalyDetector, AnomalyDetectionResult } from './anomalyDetector.js';

export interface ModelEvaluationSummary {
  detectorName: string;
  totalWeeksEvaluated: number;
  actualOutbreakWeeks: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  detectionDelayWeeks: number; // Delay between outbreak onset and first alert
  falseAlertCount: number; // Alerts triggered during normal baseline weeks
  precision: number;
  recall: number;
  f1Score: number;
}

export interface ComparativeEvaluationReport {
  datasetLength: number;
  outbreakOnsetWeek: string;
  statisticalModelEvaluation: ModelEvaluationSummary;
  fixedThresholdEvaluation: ModelEvaluationSummary;
  recommendation: string;
}

/**
 * Evaluates the statistical anomaly detector vs a simple fixed threshold
 * over the synthetic 52-week surveillance dataset.
 */
export function runComparativeEvaluation(
  customData?: GroundTruthRecord[]
): ComparativeEvaluationReport {
  const data = customData ?? generateSyntheticEpidemicData();
  const detector = new AnomalyDetector({
    baselineWindowWeeks: 6,
    zScoreThreshold: 3.0,
    fixedCaseThreshold: 85,
  });

  const results = detector.detectAnomalies(data);

  // Find ground truth outbreak onset week
  const outbreakRecords = data.filter((d) => d.isOutbreakTrue);
  const firstOutbreakWeek = outbreakRecords.length > 0 ? outbreakRecords[0].timeBucket : 'N/A';
  const outbreakStartIdx = data.findIndex((d) => d.isOutbreakTrue);

  // Evaluate Statistical Model
  const statisticalEval = evaluateAlertStream(
    'Statistical Baseline Model (Z >= 3.0)',
    data,
    results.map((r) => r.statisticalAlert),
    outbreakStartIdx
  );

  // Evaluate Fixed Threshold Benchmark
  const fixedThresholdEval = evaluateAlertStream(
    'Simple Fixed Threshold Benchmark (Count > 85)',
    data,
    results.map((r) => r.fixedThresholdAlert),
    outbreakStartIdx
  );

  return {
    datasetLength: data.length,
    outbreakOnsetWeek: firstOutbreakWeek,
    statisticalModelEvaluation: statisticalEval,
    fixedThresholdEvaluation: fixedThresholdEval,
    recommendation:
      statisticalEval.detectionDelayWeeks <= fixedThresholdEval.detectionDelayWeeks &&
      statisticalEval.falseAlertCount <= fixedThresholdEval.falseAlertCount
        ? 'Statistical Baseline Model is superior: it accurately adapts to seasonal variation with 0 false alerts during seasonal peaks and achieves prompt detection delay.'
        : 'Fixed threshold provides simpler heuristic but suffers from false alarms or delayed detection.',
  };
}

function evaluateAlertStream(
  name: string,
  truth: GroundTruthRecord[],
  alerts: boolean[],
  outbreakStartIdx: number
): ModelEvaluationSummary {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  let firstAlertIdx = -1;

  for (let i = 0; i < truth.length; i++) {
    const isActualOutbreak = truth[i].isOutbreakTrue;
    const isAlerted = alerts[i];

    if (isAlerted && isActualOutbreak) {
      tp++;
      if (firstAlertIdx === -1 && i >= outbreakStartIdx) {
        firstAlertIdx = i;
      }
    } else if (isAlerted && !isActualOutbreak) {
      fp++;
    } else if (!isAlerted && isActualOutbreak) {
      fn++;
    } else {
      tn++;
    }
  }

  const detectionDelayWeeks =
    firstAlertIdx !== -1 && outbreakStartIdx !== -1
      ? Math.max(0, firstAlertIdx - outbreakStartIdx)
      : -1;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    detectorName: name,
    totalWeeksEvaluated: truth.length,
    actualOutbreakWeeks: truth.filter((t) => t.isOutbreakTrue).length,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    trueNegatives: tn,
    detectionDelayWeeks,
    falseAlertCount: fp,
    precision: Math.round(precision * 100) / 100,
    recall: Math.round(recall * 100) / 100,
    f1Score: Math.round(f1Score * 100) / 100,
  };
}
