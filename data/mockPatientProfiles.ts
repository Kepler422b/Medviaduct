import {
  type PatientProfile,
  type Allergy,
  type ChronicCondition,
  type Prescription,
  type ConsultationVisit,
  type LabResult,
  type ImagingReport,
  type MedicalDocument,
  type QrShareToken,
  initialPatientProfile,
  initialAllergies,
  initialConditions,
  initialPrescriptions,
  initialConsultations,
  initialLabResults,
  initialImagingReports,
  initialDocuments,
  initialQrTokens
} from './patientData';

export interface MockPatientBundle {
  profile: PatientProfile;
  allergies: Allergy[];
  conditions: ChronicCondition[];
  prescriptions: Prescription[];
  consultations: ConsultationVisit[];
  labResults: LabResult[];
  imagingReports: ImagingReport[];
  documents: MedicalDocument[];
  qrTokens: QrShareToken[];
  demoNotice: string;
}

const DEMO_NOTICE = 'DEMO DATA — FICTIONAL PATIENT (Not a real individual)';

// ==========================================
// PATIENT 1: Ananya Deshmukh (Pune, Maharashtra)
// ==========================================
const ananyaProfile: PatientProfile = {
  ...initialPatientProfile,
  address: 'B-402, Shivam Enclave, Kothrud, Pune, Maharashtra 411038',
  primaryCarePhysician: {
    name: 'Dr. Alex Morgan, MD',
    specialty: 'Internal Medicine & Infectious Diseases',
    hospital: 'Metropolitan Medical Center / Pune City Hospital'
  }
};

export const bundleAnanya: MockPatientBundle = {
  profile: ananyaProfile,
  allergies: initialAllergies,
  conditions: initialConditions,
  prescriptions: initialPrescriptions,
  consultations: initialConsultations,
  labResults: initialLabResults,
  imagingReports: initialImagingReports,
  documents: initialDocuments,
  qrTokens: initialQrTokens,
  demoNotice: DEMO_NOTICE
};

// ==========================================
// PATIENT 2: Aarav Kulkarni (Mumbai, Maharashtra)
// ==========================================
const aaravProfile: PatientProfile = {
  id: 'PAT-MH-51204',
  name: 'Aarav Kulkarni',
  uhid: 'MH-MUM-2026-51204-DEMO',
  abhaId: 'DEMO-ABHA-51204-O+',
  age: 42,
  sex: 'Male',
  bloodGroup: 'O+',
  phone: '+91 98202 33119',
  email: 'aarav.kulkarni@example.com',
  address: 'Flat 12-A, Sagar Vihar, Worli Sea Face, Mumbai, Maharashtra 400018',
  emergencyContact: {
    name: 'Neha Kulkarni',
    relation: 'Spouse',
    phone: '+91 98202 33120'
  },
  primaryCarePhysician: {
    name: 'Dr. Alex Morgan, MD',
    specialty: 'Cardiovascular & Internal Medicine',
    hospital: 'Metropolitan Medical Center, Mumbai'
  }
};

const aaravAllergies: Allergy[] = [
  {
    id: 'alg-aarav-01',
    allergen: 'No Known Drug Allergies (NKDA)',
    type: 'Medication',
    reaction: 'None documented',
    severity: 'Mild',
    recordedDate: '2026-01-10',
    notes: 'DEMO DATA — FICTIONAL PATIENT. Comprehensive allergy history reviewed and cleared.'
  }
];

const aaravConditions: ChronicCondition[] = [
  {
    id: 'diag-aarav-01',
    condition: 'Essential Hypertension',
    icd10: 'I10',
    status: 'Active (Controlled)',
    diagnosedDate: '2024-03-12',
    diagnosingClinician: 'Dr. Alex Morgan, MD',
    notes: 'DEMO DATA — Well managed on Amlodipine 5mg OD. Consistently maintaining resting BP < 128/82 mmHg.'
  },
  {
    id: 'diag-aarav-02',
    condition: 'Hypercholesterolemia / Dyslipidemia',
    icd10: 'E78.0',
    status: 'Active (Controlled)',
    diagnosedDate: '2025-06-15',
    diagnosingClinician: 'Dr. Alex Morgan, MD',
    notes: 'DEMO DATA — Elevated LDL responsive to Atorvastatin 20mg bedtime regimen. LDL dropped from 162 to 94 mg/dL.'
  }
];

const aaravPrescriptions: Prescription[] = [
  {
    id: 'rx-aarav-01',
    medicationName: 'Amlodipine Besylate Tablets IP 5mg',
    genericName: 'Amlodipine',
    dosage: '5 mg',
    frequency: 'Once daily (OD)',
    route: 'Oral',
    timing: 'Morning after breakfast',
    indication: 'Essential Hypertension blood pressure regulation',
    prescribedBy: 'Dr. Alex Morgan, MD',
    startDate: '2024-03-12',
    status: 'Active',
    refillsRemaining: 3,
    instructions: 'DEMO DATA — Take daily with water. Monitor sitting BP twice weekly.'
  },
  {
    id: 'rx-aarav-02',
    medicationName: 'Atorvastatin Calcium Tablets IP 20mg',
    genericName: 'Atorvastatin',
    dosage: '20 mg',
    frequency: 'Once daily (OD)',
    route: 'Oral',
    timing: 'At bedtime',
    indication: 'Hypercholesterolemia & Atherosclerotic risk reduction',
    prescribedBy: 'Dr. Alex Morgan, MD',
    startDate: '2025-06-15',
    status: 'Active',
    refillsRemaining: 2,
    instructions: 'DEMO DATA — Take regularly at night. Report any unexplained muscle soreness.'
  },
  {
    id: 'rx-aarav-03',
    medicationName: 'Coenzyme Q10 Capsules 100mg',
    genericName: 'Ubiquinone Dietary Supplement',
    dosage: '100 mg',
    frequency: 'Once daily (OD)',
    route: 'Oral',
    timing: 'With lunch',
    indication: 'Statin adjunct cellular metabolic support',
    prescribedBy: 'Dr. Alex Morgan, MD',
    startDate: '2025-08-01',
    status: 'Active',
    refillsRemaining: 1,
    instructions: 'DEMO DATA — Nutritional support capsule taken with meals.'
  }
];

