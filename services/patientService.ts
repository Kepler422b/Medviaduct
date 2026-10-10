import {
  type PatientProfile,
  type Allergy,
  type ChronicCondition,
  type Prescription,
  type ConsultationVisit,
  type LabResult,
  type ImagingReport,
  type MedicalDocument,
  initialPatientProfile,
  initialAllergies,
  initialConditions,
  initialPrescriptions,
  initialConsultations,
  initialLabResults,
  initialImagingReports,
  initialDocuments
} from '@/data/patientData';

const STORAGE_KEYS = {
  profile: 'medvia.patient.profile',
  allergies: 'medvia.patient.allergies',
  conditions: 'medvia.patient.conditions',
  prescriptions: 'medvia.patient.prescriptions',
  consultations: 'medvia.patient.consultations',
  labs: 'medvia.patient.labs',
  imaging: 'medvia.patient.imaging',
  documents: 'medvia.patient.documents'
};

function readItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('medvia-patient-change'));
  } catch {
    // quota fallback
  }
}

export const patientService = {
  getProfile: (): PatientProfile => readItem(STORAGE_KEYS.profile, initialPatientProfile),
  updateProfile: (profile: Partial<PatientProfile>): PatientProfile => {
    const current = patientService.getProfile();
    const updated = { ...current, ...profile };
    writeItem(STORAGE_KEYS.profile, updated);
    return updated;
  },

  getAllergies: (): Allergy[] => readItem(STORAGE_KEYS.allergies, initialAllergies),
  addAllergy: (allergy: Omit<Allergy, 'id'>): Allergy => {
    const list = patientService.getAllergies();
    const created: Allergy = { ...allergy, id: `alg-${Date.now()}` };
    writeItem(STORAGE_KEYS.allergies, [created, ...list]);
    return created;
  },

  getConditions: (): ChronicCondition[] => readItem(STORAGE_KEYS.conditions, initialConditions),
  addCondition: (condition: Omit<ChronicCondition, 'id'>): ChronicCondition => {
    const list = patientService.getConditions();
    const created: ChronicCondition = { ...condition, id: `diag-${Date.now()}` };
    writeItem(STORAGE_KEYS.conditions, [created, ...list]);
    return created;
  },

  getPrescriptions: (): Prescription[] => readItem(STORAGE_KEYS.prescriptions, initialPrescriptions),
  addPrescription: (rx: Omit<Prescription, 'id'>): Prescription => {
    const list = patientService.getPrescriptions();
    const created: Prescription = { ...rx, id: `rx-${Date.now()}` };
    writeItem(STORAGE_KEYS.prescriptions, [created, ...list]);
    return created;
  },

  getConsultations: (): ConsultationVisit[] => readItem(STORAGE_KEYS.consultations, initialConsultations),
  addConsultation: (visit: Omit<ConsultationVisit, 'id'>): ConsultationVisit => {
    const list = patientService.getConsultations();
    const created: ConsultationVisit = { ...visit, id: `enc-${Date.now()}` };
    writeItem(STORAGE_KEYS.consultations, [created, ...list]);
    return created;
  },

  getLabResults: (): LabResult[] => readItem(STORAGE_KEYS.labs, initialLabResults),
  getImagingReports: (): ImagingReport[] => readItem(STORAGE_KEYS.imaging, initialImagingReports),

  getDocuments: (): MedicalDocument[] => readItem(STORAGE_KEYS.documents, initialDocuments),
  addDocument: (doc: Omit<MedicalDocument, 'id'>): MedicalDocument => {
    const list = patientService.getDocuments();
    const created: MedicalDocument = { ...doc, id: `doc-${Date.now()}` };
    writeItem(STORAGE_KEYS.documents, [created, ...list]);
    return created;
  },

  // Longitudinal snapshot
  getFullRecord: () => ({
    profile: patientService.getProfile(),
    allergies: patientService.getAllergies(),
    conditions: patientService.getConditions(),
    prescriptions: patientService.getPrescriptions(),
    consultations: patientService.getConsultations(),
    labResults: patientService.getLabResults(),
    imaging: patientService.getImagingReports(),
    documents: patientService.getDocuments()
  })
};
