import { INDIA_STATES_DATA, type StateSurveillanceRecord } from './indiaData';
import {
  MAHARASHTRA_DISTRICTS,
  MAHARASHTRA_DIVISIONS,
  formatPrivacySuppressed,
  type AdministrativeDivision,
  type DistrictSurveillanceRecord,
  type SurveillanceAlertLevel,
  type SurveilledDisease
} from './maharashtraData';

export type SurveillanceCondition = 'All' | 'Dengue';
export type SurveillanceTimeRange = '8 weeks' | '4 weeks';

export interface WeeklyPoint {
  week: string;
  cases: number;
}

export interface ComparisonEntry {
  id: string;
  name: string;
  cases: number;
  displayCases: string;
  percent: number;
  isSelected: boolean;
  alertLevel?: SurveillanceAlertLevel;
  actionPayload?: {
    stateId?: string;
    division?: AdministrativeDivision | 'all';
    districtId?: string;
  };
}

export interface SurveillanceSummary {
  scopeType: 'country' | 'state' | 'division' | 'district';
  locationName: string;
  scopeSubtitle: string;
  currentCases: number;
  previousCases: number;
  displayCases: string;
  isSuppressed: boolean;
  percentChange: number;
  alertLevel: SurveillanceAlertLevel;
  series: WeeklyPoint[];
  comparisonsTitle: string;
  comparisonsSubtitle: string;
  comparisons: ComparisonEntry[];
  reportingFacilities: number;
  reportingCompletenessPct: number;
}

const ALERT_WEIGHTS: Record<SurveillanceAlertLevel, number[]> = {
  'Outbreak Spike': [0.45, 0.52, 0.65, 0.78, 0.95, 1.15, 1.35, 1.48],
  'Alert': [0.60, 0.68, 0.72, 0.80, 0.85, 0.92, 0.95, 1.00],
  'Watch': [0.75, 0.80, 0.82, 0.88, 0.90, 0.94, 0.96, 1.00],
  'Baseline': [0.90, 0.92, 0.88, 0.94, 0.95, 0.92, 0.96, 1.00]
};

// Generate 8-week series for a non-Maharashtra state
function getStateWeeklySeries(
  state: StateSurveillanceRecord,
  condition: SurveillanceCondition
): WeeklyPoint[] {
  const baseCases = condition === 'Dengue'
    ? state.dengueCases
    : state.dengueCases + state.malariaCases + state.covidCases;

  const weights = ALERT_WEIGHTS[state.alertLevel] || ALERT_WEIGHTS['Watch'];
  const lastWeight = weights[weights.length - 1];

  return weights.map((w, i) => ({
    week: `Wk ${34 + i}`,
    cases: Math.max(0, Math.round(baseCases * (w / lastWeight)))
  }));
}

// Generate 8-week series for a Maharashtra district
function getDistrictWeeklySeries(
  district: DistrictSurveillanceRecord,
  condition: SurveillanceCondition
): WeeklyPoint[] {
  if (condition === 'Dengue') {
    return district.diseases['Dengue'].weeklyTrend.map((t, i) => ({
      week: `Wk ${34 + i}`,
      cases: t.cases
    }));
  }

  // All conditions: aggregate all 7 surveilled diseases
  const diseaseKeys = Object.keys(district.diseases) as SurveilledDisease[];
  return Array.from({ length: 8 }, (_, i) => {
    const totalWeekCases = diseaseKeys.reduce((acc, disease) => {
      const wPoint = district.diseases[disease]?.weeklyTrend[i];
      return acc + (wPoint ? wPoint.cases : 0);
    }, 0);

    return {
      week: `Wk ${34 + i}`,
      cases: totalWeekCases
    };
  });
}