const aaravConsultations: ConsultationVisit[] = [
  {
    id: 'enc-aarav-01',
    date: '2026-09-15',
    type: 'Outpatient',
    clinicianName: 'Dr. Alex Morgan, MD',
    specialty: 'Cardiovascular Medicine',
    facility: 'Metropolitan Medical Center, OPD Suite 302, Mumbai',
    chiefComplaint: 'Quarterly hypertension and lipid panel therapeutic evaluation.',
    vitals: {
      bloodPressure: '124/80 mmHg',
      heartRate: 70,
      temperature: '98.4°F',
      respiratoryRate: 15,
      oxygenSaturation: 99,
      weightKg: 76.2
    },
    clinicalFindings: 'DEMO DATA — S1 S2 normal, no murmurs. Carotid bruits absent. Peripheral pulses brisk and symmetric. Fundoscopy clear.',
    assessment: 'Essential hypertension and dyslipidemia optimally controlled. Fasting LDL at goal (94 mg/dL). Excellent statin tolerance.',
    plan: 'Continue Amlodipine 5mg and Atorvastatin 20mg. Low-saturated-fat Mediterranean diet emphasized. Routine liver enzymes and lipid review in 6 months.',
    followUpDate: '2027-03-15',
    status: 'Completed'
  },
  {
    id: 'enc-aarav-02',
    date: '2026-05-20',
    type: 'Outpatient',
    clinicianName: 'Dr. Alex Morgan, MD',
    specialty: 'Internal Medicine',
    facility: 'Metropolitan Medical Center, Mumbai',
    chiefComplaint: 'Follow-up on lipid titration and ambulatory BP check.',
    vitals: {
      bloodPressure: '128/82 mmHg',
      heartRate: 74,
      temperature: '98.6°F',
      respiratoryRate: 16,
      oxygenSaturation: 99,
      weightKg: 77.0
    },
    clinicalFindings: 'DEMO DATA — Lungs clear bilaterally. Abdomen soft, non-tender. Ambulatory home BP log averages 126/82 mmHg.',
    assessment: 'Stable cardiovascular risk profile. Normal hepatic transaminases on statin.',
    plan: 'Maintain current pharmacological dosage. 40 minutes aerobic exercise 4 days per week.',
    followUpDate: '2026-09-15',
    status: 'Completed'
  },
  {
    id: 'enc-aarav-03',
    date: '2026-01-10',
    type: 'Outpatient',
    clinicianName: 'Dr. Alex Morgan, MD',
    specialty: 'Internal Medicine',
    facility: 'Metropolitan Medical Center, Mumbai',
    chiefComplaint: 'Annual corporate health checkup review.',
    vitals: {
      bloodPressure: '138/88 mmHg',
      heartRate: 76,
      temperature: '98.4°F',
      respiratoryRate: 16,
      oxygenSaturation: 98,
      weightKg: 77.8
    },
    clinicalFindings: 'DEMO DATA — Mild elevation in systolic blood pressure. ECG shows sinus rhythm, no ischemic changes.',
    assessment: 'Borderline hypertension and elevated total cholesterol.',
    plan: 'Initiated Amlodipine 5mg OD. Advised dietary sodium restriction and lipid panel repeat.',
    followUpDate: '2026-05-20',
    status: 'Completed'
  }
];

const aaravLabResults: LabResult[] = [
  {
    id: 'lab-aarav-01',
    testName: 'Advanced Fasting Lipid Profile',
    category: 'Biochemistry',
    date: '2026-09-15',
    orderedBy: 'Dr. Alex Morgan, MD',
    laboratory: 'Metropolitan Central Diagnostic Pathology Laboratory',
    parameters: [
      { name: 'Total Cholesterol', value: 178, unit: 'mg/dL', referenceRange: '< 200', isAbnormal: false },
      { name: 'LDL-Cholesterol (Direct)', value: 94, unit: 'mg/dL', referenceRange: '< 100 (Optimal for high risk)', isAbnormal: false },
      { name: 'HDL-Cholesterol', value: 49, unit: 'mg/dL', referenceRange: '> 40', isAbnormal: false },
      { name: 'Triglycerides', value: 142, unit: 'mg/dL', referenceRange: '< 150', isAbnormal: false },
      { name: 'Non-HDL Cholesterol', value: 129, unit: 'mg/dL', referenceRange: '< 130', isAbnormal: false }
    ],
    clinicalImpression: 'DEMO DATA — Significant reduction in atherogenic lipoproteins on Atorvastatin 20mg. Target LDL reached.',
    status: 'Final'
  },
  {
    id: 'lab-aarav-02',
    testName: 'Hepatic & Renal Safety Screen',
    category: 'Biochemistry',
    date: '2026-09-15',
    orderedBy: 'Dr. Alex Morgan, MD',
    laboratory: 'Metropolitan Central Diagnostic Pathology Laboratory',
    parameters: [
      { name: 'Serum SGPT / ALT', value: 26, unit: 'U/L', referenceRange: '< 45', isAbnormal: false },
      { name: 'Serum SGOT / AST', value: 24, unit: 'U/L', referenceRange: '< 40', isAbnormal: false },
      { name: 'Serum Creatinine', value: 0.94, unit: 'mg/dL', referenceRange: '0.7 - 1.2', isAbnormal: false },
      { name: 'Estimated GFR (eGFR)', value: '> 90', unit: 'mL/min/1.73m²', referenceRange: '> 60', isAbnormal: false }
    ],
    clinicalImpression: 'DEMO DATA — Normal transaminases and preserved renal filtration on current regimen.',
    status: 'Final'
  }
];

