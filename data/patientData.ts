export interface PatientProfile {
  id: string;
  name: string;
  uhid: string;
  abhaId: string;
  age: number;
  sex: 'Female' | 'Male' | 'Other';
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
  primaryCarePhysician: {
    name: string;
    specialty: string;
    hospital: string;
  };
}

export interface Allergy {
  id: string;
  allergen: string;
  type: 'Medication' | 'Food' | 'Environmental';
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Life-threatening';
  recordedDate: string;
  notes?: string;
}

export interface ChronicCondition {
  id: string;
  condition: string;
  icd10: string;
  status: 'Active (Controlled)' | 'Active (Uncontrolled)' | 'Resolved / Remission';
  diagnosedDate: string;
  diagnosingClinician: string;
  notes: string;
}

export interface Prescription {
  id: string;
  medicationName: string;
  genericName: string;
  dosage: string;
  frequency: string;
  route: string;
  timing: string;
  indication: string;
  prescribedBy: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Discontinued' | 'Completed';
  refillsRemaining: number;
  instructions: string;
}

export interface ConsultationVisit {
  id: string;
  date: string;
  type: 'Outpatient' | 'Emergency Care' | 'Telehealth' | 'Inpatient Review';
  clinicianName: string;
  clinician?: string;
  specialty: string;
  facility: string;
  hospital?: string;
  chiefComplaint: string;
  vitals: {
    bloodPressure: string;
    heartRate: number;
    pulse?: number;
    temperature: string;
    respiratoryRate?: number;
    oxygenSaturation: number;
    oxygen?: number;
    weightKg: number;
  };
  clinicalFindings: string;
  assessment: string;
  impression?: string;
  plan: string;
  followUpDate?: string;
  status: 'Completed';
}

export interface LabResult {
  id: string;
  testName: string;
  category: 'Hematology' | 'Biochemistry' | 'Serology' | 'Metabolic' | 'Urinalysis';
  date: string;
  orderedBy: string;
  laboratory: string;
  parameters: {
    name: string;
    value: string | number;
    unit: string;
    referenceRange: string;
    isAbnormal: boolean;
    flag?: 'High' | 'Low' | 'Critical' | 'Abnormal';
  }[];
  clinicalImpression: string;
  status: 'Final';
}

export interface ImagingReport {
  id: string;
  modality: 'Ultrasound' | 'X-Ray' | 'CT Scan' | 'MRI';
  bodyRegion: string;
  anatomy?: string;
  date: string;
  orderedBy: string;
  radiologist: string;
  facility: string;
  clinicalIndication: string;
  findings: string;
  impression: string;
  status: 'Final';
}

export interface MedicalDocument {
  id: string;
  title: string;
  category: 'Discharge Summary' | 'Consultation Note' | 'Lab Report' | 'Imaging Scan' | 'Prescription' | 'Clinical Summary';
  date: string;
  facility: string;
  author?: string;
  fileSize: string;
  fileType: 'PDF' | 'JPG' | 'DICOM';
  summary: string;
  tags: string[];
}

export interface QrShareToken {
  id: string;
  token: string;
  patientId: string;
  patientName: string;
  createdAt: string;
  expiresAt: string;
  status: 'Active' | 'Expired' | 'Revoked';
  recipientType: 'Clinician Verified' | 'Emergency Access' | 'Caregiver';
  recipientName?: string;
  permittedCategories: {
    profile: boolean;
    consultations: boolean;
    medications: boolean;
    labResults: boolean;
    imaging: boolean;
    allergies: boolean;
    sensitiveNotes: boolean;
  };
  scanCount: number;
  lastScannedAt?: string;
  accessLogs: {
    timestamp: string;
    accessedBy: string;
    facility: string;
    action: string;
  }[];
}

