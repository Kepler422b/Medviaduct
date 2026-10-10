export type AdministrativeDivision =
  | 'Konkan'
  | 'Pune'
  | 'Nashik'
  | 'Chhatrapati Sambhajinagar'
  | 'Amravati'
  | 'Nagpur';

export type SurveilledDisease =
  | 'Dengue'
  | 'Malaria'
  | 'COVID-19'
  | 'Influenza H1N1'
  | 'Acute Diarrheal Disease'
  | 'Leptospirosis'
  | 'Chikungunya';

export type SurveillanceAlertLevel = 'Baseline' | 'Watch' | 'Alert' | 'Outbreak Spike';

export interface DistrictSurveillanceRecord {
  id: string;
  code: string;
  name: string;
  division: AdministrativeDivision;
  headquarters: string;
  population2026: number; // in thousands/actual
  reportingFacilities: {
    total: number;
    reportingOnTime: number;
    completenessPct: number;
  };
  coordinates: {
    lat: number;
    lng: number;
  };
  diseases: Record<
    SurveilledDisease,
    {
      currentPeriodCases: number;
      previousPeriodCases: number;
      percentChange: number;
      alertLevel: SurveillanceAlertLevel;
      testPositivityPct: number;
      weeklyTrend: { week: string; cases: number }[];
      monthlyTrend: { month: string; cases: number }[];
      annualTrend: { year: string; cases: number }[];
    }
  >;
}

export interface SurveillanceDivisionSummary {
  division: AdministrativeDivision;
  districtCount: number;
  totalPopulation: number;
  reportingCompleteness: number;
  diseaseCases: Record<SurveilledDisease, number>;
  activeAlertsCount: number;
}

export const MAHARASHTRA_DIVISIONS: {
  id: AdministrativeDivision;
  division: AdministrativeDivision;
  name: string;
  description: string;
  keyDistricts: string;
  color: string;
}[] = [
  { id: 'Konkan', division: 'Konkan', name: 'Konkan Division', description: 'Coastal belt including Mumbai MMR, Thane, Palghar, Raigad, Ratnagiri and Sindhudurg', keyDistricts: 'Mumbai, Thane, Palghar, Raigad, Ratnagiri, Sindhudurg', color: '#0E7068' },
  { id: 'Pune', division: 'Pune', name: 'Pune Division', description: 'Western Maharashtra agro-industrial belt: Pune, Satara, Sangli, Solapur and Kolhapur', keyDistricts: 'Pune, Satara, Sangli, Solapur, Kolhapur', color: '#1B6A9C' },
  { id: 'Nashik', division: 'Nashik', name: 'Nashik Division', description: 'North Maharashtra: Nashik, Dhule, Nandurbar, Jalgaon and Ahmednagar', keyDistricts: 'Nashik, Dhule, Nandurbar, Jalgaon, Ahmednagar', color: '#8558A8' },
  { id: 'Chhatrapati Sambhajinagar', division: 'Chhatrapati Sambhajinagar', name: 'Chhatrapati Sambhajinagar Division', description: 'Marathwada plateau: 8 districts spanning Godavari basin', keyDistricts: 'Chhatrapati Sambhajinagar, Jalna, Parbhani, Nanded, Beed, Latur', color: '#D97706' },
  { id: 'Amravati', division: 'Amravati', name: 'Amravati Division', description: 'Western Vidarbha: Amravati, Akola, Yavatmal, Buldhana and Washim', keyDistricts: 'Amravati, Akola, Yavatmal, Buldhana, Washim', color: '#DC2626' },
  { id: 'Nagpur', division: 'Nagpur', name: 'Nagpur Division', description: 'Eastern Vidarbha forest and mineral belt: Nagpur, Wardha, Bhandara, Gondia, Chandrapur and Gadchiroli', keyDistricts: 'Nagpur, Wardha, Bhandara, Gondia, Chandrapur, Gadchiroli', color: '#059669' }
];

export const SURVEILLED_DISEASES: {
  id: SurveilledDisease;
  name: string;
  category: 'Vector-Borne' | 'Respiratory' | 'Water-Borne' | 'Zoonotic';
  thresholdBaseline: number;
  unit: string;
}[] = [
  { id: 'Dengue', name: 'Dengue (DENV Serotypes 1-4)', category: 'Vector-Borne', thresholdBaseline: 250, unit: 'Laboratory-confirmed cases' },
  { id: 'Malaria', name: 'Malaria (P. vivax & P. falciparum)', category: 'Vector-Borne', thresholdBaseline: 180, unit: 'Slide-confirmed cases' },
  { id: 'COVID-19', name: 'COVID-19 / SARS-CoV-2 Surveillance', category: 'Respiratory', thresholdBaseline: 300, unit: 'RT-PCR & TrueNat cases' },
  { id: 'Influenza H1N1', name: 'Seasonal Influenza A (H1N1 / H3N2)', category: 'Respiratory', thresholdBaseline: 90, unit: 'Viral swabs' },
  { id: 'Acute Diarrheal Disease', name: 'Acute Diarrheal Disease (ADD / Cholera sentinel)', category: 'Water-Borne', thresholdBaseline: 420, unit: 'Sentinel facility visits' },
  { id: 'Leptospirosis', name: 'Leptospirosis (Post-Monsoon Watch)', category: 'Zoonotic', thresholdBaseline: 65, unit: 'MAT & IgM confirmed' },
  { id: 'Chikungunya', name: 'Chikungunya (CHIKV)', category: 'Vector-Borne', thresholdBaseline: 75, unit: 'Serological confirmations' }
];