const aaravImagingReports: ImagingReport[] = [
  {
    id: 'img-aarav-01',
    modality: 'Ultrasound',
    bodyRegion: '2D Transthoracic Echocardiogram',
    date: '2026-01-10',
    orderedBy: 'Dr. Alex Morgan, MD',
    radiologist: 'Dr. Rajiv Merchant, MD, DM (Cardiology)',
    facility: 'Metropolitan Non-Invasive Cardiac Imaging Suite',
    clinicalIndication: 'Baseline cardiac screening for hypertension and dyslipidemia.',
    findings: 'DEMO DATA — Left ventricular internal dimensions within normal limits. Interventricular septal thickness 10.2 mm (no LV hypertrophy). Ejection fraction 62%. Normal diastolic filling pattern.',
    impression: 'Normal 2D echocardiographic study. Preserved left ventricular systolic function with no hypertensive end-organ remodelling.',
    status: 'Final'
  }
];

const aaravDocuments: MedicalDocument[] = [
  {
    id: 'doc-aarav-01',
    title: 'Cardiology Consultation & Lipid Titration Summary',
    category: 'Consultation Note',
    date: '2026-09-15',
    facility: 'Metropolitan Medical Center, Mumbai',
    fileSize: '215 KB',
    fileType: 'PDF',
    summary: 'DEMO DATA — FICTIONAL PATIENT. Outpatient assessment confirming optimal blood pressure (124/80) and target LDL response on Atorvastatin 20mg.',
    tags: ['Cardiology', 'Hypertension', 'Lipids', 'Statin']
  },
  {
    id: 'doc-aarav-02',
    title: 'Comprehensive Lipid & Hepatic Safety Panel Report',
    category: 'Lab Report',
    date: '2026-09-15',
    facility: 'Metropolitan Central Diagnostic Pathology Laboratory',
    fileSize: '185 KB',
    fileType: 'PDF',
    summary: 'DEMO DATA — FICTIONAL PATIENT. Official lab results demonstrating total cholesterol 178 mg/dL, LDL 94 mg/dL, and normal liver transaminases.',
    tags: ['Lipid Panel', 'Biochemistry', 'Liver Safety']
  }
];

export const bundleAarav: MockPatientBundle = {
  profile: aaravProfile,
  allergies: aaravAllergies,
  conditions: aaravConditions,
  prescriptions: aaravPrescriptions,
  consultations: aaravConsultations,
  labResults: aaravLabResults,
  imagingReports: aaravImagingReports,
  documents: aaravDocuments,
  qrTokens: [],
  demoNotice: DEMO_NOTICE
};

// ==========================================
// PATIENT 3: Meera Patil (Nashik, Maharashtra)
// ==========================================
const meeraProfile: PatientProfile = {
  id: 'PAT-MH-62381',
  name: 'Meera Patil',
  uhid: 'MH-NSK-2026-62381-DEMO',
  abhaId: 'DEMO-ABHA-62381-A+',
  age: 28,
  sex: 'Female',
  bloodGroup: 'A+',
  phone: '+91 94222 81093',
  email: 'meera.patil@example.com',
  address: 'Bungalow 7, Godavari Greens, Gangapur Road, Nashik, Maharashtra 422013',
  emergencyContact: {
    name: 'Sunil Patil',
    relation: 'Father',
    phone: '+91 94222 81094'
  },
  primaryCarePhysician: {
    name: 'Dr. Sunita Kulkarni, MD',
    specialty: "General Medicine & Women's Health",
    hospital: 'Nashik Medical Enclave / Metro OPD'
  }
};

const meeraAllergies: Allergy[] = [
  {
    id: 'alg-meera-01',
    allergen: 'No Known Drug Allergies (NKDA)',
    type: 'Medication',
    reaction: 'None documented',
    severity: 'Mild',
    recordedDate: '2026-06-18',
    notes: 'DEMO DATA — FICTIONAL PATIENT. Cleared for beta-lactams, NSAIDs, and sulfa drugs.'
  }
];

const meeraConditions: ChronicCondition[] = [
  {
    id: 'diag-meera-01',
    condition: 'Iron Deficiency Anaemia',
    icd10: 'D50.9',
    status: 'Active (Controlled)',
    diagnosedDate: '2026-06-18',
    diagnosingClinician: 'Dr. Sunita Kulkarni, MD',
    notes: 'DEMO DATA — Microcytic hypochromic anaemia responsive to oral iron therapy. Hemoglobin improved from 8.8 to 11.6 g/dL.'
  }
];