export const initialPatientProfile: PatientProfile = {
  id: 'PAT-MH-40192',
  name: 'Ananya Deshmukh',
  uhid: 'MH-MUM-2026-90412',
  abhaId: '91-4820-1049-2810',
  age: 34,
  sex: 'Female',
  bloodGroup: 'B+',
  phone: '+91 98201 44821',
  email: 'ananya.deshmukh@example.com',
  address: 'B-402, Shivam Enclave, Dadar West, Mumbai, Maharashtra 400028',
  emergencyContact: {
    name: 'Rohan Deshmukh',
    relation: 'Spouse',
    phone: '+91 98201 44822'
  },
  primaryCarePhysician: {
    name: 'Dr. Alex Morgan, MD',
    specialty: 'Internal Medicine & Infectious Diseases',
    hospital: 'Metropolitan Medical Center / KEM Hospital Mumbai'
  }
};

export const initialAllergies: Allergy[] = [
  {
    id: 'alg-1',
    allergen: 'Penicillin / Amoxicillin',
    type: 'Medication',
    reaction: 'Urticaria, facial flushing, and mild angioedema',
    severity: 'Severe',
    recordedDate: '2022-04-10',
    notes: 'Confirmed by clinical reaction during childhood pharyngitis treatment. Strict cross-reactivity warning.'
  },
  {
    id: 'alg-2',
    allergen: 'NSAIDs (Ibuprofen, Diclofenac)',
    type: 'Medication',
    reaction: 'Gastric epigastric pain and bronchospasm episodes',
    severity: 'Moderate',
    recordedDate: '2023-11-15',
    notes: 'Use Paracetamol or Acetaminophen as first-line antipyretic/analgesic.'
  }
];

export const initialConditions: ChronicCondition[] = [
  {
    id: 'diag-1',
    condition: 'Type 2 Diabetes Mellitus',
    icd10: 'E11.9',
    status: 'Active (Controlled)',
    diagnosedDate: '2023-01-14',
    diagnosingClinician: 'Dr. Alex Morgan, MD',
    notes: 'Monitored on oral hypoglycemics (Metformin 500mg BID) and dietary carbohydrates moderation. Latest HbA1c 6.8%.'
  },
  {
    id: 'diag-2',
    condition: 'Essential Hypertension',
    icd10: 'I10',
    status: 'Active (Controlled)',
    diagnosedDate: '2022-08-20',
    diagnosingClinician: 'Dr. Alex Morgan, MD',
    notes: 'Well managed on Telmisartan 40mg daily. Ambulatory BP consistently < 130/80 mmHg.'
  },
  {
    id: 'diag-3',
    condition: 'Acute Dengue Fever with Thrombocytopenia',
    icd10: 'A90',
    status: 'Resolved / Remission',
    diagnosedDate: '2026-09-20',
    diagnosingClinician: 'Dr. Rajesh Patil, Emergency Medicine',
    notes: 'Presented with acute high-grade fever, retro-orbital headache, myalgia and thrombocytopenia (platelets nadir 92,000/µL). Completely recovered following intravenous hydration; platelets normalized to 184,000/µL on 28 Sep 2026.'
  }
];

