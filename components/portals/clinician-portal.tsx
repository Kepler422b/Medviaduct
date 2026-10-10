'use client';

import React, { useState, useEffect } from 'react';
import Link from '@/components/link';
import {
  BriefcaseMedical,
  ShieldCheck,
  Search,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Activity,
  Network,
  BookOpen,
  Printer,
  Download,
  Plus,
  Trash2,
  Copy,
  ChevronRight,
  TrendingUp,
  Clock,
  User,
  HeartPulse,
  Pill,
  ExternalLink,
  HelpCircle,
  FileCheck,
  LogOut,
  X,
  Lock
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { toast, Toaster } from 'sonner';
import { qrTokenService } from '@/services/qrTokenService';
import { patientService } from '@/services/patientService';
import {
  securityService,
  accessGrantStore,
  type EmergencyReasonCode,
  type ActiveAccessGrant,
} from '@/services/securityService';
import type { QrShareToken, PatientProfile } from '@/data/patientData';

// Simulated longitudinal lab data for Recharts
const PLATELET_TRAJECTORY = [
  { date: 'Sep 21 (Day 4)', platelets: 48000, reference: 150000, status: 'Severe Thrombocytopenia' },
  { date: 'Sep 23 (Day 6)', platelets: 92000, reference: 150000, status: 'Rebound Phase' },
  { date: 'Sep 26 (Day 9)', platelets: 145000, reference: 150000, status: 'Near Normal' },
  { date: 'Oct 03 (Day 16)', platelets: 228000, reference: 150000, status: 'Full Recovery' }
];

const METABOLIC_TRAJECTORY = [
  { date: 'Jan 2026', hba1c: 7.4, fastingGlucose: 142, bpSystolic: 138 },
  { date: 'May 2026', hba1c: 7.1, fastingGlucose: 130, bpSystolic: 132 },
  { date: 'Oct 2026', hba1c: 6.8, fastingGlucose: 114, bpSystolic: 124 }
];

// Curated Clinical Evidence Guidelines
const CLINICAL_GUIDELINES = [
  {
    id: 'guide-01',
    title: 'WHO Guidelines for Clinical Management of Dengue in Adults (2024 Update)',
    organization: 'World Health Organization (WHO)',
    citation: 'WHO Technical Report Series No. 1042; Geneva.',
    doi: '10.2471/BLT.23.290882',
    summary:
      'Avoid prophylactic platelet transfusions in stable patients with resolving convalescent dengue. Monitor hematocrit and fluid balance.',
    keyRecommendation: 'Withhold invasive interventions if platelets > 50,000/µL and clinical recovery evident.'
  },
  {
    id: 'guide-02',
    title: 'ADA Standards of Medical Care in Diabetes: Metformin & Glycemic Goals',
    organization: 'American Diabetes Association / Lancet Diabetes',
    citation: 'Diabetes Care 2026; 49(Suppl. 1): S112-S125.',
    doi: '10.2337/dc26-S009',
    summary:
      'First-line Metformin monotherapy recommended for HbA1c < 7.0%. Regular renal function monitoring (eGFR) advised.',
    keyRecommendation: 'Maintain Metformin 500mg BD with meals. Monitor annual serum creatinine.'
  },
  {
    id: 'guide-03',
    title: 'ISH Global Hypertension Practice Guidelines: Target BP in Diabetics',
    organization: 'International Society of Hypertension',
    citation: 'Lancet 2025; 405(10488): 1890-1904.',
    doi: '10.1016/S0140-6736(25)00412-9',
    summary:
      'Target blood pressure < 130/80 mmHg in patients with comorbid diabetes. ARBs like Telmisartan provide sustained 24h blockade.',
    keyRecommendation: 'Continue Telmisartan 40mg OD morning for renoprotection and blood pressure control.'
  }
];

// Anonymized Similar Cases Cohort
const SIMILAR_CASES = [
  {
    id: 'SIM-CASE-719',
    matchScore: 94,
    age: 36,
    sex: 'Female',
    matchingFeatures: ['Dengue Fever Seropositive', 'Thrombocytopenia (44k)', 'Type 2 Diabetes', 'Metformin Therapy'],
    course: 'Convalescent recovery by Day 10. Platelets rebounded to 210,000 without transfusion.',
    outcome: 'Discharged with normal metabolic control.'
  },
  {
    id: 'SIM-CASE-412',
    matchScore: 88,
    age: 33,
    sex: 'Female',
    matchingFeatures: ['Dengue IgM Positive', 'Mild Hepatomegaly on USG', 'Hypertension on ARB'],
    course: 'Conservative isotonic fluid hydration. Platelet count recovered in 14 days.',
    outcome: 'Full recovery, no hemorrhagic manifestations.'
  }
];

export function ClinicianPortal() {
  const [tokenInput, setTokenInput] = useState('MV-SHARE-8F32A9C04B');
  const [activeToken, setActiveToken] = useState<QrShareToken | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [tokenStatusMessage, setTokenStatusMessage] = useState<string | null>(null);

  // Active patient data (loaded upon token verification)
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'vitals' | 'similar' | 'guidelines' | 'prescribe'>('chart');

  // Consultation Note Generator State
  const [subjectiveNote, setSubjectiveNote] = useState(
    'Patient presents for post-Dengue convalescence follow-up and chronic diabetes review. Reports feeling energized, appetite returned to normal. No myalgia, headache, or bleeding tendencies.'
  );
  const [objectiveVitals, setObjectiveVitals] = useState({
    bp: '124/82 mmHg',
    pulse: '74 bpm',
    temp: '98.4°F',
    spo2: '99%',
    weight: '62 kg'
  });
  const [assessmentNote, setAssessmentNote] = useState(
    '1. Resolving Dengue Fever — Convalescent phase with complete platelet normalization.\n2. Type 2 Diabetes Mellitus — Controlled on Metformin 500mg BD (HbA1c 6.8%).\n3. Essential Hypertension — Controlled on Telmisartan 40mg OD.'
  );
  const [planNote, setPlanNote] = useState(
    '1. Continue Metformin 500mg BD with meals.\n2. Continue Telmisartan 40mg OD in morning.\n3. Discontinue PRN Paracetamol.\n4. Repeat HbA1c and Serum Creatinine in 3 months.\n5. Maintain strict hydration (2.5L/day).'
  );

  // Prescription items in generator
  const [prescribedMedications, setPrescribedMedications] = useState([
    { name: 'Metformin Hydrochloride', dosage: '500 mg', frequency: 'Twice daily with meals', duration: '90 Days' },
    { name: 'Telmisartan', dosage: '40 mg', frequency: 'Once daily (morning)', duration: '90 Days' },
    { name: 'Neurobion Forte', dosage: '1 Tablet', frequency: 'Once daily (evening)', duration: '30 Days' }
  ]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');
  const [newMedDuration, setNewMedDuration] = useState('');

  // Allergy warning popup state
  const [allergyWarning, setAllergyWarning] = useState<string | null>(null);

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<
    { timestamp: string; action: string; practitioner: string }[]
  >([
    {
      timestamp: '2026-10-10 11:15 IST',
      action: 'Validated QR Token MV-SHARE-8F32A9C04B for Ananya Deshmukh',
      practitioner: 'Dr. Alex Morgan, MD'
    },
    {
      timestamp: '2026-10-10 11:18 IST',
      action: 'Inspected longitudinal hematology and metabolic panels',
      practitioner: 'Dr. Alex Morgan, MD'
    }
  ]);

  // Break-Glass Emergency Override State
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState<EmergencyReasonCode>('ACUTE_CARDIOVASCULAR_COLLAPSE');
  const [breakGlassJustification, setBreakGlassJustification] = useState('');
  const [breakGlassConfirmed, setBreakGlassConfirmed] = useState(false);
  const [isSubmittingBreakGlass, setIsSubmittingBreakGlass] = useState(false);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencySecondsLeft, setEmergencySecondsLeft] = useState(300);
  const [activeEmergencyGrant, setActiveEmergencyGrant] = useState<ActiveAccessGrant | null>(null);

  // Initial auto-verify demo token
  useEffect(() => {
    handleVerifyToken('MV-SHARE-8F32A9C04B', false);
  }, []);

  // Strict 5-minute Countdown Timer with Auto-Revoke & Memory Wipe
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (emergencyActive && emergencySecondsLeft > 0) {
      timer = setInterval(() => {
        setEmergencySecondsLeft((prev) => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            handleEndEmergencySession('Emergency access grant expired (5-minute strict TTL). In-memory clinical session wiped.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [emergencyActive, emergencySecondsLeft]);

  // Clean wipe of emergency access grant
  const handleEndEmergencySession = async (customMessage?: string) => {
    if (activeEmergencyGrant) {
      try {
        await securityService.revokeEmergencyAccess(activeEmergencyGrant.grantId);
      } catch (e) {
        console.warn('Revoke emergency access error:', e);
      }
    }
    accessGrantStore.clear();
    setEmergencyActive(false);
    setActiveEmergencyGrant(null);
    setActiveToken(null);
    setEmergencySecondsLeft(0);
    toast.warning(customMessage || 'Emergency access override session ended. Access grant revoked.');
    setAuditLogs((prev) => [
      {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Revoked emergency break-glass grant. Clinical session locked.',
        practitioner: 'Dr. Alex Morgan, MD'
      },
      ...prev
    ]);
  };

  // Submit Break-Glass Request
  const handleExecuteBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (breakGlassJustification.trim().length < 10) {
      toast.error('Clinical justification must contain at least 10 characters.');
      return;
    }
    if (!breakGlassConfirmed) {
      toast.error('Please check the confirmation box to certify emergency override.');
      return;
    }

    setIsSubmittingBreakGlass(true);
    try {
      const res = await securityService.requestEmergencyAccess({
        patientId: 'p-ananya-deshmukh',
        reasonCode: breakGlassReason,
        justification: breakGlassJustification.trim(),
        durationMinutes: 5,
      });

      const patientProfile = patientService.getProfile();
      setPatient(patientProfile);

      setActiveToken({
        id: res.emergencyGrantId,
        token: `EMERGENCY-OVERRIDE-${res.reasonCode}`,
        patientId: patientProfile.id,
        patientName: patientProfile.name,
        createdAt: res.createdAt,
        expiresAt: res.expiresAt,
        status: 'Active',
        recipientType: 'Emergency Access',
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
        accessLogs: [
          {
            timestamp: res.createdAt,
            accessedBy: 'Dr. Alex Morgan, MD',
            facility: 'Metropolitan Medical Center ER',
            action: `Break-Glass Override: ${res.reasonCode}. Justification: ${breakGlassJustification.trim()}`
          }
        ]
      });

      const inMemoryGrant: ActiveAccessGrant = {
        grantId: res.emergencyGrantId,
        patientId: patientProfile.id,
        scopes: res.scopes,
        expiresAt: res.expiresAt,
        grantType: 'EMERGENCY_OVERRIDE',
        reasonCode: res.reasonCode
      };
      setActiveEmergencyGrant(inMemoryGrant);
      setEmergencyActive(true);
      setEmergencySecondsLeft(300);
      setShowBreakGlassModal(false);
      setBreakGlassJustification('');
      setBreakGlassConfirmed(false);

      toast.success('Break-Glass emergency override granted. 5-minute strict countdown active.');
      setAuditLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: `Break-Glass declaration: ${res.reasonCode} (Grant ID: ${res.emergencyGrantId.slice(0, 8)}...)`,
          practitioner: 'Dr. Alex Morgan, MD'
        },
        ...prev
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Emergency access request failed';
      toast.error(msg);
    } finally {
      setIsSubmittingBreakGlass(false);
    }
  };

  const handleVerifyToken = async (tokenToVerify: string, triggerToast = true) => {
    const cleanToken = tokenToVerify.trim();
    setIsVerifying(true);
    setTokenStatusMessage(null);

    // 1. Check if token is a single-use MediVault token format (MEDVIADUCT:v1:...)
    if (cleanToken.startsWith('MEDVIADUCT:v1:')) {
      try {
        const res = await securityService.resolveQr(cleanToken);
        const profile = patientService.getProfile();
        setPatient(profile);
        setActiveToken({
          id: res.accessGrantId,
          token: cleanToken,
          patientId: res.patientId,
          patientName: profile.name,
          createdAt: new Date().toISOString(),
          expiresAt: res.expiresAt,
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
          accessLogs: [
            {
              timestamp: new Date().toISOString(),
              accessedBy: 'Dr. Alex Morgan, MD',
              facility: 'Metropolitan Medical Center OPD',
              action: `Single-use QR redeemed. Scopes: ${res.scopes.join(', ')}`
            }
          ]
        });
        setTokenStatusMessage('Access Grant Verified: Single-use QR redeemed in-session.');
        if (triggerToast) {
          toast.success(`Access Grant acquired: ${profile.name}`);
        }
        setAuditLogs((prev) => [
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: `Redeemed single-use QR token (Grant ID: ${res.accessGrantId.slice(0, 8)}...)`,
            practitioner: 'Dr. Alex Morgan, MD'
          },
          ...prev
        ]);
      } catch (err: unknown) {
        setActiveToken(null);
        const msg = err instanceof Error ? err.message : 'Invalid or expired QR token';
        setTokenStatusMessage(`Authorization Failed: ${msg}`);
        if (triggerToast) {
          toast.error(msg);
        }
      } finally {
        setIsVerifying(false);
      }
      return;
    }

    // 2. Standard token fallback
    setTimeout(() => {
      const verified = qrTokenService.validateAndLog(
        cleanToken,
        'Dr. Alex Morgan, MD',
        'Metropolitan Medical Center OPD'
      );

      if (verified.valid && verified.token) {
        setActiveToken(verified.token);
        setPatient(patientService.getProfile());
        // Also register into in-memory accessGrantStore
        accessGrantStore.set({
          grantId: verified.token.id,
          patientId: verified.token.patientId,
          scopes: ['timeline:read', 'clinical-summary:generate'],
          expiresAt: verified.token.expiresAt,
          grantType: 'CONSENT_GRANT',
        });
        setTokenStatusMessage('Token Verified: Full clinical history unlocked.');
        if (triggerToast) {
          toast.success(`Access authorized: ${verified.token.patientName}`);
        }
        setAuditLogs((prev) => [
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: `Authorized access to ${verified.token?.patientName} (${cleanToken})`,
            practitioner: 'Dr. Alex Morgan, MD'
          },
          ...prev
        ]);
      } else {
        setActiveToken(null);
        setTokenStatusMessage(`Authorization Failed: ${verified.reason}`);
        if (triggerToast) {
          toast.error(verified.reason || 'Invalid QR token');
        }
      }
      setIsVerifying(false);
    }, 300);
  };

  // Add Medication with Drug Allergy Check
  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;

    const medLower = newMedName.toLowerCase();

    // Strict Allergy Contraindication Check
    if (
      medLower.includes('penicillin') ||
      medLower.includes('amoxicillin') ||
      medLower.includes('ampicillin') ||
      medLower.includes('augmentin')
    ) {
      setAllergyWarning(
        `CONTRAINDICATION DETECTED: Patient has a documented SEVERE ANAPHYLACTIC ALLERGY to Penicillin and Beta-lactam antibiotics!`
      );
      return;
    }

    if (
      medLower.includes('ibuprofen') ||
      medLower.includes('naproxen') ||
      medLower.includes('diclofenac') ||
      medLower.includes('nsaid')
    ) {
      setAllergyWarning(
        `ALLERGY WARNING: Patient has a documented MODERATE URTICARIA ALLERGY to NSAIDs. Consider Paracetamol as a safe alternative.`
      );
      return;
    }

    setPrescribedMedications((prev) => [
      ...prev,
      {
        name: newMedName,
        dosage: newMedDosage || 'Standard dose',
        frequency: newMedFreq || 'As directed',
        duration: newMedDuration || '30 Days'
      }
    ]);

    setNewMedName('');
    setNewMedDosage('');
    setNewMedFreq('');
    setNewMedDuration('');
    toast.success('Medication added to encounter plan');
  };

  const handlePrintSummary = () => {
    window.print();
    toast.info('Initiating print dialog for consultation record');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F4] text-[#133840] flex flex-col font-sans">
      <Toaster richColors position="top-right" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DFE7E4] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#133840] flex items-center justify-center text-white font-bold text-sm">
                M
              </div>
              <div className="flex flex-col">
                <span className="font-serif font-bold text-base tracking-tight text-[#133840]">
                  Medviaduct
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider text-teal-700">
                  Clinician Workbench & Hospital OPD
                </span>
              </div>
            </Link>

            <span className="hidden md:inline-block h-4 w-px bg-slate-200 mx-1" />

            <div className="hidden md:flex items-center gap-1.5 text-xs text-[#607582] bg-[#F4F8F6] px-2.5 py-1 rounded-full border border-[#DFEAE4]">
              <ShieldCheck size={14} className="text-teal-600" />
              <span>Verified Session: <strong>Dr. Alex Morgan, MD</strong> (#MH-MED-84920)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/patient"
              className="text-xs text-[#607582] hover:text-[#133840] font-medium px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Patient Portal
            </Link>
            <Link
              href="/admin"
              className="text-xs text-[#607582] hover:text-[#133840] font-medium px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Surveillance Admin
            </Link>
            <Link
              href="/login"
              title="End clinician session"
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
            >
              <BriefcaseMedical size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* Active Emergency Break-Glass Notification Banner */}
      {emergencyActive && activeEmergencyGrant && (
        <div className="bg-rose-700 text-white px-4 py-2.5 text-xs font-medium border-b border-rose-800 shadow-sm animate-in fade-in">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-amber-300 animate-ping shrink-0" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold uppercase tracking-wider bg-rose-900/80 text-amber-200 px-2 py-0.5 rounded text-[11px] border border-rose-600">
                  ⚠️ Emergency Break-Glass Active
                </span>
                <span>
                  Reason: <strong>{activeEmergencyGrant.reasonCode}</strong>
                </span>
                <span className="hidden sm:inline opacity-70">|</span>
                <span>
                  Strict TTL Expiry:{' '}
                  <strong className="font-mono text-amber-200 text-sm underline decoration-amber-400">
                    {Math.floor(emergencySecondsLeft / 60)
                      .toString()
                      .padStart(2, '0')}
                    :
                    {(emergencySecondsLeft % 60).toString().padStart(2, '0')}
                  </strong>
                </span>
                <span className="hidden md:inline opacity-70">|</span>
                <span className="text-rose-100 text-[11px]">
                  Append-only tamper-evident audit ledger active
                </span>
              </div>
            </div>
            <button
              onClick={() => handleEndEmergencySession()}
              className="bg-white text-rose-800 hover:bg-rose-50 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut size={13} />
              <span>End Emergency Session</span>
            </button>
          </div>
        </div>
      )}

      {/* Patient QR Lookup Bar */}
      <section className="bg-white border-b border-[#DFE7E4] py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 max-w-2xl flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 min-w-[240px]">
              <QrCode
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-700"
              />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Scan or enter QR Token (e.g. MEDVIADUCT:v1:... or MV-SHARE-...)"
                className="w-full pl-10 pr-4 py-2 bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl text-xs font-mono font-medium text-[#133840] focus:outline-none focus:border-teal-600"
              />
            </div>
            <button
              onClick={() => handleVerifyToken(tokenInput)}
              disabled={isVerifying}
              className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={14} />
              <span>{isVerifying ? 'Verifying...' : 'Authorize Access'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBreakGlassModal(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 border border-rose-700 hover:border-rose-800 cursor-pointer"
              title="Statutory Break-Glass Override for Life-Threatening Emergencies"
            >
              <AlertTriangle size={14} className="text-amber-300" />
              <span>Emergency Break-Glass</span>
            </button>
          </div>

          {/* Quick Token status pill */}
          {activeToken && (
            <div className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Authorized for <strong>{activeToken.patientName}</strong> · Expires in 24h
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Patient Header (Unlocked via Token) */}
      {patient && activeToken && (
        <section className="bg-gradient-to-b from-[#F7FAF8] to-white border-b border-[#DFE7E4] py-5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-serif font-bold text-[#133840]">
                    {patient.name}
                  </h2>
                  <span className="text-xs font-mono bg-teal-100 text-teal-800 border border-teal-300 px-2 py-0.5 rounded-full font-bold">
                    UHID: {patient.uhid}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                    {patient.bloodGroup}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#607582] mt-1">
                  <span>Age: {patient.age} yrs ({patient.sex})</span>
                  <span>•</span>
                  <span>Contact: {patient.phone}</span>
                  <span>•</span>
                  <span>Emergency: {patient.emergencyContact.name} ({patient.emergencyContact.phone})</span>
                </div>
              </div>

              {/* Critical Drug Allergy Warning Banner */}
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl px-4 py-2.5 flex items-center gap-3">
                <AlertTriangle size={20} className="text-rose-600 shrink-0" />
                <div className="text-xs text-rose-900">
                  <span className="font-bold uppercase tracking-wider block text-[10px]">
                    Allergy Alert
                  </span>
                  <strong>Penicillin (Anaphylaxis)</strong> & <strong>NSAIDs (Urticaria)</strong>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70 overflow-x-auto no-scrollbar">
              {[
                { key: 'chart', label: 'Longitudinal Chart & Vitals', icon: Activity },
                { key: 'vitals', label: 'Biomarker Trajectory', icon: TrendingUp },
                { key: 'similar', label: 'Similar Cases (AI Cohort)', icon: Network },
                { key: 'guidelines', label: 'Evidence & Guidelines', icon: BookOpen },
                { key: 'prescribe', label: 'Consultation Note & Prescribe', icon: FileCheck }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-[#133840] text-white shadow-xs'
                        : 'text-[#607582] hover:text-[#133840] hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-teal-300' : 'text-[#8DA39C]'} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {patient && (
          <>
            {/* ===================== TAB 1: LONGITUDINAL CHART ===================== */}
            {activeTab === 'chart' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Vitals & History Summary */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Platelet Rebound Chart */}
                  <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                          <TrendingUp size={16} className="text-teal-700" />
                          Platelet Count Rebound Trajectory (Post-Dengue Recovery)
                        </h3>
                        <p className="text-xs text-[#607582]">
                          Serial CBC monitoring showing nadir at Day 4 and robust marrow recovery.
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        Current: 228,000 /µL (Normal)
                      </span>
                    </div>

                    <div className="h-64 w-full pt-4 min-w-0">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                        <AreaChart data={PLATELET_TRAJECTORY}>
                          <defs>
                            <linearGradient id="plateletGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#237C78" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#237C78" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} domain={[0, 260000]} />
                          <Tooltip
                            formatter={(val: any) => [`${val.toLocaleString()} /µL`, 'Platelets']}
                          />
                          <Area
                            type="monotone"
                            dataKey="platelets"
                            stroke="#133840"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#plateletGrad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Consultation History Summary */}
                  <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
                    <h3 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                      <Clock size={16} className="text-teal-700" />
                      Clinical Encounters & Doctor Notes
                    </h3>

                    <div className="space-y-3">
                      {patientService.getConsultations().map((consult) => (
                        <div
                          key={consult.id}
                          className="p-3.5 rounded-xl border border-[#DFECE6] bg-[#FAF9F6] space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-xs text-[#133840]">
                                {consult.clinician}
                              </span>
                              <span className="text-[11px] text-[#607582] ml-2">
                                ({consult.specialty} · {consult.hospital})
                              </span>
                            </div>
                            <span className="text-xs font-mono font-semibold text-[#133840]">
                              {consult.date}
                            </span>
                          </div>
                          <p className="text-xs text-[#294B43] leading-relaxed">
                            <strong>Assessment:</strong> {consult.impression}
                          </p>
                          <p className="text-xs text-teal-900 font-medium">
                            <strong>Plan:</strong> {consult.plan}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Quick Vitals & Active Chronic Conditions */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Current Active Prescriptions */}
                  <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-3">
                    <h4 className="font-serif font-bold text-sm text-[#133840] flex items-center gap-2">
                      <Pill size={16} className="text-teal-700" />
                      Current Prescriptions
                    </h4>

                    <div className="space-y-2 text-xs">
                      {patientService
                        .getPrescriptions()
                        .filter((p) => p.status === 'Active')
                        .map((med) => (
                          <div
                            key={med.id}
                            className="p-2.5 rounded-lg border border-[#E3ECE8] bg-[#FAF9F6] space-y-1"
                          >
                            <div className="flex justify-between font-bold text-[#133840]">
                              <span>{med.medicationName}</span>
                              <span className="font-mono text-teal-800">{med.dosage}</span>
                            </div>
                            <div className="text-[11px] text-[#607582]">
                              {med.frequency} ({med.timing})
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Chronic Conditions */}
                  <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-3">
                    <h4 className="font-serif font-bold text-sm text-[#133840] flex items-center gap-2">
                      <Activity size={16} className="text-teal-700" />
                      Chronic Problem List
                    </h4>

                    <div className="space-y-2 text-xs">
                      {patientService.getConditions().map((cond) => (
                        <div
                          key={cond.id}
                          className="p-2.5 rounded-lg border border-[#E3ECE8] bg-[#FAF9F6]"
                        >
                          <div className="flex justify-between font-semibold text-[#133840]">
                            <span>{cond.condition}</span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                              {cond.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#607582] mt-0.5">{cond.notes}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== TAB 2: BIOMARKER TRAJECTORY ===================== */}
            {activeTab === 'vitals' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-serif font-bold text-base text-[#133840]">
                        Longitudinal Glycemic & Blood Pressure Trajectory (2026)
                      </h3>
                      <p className="text-xs text-[#607582]">
                        Monitoring response to Metformin 500mg BD and Telmisartan 40mg OD.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                      HbA1c Improved: 7.4% → 6.8%
                    </span>
                  </div>

                  <div className="h-64 w-full pt-4 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                      <LineChart data={METABOLIC_TRAJECTORY}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="hba1c"
                          stroke="#133840"
                          strokeWidth={3}
                          name="HbA1c (%)"
                        />
                        <Line
                          type="monotone"
                          dataKey="fastingGlucose"
                          stroke="#237C78"
                          strokeWidth={2}
                          name="Fasting Glucose (mg/dL)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== TAB 3: SIMILAR CASES ===================== */}
            {activeTab === 'similar' && (
              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                      <Network size={18} className="text-teal-700" />
                      Similar Clinical Cases (Anonymized Cohort Matching)
                    </h3>
                    <p className="text-xs text-[#607582]">
                      Matches identified via age, presentation (convalescent dengue, thrombocytopenia) and comorbid Type 2 Diabetes.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SIMILAR_CASES.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-[#DFECE6] bg-[#FAF9F6] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#133840]">{item.id}</span>
                        <span className="text-xs font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded border border-teal-300">
                          {item.matchScore}% Clinical Match
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {item.matchingFeatures.map((feat, fIdx) => (
                          <span
                            key={fIdx}
                            className="text-[10px] bg-white border border-[#D5E2DC] px-2 py-0.5 rounded font-medium text-[#204940]"
                          >
                            {feat}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs text-[#45635C] leading-relaxed">
                        <strong>Observed Course:</strong> {item.course}
                      </p>

                      <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                        <strong>Outcome:</strong> {item.outcome}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===================== TAB 4: EVIDENCE & GUIDELINES ===================== */}
            {activeTab === 'guidelines' && (
              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                      <BookOpen size={18} className="text-teal-700" />
                      Evidence & Clinical Guidelines Explorer
                    </h3>
                    <p className="text-xs text-[#607582]">
                      Peer-reviewed practice recommendations grounded in real international protocols.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {CLINICAL_GUIDELINES.map((guide) => (
                    <div
                      key={guide.id}
                      className="p-4 rounded-xl border border-[#DFECE6] bg-[#FAF9F6] space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-[#133840]">{guide.title}</h4>
                          <span className="text-xs text-[#607582]">{guide.organization}</span>
                        </div>
                        <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-[#607582]">
                          DOI: {guide.doi}
                        </span>
                      </div>

                      <p className="text-xs text-[#284941] leading-relaxed">{guide.summary}</p>

                      <div className="bg-teal-50/80 p-2.5 rounded-lg border border-teal-200 text-xs text-teal-950">
                        <strong>Key Recommendation:</strong> {guide.keyRecommendation}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-[#607582]">
                        <span className="italic">{guide.citation}</span>
                        <button
                          onClick={() => {
                            setPlanNote(
                              (prev) => `${prev}\n- Follow guideline: ${guide.title} (${guide.doi})`
                            );
                            toast.success('Guideline inserted into consultation plan note');
                          }}
                          className="text-xs text-teal-800 font-semibold hover:underline"
                        >
                          Insert into Plan →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===================== TAB 5: CONSULTATION NOTE & PRESCRIBE ===================== */}
            {activeTab === 'prescribe' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-[#133840] flex items-center gap-2">
                        <FileCheck size={18} className="text-teal-700" />
                        Clinical Encounter Note & Prescription Generator
                      </h3>
                      <p className="text-xs text-[#607582]">
                        Structured SOAP notes, interactive prescriber, and print-ready summary.
                      </p>
                    </div>

                    <button
                      onClick={handlePrintSummary}
                      className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Printer size={14} />
                      <span>Print / Export Summary</span>
                    </button>
                  </div>

                  {/* SOAP Encounter Note Forms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#133840]">
                        Subjective (Patient Symptoms & History)
                      </label>
                      <textarea
                        value={subjectiveNote}
                        onChange={(e) => setSubjectiveNote(e.target.value)}
                        rows={4}
                        className="w-full bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl p-3 text-xs text-[#133840] focus:outline-none focus:border-teal-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#133840]">
                        Assessment (Clinical Impressions)
                      </label>
                      <textarea
                        value={assessmentNote}
                        onChange={(e) => setAssessmentNote(e.target.value)}
                        rows={4}
                        className="w-full bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl p-3 text-xs text-[#133840] focus:outline-none focus:border-teal-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#133840]">
                      Plan & Follow-up Instructions
                    </label>
                    <textarea
                      value={planNote}
                      onChange={(e) => setPlanNote(e.target.value)}
                      rows={3}
                      className="w-full bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl p-3 text-xs text-[#133840] focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  {/* Prescription Medication Prescriber with Allergy Checker */}
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <h4 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                      <Pill size={16} className="text-teal-700" />
                      Prescribed Medications (with Automatic Allergy Verification)
                    </h4>

                    {/* Prescribed List */}
                    <div className="space-y-2">
                      {prescribedMedications.map((med, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl border border-[#DFECE6] bg-[#FAF9F6] text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#133840]">{med.name}</span>
                            <span className="font-mono text-teal-800 ml-2">({med.dosage})</span>
                            <span className="text-[#607582] ml-2">— {med.frequency}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] text-[#607582]">{med.duration}</span>
                            <button
                              onClick={() =>
                                setPrescribedMedications((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add Drug Form */}
                    <form
                      onSubmit={handleAddMedication}
                      className="bg-[#FAF9F6] p-4 rounded-xl border border-[#DCE6E1] space-y-3"
                    >
                      <span className="text-xs font-bold text-[#133840] block">
                        Add New Prescription Item
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          value={newMedName}
                          onChange={(e) => setNewMedName(e.target.value)}
                          placeholder="Drug Name (e.g. Paracetamol)"
                          className="bg-white border border-[#DFE7E4] rounded-lg px-3 py-1.5 text-xs text-[#133840] focus:outline-none focus:border-teal-600"
                        />
                        <input
                          type="text"
                          value={newMedDosage}
                          onChange={(e) => setNewMedDosage(e.target.value)}
                          placeholder="Dosage (e.g. 650 mg)"
                          className="bg-white border border-[#DFE7E4] rounded-lg px-3 py-1.5 text-xs text-[#133840] focus:outline-none focus:border-teal-600"
                        />
                        <input
                          type="text"
                          value={newMedFreq}
                          onChange={(e) => setNewMedFreq(e.target.value)}
                          placeholder="Frequency (e.g. SOS / As needed)"
                          className="bg-white border border-[#DFE7E4] rounded-lg px-3 py-1.5 text-xs text-[#133840] focus:outline-none focus:border-teal-600"
                        />
                        <input
                          type="text"
                          value={newMedDuration}
                          onChange={(e) => setNewMedDuration(e.target.value)}
                          placeholder="Duration (e.g. 5 Days)"
                          className="bg-white border border-[#DFE7E4] rounded-lg px-3 py-1.5 text-xs text-[#133840] focus:outline-none focus:border-teal-600"
                        />
                      </div>

                      <button
                        type="submit"
                        className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus size={14} />
                        <span>Add Drug to Prescription</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Audit Log Footer */}
        <section className="mt-8 bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-3">
          <h4 className="font-serif font-bold text-sm text-[#133840] flex items-center gap-2">
            <ShieldCheck size={16} className="text-teal-700" />
            Clinician Session Access Audit Trail
          </h4>
          <div className="space-y-1.5 text-xs">
            {auditLogs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-[#FAF9F6] border border-[#E9EFEA]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#607582]">{log.timestamp}</span>
                  <span className="font-medium text-[#133840]">{log.action}</span>
                </div>
                <span className="text-[10px] text-[#8CA09A]">{log.practitioner}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Contraindication Alert Modal */}
      {allergyWarning && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-rose-300 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-rose-950">
                  Critical Contraindication Alert
                </h3>
                <p className="text-xs text-rose-900 mt-1 leading-relaxed">{allergyWarning}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAllergyWarning(null)}
                className="bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                Acknowledge & Cancel Drug
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Emergency Break-Glass Modal Dialog */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border-2 border-rose-400 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                  <AlertTriangle size={22} className="text-rose-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold font-mono tracking-wider uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                      HLTH-01 Protocol 4
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">5-Min TTL</span>
                  </div>
                  <h3 className="text-base font-serif font-bold text-rose-950 mt-0.5">
                    Emergency Break-Glass Override
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakGlassModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Warning Callout */}
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-rose-950">
                <Lock size={13} />
                <span>Statutory Emergency Override Warning</span>
              </p>
              <p className="text-[11px] leading-relaxed text-rose-800">
                You are initiating an unprompted override of patient consent. This declaration generates an
                <strong> immutable, tamper-evident audit log</strong> bound to your clinician identity
                (<strong>Dr. Alex Morgan, MD #MH-MED-84920</strong>) and grants temporary 5-minute read access.
              </p>
            </div>

            <form onSubmit={handleExecuteBreakGlass} className="space-y-4 text-xs">
              {/* Emergency Reason Code Dropdown */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#133840] block">
                  Emergency Medical Indication <span className="text-rose-600">*</span>
                </label>
                <select
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value as EmergencyReasonCode)}
                  className="w-full bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl px-3 py-2 text-xs text-[#133840] font-medium focus:outline-none focus:border-rose-600"
                >
                  <option value="ACUTE_CARDIOVASCULAR_COLLAPSE">Cardiac Arrest / Acute Cardiovascular Collapse</option>
                  <option value="UNRESPONSIVE_TRAUMA">Trauma / Unconscious Patient</option>
                  <option value="RESPIRATORY_ARREST">Acute Respiratory Failure / Arrest</option>
                  <option value="ACUTE_NEUROLOGICAL_DEFICIT">Unresponsive / Comatose / Neurological Deficit</option>
                  <option value="IMMINENT_THREAT_TO_LIFE">Mass Casualty / Imminent Threat to Life</option>
                  <option value="SEVERE_SEPSIS_SHOCK">Severe Sepsis Shock</option>
                  <option value="ANAPHYLAXIS">Severe Anaphylaxis / Airway Compromise</option>
                </select>
              </div>

              {/* Clinical Justification (enforcing min 10 chars) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-[#133840]">
                    Clinical Justification <span className="text-rose-600">*</span>
                  </label>
                  <span
                    className={`text-[10px] font-mono ${
                      breakGlassJustification.trim().length >= 10
                        ? 'text-emerald-700 font-bold'
                        : 'text-amber-700 font-medium'
                    }`}
                  >
                    {breakGlassJustification.trim().length} / 10 characters minimum
                  </span>
                </div>
                <textarea
                  value={breakGlassJustification}
                  onChange={(e) => setBreakGlassJustification(e.target.value)}
                  placeholder="Detail the patient presentation, acuity, and justification for bypassing normal consent..."
                  rows={3}
                  className="w-full bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl p-3 text-xs text-[#133840] focus:outline-none focus:border-rose-600 resize-none font-sans"
                />
              </div>

              {/* Explicit Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
                <input
                  type="checkbox"
                  checked={breakGlassConfirmed}
                  onChange={(e) => setBreakGlassConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-[11px] text-amber-950 leading-relaxed font-medium">
                  I certify under penalty of professional license revocation that the patient is unable to provide consent,
                  and immediate access is essential to preserve life or prevent irreversible neurological harm.
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBreakGlassModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingBreakGlass ||
                    breakGlassJustification.trim().length < 10 ||
                    !breakGlassConfirmed
                  }
                  className="bg-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <AlertTriangle size={14} />
                  <span>
                    {isSubmittingBreakGlass ? 'Authorizing...' : 'Execute Break-Glass (5-Min TTL)'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