const meeraPrescriptions: Prescription[] = [
  {
    id: 'rx-meera-01',
    medicationName: 'Ferrous Ascorbate with Folic Acid Tablets',
    genericName: 'Ferrous Ascorbate (100mg) + Folic Acid (1.5mg)',
    dosage: '1 tablet (100 mg Elemental Iron)',
    frequency: 'Once daily (OD)',
    route: 'Oral',
    timing: 'Post-lunch with water or orange juice',
    indication: 'Replenishment of iron stores & erythropoiesis',
    prescribedBy: 'Dr. Sunita Kulkarni, MD',
    startDate: '2026-06-18',
    status: 'Active',
    refillsRemaining: 2,
    instructions: 'DEMO DATA — Avoid taking with tea, coffee, or antacids. Continue for 3 months to replenish ferritin stores.'
  },
  {
    id: 'rx-meera-02',
    medicationName: 'Ascorbic Acid (Vitamin C) Chewable Tablets 500mg',
    genericName: 'Vitamin C',
    dosage: '500 mg',
    frequency: 'Once daily (OD)',
    route: 'Oral',
    timing: 'Midday with iron dose',
    indication: 'Dietary iron absorption facilitation',
    prescribedBy: 'Dr. Sunita Kulkarni, MD',
    startDate: '2026-06-18',
    status: 'Active',
    refillsRemaining: 1,
    instructions: 'DEMO DATA — Chewable tablet taken alongside iron supplement.'
  }
];

const meeraConsultations: ConsultationVisit[] = [
  {
    id: 'enc-meera-01',
    date: '2026-09-24',
    type: 'Outpatient',
    clinicianName: 'Dr. Sunita Kulkarni, MD',
    specialty: 'Internal Medicine',
    facility: 'Nashik Medical Enclave OPD, Nashik',
    chiefComplaint: 'Follow-up consultation for iron-deficiency anaemia and fatigue resolution.',
    vitals: {
      bloodPressure: '116/74 mmHg',
      heartRate: 76,
      temperature: '98.4°F',
      respiratoryRate: 15,
      oxygenSaturation: 99,
      weightKg: 54.0
    },
    clinicalFindings: 'DEMO DATA — Conjunctiva pink, palmar pallor resolved. No koilonychia or glossitis. S1 S2 normal, no hemic murmur. Lungs clear.',
    assessment: 'Marked clinical response to oral ferrous ascorbate. Hemoglobin increased from 8.8 to 11.6 g/dL. Fatigue completely resolved.',
    plan: 'Continue Ferrous Ascorbate 100mg for 60 more days to replenish bone marrow ferritin reserves. Repeat CBC in December.',
    followUpDate: '2026-12-18',
    status: 'Completed'
  },
  {
    id: 'enc-meera-02',
    date: '2026-06-18',
    type: 'Outpatient',
    clinicianName: 'Dr. Sunita Kulkarni, MD',
    specialty: 'Internal Medicine',
    facility: 'Nashik Medical Enclave OPD, Nashik',
    chiefComplaint: 'Progressive tiredness, breathlessness on climbing stairs, cold extremities, and brittle nails.',
    vitals: {
      bloodPressure: '112/70 mmHg',
      heartRate: 88,
      temperature: '98.6°F',
      respiratoryRate: 18,
      oxygenSaturation: 98,
      weightKg: 53.4
    },
    clinicalFindings: 'DEMO DATA — Significant conjunctival and palmar pallor. Mild resting tachycardia. Soft systolic flow murmur at pulmonary area.',
    assessment: 'Moderate-to-severe Microcytic Hypochromic Anaemia secondary to iron depletion. Baseline Hb 8.8 g/dL, Ferritin 6.2 ng/mL.',
    plan: 'Initiated oral Ferrous Ascorbate 100mg BID initially for 2 weeks, then OD with Vitamin C. Pelvic USG ordered to exclude menorrhagia causes.',
    followUpDate: '2026-07-28',
    status: 'Completed'
  }
];

const meeraLabResults: LabResult[] = [
  {
    id: 'lab-meera-01',
    testName: 'Complete Blood Count & Iron Kinetics Panel',
    category: 'Hematology',
    date: '2026-09-24',
    orderedBy: 'Dr. Sunita Kulkarni, MD',
    laboratory: 'Nashik Diagnostic Pathology Center',
    parameters: [
      { name: 'Hemoglobin', value: 11.6, unit: 'g/dL', referenceRange: '12.0 - 15.5', isAbnormal: true, flag: 'Low' },
      { name: 'Serum Ferritin', value: 32.4, unit: 'ng/mL', referenceRange: '15 - 150', isAbnormal: false },
      { name: 'Serum Iron', value: 78, unit: 'µg/dL', referenceRange: '60 - 170', isAbnormal: false },
      { name: 'Total Iron Binding Capacity (TIBC)', value: 330, unit: 'µg/dL', referenceRange: '250 - 450', isAbnormal: false },
      { name: 'Mean Corpuscular Volume (MCV)', value: 82.5, unit: 'fL', referenceRange: '80 - 100', isAbnormal: false }
    ],
    clinicalImpression: 'DEMO DATA — Substantial hematologic recovery. Erythrocyte indices normalized; iron stores replenishing appropriately.',
    status: 'Final'
  },
  {
    id: 'lab-meera-02',
    testName: 'Baseline Anaemia Workup & Peripheral Smear',
    category: 'Hematology',
    date: '2026-06-18',
    orderedBy: 'Dr. Sunita Kulkarni, MD',
    laboratory: 'Nashik Diagnostic Pathology Center',
    parameters: [
      { name: 'Hemoglobin', value: 8.8, unit: 'g/dL', referenceRange: '12.0 - 15.5', isAbnormal: true, flag: 'Critical' },
      { name: 'Serum Ferritin', value: 6.2, unit: 'ng/mL', referenceRange: '15 - 150', isAbnormal: true, flag: 'Critical' },
      { name: 'MCV', value: 68.2, unit: 'fL', referenceRange: '80 - 100', isAbnormal: true, flag: 'Low' },
      { name: 'MCH', value: 21.0, unit: 'pg', referenceRange: '27 - 33', isAbnormal: true, flag: 'Low' }
    ],
    clinicalImpression: 'DEMO DATA — Severe microcytic hypochromic anaemia with profound iron store depletion.',
    status: 'Final'
  }
];