export const initialPrescriptions: Prescription[] = [
  {
    id: 'rx-1',
    medicationName: 'Metformin Hydrochloride 500mg',
    genericName: 'Metformin',
    dosage: '500 mg',
    frequency: 'Twice daily (BID)',
    route: 'Oral',
    timing: 'With morning and evening meals',
    indication: 'Type 2 Diabetes Mellitus glycemic control',
    prescribedBy: 'Dr. Alex Morgan, MD',
    startDate: '2023-01-14',
    status: 'Active',
    refillsRemaining: 2,
    instructions: 'Take consistently with food to minimize gastrointestinal discomfort. Avoid skipping doses.'
  },
  {
    id: 'rx-2',
    medicationName: 'Telmisartan Tablets IP 40mg',
    genericName: 'Telmisartan',
    dosage: '40 mg',
    frequency: 'Once daily (OD)',
    route: 'Oral',
    timing: 'Morning after breakfast',
    indication: 'Essential Hypertension blood pressure regulation',
    prescribedBy: 'Dr. Alex Morgan, MD',
    startDate: '2022-08-20',
    status: 'Active',
    refillsRemaining: 3,
    instructions: 'Monitor standing and sitting blood pressure periodically. Maintain low-sodium dietary habit.'
  },
  {
    id: 'rx-3',
    medicationName: 'Multivitamin with Zinc & Vitamin D3',
    genericName: 'Micronutrient Supplement',
    dosage: '1 capsule',
    frequency: 'Once daily (OD)',
    route: 'Oral',
    timing: 'Midday with water',
    indication: 'Post-viral recovery & metabolic support',
    prescribedBy: 'Dr. Alex Morgan, MD',
    startDate: '2026-09-28',
    status: 'Active',
    refillsRemaining: 1,
    instructions: 'Prescribed for 30 days post-dengue recovery support.'
  },
  {
    id: 'rx-4',
    medicationName: 'Paracetamol Tablets IP 650mg',
    genericName: 'Paracetamol / Acetaminophen',
    dosage: '650 mg',
    frequency: 'As needed (PRN) every 6 hours',
    route: 'Oral',
    timing: 'Post-meals during fever spikes',
    indication: 'Acute febrile episodes and body aches (Dengue phase)',
    prescribedBy: 'Dr. Rajesh Patil, Emergency Medicine',
    startDate: '2026-09-20',
    endDate: '2026-09-26',
    status: 'Completed',
    refillsRemaining: 0,
    instructions: 'Do not exceed 3,000 mg in 24 hours. Discontinued once fever settled.'
  }
];

export const initialConsultations: ConsultationVisit[] = [
  {
    id: 'enc-1',
    date: '2026-09-28',
    type: 'Outpatient',
    clinicianName: 'Dr. Alex Morgan, MD',
    specialty: 'Internal Medicine',
    facility: 'Metropolitan Medical Center, OPD Suite 304, Mumbai',
    chiefComplaint: 'Follow-up consultation after acute viral fever and thrombocytopenia.',
    vitals: {
      bloodPressure: '122/78 mmHg',
      heartRate: 74,
      temperature: '98.4°F (Afebrile)',
      respiratoryRate: 16,
      oxygenSaturation: 99,
      weightKg: 62.5
    },
    clinicalFindings: 'Patient is alert, comfortable, and clinically stable. No petechiae, spontaneous mucosal bleeding, or rash. Heart sounds S1 S2 normal. Lungs clear to auscultation bilaterally. Abdomen soft, non-tender; liver margin non-palpable.',
    assessment: 'Full resolution of acute Dengue fever. Repeat platelet count demonstrates reassuring rise to 184,000/µL. Metabolic parameters stable.',
    plan: 'Continue regular Metformin and Telmisartan. Added 30-day course of multivitamin with zinc. Resume moderate walking routine. Regular diabetic follow-up in 3 months.',
    followUpDate: '2026-12-15',
    status: 'Completed'
  },
  {
    id: 'enc-2',
    date: '2026-09-21',
    type: 'Emergency Care',
    clinicianName: 'Dr. Rajesh Patil, MBBS, MEM',
    specialty: 'Emergency Medicine',
    facility: 'Metropolitan Emergency Department, Mumbai',
    chiefComplaint: 'High-grade fever for 5 days, severe retro-orbital headache, generalized myalgia, fatigue, and fine erythematous rash.',
    vitals: {
      bloodPressure: '114/72 mmHg',
      heartRate: 98,
      temperature: '102.4°F',
      respiratoryRate: 19,
      oxygenSaturation: 98,
      weightKg: 63.0
    },
    clinicalFindings: 'Dehydrated oral mucosa, conjunctival suffusion, faint macular rash over forearms and chest. Positive tourniquet test. Abdomen soft with mild right hypochondriac tenderness.',
    assessment: 'Acute Arboviral infection / Suspected Dengue fever with thrombocytopenia. Platelet count 92,000/µL, Leukopenia 3,200/µL. Dengue NS1 Antigen confirmed positive.',
    plan: 'Initiated 1.5 L Isotonic Ringer Lactate hydration. Paracetamol 650mg IV for hyperpyrexia. Strict warning against NSAIDs/Aspirin. Prescribed home hydration protocol with daily outpatient platelet count monitoring.',
    followUpDate: '2026-09-23',
    status: 'Completed'
  },
  {
    id: 'enc-3',
    date: '2026-08-14',
    type: 'Outpatient',
    clinicianName: 'Dr. Alex Morgan, MD',
    specialty: 'Internal Medicine',
    facility: 'Metropolitan Medical Center, Mumbai',
    chiefComplaint: 'Quarterly chronic disease management review for Type 2 Diabetes and Hypertension.',
    vitals: {
      bloodPressure: '126/82 mmHg',
      heartRate: 72,
      temperature: '98.6°F',
      respiratoryRate: 15,
      oxygenSaturation: 99,
      weightKg: 63.2
    },
    clinicalFindings: 'No peripheral edema, normal pedal pulses, clear chest, normal cardiovascular sounds. Visual fundoscopy screening unremarkable.',
    assessment: 'Type 2 Diabetes and Essential Hypertension well controlled. HbA1c 6.8% (down from 7.1% last quarter). Renal function (Serum Creatinine 0.88 mg/dL) normal.',
    plan: 'Continue Metformin 500mg BID and Telmisartan 40mg OD. Encouraged ongoing 45 min daily brisk walking. Annual ophthalmology fundoscopy scheduled.',
    followUpDate: '2026-11-20',
    status: 'Completed'
  }
];