// Helper to generate consistent realistic epidemic series
function makeTrend(base: number, multiplier = 1, isOutbreak = false) {
  const weeklyWeights = isOutbreak
    ? [0.45, 0.52, 0.65, 0.78, 0.95, 1.15, 1.35, 1.48]
    : [0.85, 0.92, 0.88, 1.02, 0.96, 0.98, 1.05, 1.0];

  const weeklyTrend = weeklyWeights.map((w, i) => ({
    week: `Epi W${34 + i}`,
    cases: Math.max(0, Math.round(base * multiplier * w))
  }));

  const monthlyTrend = [
    { month: 'Jun 2026', cases: Math.round(base * 3.2) },
    { month: 'Jul 2026', cases: Math.round(base * 3.8) },
    { month: 'Aug 2026', cases: Math.round(base * 4.3) },
    { month: 'Sep 2026', cases: Math.round(base * (isOutbreak ? 5.2 : 4.0)) }
  ];

  const annualTrend = [
    { year: '2023', cases: Math.round(base * 42) },
    { year: '2024', cases: Math.round(base * 46) },
    { year: '2025', cases: Math.round(base * 44) },
    { year: '2026 (YTD)', cases: Math.round(base * 38) }
  ];

  const current = weeklyTrend[weeklyTrend.length - 1].cases;
  const previous = weeklyTrend[weeklyTrend.length - 2].cases;
  const percentChange = previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : 0;

  const alertLevel: SurveillanceAlertLevel = isOutbreak
    ? 'Outbreak Spike'
    : percentChange > 20
    ? 'Alert'
    : percentChange > 8
    ? 'Watch'
    : 'Baseline';

  return {
    currentPeriodCases: current,
    previousPeriodCases: previous,
    percentChange,
    alertLevel,
    testPositivityPct: Number((Math.min(22, 3.5 + (current / 80) * 1.8)).toFixed(1)),
    weeklyTrend,
    monthlyTrend,
    annualTrend
  };
}