const meeraImagingReports: ImagingReport[] = [
  {
    id: 'img-meera-01',
    modality: 'Ultrasound',
    bodyRegion: 'Whole Abdomen & Pelvis',
    date: '2026-06-20',
    orderedBy: 'Dr. Sunita Kulkarni, MD',
    radiologist: 'Dr. Pravin Deshpande, DMRD',
    facility: 'Nashik Sonography & Imaging Center',
    clinicalIndication: 'Evaluation for occult causes of iron-deficiency anaemia.',
    findings: 'DEMO DATA — Uterus normal in size and anteverted. Endometrial thickness 6 mm. Both ovaries show normal follicular activity. No fibroids, polyps, or free pelvic fluid.',
    impression: 'Normal pelvic and abdominal sonogram. No anatomical source of blood loss identified.',
    status: 'Final'
  }
];

const meeraDocuments: MedicalDocument[] = [
  {
    id: 'doc-meera-01',
    title: 'Hematology Follow-up Note — Anaemia Convalescence',
    category: 'Consultation Note',
    date: '2026-09-24',
    facility: 'Nashik Medical Enclave OPD, Nashik',
    fileSize: '240 KB',
    fileType: 'PDF',
    summary: 'DEMO DATA — FICTIONAL PATIENT. Consultation note documenting clinical resolution of fatigue and hemoglobin recovery to 11.6 g/dL.',
    tags: ['Anaemia', 'Hematology', 'Iron Supplement', 'Internal Medicine']
  },
  {
    id: 'doc-meera-02',
    title: 'Serial Hemogram & Ferritin Trend Investigation',
    category: 'Lab Report',
    date: '2026-09-24',
    facility: 'Nashik Diagnostic Pathology Center',
    fileSize: '195 KB',
    fileType: 'PDF',
    summary: 'DEMO DATA — FICTIONAL PATIENT. Laboratory report verifying serum ferritin rise from 6.2 to 32.4 ng/mL and normal RBC morphology.',
    tags: ['CBC', 'Ferritin', 'Iron Profile']
  }
];

export const bundleMeera: MockPatientBundle = {
  profile: meeraProfile,
  allergies: meeraAllergies,
  conditions: meeraConditions,
  prescriptions: meeraPrescriptions,
  consultations: meeraConsultations,
  labResults: meeraLabResults,
  imagingReports: meeraImagingReports,
  documents: meeraDocuments,
  qrTokens: [],
  demoNotice: DEMO_NOTICE
};

// ==========================================
// PATIENT 4: Rohan Shah (Nagpur, Maharashtra)
// ==========================================
const rohanProfile: PatientProfile = {
  id: 'PAT-MH-73492',
  name: 'Rohan Shah',
  uhid: 'MH-NGP-2026-73492-DEMO',
  abhaId: 'DEMO-ABHA-73492-AB+',
  age: 56,
  sex: 'Male',
  bloodGroup: 'AB+',
  phone: '+91 97120 44920',
  email: 'rohan.shah@example.com',
  address: 'Plot 44, Hilltop Layout, Ramdaspeth, Nagpur, Maharashtra 440010',
  emergencyContact: {
    name: 'Kavita Shah',
    relation: 'Spouse',
    phone: '+91 97120 44921'
  },
  primaryCarePhysician: {
    name: 'Dr. Devendra Joshi, MD',
    specialty: 'Endocrinology & Diabetes Care',
    hospital: 'Orange City Hospital / Metro Affiliate, Nagpur'
  }
};

const rohanAllergies: Allergy[] = [
  {
    id: 'alg-rohan-01',
    allergen: 'Sulfonamide Antibiotics (Co-trimoxazole, Bactrim)',
    type: 'Medication',
    reaction: 'Severe maculopapular rash, facial erythema, and pruritus',
    severity: 'Severe',
    recordedDate: '2022-09-14',
    notes: 'DEMO DATA — FICTIONAL PATIENT. Severe allergic reaction during treatment of respiratory infection. Strict cross-reactivity alert for sulfa-compounds.'
  }
];

const rohanConditions: ChronicCondition[] = [
  {
    id: 'diag-rohan-01',
    condition: 'Type 2 Diabetes Mellitus',
    icd10: 'E11.9',
    status: 'Active (Controlled)',
    diagnosedDate: '2021-04-10',
    diagnosingClinician: 'Dr. Devendra Joshi, MD',
    notes: 'DEMO DATA — Maintained on Metformin 850mg BID. Latest HbA1c 6.9%. Normal diabetic peripheral neuropathy screening.'
  }
];

const rohanPrescriptions: Prescription[] = [
  {
    id: 'rx-rohan-01',
    medicationName: 'Metformin Hydrochloride Prolonged-Release Tablets IP 850mg',
    genericName: 'Metformin PR',
    dosage: '850 mg',
    frequency: 'Twice daily (BID)',
    route: 'Oral',
    timing: 'With morning and evening meals',
    indication: 'Type 2 Diabetes Mellitus glycemic regulation',
    prescribedBy: 'Dr. Devendra Joshi, MD',
    startDate: '2021-04-10',
    status: 'Active',
    refillsRemaining: 3,
    instructions: 'DEMO DATA — Swallow whole; do not crush or chew. Take with food.'
  },
  {
    id: 'rx-rohan-02',
    medicationName: 'Alpha Lipoic Acid with Methylcobalamin Capsules',
    genericName: 'Neuroprotective Antioxidant Complex',
    dosage: '1 capsule',
    frequency: 'Once daily (OD)',
    route: 'Oral',
    timing: 'After breakfast',
    indication: 'Peripheral nerve antioxidant support',
    prescribedBy: 'Dr. Devendra Joshi, MD',
    startDate: '2023-11-05',
    status: 'Active',
    refillsRemaining: 2,
    instructions: 'DEMO DATA — Daily nutritional capsule for diabetic health.'
  }
];