export const initialLabResults: LabResult[] = [
  {
    id: 'lab-1',
    testName: 'Complete Blood Count (CBC) with Automated Platelet Profile',
    category: 'Hematology',
    date: '2026-09-28',
    orderedBy: 'Dr. Alex Morgan, MD',
    laboratory: 'Metropolitan Central Diagnostic Pathology Laboratory',
    parameters: [
      { name: 'Platelet Count', value: 184000, unit: '/µL', referenceRange: '150,000 - 450,000', isAbnormal: false },
      { name: 'Total Leukocyte Count (WBC)', value: 6400, unit: '/µL', referenceRange: '4,000 - 11,000', isAbnormal: false },
      { name: 'Hemoglobin', value: 13.2, unit: 'g/dL', referenceRange: '12.0 - 15.5', isAbnormal: false },
      { name: 'Hematocrit (PCV)', value: 39.4, unit: '%', referenceRange: '36.0 - 46.0', isAbnormal: false },
      { name: 'Mean Platelet Volume (MPV)', value: 9.8, unit: 'fL', referenceRange: '7.5 - 11.5', isAbnormal: false }
    ],
    clinicalImpression: 'Reassuring platelet recovery from previous nadir. Normal leukocyte and erythroid indices.',
    status: 'Final'
  },
  {
    id: 'lab-2',
    testName: 'Dengue Serology & Acute Thrombocytopenia Evaluation',
    category: 'Serology',
    date: '2026-09-21',
    orderedBy: 'Dr. Rajesh Patil, Emergency Medicine',
    laboratory: 'Metropolitan Emergency Diagnostic Unit',
    parameters: [
      { name: 'Dengue NS1 Antigen (ELISA)', value: 'POSITIVE', unit: 'Index', referenceRange: 'Negative (< 0.9)', isAbnormal: true, flag: 'Critical' },
      { name: 'Platelet Count', value: 92000, unit: '/µL', referenceRange: '150,000 - 450,000', isAbnormal: true, flag: 'Low' },
      { name: 'Total Leukocyte Count (WBC)', value: 3200, unit: '/µL', referenceRange: '4,000 - 11,000', isAbnormal: true, flag: 'Low' },
      { name: 'Hematocrit (PCV)', value: 41.2, unit: '%', referenceRange: '36.0 - 46.0', isAbnormal: false },
      { name: 'Dengue IgM Antibody', value: 'BORDERLINE (0.95)', unit: 'Ratio', referenceRange: 'Negative (< 0.9)', isAbnormal: true, flag: 'High' }
    ],
    clinicalImpression: 'Consistent with acute primary dengue virus infection. Significant thrombocytopenia and leukopenia noted. Monitoring indicated.',
    status: 'Final'
  },
  {
    id: 'lab-3',
    testName: 'Comprehensive Glycemic & Renal Profile',
    category: 'Metabolic',
    date: '2026-08-14',
    orderedBy: 'Dr. Alex Morgan, MD',
    laboratory: 'Metropolitan Central Diagnostic Pathology Laboratory',
    parameters: [
      { name: 'Glycated Hemoglobin (HbA1c)', value: 6.8, unit: '%', referenceRange: '< 5.7 (Normal), < 7.0 (Target)', isAbnormal: false },
      { name: 'Fasting Blood Sugar (FBS)', value: 118, unit: 'mg/dL', referenceRange: '70 - 100 (Normal), < 130 (Target)', isAbnormal: true, flag: 'High' },
      { name: 'Serum Creatinine', value: 0.88, unit: 'mg/dL', referenceRange: '0.6 - 1.1', isAbnormal: false },
      { name: 'Blood Urea Nitrogen (BUN)', value: 14.2, unit: 'mg/dL', referenceRange: '7 - 20', isAbnormal: false },
      { name: 'Estimated GFR (eGFR)', value: '> 90', unit: 'mL/min/1.73m²', referenceRange: '> 60', isAbnormal: false }
    ],
    clinicalImpression: 'Optimal glycemic control on oral therapy. Preserved renal function with normal filtration markers.',
    status: 'Final'
  }
];

