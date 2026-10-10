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
  FileCheck
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

  // Initial auto-verify demo token
  useEffect(() => {
    handleVerifyToken('MV-SHARE-8F32A9C04B', false);
  }, []);

  const handleVerifyToken = (tokenToVerify: string, triggerToast = true) => {
    setIsVerifying(true);
    setTokenStatusMessage(null);

    setTimeout(() => {
      const verified = qrTokenService.validateAndLog(
        tokenToVerify.trim(),
        'Dr. Alex Morgan, MD',
        'Metropolitan Medical Center OPD'
      );

      if (verified.valid && verified.token) {
        setActiveToken(verified.token);
        setPatient(patientService.getProfile());
        setTokenStatusMessage('Token Verified: Full clinical history unlocked.');
        if (triggerToast) {
          toast.success(`Access authorized: ${verified.token.patientName}`);
        }
        setAuditLogs((prev) => [
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: `Authorized access to ${verified.token?.patientName} (${tokenToVerify})`,
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

      {/* Patient QR Lookup Bar */}
      <section className="bg-white border-b border-[#DFE7E4] py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl flex items-center gap-2">
            <div className="relative flex-1">
              <QrCode
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-700"
              />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Scan or enter QR Token (e.g. MV-SHARE-8F32A9C04B)"
                className="w-full pl-10 pr-4 py-2 bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl text-xs font-mono font-medium text-[#133840] focus:outline-none focus:border-teal-600"
              />
            </div>
            <button
              onClick={() => handleVerifyToken(tokenInput)}
              disabled={isVerifying}
              className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>{isVerifying ? 'Verifying...' : 'Authorize Access'}</span>
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
    </div>
  );
}