const rohanConsultations: ConsultationVisit[] = [
  {
    id: 'enc-rohan-01',
    date: '2026-09-30',
    type: 'Outpatient',
    clinicianName: 'Dr. Devendra Joshi, MD',
    specialty: 'Endocrinology',
    facility: 'Orange City Hospital Diabetes Clinic, Nagpur',
    chiefComplaint: 'Quarterly glycemic assessment and diabetic foot examination.',
    vitals: {
      bloodPressure: '126/80 mmHg',
      heartRate: 74,
      temperature: '98.4°F',
      respiratoryRate: 15,
      oxygenSaturation: 98,
      weightKg: 81.0
    },
    clinicalFindings: 'DEMO DATA — Semmes-Weinstein 10g monofilament test 10/10 intact bilaterally. Vibration sensation normal. Pedal pulses 2+ symmetric. Clear lungs.',
    assessment: 'Type 2 Diabetes in excellent target control (HbA1c 6.9%). No microvascular complications or autonomic symptoms.',
    plan: 'Maintain Metformin 850mg BID. Continue 45 min evening walking. Urine microalbumin and HbA1c repeat in 3 months.',
    followUpDate: '2026-12-30',
    status: 'Completed'
  },
  {
    id: 'enc-rohan-02',
    date: '2026-06-12',
    type: 'Outpatient',
    clinicianName: 'Dr. Devendra Joshi, MD',
    specialty: 'Endocrinology',
    facility: 'Orange City Hospital, Nagpur',
    chiefComplaint: 'Follow-up on glycemic monitoring and medication tolerance.',
    vitals: {
      bloodPressure: '128/82 mmHg',
      heartRate: 76,
      temperature: '98.6°F',
      respiratoryRate: 16,
      oxygenSaturation: 99,
      weightKg: 81.6
    },
    clinicalFindings: 'DEMO DATA — No pedal edema, fundus screening normal. Fasting self-monitored blood glucose averaging 116-124 mg/dL.',
    assessment: 'Satisfactory glycemic stability with prolonged-release Metformin formulation.',
    plan: 'Continue diet moderation and pharmacological regimen.',
    followUpDate: '2026-09-30',
    status: 'Completed'
  }
];

const rohanLabResults: LabResult[] = [
  {
    id: 'lab-rohan-01',
    testName: 'Comprehensive Glycemic & Renal Profile',
    category: 'Metabolic',
    date: '2026-09-30',
    orderedBy: 'Dr. Devendra Joshi, MD',
    laboratory: 'Nagpur Central Diagnostic Laboratory',
    parameters: [
      { name: 'Glycated Hemoglobin (HbA1c)', value: 6.9, unit: '%', referenceRange: '< 7.0 (Target)', isAbnormal: false },
      { name: 'Fasting Blood Sugar (FBS)', value: 116, unit: 'mg/dL', referenceRange: '70 - 100 (Normal), < 130 (Target)', isAbnormal: true, flag: 'High' },
      { name: 'Post-Prandial Blood Sugar (PPBS)', value: 152, unit: 'mg/dL', referenceRange: '< 180 (Target)', isAbnormal: false },
      { name: 'Serum Creatinine', value: 0.98, unit: 'mg/dL', referenceRange: '0.7 - 1.2', isAbnormal: false },
      { name: 'Urine Albumin-to-Creatinine Ratio (uACR)', value: 16.4, unit: 'mg/g', referenceRange: '< 30 (Normal)', isAbnormal: false }
    ],
    clinicalImpression: 'DEMO DATA — Tight glycemic regulation without hypoglycemia. Normal renal filtration with no microalbuminuria.',
    status: 'Final'
  }
];

const rohanImagingReports: ImagingReport[] = [
  {
    id: 'img-rohan-01',
    modality: 'Ultrasound',
    bodyRegion: 'Lower Extremity Arterial Doppler',
    date: '2026-01-20',
    orderedBy: 'Dr. Devendra Joshi, MD',
    radiologist: 'Dr. Sunita Deshmukh, MD, DMRD',
    facility: 'Orange City Diagnostic Imaging Suite, Nagpur',
    clinicalIndication: 'Routine screening for peripheral vascular disease in diabetes.',
    findings: 'DEMO DATA — Bilateral femoral, popliteal, anterior and posterior tibial arteries demonstrate normal triphasic flow patterns. No hemodynamically significant stenosis.',
    impression: 'Normal bilateral lower extremity arterial Doppler study.',
    status: 'Final'
  }
];