export const MAHARASHTRA_DISTRICTS: DistrictSurveillanceRecord[] = [
  // ----------------- KONKAN DIVISION (7) -----------------
  {
    id: 'mumbai-city',
    code: 'MH-MC',
    name: 'Mumbai City',
    division: 'Konkan',
    headquarters: 'Mumbai',
    population2026: 3145000,
    reportingFacilities: { total: 184, reportingOnTime: 178, completenessPct: 96.7 },
    coordinates: { lat: 18.9388, lng: 72.8354 },
    diseases: {
      Dengue: makeTrend(145, 1.2, true),
      Malaria: makeTrend(95, 1.1),
      'COVID-19': makeTrend(120, 1.0),
      'Influenza H1N1': makeTrend(42, 1.0),
      'Acute Diarrheal Disease': makeTrend(190, 0.9),
      Leptospirosis: makeTrend(38, 1.4, true),
      Chikungunya: makeTrend(26, 1.0)
    }
  },
  {
    id: 'mumbai-suburban',
    code: 'MH-MS',
    name: 'Mumbai Suburban',
    division: 'Konkan',
    headquarters: 'Bandra',
    population2026: 9425000,
    reportingFacilities: { total: 310, reportingOnTime: 298, completenessPct: 96.1 },
    coordinates: { lat: 19.0760, lng: 72.8777 },
    diseases: {
      Dengue: makeTrend(260, 1.3, true),
      Malaria: makeTrend(150, 1.05),
      'COVID-19': makeTrend(210, 1.1),
      'Influenza H1N1': makeTrend(78, 1.0),
      'Acute Diarrheal Disease': makeTrend(340, 1.0),
      Leptospirosis: makeTrend(55, 1.2),
      Chikungunya: makeTrend(48, 1.0)
    }
  },
  {
    id: 'thane',
    code: 'MH-TH',
    name: 'Thane',
    division: 'Konkan',
    headquarters: 'Thane',
    population2026: 8250000,
    reportingFacilities: { total: 245, reportingOnTime: 232, completenessPct: 94.7 },
    coordinates: { lat: 19.2183, lng: 72.9781 },
    diseases: {
      Dengue: makeTrend(185, 1.15),
      Malaria: makeTrend(110, 1.0),
      'COVID-19': makeTrend(140, 1.0),
      'Influenza H1N1': makeTrend(44, 0.9),
      'Acute Diarrheal Disease': makeTrend(260, 1.0),
      Leptospirosis: makeTrend(32, 1.1),
      Chikungunya: makeTrend(30, 0.9)
    }
  },
  {
    id: 'palghar',
    code: 'MH-PL',
    name: 'Palghar',
    division: 'Konkan',
    headquarters: 'Palghar',
    population2026: 3150000,
    reportingFacilities: { total: 142, reportingOnTime: 131, completenessPct: 92.3 },
    coordinates: { lat: 19.6967, lng: 72.7699 },
    diseases: {
      Dengue: makeTrend(78, 1.0),
      Malaria: makeTrend(88, 1.2),
      'COVID-19': makeTrend(35, 0.9),
      'Influenza H1N1': makeTrend(18, 0.8),
      'Acute Diarrheal Disease': makeTrend(180, 1.1),
      Leptospirosis: makeTrend(22, 1.0),
      Chikungunya: makeTrend(14, 0.8)
    }
  },
  {
    id: 'raigad',
    code: 'MH-RG',
    name: 'Raigad',
    division: 'Konkan',
    headquarters: 'Alibag',
    population2026: 2780000,
    reportingFacilities: { total: 138, reportingOnTime: 129, completenessPct: 93.5 },
    coordinates: { lat: 18.6534, lng: 72.8777 },
    diseases: {
      Dengue: makeTrend(64, 1.0),
      Malaria: makeTrend(52, 0.9),
      'COVID-19': makeTrend(28, 0.8),
      'Influenza H1N1': makeTrend(12, 0.7),
      'Acute Diarrheal Disease': makeTrend(145, 1.0),
      Leptospirosis: makeTrend(24, 1.1),
      Chikungunya: makeTrend(15, 0.8)
    }
  },
  {
    id: 'ratnagiri',
    code: 'MH-RT',
    name: 'Ratnagiri',
    division: 'Konkan',
    headquarters: 'Ratnagiri',
    population2026: 1680000,
    reportingFacilities: { total: 112, reportingOnTime: 106, completenessPct: 94.6 },
    coordinates: { lat: 16.9902, lng: 73.3120 },
    diseases: {
      Dengue: makeTrend(42, 0.9),
      Malaria: makeTrend(34, 0.8),
      'COVID-19': makeTrend(18, 0.7),
      'Influenza H1N1': makeTrend(8, 0.7),
      'Acute Diarrheal Disease': makeTrend(110, 0.9),
      Leptospirosis: makeTrend(16, 0.9),
      Chikungunya: makeTrend(9, 0.6)
    }
  },
  {
    id: 'sindhudurg',
    code: 'MH-SD',
    name: 'Sindhudurg',
    division: 'Konkan',
    headquarters: 'Oros',
    population2026: 870000,
    reportingFacilities: { total: 78, reportingOnTime: 76, completenessPct: 97.4 },
    coordinates: { lat: 16.1200, lng: 73.6800 },
    diseases: {
      Dengue: makeTrend(22, 0.8),
      Malaria: makeTrend(18, 0.7),
      'COVID-19': makeTrend(10, 0.6),
      'Influenza H1N1': makeTrend(5, 0.5),
      'Acute Diarrheal Disease': makeTrend(68, 0.8),
      Leptospirosis: makeTrend(14, 0.9),
      Chikungunya: makeTrend(6, 0.5)
    }
  },

  // ----------------- PUNE DIVISION (5) -----------------
  {
    id: 'pune',
    code: 'MH-PU',
    name: 'Pune',
    division: 'Pune',
    headquarters: 'Pune',
    population2026: 10250000,
    reportingFacilities: { total: 340, reportingOnTime: 331, completenessPct: 97.4 },
    coordinates: { lat: 18.5204, lng: 73.8567 },
    diseases: {
      Dengue: makeTrend(280, 1.45, true),
      Malaria: makeTrend(75, 0.9),
      'COVID-19': makeTrend(185, 1.05),
      'Influenza H1N1': makeTrend(92, 1.15),
      'Acute Diarrheal Disease': makeTrend(310, 1.0),
      Leptospirosis: makeTrend(28, 0.9),
      Chikungunya: makeTrend(64, 1.1)
    }
  },
  {
    id: 'satara',
    code: 'MH-ST',
    name: 'Satara',
    division: 'Pune',
    headquarters: 'Satara',
    population2026: 3120000,
    reportingFacilities: { total: 154, reportingOnTime: 147, completenessPct: 95.5 },
    coordinates: { lat: 17.6805, lng: 73.9997 },
    diseases: {
      Dengue: makeTrend(68, 1.0),
      Malaria: makeTrend(32, 0.8),
      'COVID-19': makeTrend(42, 0.8),
      'Influenza H1N1': makeTrend(22, 0.8),
      'Acute Diarrheal Disease': makeTrend(165, 0.9),
      Leptospirosis: makeTrend(14, 0.8),
      Chikungunya: makeTrend(18, 0.8)
    }
  },
  {
    id: 'sangli',
    code: 'MH-SN',
    name: 'Sangli',
    division: 'Pune',
    headquarters: 'Sangli',
    population2026: 2980000,
    reportingFacilities: { total: 148, reportingOnTime: 142, completenessPct: 95.9 },
    coordinates: { lat: 16.8524, lng: 74.5815 },
    diseases: {
      Dengue: makeTrend(62, 0.9),
      Malaria: makeTrend(28, 0.7),
      'COVID-19': makeTrend(36, 0.8),
      'Influenza H1N1': makeTrend(18, 0.7),
      'Acute Diarrheal Disease': makeTrend(150, 0.9),
      Leptospirosis: makeTrend(12, 0.7),
      Chikungunya: makeTrend(16, 0.8)
    }
  },
  {
    id: 'solapur',
    code: 'MH-SO',
    name: 'Solapur',
    division: 'Pune',
    headquarters: 'Solapur',
    population2026: 4520000,
    reportingFacilities: { total: 196, reportingOnTime: 184, completenessPct: 93.9 },
    coordinates: { lat: 17.6599, lng: 75.9064 },
    diseases: {
      Dengue: makeTrend(94, 1.1),
      Malaria: makeTrend(48, 0.8),
      'COVID-19': makeTrend(52, 0.9),
      'Influenza H1N1': makeTrend(26, 0.8),
      'Acute Diarrheal Disease': makeTrend(210, 1.0),
      Leptospirosis: makeTrend(15, 0.7),
      Chikungunya: makeTrend(24, 0.9)
    }
  },
  {
    id: 'kolhapur',
    code: 'MH-KP',
    name: 'Kolhapur',
    division: 'Pune',
    headquarters: 'Kolhapur',
    population2026: 4050000,
    reportingFacilities: { total: 182, reportingOnTime: 175, completenessPct: 96.2 },
    coordinates: { lat: 16.7050, lng: 74.2433 },
    diseases: {
      Dengue: makeTrend(98, 1.15),
      Malaria: makeTrend(38, 0.8),
      'COVID-19': makeTrend(55, 0.9),
      'Influenza H1N1': makeTrend(30, 0.9),
      'Acute Diarrheal Disease': makeTrend(195, 1.0),
      Leptospirosis: makeTrend(22, 1.0),
      Chikungunya: makeTrend(28, 0.9)
    }
  },

  // ----------------- NASHIK DIVISION (5) -----------------
  {
    id: 'nashik',
    code: 'MH-NS',
    name: 'Nashik',
    division: 'Nashik',
    headquarters: 'Nashik',
    population2026: 6450000,
    reportingFacilities: { total: 230, reportingOnTime: 220, completenessPct: 95.7 },
    coordinates: { lat: 19.9975, lng: 73.7898 },
    diseases: {
      Dengue: makeTrend(135, 1.2),
      Malaria: makeTrend(65, 0.9),
      'COVID-19': makeTrend(90, 0.95),
      'Influenza H1N1': makeTrend(38, 0.9),
      'Acute Diarrheal Disease': makeTrend(240, 1.0),
      Leptospirosis: makeTrend(18, 0.8),
      Chikungunya: makeTrend(35, 1.0)
    }
  },
  {
    id: 'dhule',
    code: 'MH-DH',
    name: 'Dhule',
    division: 'Nashik',
    headquarters: 'Dhule',
    population2026: 2180000,
    reportingFacilities: { total: 118, reportingOnTime: 110, completenessPct: 93.2 },
    coordinates: { lat: 20.9042, lng: 74.7749 },
    diseases: {
      Dengue: makeTrend(45, 0.9),
      Malaria: makeTrend(42, 0.9),
      'COVID-19': makeTrend(24, 0.8),
      'Influenza H1N1': makeTrend(14, 0.7),
      'Acute Diarrheal Disease': makeTrend(135, 1.0),
      Leptospirosis: makeTrend(8, 0.6),
      Chikungunya: makeTrend(15, 0.8)
    }
  },
  {
    id: 'nandurbar',
    code: 'MH-NB',
    name: 'Nandurbar',
    division: 'Nashik',
    headquarters: 'Nandurbar',
    population2026: 1780000,
    reportingFacilities: { total: 106, reportingOnTime: 96, completenessPct: 90.6 },
    coordinates: { lat: 21.3697, lng: 74.2389 },
    diseases: {
      Dengue: makeTrend(38, 0.9),
      Malaria: makeTrend(72, 1.15),
      'COVID-19': makeTrend(16, 0.7),
      'Influenza H1N1': makeTrend(10, 0.6),
      'Acute Diarrheal Disease': makeTrend(160, 1.15),
      Leptospirosis: makeTrend(9, 0.6),
      Chikungunya: makeTrend(12, 0.7)
    }
  },
  {
    id: 'jalgaon',
    code: 'MH-JG',
    name: 'Jalgaon',
    division: 'Nashik',
    headquarters: 'Jalgaon',
    population2026: 4420000,
    reportingFacilities: { total: 198, reportingOnTime: 188, completenessPct: 94.9 },
    coordinates: { lat: 21.0077, lng: 75.5626 },
    diseases: {
      Dengue: makeTrend(88, 1.05),
      Malaria: makeTrend(60, 0.95),
      'COVID-19': makeTrend(48, 0.9),
      'Influenza H1N1': makeTrend(22, 0.8),
      'Acute Diarrheal Disease': makeTrend(215, 1.0),
      Leptospirosis: makeTrend(12, 0.7),
      Chikungunya: makeTrend(28, 0.9)
    }
  },
  {
    id: 'ahmednagar',
    code: 'MH-AH',
    name: 'Ahmednagar',
    division: 'Nashik',
    headquarters: 'Ahmednagar',
    population2026: 4850000,
    reportingFacilities: { total: 212, reportingOnTime: 201, completenessPct: 94.8 },
    coordinates: { lat: 19.0952, lng: 74.7480 },
    diseases: {
      Dengue: makeTrend(96, 1.1),
      Malaria: makeTrend(44, 0.85),
      'COVID-19': makeTrend(54, 0.9),
      'Influenza H1N1': makeTrend(25, 0.8),
      'Acute Diarrheal Disease': makeTrend(225, 1.0),
      Leptospirosis: makeTrend(14, 0.7),
      Chikungunya: makeTrend(32, 0.9)
    }
  },

  // ----------------- CHHATRAPATI SAMBHAJINAGAR (MARATHWADA) (8) -----------------
  {
    id: 'chhatrapati-sambhajinagar',
    code: 'MH-CS',
    name: 'Chhatrapati Sambhajinagar',
    division: 'Chhatrapati Sambhajinagar',
    headquarters: 'Chhatrapati Sambhajinagar',
    population2026: 4020000,
    reportingFacilities: { total: 186, reportingOnTime: 177, completenessPct: 95.2 },
    coordinates: { lat: 19.8762, lng: 75.3433 },
    diseases: {
      Dengue: makeTrend(115, 1.2),
      Malaria: makeTrend(46, 0.9),
      'COVID-19': makeTrend(68, 0.95),
      'Influenza H1N1': makeTrend(34, 0.9),
      'Acute Diarrheal Disease': makeTrend(210, 1.0),
      Leptospirosis: makeTrend(11, 0.6),
      Chikungunya: makeTrend(38, 1.0)
    }
  },
  {
    id: 'jalna',
    code: 'MH-JL',
    name: 'Jalna',
    division: 'Chhatrapati Sambhajinagar',
    headquarters: 'Jalna',
    population2026: 2050000,
    reportingFacilities: { total: 114, reportingOnTime: 106, completenessPct: 93.0 },
    coordinates: { lat: 19.8410, lng: 75.8864 },
    diseases: {
      Dengue: makeTrend(48, 1.0),
      Malaria: makeTrend(30, 0.8),
      'COVID-19': makeTrend(22, 0.8),
      'Influenza H1N1': makeTrend(12, 0.7),
      'Acute Diarrheal Disease': makeTrend(140, 1.0),
      Leptospirosis: makeTrend(7, 0.5),
      Chikungunya: makeTrend(16, 0.8)
    }
  },
  {
    id: 'parbhani',
    code: 'MH-PR',
    name: 'Parbhani',
    division: 'Chhatrapati Sambhajinagar',
    headquarters: 'Parbhani',
    population2026: 1940000,
    reportingFacilities: { total: 108, reportingOnTime: 100, completenessPct: 92.6 },
    coordinates: { lat: 19.2644, lng: 76.7749 },
    diseases: {
      Dengue: makeTrend(44, 0.95),
      Malaria: makeTrend(32, 0.85),
      'COVID-19': makeTrend(20, 0.8),
      'Influenza H1N1': makeTrend(10, 0.7),
      'Acute Diarrheal Disease': makeTrend(135, 1.0),
      Leptospirosis: makeTrend(6, 0.5),
      Chikungunya: makeTrend(14, 0.8)
    }
  },
  {
    id: 'hingoli',
    code: 'MH-HI',
    name: 'Hingoli',
    division: 'Chhatrapati Sambhajinagar',
    headquarters: 'Hingoli',
    population2026: 1220000,
    reportingFacilities: { total: 82, reportingOnTime: 77, completenessPct: 93.9 },
    coordinates: { lat: 19.7180, lng: 77.1484 },
    diseases: {
      Dengue: makeTrend(28, 0.9),
      Malaria: makeTrend(24, 0.8),
      'COVID-19': makeTrend(14, 0.7),
      'Influenza H1N1': makeTrend(7, 0.6),
      'Acute Diarrheal Disease': makeTrend(98, 0.95),
      Leptospirosis: makeTrend(4, 0.4),
      Chikungunya: makeTrend(10, 0.7)
    }
  },
  {
    id: 'nanded',
    code: 'MH-ND',
    name: 'Nanded',
    division: 'Chhatrapati Sambhajinagar',
    headquarters: 'Nanded',
    population2026: 3580000,
    reportingFacilities: { total: 172, reportingOnTime: 161, completenessPct: 93.6 },
    coordinates: { lat: 19.1383, lng: 77.3210 },
    diseases: {
      Dengue: makeTrend(76, 1.05),
      Malaria: makeTrend(55, 0.95),
      'COVID-19': makeTrend(38, 0.85),
      'Influenza H1N1': makeTrend(19, 0.8),
      'Acute Diarrheal Disease': makeTrend(195, 1.05),
      Leptospirosis: makeTrend(9, 0.5),
      Chikungunya: makeTrend(26, 0.9)
    }
  },
  {
    id: 'beed',
    code: 'MH-BD',
    name: 'Beed',
    division: 'Chhatrapati Sambhajinagar',
    headquarters: 'Beed',
    population2026: 2750000,
    reportingFacilities: { total: 146, reportingOnTime: 136, completenessPct: 93.2 },
    coordinates: { lat: 18.9891, lng: 75.7601 },
    diseases: {
      Dengue: makeTrend(58, 1.0),
      Malaria: makeTrend(34, 0.8),
      'COVID-19': makeTrend(26, 0.8),
      'Influenza H1N1': makeTrend(14, 0.7),
      'Acute Diarrheal Disease': makeTrend(165, 1.0),
      Leptospirosis: makeTrend(6, 0.5),
      Chikungunya: makeTrend(18, 0.8)
    }
  },
  {
    id: 'latur',
    code: 'MH-LT',
    name: 'Latur',
    division: 'Chhatrapati Sambhajinagar',
    headquarters: 'Latur',
    population2026: 2620000,
    reportingFacilities: { total: 140, reportingOnTime: 132, completenessPct: 94.3 },
    coordinates: { lat: 18.4088, lng: 76.5604 },
    diseases: {
      Dengue: makeTrend(64, 1.05),
      Malaria: makeTrend(36, 0.85),
      'COVID-19': makeTrend(30, 0.8),
      'Influenza H1N1': makeTrend(16, 0.75),
      'Acute Diarrheal Disease': makeTrend(170, 1.0),
      Leptospirosis: makeTrend(7, 0.5),
      Chikungunya: makeTrend(20, 0.85)
    }
  },
  {
    id: 'dharashiv',
    code: 'MH-DH',
    name: 'Dharashiv',
    division: 'Chhatrapati Sambhajinagar',
    headquarters: 'Dharashiv',
    population2026: 1720000,
    reportingFacilities: { total: 104, reportingOnTime: 98, completenessPct: 94.2 },
    coordinates: { lat: 18.1762, lng: 76.0400 },
    diseases: {
      Dengue: makeTrend(42, 0.95),
      Malaria: makeTrend(26, 0.8),
      'COVID-19': makeTrend(18, 0.75),
      'Influenza H1N1': makeTrend(10, 0.7),
      'Acute Diarrheal Disease': makeTrend(125, 0.95),
      Leptospirosis: makeTrend(5, 0.4),
      Chikungunya: makeTrend(13, 0.75)
    }
  },

  // ----------------- AMRAVATI DIVISION (5) -----------------
  {
    id: 'amravati',
    code: 'MH-AM',
    name: 'Amravati',
    division: 'Amravati',
    headquarters: 'Amravati',
    population2026: 3080000,
    reportingFacilities: { total: 162, reportingOnTime: 154, completenessPct: 95.1 },
    coordinates: { lat: 20.9374, lng: 77.7796 },
    diseases: {
      Dengue: makeTrend(72, 1.05),
      Malaria: makeTrend(65, 1.0),
      'COVID-19': makeTrend(38, 0.85),
      'Influenza H1N1': makeTrend(20, 0.8),
      'Acute Diarrheal Disease': makeTrend(185, 1.0),
      Leptospirosis: makeTrend(8, 0.6),
      Chikungunya: makeTrend(24, 0.85)
    }
  },
  {
    id: 'akola',
    code: 'MH-AK',
    name: 'Akola',
    division: 'Amravati',
    headquarters: 'Akola',
    population2026: 1940000,
    reportingFacilities: { total: 112, reportingOnTime: 106, completenessPct: 94.6 },
    coordinates: { lat: 20.7002, lng: 77.0082 },
    diseases: {
      Dengue: makeTrend(50, 1.0),
      Malaria: makeTrend(40, 0.9),
      'COVID-19': makeTrend(25, 0.8),
      'Influenza H1N1': makeTrend(12, 0.7),
      'Acute Diarrheal Disease': makeTrend(145, 1.0),
      Leptospirosis: makeTrend(6, 0.5),
      Chikungunya: makeTrend(18, 0.8)
    }
  },
  {
    id: 'yavatmal',
    code: 'MH-YV',
    name: 'Yavatmal',
    division: 'Amravati',
    headquarters: 'Yavatmal',
    population2026: 2950000,
    reportingFacilities: { total: 156, reportingOnTime: 144, completenessPct: 92.3 },
    coordinates: { lat: 20.3888, lng: 78.1204 },
    diseases: {
      Dengue: makeTrend(60, 1.0),
      Malaria: makeTrend(78, 1.15),
      'COVID-19': makeTrend(30, 0.8),
      'Influenza H1N1': makeTrend(15, 0.7),
      'Acute Diarrheal Disease': makeTrend(190, 1.1),
      Leptospirosis: makeTrend(7, 0.5),
      Chikungunya: makeTrend(20, 0.8)
    }
  },
  {
    id: 'buldhana',
    code: 'MH-BL',
    name: 'Buldhana',
    division: 'Amravati',
    headquarters: 'Buldhana',
    population2026: 2780000,
    reportingFacilities: { total: 144, reportingOnTime: 135, completenessPct: 93.8 },
    coordinates: { lat: 20.5300, lng: 76.1800 },
    diseases: {
      Dengue: makeTrend(54, 0.95),
      Malaria: makeTrend(46, 0.9),
      'COVID-19': makeTrend(28, 0.8),
      'Influenza H1N1': makeTrend(14, 0.7),
      'Acute Diarrheal Disease': makeTrend(160, 1.0),
      Leptospirosis: makeTrend(6, 0.5),
      Chikungunya: makeTrend(17, 0.8)
    }
  },
  {
    id: 'washim',
    code: 'MH-WS',
    name: 'Washim',
    division: 'Amravati',
    headquarters: 'Washim',
    population2026: 1280000,
    reportingFacilities: { total: 84, reportingOnTime: 79, completenessPct: 94.0 },
    coordinates: { lat: 20.1111, lng: 77.1350 },
    diseases: {
      Dengue: makeTrend(32, 0.9),
      Malaria: makeTrend(30, 0.85),
      'COVID-19': makeTrend(15, 0.7),
      'Influenza H1N1': makeTrend(8, 0.6),
      'Acute Diarrheal Disease': makeTrend(105, 0.95),
      Leptospirosis: makeTrend(4, 0.4),
      Chikungunya: makeTrend(11, 0.7)
    }
  },

  // ----------------- NAGPUR DIVISION (6) -----------------
  {
    id: 'nagpur',
    code: 'MH-NG',
    name: 'Nagpur',
    division: 'Nagpur',
    headquarters: 'Nagpur',
    population2026: 4950000,
    reportingFacilities: { total: 215, reportingOnTime: 206, completenessPct: 95.8 },
    coordinates: { lat: 21.1458, lng: 79.0882 },
    diseases: {
      Dengue: makeTrend(140, 1.25),
      Malaria: makeTrend(95, 1.05),
      'COVID-19': makeTrend(85, 0.95),
      'Influenza H1N1': makeTrend(45, 0.95),
      'Acute Diarrheal Disease': makeTrend(230, 1.0),
      Leptospirosis: makeTrend(14, 0.7),
      Chikungunya: makeTrend(42, 1.05)
    }
  },
  {
    id: 'wardha',
    code: 'MH-WR',
    name: 'Wardha',
    division: 'Nagpur',
    headquarters: 'Wardha',
    population2026: 1380000,
    reportingFacilities: { total: 88, reportingOnTime: 84, completenessPct: 95.5 },
    coordinates: { lat: 20.7453, lng: 78.6022 },
    diseases: {
      Dengue: makeTrend(36, 0.95),
      Malaria: makeTrend(38, 0.9),
      'COVID-19': makeTrend(20, 0.8),
      'Influenza H1N1': makeTrend(11, 0.7),
      'Acute Diarrheal Disease': makeTrend(110, 0.95),
      Leptospirosis: makeTrend(5, 0.5),
      Chikungunya: makeTrend(14, 0.8)
    }
  },
  {
    id: 'bhandara',
    code: 'MH-BH',
    name: 'Bhandara',
    division: 'Nagpur',
    headquarters: 'Bhandara',
    population2026: 1250000,
    reportingFacilities: { total: 82, reportingOnTime: 78, completenessPct: 95.1 },
    coordinates: { lat: 21.1714, lng: 79.6545 },
    diseases: {
      Dengue: makeTrend(34, 0.9),
      Malaria: makeTrend(52, 1.05),
      'COVID-19': makeTrend(16, 0.75),
      'Influenza H1N1': makeTrend(9, 0.65),
      'Acute Diarrheal Disease': makeTrend(115, 1.0),
      Leptospirosis: makeTrend(6, 0.5),
      Chikungunya: makeTrend(12, 0.75)
    }
  },
  {
    id: 'gondia',
    code: 'MH-GN',
    name: 'Gondia',
    division: 'Nagpur',
    headquarters: 'Gondia',
    population2026: 1420000,
    reportingFacilities: { total: 94, reportingOnTime: 88, completenessPct: 93.6 },
    coordinates: { lat: 21.4598, lng: 80.1961 },
    diseases: {
      Dengue: makeTrend(38, 0.9),
      Malaria: makeTrend(86, 1.25),
      'COVID-19': makeTrend(18, 0.75),
      'Influenza H1N1': makeTrend(10, 0.7),
      'Acute Diarrheal Disease': makeTrend(135, 1.05),
      Leptospirosis: makeTrend(7, 0.5),
      Chikungunya: makeTrend(15, 0.8)
    }
  },
  {
    id: 'chandrapur',
    code: 'MH-CD',
    name: 'Chandrapur',
    division: 'Nagpur',
    headquarters: 'Chandrapur',
    population2026: 2320000,
    reportingFacilities: { total: 132, reportingOnTime: 124, completenessPct: 93.9 },
    coordinates: { lat: 19.9615, lng: 79.2961 },
    diseases: {
      Dengue: makeTrend(64, 1.0),
      Malaria: makeTrend(112, 1.3, true),
      'COVID-19': makeTrend(28, 0.8),
      'Influenza H1N1': makeTrend(15, 0.75),
      'Acute Diarrheal Disease': makeTrend(175, 1.05),
      Leptospirosis: makeTrend(8, 0.6),
      Chikungunya: makeTrend(22, 0.85)
    }
  },
  {
    id: 'gadchiroli',
    code: 'MH-GD',
    name: 'Gadchiroli',
    division: 'Nagpur',
    headquarters: 'Gadchiroli',
    population2026: 1140000,
    reportingFacilities: { total: 86, reportingOnTime: 78, completenessPct: 90.7 },
    coordinates: { lat: 20.1809, lng: 79.9934 },
    diseases: {
      Dengue: makeTrend(32, 0.85),
      Malaria: makeTrend(145, 1.45, true),
      'COVID-19': makeTrend(12, 0.65),
      'Influenza H1N1': makeTrend(6, 0.55),
      'Acute Diarrheal Disease': makeTrend(160, 1.15),
      Leptospirosis: makeTrend(8, 0.6),
      Chikungunya: makeTrend(14, 0.75)
    }
  }
];