// Maharashtra division weekly series
function getDivisionWeeklySeries(
  division: AdministrativeDivision,
  condition: SurveillanceCondition
): WeeklyPoint[] {
  const divDistricts = MAHARASHTRA_DISTRICTS.filter((d) => d.division === division);
  return Array.from({ length: 8 }, (_, i) => {
    const totalCases = divDistricts.reduce((acc, dist) => {
      const dSeries = getDistrictWeeklySeries(dist, condition);
      return acc + (dSeries[i]?.cases || 0);
    }, 0);
    return {
      week: `Wk ${34 + i}`,
      cases: totalCases
    };
  });
}

// Maharashtra whole state weekly series
function getMaharashtraWholeWeeklySeries(
  condition: SurveillanceCondition
): WeeklyPoint[] {
  return Array.from({ length: 8 }, (_, i) => {
    const totalCases = MAHARASHTRA_DISTRICTS.reduce((acc, dist) => {
      const dSeries = getDistrictWeeklySeries(dist, condition);
      return acc + (dSeries[i]?.cases || 0);
    }, 0);
    return {
      week: `Wk ${34 + i}`,
      cases: totalCases
    };
  });
}

// All India weekly series
function getAllIndiaWeeklySeries(
  condition: SurveillanceCondition
): WeeklyPoint[] {
  const mhSeries = getMaharashtraWholeWeeklySeries(condition);

  return Array.from({ length: 8 }, (_, i) => {
    let weekTotal = mhSeries[i].cases;

    INDIA_STATES_DATA.forEach((s) => {
      if (s.id === 'maharashtra') return; // already added from district aggregates
      const sSeries = getStateWeeklySeries(s, condition);
      weekTotal += sSeries[i]?.cases || 0;
    });

    return {
      week: `Wk ${34 + i}`,
      cases: weekTotal
    };
  });
}