const rohanDocuments: MedicalDocument[] = [
  {
    id: 'doc-rohan-01',
    title: 'Diabetes Clinic Consultation & Neuropathy Review',
    category: 'Consultation Note',
    date: '2026-09-30',
    facility: 'Orange City Hospital Diabetes Clinic, Nagpur',
    fileSize: '260 KB',
    fileType: 'PDF',
    summary: 'DEMO DATA — FICTIONAL PATIENT. Comprehensive diabetic evaluation confirming HbA1c 6.9%, normal foot monofilament exam, and Metformin 850mg continuation.',
    tags: ['Diabetes', 'HbA1c', 'Endocrinology', 'Foot Screen']
  },
  {
    id: 'doc-rohan-02',
    title: 'Drug Allergy Alert Documentation — Sulfonamides',
    category: 'Clinical Summary',
    date: '2022-09-14',
    facility: 'Orange City Emergency & Allergy Clinic',
    fileSize: '150 KB',
    fileType: 'PDF',
    summary: 'DEMO DATA — FICTIONAL PATIENT. Documented severe allergic reaction to Co-trimoxazole. Warning placed against sulfonamide antibiotic administration.',
    tags: ['Allergy Alert', 'Sulfonamides', 'Drug Safety']
  }
];

export const bundleRohan: MockPatientBundle = {
  profile: rohanProfile,
  allergies: rohanAllergies,
  conditions: rohanConditions,
  prescriptions: rohanPrescriptions,
  consultations: rohanConsultations,
  labResults: rohanLabResults,
  imagingReports: rohanImagingReports,
  documents: rohanDocuments,
  qrTokens: [],
  demoNotice: DEMO_NOTICE
};

// ==========================================
// PATIENT 5: Sana Khan (Chhatrapati Sambhajinagar, Maharashtra)
// ==========================================
const sanaProfile: PatientProfile = {
  id: 'PAT-MH-84513',
  name: 'Sana Khan',
  uhid: 'MH-CSN-2026-84513-DEMO',
  abhaId: 'DEMO-ABHA-84513-O-',
  age: 19,
  sex: 'Female',
  bloodGroup: 'O-',
  phone: '+91 99230 18451',
  email: 'sana.khan@example.com',
  address: 'House 22, Old Bazaar Lane, Gulmandi Circle, Chhatrapati Sambhajinagar, Maharashtra 431001',
  emergencyContact: {
    name: 'Tariq Khan',
    relation: 'Father',
    phone: '+91 99230 18452'
  },
  primaryCarePhysician: {
    name: 'Dr. Farida Sheikh, MD',
    specialty: 'Pulmonology & Respiratory Medicine',
    hospital: 'Sambhajinagar Medical Center / Metro OPD'
  }
};

const sanaAllergies: Allergy[] = [
  {
    id: 'alg-sana-01',
    allergen: 'No Known Drug Allergies (NKDA)',
    type: 'Medication',
    reaction: 'None documented',
    severity: 'Mild',
    recordedDate: '2023-08-14',
    notes: 'DEMO DATA — FICTIONAL PATIENT. Cleared for standard antibiotics. Environmental dust/pollen triggers identified.'
  }
];

const sanaConditions: ChronicCondition[] = [
  {
    id: 'diag-sana-01',
    condition: 'Bronchial Asthma (Allergic Phenotype)',
    icd10: 'J45.0',
    status: 'Active (Controlled)',
    diagnosedDate: '2023-08-14',
    diagnosingClinician: 'Dr. Farida Sheikh, MD',
    notes: 'DEMO DATA — Well controlled on maintenance Budesonide/Formoterol dry powder inhaler. Peak flow consistently > 90% of predicted.'
  }
];

const sanaPrescriptions: Prescription[] = [
  {
    id: 'rx-sana-01',
    medicationName: 'Budesonide (200mcg) + Formoterol (6mcg) DPI Inhaler',
    genericName: 'Budesonide / Formoterol Fumarate',
    dosage: '1 puff (200/6 mcg)',
    frequency: 'Twice daily (BID) & as needed (PRN)',
    route: 'Inhalation',
    timing: 'Morning and evening; rinse mouth after use',
    indication: 'Bronchial Asthma anti-inflammatory maintenance & SMART therapy',
    prescribedBy: 'Dr. Farida Sheikh, MD',
    startDate: '2023-08-14',
    status: 'Active',
    refillsRemaining: 3,
    instructions: 'DEMO DATA — Inhale deeply through DPI. Rinse mouth with water after inhalation to prevent oral candidiasis.'
  },
  {
    id: 'rx-sana-02',
    medicationName: 'Levocetirizine Dihydrochloride Tablets IP 5mg',
    genericName: 'Levocetirizine',
    dosage: '5 mg',
    frequency: 'Once daily (OD) at bedtime as needed',
    route: 'Oral',
    timing: 'At bedtime during dust/pollen exposure',
    indication: 'Allergic rhinitis and seasonal airway hypersensitivity',
    prescribedBy: 'Dr. Farida Sheikh, MD',
    startDate: '2024-02-10',
    status: 'Active',
    refillsRemaining: 1,
    instructions: 'DEMO DATA — Antihistamine for seasonal rhinitis symptoms.'
  }
];