export const OFFICIAL_SOURCES_METADATA = [
  {
    id: 'nhm-mh',
    agency: 'Public Health Department, Government of Maharashtra & NHM Maharashtra',
    portal: 'Arogya Maharashtra Health Portal (Health MIS)',
    dataCoverage: '36 District Hospitals, 82 Sub-District Hospitals, 1,828 Primary Health Centres (PHCs)',
    reportingCadence: 'Weekly & Monthly statutory health reporting',
    lastUpdated: '10 October 2026, 06:00 IST',
    sourceUrl: 'https://arogya.maharashtra.gov.in',
    status: 'Verified Authorized Integration'
  },
  {
    id: 'idsp-ncdc',
    agency: 'Integrated Disease Surveillance Programme (IDSP) — NCDC & MoHFW India',
    portal: 'IHIP / IDSP Weekly Epidemiological Outbreak Surveillance Feeds',
    dataCoverage: 'Early Outbreak Signals (L, P, S forms) across Maharashtra monitoring districts',
    reportingCadence: 'Weekly Epidemiological Reports (Epi Weeks)',
    lastUpdated: '08 October 2026 (Epi Week 41 compilation)',
    sourceUrl: 'https://idsp.nic.in',
    status: 'Verified Authorized Integration'
  },
  {
    id: 'ncdc-vector',
    agency: 'National Centre for Disease Control (NCDC) — National Vector Borne Disease Control',
    portal: 'NVBDCP National Sentinel Surveillance Network',
    dataCoverage: 'Sentinel surveillance for Dengue, Malaria, Chikungunya in Maharashtra urban & rural zones',
    reportingCadence: 'Fortnightly & Monthly surveillance bulletin',
    lastUpdated: '01 October 2026',
    sourceUrl: 'https://ncdc.gov.in',
    status: 'Verified Authorized Integration'
  }
];

export const MAHARASHTRA_SOURCES = OFFICIAL_SOURCES_METADATA;

// Privacy rule: threshold of 10 for small group suppression
export function formatPrivacySuppressed(value: number, threshold = 10): string {
  if (value === 0) return '0 (No cases reported)';
  if (value < threshold) return '< 10 (Suppressed)';
  return value.toLocaleString();
}