export function getSurveillanceMetrics({
  stateId = 'all-india',
  division = 'all',
  districtId = 'all',
  condition = 'All',
  timeRange = '8 weeks'
}: {
  stateId: string;
  division?: AdministrativeDivision | 'all';
  districtId?: string;
  condition?: SurveillanceCondition;
  timeRange?: SurveillanceTimeRange;
}): SurveillanceSummary {
  const isAllIndia = stateId === 'all-india';
  const isMaharashtra = stateId === 'maharashtra';

  // -------------------------------------------------------------
  // LEVEL 4: MAHARASHTRA SPECIFIC DISTRICT
  // -------------------------------------------------------------
  if (isMaharashtra && districtId !== 'all') {
    const district = MAHARASHTRA_DISTRICTS.find((d) => d.id === districtId) || MAHARASHTRA_DISTRICTS[0];
    const fullSeries = getDistrictWeeklySeries(district, condition);
    const displayedSeries = timeRange === '4 weeks' ? fullSeries.slice(-4) : fullSeries;

    const currentCases = fullSeries[fullSeries.length - 1].cases;
    const prevCases = fullSeries[fullSeries.length - 2].cases;
    const percentChange = prevCases > 0 ? Number((((currentCases - prevCases) / prevCases) * 100).toFixed(1)) : 0;

    const alertLevel = condition === 'Dengue'
      ? district.diseases['Dengue'].alertLevel
      : percentChange > 25 ? 'Outbreak Spike' : percentChange > 15 ? 'Alert' : percentChange > 5 ? 'Watch' : 'Baseline';

    // Comparisons: sibling districts in the same division
    const siblingDistricts = MAHARASHTRA_DISTRICTS.filter((d) => d.division === district.division);
    const siblingMetrics = siblingDistricts.map((d) => {
      const dSeries = getDistrictWeeklySeries(d, condition);
      const dCurrent = dSeries[dSeries.length - 1].cases;
      return {
        id: d.id,
        name: `${d.name} District`,
        cases: dCurrent,
        alertLevel: d.diseases['Dengue'].alertLevel,
        districtId: d.id
      };
    });

    const maxCases = Math.max(...siblingMetrics.map((m) => m.cases), 1);
    const comparisons: ComparisonEntry[] = siblingMetrics.map((m) => ({
      id: m.id,
      name: m.name,
      cases: m.cases,
      displayCases: formatPrivacySuppressed(m.cases),
      percent: Math.min(100, Math.max(8, Math.round((m.cases / maxCases) * 100))),
      isSelected: m.id === district.id,
      alertLevel: m.alertLevel,
      actionPayload: {
        stateId: 'maharashtra',
        division: district.division,
        districtId: m.districtId
      }
    }));

    return {
      scopeType: 'district',
      locationName: `${district.name} District`,
      scopeSubtitle: `${district.division} Division, Maharashtra · ${district.headquarters}`,
      currentCases,
      previousCases: prevCases,
      displayCases: formatPrivacySuppressed(currentCases),
      isSuppressed: currentCases < 10,
      percentChange,
      alertLevel,
      series: displayedSeries,
      comparisonsTitle: `${district.division} Division Districts`,
      comparisonsSubtitle: `District-level surveillance comparison in ${district.division} Division`,
      comparisons,
      reportingFacilities: district.reportingFacilities.total,
      reportingCompletenessPct: district.reportingFacilities.completenessPct
    };
  }

  // -------------------------------------------------------------
  // LEVEL 3: MAHARASHTRA ADMINISTRATIVE DIVISION
  // -------------------------------------------------------------
  if (isMaharashtra && division !== 'all') {
    const fullSeries = getDivisionWeeklySeries(division, condition);
    const displayedSeries = timeRange === '4 weeks' ? fullSeries.slice(-4) : fullSeries;

    const currentCases = fullSeries[fullSeries.length - 1].cases;
    const prevCases = fullSeries[fullSeries.length - 2].cases;
    const percentChange = prevCases > 0 ? Number((((currentCases - prevCases) / prevCases) * 100).toFixed(1)) : 0;

    const alertLevel: SurveillanceAlertLevel = percentChange > 20 ? 'Alert' : percentChange > 8 ? 'Watch' : 'Baseline';

    // Comparisons: all constituent districts in this division
    const divDistricts = MAHARASHTRA_DISTRICTS.filter((d) => d.division === division);
    const districtMetrics = divDistricts.map((d) => {
      const dSeries = getDistrictWeeklySeries(d, condition);
      const dCurrent = dSeries[dSeries.length - 1].cases;
      return {
        id: d.id,
        name: `${d.name} District`,
        cases: dCurrent,
        alertLevel: d.diseases['Dengue'].alertLevel,
        districtId: d.id
      };
    });

    const maxCases = Math.max(...districtMetrics.map((m) => m.cases), 1);
    const comparisons: ComparisonEntry[] = districtMetrics.map((m) => ({
      id: m.id,
      name: m.name,
      cases: m.cases,
      displayCases: formatPrivacySuppressed(m.cases),
      percent: Math.min(100, Math.max(8, Math.round((m.cases / maxCases) * 100))),
      isSelected: false,
      alertLevel: m.alertLevel,
      actionPayload: {
        stateId: 'maharashtra',
        division,
        districtId: m.districtId
      }
    }));

    const divMeta = MAHARASHTRA_DIVISIONS.find((dv) => dv.id === division);
    const totalFacilities = divDistricts.reduce((acc, d) => acc + d.reportingFacilities.total, 0);
    const avgCompleteness = Number(
      (divDistricts.reduce((acc, d) => acc + d.reportingFacilities.completenessPct, 0) / divDistricts.length).toFixed(1)
    );

    return {
      scopeType: 'division',
      locationName: `${division} Division`,
      scopeSubtitle: `${divDistricts.length} reporting districts · ${divMeta?.description || 'Maharashtra'}`,
      currentCases,
      previousCases: prevCases,
      displayCases: formatPrivacySuppressed(currentCases),
      isSuppressed: currentCases < 10,
      percentChange,
      alertLevel,
      series: displayedSeries,
      comparisonsTitle: `${division} Division Districts`,
      comparisonsSubtitle: `Breakdown across all ${divDistricts.length} constituent districts`,
      comparisons,
      reportingFacilities: totalFacilities,
      reportingCompletenessPct: avgCompleteness
    };
  }

  // -------------------------------------------------------------
  // LEVEL 2: MAHARASHTRA ENTIRE STATE
  // -------------------------------------------------------------
  if (isMaharashtra) {
    const fullSeries = getMaharashtraWholeWeeklySeries(condition);
    const displayedSeries = timeRange === '4 weeks' ? fullSeries.slice(-4) : fullSeries;

    const currentCases = fullSeries[fullSeries.length - 1].cases;
    const prevCases = fullSeries[fullSeries.length - 2].cases;
    const percentChange = prevCases > 0 ? Number((((currentCases - prevCases) / prevCases) * 100).toFixed(1)) : 0;
    const alertLevel: SurveillanceAlertLevel = 'Alert';

    // Comparisons: all 6 administrative divisions of Maharashtra
    const divMetrics = MAHARASHTRA_DIVISIONS.map((div) => {
      const dSeries = getDivisionWeeklySeries(div.id, condition);
      const dCurrent = dSeries[dSeries.length - 1].cases;
      return {
        id: div.id,
        name: div.name,
        cases: dCurrent,
        divisionId: div.id
      };
    });

    const maxCases = Math.max(...divMetrics.map((m) => m.cases), 1);
    const comparisons: ComparisonEntry[] = divMetrics.map((m) => ({
      id: m.id,
      name: m.name,
      cases: m.cases,
      displayCases: formatPrivacySuppressed(m.cases),
      percent: Math.min(100, Math.max(8, Math.round((m.cases / maxCases) * 100))),
      isSelected: false,
      alertLevel: 'Alert',
      actionPayload: {
        stateId: 'maharashtra',
        division: m.divisionId,
        districtId: 'all'
      }
    }));

    const totalFacilities = MAHARASHTRA_DISTRICTS.reduce((acc, d) => acc + d.reportingFacilities.total, 0);

    return {
      scopeType: 'state',
      locationName: 'Maharashtra',
      scopeSubtitle: '36 Districts · 6 Administrative Divisions · Flagship Surveillance Zone',
      currentCases,
      previousCases: prevCases,
      displayCases: formatPrivacySuppressed(currentCases),
      isSuppressed: currentCases < 10,
      percentChange,
      alertLevel,
      series: displayedSeries,
      comparisonsTitle: 'Administrative Division Comparisons',
      comparisonsSubtitle: 'Aggregate surveillance activity across Maharashtra’s 6 administrative divisions',
      comparisons,
      reportingFacilities: totalFacilities,
      reportingCompletenessPct: 95.8
    };
  }

  // -------------------------------------------------------------
  // LEVEL 2B: OTHER INDIAN STATES / UNION TERRITORIES
  // -------------------------------------------------------------
  if (!isAllIndia) {
    const state = INDIA_STATES_DATA.find((s) => s.id === stateId) || INDIA_STATES_DATA[0];
    const fullSeries = getStateWeeklySeries(state, condition);
    const displayedSeries = timeRange === '4 weeks' ? fullSeries.slice(-4) : fullSeries;

    const currentCases = fullSeries[fullSeries.length - 1].cases;
    const prevCases = fullSeries[fullSeries.length - 2].cases;
    const percentChange = prevCases > 0 ? Number((((currentCases - prevCases) / prevCases) * 100).toFixed(1)) : 0;

    // Comparisons: peer states in the same geographic zone
    const zoneStates = INDIA_STATES_DATA.filter((s) => s.zone === state.zone);
    const peerMetrics = zoneStates.map((s) => {
      const sSeries = getStateWeeklySeries(s, condition);
      const sCurrent = sSeries[sSeries.length - 1].cases;
      return {
        id: s.id,
        name: s.name,
        cases: sCurrent,
        alertLevel: s.alertLevel,
        stateId: s.id
      };
    });

    const maxCases = Math.max(...peerMetrics.map((m) => m.cases), 1);
    const comparisons: ComparisonEntry[] = peerMetrics.map((m) => ({
      id: m.id,
      name: m.name,
      cases: m.cases,
      displayCases: formatPrivacySuppressed(m.cases),
      percent: Math.min(100, Math.max(8, Math.round((m.cases / maxCases) * 100))),
      isSelected: m.id === state.id,
      alertLevel: m.alertLevel,
      actionPayload: {
        stateId: m.stateId,
        division: 'all',
        districtId: 'all'
      }
    }));

    return {
      scopeType: 'state',
      locationName: state.name,
      scopeSubtitle: `${state.type} · ${state.zone} Zone · Capital: ${state.capital}`,
      currentCases,
      previousCases: prevCases,
      displayCases: formatPrivacySuppressed(currentCases),
      isSuppressed: currentCases < 10,
      percentChange,
      alertLevel: state.alertLevel,
      series: displayedSeries,
      comparisonsTitle: `${state.zone} Zone Comparisons`,
      comparisonsSubtitle: `Surveillance comparison with peer reporting states in the ${state.zone} Zone`,
      comparisons,
      reportingFacilities: state.reportingFacilities,
      reportingCompletenessPct: state.reportingCompletenessPct
    };
  }

  // -------------------------------------------------------------
  // LEVEL 1: ALL INDIA (DEFAULT)
  // -------------------------------------------------------------
  const fullSeries = getAllIndiaWeeklySeries(condition);
  const displayedSeries = timeRange === '4 weeks' ? fullSeries.slice(-4) : fullSeries;

  const currentCases = fullSeries[fullSeries.length - 1].cases;
  const prevCases = fullSeries[fullSeries.length - 2].cases;
  const percentChange = prevCases > 0 ? Number((((currentCases - prevCases) / prevCases) * 100).toFixed(1)) : 0;

  // Top reporting states in India
  const stateRankings = INDIA_STATES_DATA.map((s) => {
    let sCurrent = 0;
    if (s.id === 'maharashtra') {
      const mhSeries = getMaharashtraWholeWeeklySeries(condition);
      sCurrent = mhSeries[mhSeries.length - 1].cases;
    } else {
      const sSeries = getStateWeeklySeries(s, condition);
      sCurrent = sSeries[sSeries.length - 1].cases;
    }

    return {
      id: s.id,
      name: s.name,
      cases: sCurrent,
      alertLevel: s.alertLevel,
      stateId: s.id
    };
  }).sort((a, b) => b.cases - a.cases);

  // Take top 8 reporting states for comparison
  const top8 = stateRankings.slice(0, 8);
  const maxCases = Math.max(...top8.map((m) => m.cases), 1);
  const comparisons: ComparisonEntry[] = top8.map((m) => ({
    id: m.id,
    name: m.name,
    cases: m.cases,
    displayCases: formatPrivacySuppressed(m.cases),
    percent: Math.min(100, Math.max(8, Math.round((m.cases / maxCases) * 100))),
    isSelected: false,
    alertLevel: m.alertLevel,
    actionPayload: {
      stateId: m.stateId,
      division: 'all',
      districtId: 'all'
    }
  }));

  const totalFacilities = INDIA_STATES_DATA.reduce((acc, s) => acc + s.reportingFacilities, 0);

  return {
    scopeType: 'country',
    locationName: 'All India',
    scopeSubtitle: '28 States & 8 Union Territories · National Sentinel Surveillance Network',
    currentCases,
    previousCases: prevCases,
    displayCases: formatPrivacySuppressed(currentCases),
    isSuppressed: false,
    percentChange,
    alertLevel: 'Alert',
    series: displayedSeries,
    comparisonsTitle: 'National Surveillance Rankings',
    comparisonsSubtitle: 'Top reporting States & Union Territories across active surveillance zones',
    comparisons,
    reportingFacilities: totalFacilities,
    reportingCompletenessPct: 95.4
  };
}