const sanaConsultations: ConsultationVisit[] = [
  {
    id: 'enc-sana-01',
    date: '2026-10-02',
    type: 'Outpatient',
    clinicianName: 'Dr. Farida Sheikh, MD',
    specialty: 'Pulmonary Medicine',
    facility: 'Sambhajinagar Medical Center Pulmonology Suite',
    chiefComplaint: 'Quarterly asthma follow-up and peak flow diary review.',
    vitals: {
      bloodPressure: '114/72 mmHg',
      heartRate: 78,
      temperature: '98.4°F',
      respiratoryRate: 16,
      oxygenSaturation: 99,
      weightKg: 50.2
    },
    clinicalFindings: 'DEMO DATA — Chest examination: Bilateral vesicular breath sounds, no rhonchi, wheezing, or prolonged expiration. Peak flow measured in clinic: 420 L/min (93% of personal best).',
    assessment: 'Bronchial asthma in complete clinical remission on maintenance DPI. Asthma Control Test (ACT) score 24/25.',
    plan: 'Continue Budesonide/Formoterol 200/6mcg 1 puff BID. Carry inhaler at all times. Routine spirometry review in 6 months.',
    followUpDate: '2027-04-02',
    status: 'Completed'
  },
  {
    id: 'enc-sana-02',
    date: '2026-08-04',
    type: 'Outpatient',
    clinicianName: 'Dr. Farida Sheikh, MD',
    specialty: 'Pulmonary Medicine',
    facility: 'Sambhajinagar Medical Center',
    chiefComplaint: 'Seasonal monsoon dampness review; mild nocturnal tickle cough.',
    vitals: {
      bloodPressure: '112/70 mmHg',
      heartRate: 80,
      temperature: '98.6°F',
      respiratoryRate: 17,
      oxygenSaturation: 98,
      weightKg: 49.8
    },
    clinicalFindings: 'DEMO DATA — Clear chest, good air entry. Inhaler technique verified with excellent inspiratory flow.',
    assessment: 'Seasonal allergic trigger exacerbation prevented by adherence to SMART protocol.',
    plan: 'Temporary addition of Levocetirizine 5mg for 14 days during peak monsoon dampness.',
    followUpDate: '2026-10-02',
    status: 'Completed'
  }
];

const sanaLabResults: LabResult[] = [
  {
    id: 'lab-sana-01',
    testName: 'Peak Expiratory Flow & Pulmonary Allergic Markers',
    category: 'Hematology',
    date: '2026-10-02',
    orderedBy: 'Dr. Farida Sheikh, MD',
    laboratory: 'Sambhajinagar Central Diagnostic Pathology Laboratory',
    parameters: [
      { name: 'Peak Expiratory Flow Rate (PEFR)', value: 420, unit: 'L/min', referenceRange: '> 380 (Predicted)', isAbnormal: false },
      { name: 'Total Serum IgE', value: 145, unit: 'IU/mL', referenceRange: '< 100', isAbnormal: true, flag: 'High' },
      { name: 'Absolute Eosinophil Count (AEC)', value: 280, unit: '/µL', referenceRange: '40 - 450', isAbnormal: false },
      { name: 'Oxygen Saturation (Room Air)', value: 99, unit: '%', referenceRange: '95 - 100', isAbnormal: false }
    ],
    clinicalImpression: 'DEMO DATA — Excellent airway mechanics. Mild atopic diathesis evidenced by elevated IgE, responsive to inhaled corticosteroid.',
    status: 'Final'
  }
];

const sanaImagingReports: ImagingReport[] = [
  {
    id: 'img-sana-01',
    modality: 'X-Ray',
    bodyRegion: 'Chest PA View',
    date: '2026-03-15',
    orderedBy: 'Dr. Farida Sheikh, MD',
    radiologist: 'Dr. A. V. Pathak, DMRD',
    facility: 'Sambhajinagar Radiodiagnosis Center',
    clinicalIndication: 'Annual respiratory baseline evaluation.',
    findings: 'DEMO DATA — Lung fields are clear. No evidence of pneumonic consolidation, bronchiectasis, or pneumothorax. Cardiothoracic ratio normal. Diaphragmatic contours smooth.',
    impression: 'Normal chest radiograph. No active pulmonary pathology.',
    status: 'Final'
  }
];

const sanaDocuments: MedicalDocument[] = [
  {
    id: 'doc-sana-01',
    title: 'Asthma Action Plan & Maintenance DPI Protocol',
    category: 'Consultation Note',
    date: '2026-10-02',
    facility: 'Sambhajinagar Medical Center Pulmonology Suite',
    fileSize: '230 KB',
    fileType: 'PDF',
    summary: 'DEMO DATA — FICTIONAL PATIENT. Personalized asthma management plan with green/yellow/red zone guidelines and Budesonide/Formoterol maintenance instructions.',
    tags: ['Asthma', 'Action Plan', 'Pulmonology', 'Inhaler']
  },
  {
    id: 'doc-sana-02',
    title: 'Peak Flow Monitoring Diary & Pulmonary Assessment Report',
    category: 'Lab Report',
    date: '2026-10-02',
    facility: 'Sambhajinagar Central Diagnostic Pathology Laboratory',
    fileSize: '310 KB',
    fileType: 'PDF',
    summary: 'DEMO DATA — FICTIONAL PATIENT. Verified 90-day peak flow diary documenting sustained PEFR > 400 L/min and normal pulmonary mechanics.',
    tags: ['PEFR', 'Peak Flow', 'Respiratory', 'Allergy']
  }
];

export const bundleSana: MockPatientBundle = {
  profile: sanaProfile,
  allergies: sanaAllergies,
  conditions: sanaConditions,
  prescriptions: sanaPrescriptions,
  consultations: sanaConsultations,
  labResults: sanaLabResults,
  imagingReports: sanaImagingReports,
  documents: sanaDocuments,
  qrTokens: [],
  demoNotice: DEMO_NOTICE
};

// ==========================================
// REGISTRY OF ALL MOCK PATIENTS
// ==========================================
export const MOCK_PATIENT_BUNDLES: Record<string, MockPatientBundle> = {
  'PAT-MH-40192': bundleAnanya,
  'PAT-MH-51204': bundleAarav,
  'PAT-MH-62381': bundleMeera,
  'PAT-MH-73492': bundleRohan,
  'PAT-MH-84513': bundleSana
};

export const ALL_MOCK_PROFILES: PatientProfile[] = [
  ananyaProfile,
  aaravProfile,
  meeraProfile,
  rohanProfile,
  sanaProfile
];