export const initialImagingReports: ImagingReport[] = [
  {
    id: 'img-1',
    modality: 'Ultrasound',
    bodyRegion: 'Whole Abdomen & Pelvis',
    date: '2026-09-21',
    orderedBy: 'Dr. Rajesh Patil, Emergency Medicine',
    radiologist: 'Dr. Meera Swaminathan, MD, DMRD',
    facility: 'Metropolitan Department of Radiodiagnosis',
    clinicalIndication: 'Acute febrile illness, suspected dengue with thrombocytopenia and right hypochondriac pain.',
    findings: 'Liver: Mildly enlarged measuring 14.2 cm with uniform parenchymal echotexture. No focal focal lesion. Gallbladder: Normal distension, wall thickness 2.8 mm (no evidence of edematous thickening). Spleen: Normal in size (10.4 cm). Kidneys: Normal bilateral corticomedullary differentiation. Peritoneal Cavity: No evidence of ascites or pleural effusion in either costophrenic angle.',
    impression: 'Mild hepatomegaly likely reactive to acute viral infection. No sonographic signs of plasma leakage or severe dengue-related fluid collections.',
    status: 'Final'
  },
  {
    id: 'img-2',
    modality: 'X-Ray',
    bodyRegion: 'Chest PA View',
    date: '2026-01-12',
    orderedBy: 'Dr. Alex Morgan, MD',
    radiologist: 'Dr. K. R. Raman, MD (Radiology)',
    facility: 'Metropolitan Department of Radiodiagnosis',
    clinicalIndication: 'Annual routine health checkup.',
    findings: 'Normal cardiothoracic ratio (< 0.50). Lung parenchyma is clear bilaterally without consolidations or active infiltrates. Both hemidiaphragms are smooth with sharp costophrenic angles. Bony thorax normal.',
    impression: 'Normal chest radiograph.',
    status: 'Final'
  }
];

export const initialDocuments: MedicalDocument[] = [
  {
    id: 'doc-1',
    title: 'Discharge & Recovery Summary — Acute Dengue Episode',
    category: 'Discharge Summary',
    date: '2026-09-28',
    facility: 'Metropolitan Medical Center, Mumbai',
    fileSize: '428 KB',
    fileType: 'PDF',
    summary: 'Comprehensive clinical care summary documenting resolution of acute dengue fever, platelet normalization from 92,000 to 184,000/µL, and resumption of chronic care regimen.',
    tags: ['Dengue', 'Discharge', 'Platelet Recovery', 'Internal Medicine']
  },
  {
    id: 'doc-2',
    title: 'CBC & Coagulation Report with Automated Curves',
    category: 'Lab Report',
    date: '2026-09-28',
    facility: 'Metropolitan Central Diagnostic Pathology Laboratory',
    fileSize: '210 KB',
    fileType: 'PDF',
    summary: 'Certified laboratory investigation showing full complete blood count, erythrocyte indices, and automated platelet counts.',
    tags: ['CBC', 'Hematology', 'Platelets']
  },
  {
    id: 'doc-3',
    title: 'Emergency Admission & Serology Report',
    category: 'Lab Report',
    date: '2026-09-21',
    facility: 'Metropolitan Emergency Diagnostic Unit',
    fileSize: '315 KB',
    fileType: 'PDF',
    summary: 'Emergency serology documenting positive Dengue NS1 antigen and admission platelet count of 92,000/µL.',
    tags: ['Dengue NS1', 'Emergency', 'Serology']
  },
  {
    id: 'doc-4',
    title: 'Abdominal Ultrasound Scan Report & Sonograms',
    category: 'Imaging Scan',
    date: '2026-09-21',
    facility: 'Metropolitan Department of Radiodiagnosis',
    fileSize: '1.4 MB',
    fileType: 'PDF',
    summary: 'Official ultrasound report ruling out gallbladder edema, ascites, and splenic complications.',
    tags: ['Ultrasound', 'Radiology', 'Abdomen']
  },
  {
    id: 'doc-5',
    title: 'Quarterly Metabolic & Diabetes Review Summary',
    category: 'Consultation Note',
    date: '2026-08-14',
    facility: 'Metropolitan Medical Center, Mumbai',
    fileSize: '190 KB',
    fileType: 'PDF',
    summary: 'Clinical consultation note detailing HbA1c 6.8%, blood pressure control, and ongoing Metformin/Telmisartan prescription renewals.',
    tags: ['Diabetes', 'Hypertension', 'HbA1c', 'Prescriptions']
  }
];

export const initialQrTokens: QrShareToken[] = [
  {
    id: 'qr-share-01',
    token: 'MV-SHARE-8F32A9C04B',
    patientId: 'PAT-MH-40192',
    patientName: 'Ananya Deshmukh',
    createdAt: '2026-10-10T09:30:00Z',
    expiresAt: '2026-10-11T09:30:00Z',
    status: 'Active',
    recipientType: 'Clinician Verified',
    recipientName: 'Dr. Alex Morgan, MD',
    permittedCategories: {
      profile: true,
      consultations: true,
      medications: true,
      labResults: true,
      imaging: true,
      allergies: true,
      sensitiveNotes: false
    },
    scanCount: 1,
    lastScannedAt: '2026-10-10T11:15:00Z',
    accessLogs: [
      {
        timestamp: '2026-10-10T11:15:00Z',
        accessedBy: 'Dr. Alex Morgan, MD',
        facility: 'Metropolitan Medical Center OPD',
        action: 'Verified token and accessed longitudinal lab & prescription records.'
      }
    ]
  },
  {
    id: 'qr-share-02',
    token: 'MV-SHARE-E471B029FA',
    patientId: 'PAT-MH-40192',
    patientName: 'Ananya Deshmukh',
    createdAt: '2026-09-21T18:00:00Z',
    expiresAt: '2026-09-22T18:00:00Z',
    status: 'Expired',
    recipientType: 'Emergency Access',
    recipientName: 'Emergency Triage Duty Clinician',
    permittedCategories: {
      profile: true,
      consultations: true,
      medications: true,
      labResults: true,
      imaging: true,
      allergies: true,
      sensitiveNotes: false
    },
    scanCount: 2,
    lastScannedAt: '2026-09-21T18:32:00Z',
    accessLogs: [
      {
        timestamp: '2026-09-21T18:32:00Z',
        accessedBy: 'Dr. Rajesh Patil, Emergency Medicine',
        facility: 'Metropolitan Emergency Department',
        action: 'Accessed allergy and chronic medication history for emergency hydration management.'
      }
    ]
  }
];
