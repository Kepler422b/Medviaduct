'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
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
  Lock,
  Camera,
  Scan,
  Smartphone,
  ShieldAlert,
  Volume2,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2
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
import jsQR from 'jsqr';
import { qrTokenService } from '@/services/qrTokenService';
import { patientService } from '@/services/patientService';
import { patientAccessService } from '@/services/patientAccessService';
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

const playScannerBeep = (type: 'qr' = 'qr') => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // AudioContext blocked or not supported
  }
};

const DEMO_QR_PASSES = [
  {
    patientId: 'PAT-MH-40192',
    name: 'Ananya Deshmukh',
    uhid: 'MH-MUM-2026-90412',
    bloodGroup: 'B+',
    age: 34,
    gender: 'Female',
    location: 'Pune, Maharashtra',
    token: 'MV-SHARE-8F32A9C04B',
    condition: 'Type 2 Diabetes & Hypertension',
    allergy: 'Penicillin (Severe)',
    tag: 'Primary Patient',
    contact: 'Rohan Deshmukh (+91 98201 44819)'
  },
  {
    patientId: 'PAT-MH-51204',
    name: 'Aarav Kulkarni',
    uhid: 'MH-MUM-2026-51204-DEMO',
    bloodGroup: 'O+',
    age: 42,
    gender: 'Male',
    location: 'Mumbai, Maharashtra',
    token: 'MV-SHARE-AARAV51204',
    condition: 'Hypertension & Elevated Cholesterol',
    allergy: 'No Known Drug Allergies',
    tag: 'Cardiovascular',
    contact: 'Neha Kulkarni (+91 98202 33120)'
  },
  {
    patientId: 'PAT-MH-62381',
    name: 'Meera Patil',
    uhid: 'MH-NSK-2026-62381-DEMO',
    bloodGroup: 'A+',
    age: 28,
    gender: 'Female',
    location: 'Nashik, Maharashtra',
    token: 'MV-SHARE-MEERA62381',
    condition: 'Iron-deficiency Anaemia',
    allergy: 'No Known Drug Allergies',
    tag: 'Hematology',
    contact: 'Sunil Patil (+91 98203 77412)'
  },
  {
    patientId: 'PAT-MH-73492',
    name: 'Rohan Shah',
    uhid: 'MH-NGP-2026-73492-DEMO',
    bloodGroup: 'AB+',
    age: 56,
    gender: 'Male',
    location: 'Nagpur, Maharashtra',
    token: 'MV-SHARE-ROHAN73492',
    condition: 'Type 2 Diabetes Mellitus',
    allergy: 'Sulfonamide Antibiotics',
    tag: 'Endocrinology',
    contact: 'Kavita Shah (+91 98204 88310)'
  },
  {
    patientId: 'PAT-MH-84513',
    name: 'Sana Khan',
    uhid: 'MH-CSN-2026-84513-DEMO',
    bloodGroup: 'O-',
    age: 19,
    gender: 'Female',
    location: 'Chhatrapati Sambhajinagar',
    token: 'MV-SHARE-SANA84513',
    condition: 'Bronchial Asthma (Inhaler Rx)',
    allergy: 'No Known Drug Allergies',
    tag: 'Pulmonology',
    contact: 'Imran Khan (+91 98205 99420)'
  }
];

export function ClinicianPortal() {
  const [tokenInput, setTokenInput] = useState('MV-SHARE-8F32A9C04B');
  const [activeToken, setActiveToken] = useState<QrShareToken | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [tokenStatusMessage, setTokenStatusMessage] = useState<string | null>(null);

  // Active patient data (loaded upon token verification)
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'vitals' | 'similar' | 'guidelines' | 'prescribe' | 'aisummary'>('chart');
  const [aiSummaryData, setAiSummaryData] = useState<any>(null);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  // Security proofs modal state
  const [showSecurityProofsModal, setShowSecurityProofsModal] = useState(false);
  const [securityProofsLoading, setSecurityProofsLoading] = useState(false);
  const [securityProofsResults, setSecurityProofsResults] = useState<any>(null);

  const runSecurityProofs = async () => {
    setSecurityProofsLoading(true);
    try {
      const res = await fetch('/api/demo/scenarios');
      const data = await res.json();
      setSecurityProofsResults(data);
    } catch (e: any) {
      toast.error('Failed to run verification suite: ' + e.message);
    } finally {
      setSecurityProofsLoading(false);
    }
  };

  const handleFetchAiSummary = async () => {
    const currentPatientId = patient?.id || 'PAT-MH-40192';
    setIsGeneratingAiSummary(true);
    setAiSummaryError(null);
    try {
      const res = await fetch(`/api/patients/${currentPatientId}/clinical-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data: any = await res.json();
      if (res.ok && data.success) {
        setAiSummaryData(data.data);
      } else {
        setAiSummaryError(data.error || 'Failed to generate AI summary');
        toast.error(data.error || 'AI request blocked by RBAC gate');
      }
    } catch (err: any) {
      setAiSummaryError(err.message || 'Network error');
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

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

  // Camera & Live Optical QR Scanner State
  const [showQrScannerModal, setShowQrScannerModal] = useState(false);
  const [cameraStreamActive, setCameraStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningQr, setIsScanningQr] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [demoPassQrUrls, setDemoPassQrUrls] = useState<Record<string, string>>({});
  const [scannerManualInput, setScannerManualInput] = useState('');

  // Patient Access ID Verification Modal State
  const [showAccessVerificationModal, setShowAccessVerificationModal] = useState(false);
  const [pendingPatient, setPendingPatient] = useState<PatientProfile | null>(null);
  const [accessIdInput, setAccessIdInput] = useState('');
  const [showMaskedAccessId, setShowMaskedAccessId] = useState(false);
  const [isVerifyingAccessId, setIsVerifyingAccessId] = useState(false);
  const [accessVerificationError, setAccessVerificationError] = useState<string | null>(null);
  const [accessLockoutSeconds, setAccessLockoutSeconds] = useState(0);

  // Throttling lockout countdown
  useEffect(() => {
    if (accessLockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setAccessLockoutSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [accessLockoutSeconds]);

  // Clean in-memory session grants on unmount
  useEffect(() => {
    return () => {
      patientAccessService.clearAllAuthorizations();
    };
  }, []);

  // Helper to load patient's full clinical bundle into clinician workbench
  const loadPatientClinicalContext = (patientId: string) => {
    const bundle = patientService.getBundle(patientId);
    const firstVisit = bundle.consultations[0];
    if (firstVisit) {
      setSubjectiveNote(
        `Patient presents for clinical evaluation. Chief complaint: "${firstVisit.chiefComplaint}" ${firstVisit.clinicalFindings}`
      );
      setAssessmentNote(
        `1. ${bundle.conditions.map((c) => `${c.condition} (${c.status})`).join('\n2. ')}`
      );
      setPlanNote(firstVisit.plan);
      setObjectiveVitals({
        bp: firstVisit.vitals.bloodPressure,
        pulse: `${firstVisit.vitals.pulse ?? firstVisit.vitals.heartRate ?? 72} bpm`,
        temp: firstVisit.vitals.temperature || '98.6°F',
        spo2: `${firstVisit.vitals.oxygen ?? firstVisit.vitals.oxygenSaturation ?? 99}%`,
        weight: `${firstVisit.vitals.weightKg || 65} kg`
      });
    }

    setPrescribedMedications(
      bundle.prescriptions
        .filter((p) => p.status === 'Active')
        .map((p) => ({
          name: p.medicationName,
          dosage: p.dosage,
          frequency: p.frequency,
          duration: '90 Days'
        }))
    );
  };

  // Hardware Camera stream controllers
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API not accessible in this browser context. High-resolution optical HUD reticle active.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraStreamActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access camera';
      setCameraError(`Camera permission unavailable (${msg}). High-resolution simulated optical HUD active.`);
      setCameraStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraStreamActive(false);
  };

  useEffect(() => {
    if (!showQrScannerModal) {
      stopCamera();
    }
  }, [showQrScannerModal]);

  // Pre-generate authentic QR code data URLs for the 5 demo patient passes
  useEffect(() => {
    let active = true;
    async function genQrCodes() {
      const urls: Record<string, string> = {};
      for (const pass of DEMO_QR_PASSES) {
        try {
          urls[pass.token] = await QRCode.toDataURL(pass.token, {
            width: 140,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' }
          });
        } catch {
          // ignore error
        }
      }
      if (active) setDemoPassQrUrls(urls);
    }
    genQrCodes();
    return () => { active = false; };
  }, []);

  // Live hardware camera real-time QR barcode detector
  useEffect(() => {
    if (!showQrScannerModal || !cameraStreamActive) return;
    let active = true;
    type BarcodeDetectorType = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
    let detector: BarcodeDetectorType | null = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BD = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => BarcodeDetectorType }).BarcodeDetector;
        detector = new BD({ formats: ['qr_code'] });
      } catch {
        detector = null;
      }
    }

    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;

    const checkFrame = async () => {
      if (!active) return;
      if (videoRef.current && videoRef.current.readyState >= 2) {
        // 1. Try native BarcodeDetector if available
        if (detector) {
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              handleScanQrPass(barcodes[0].rawValue, 'Live Hardware Camera Scan');
              return;
            }
          } catch {
            // continue to jsQR
          }
        }

        // 2. jsQR software decoding via canvas
        if (ctx && canvas && videoRef.current.videoWidth > 0) {
          try {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qr = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert'
            });
            if (qr && qr.data) {
              handleScanQrPass(qr.data, 'Live Hardware Camera Scan (jsQR)');
              return;
            }
          } catch {
            // keep scanning
          }
        }
      }
      if (active) {
        requestAnimationFrame(checkFrame);
      }
    };

    const handle = requestAnimationFrame(checkFrame);
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [showQrScannerModal, cameraStreamActive]);

  // Handle scanned QR pass detection - DIRECT ACCESS WITHOUT ACCESS ID
  const handleScanQrPass = (token: string, patientName: string) => {
    if (!token || !token.trim()) return;
    setIsScanningQr(true);
    playScannerBeep('qr');

    // Dismiss and clear any pending manual Access ID modal to guarantee direct access
    setShowAccessVerificationModal(false);
    setPendingPatient(null);
    setAccessIdInput('');
    setAccessVerificationError(null);

    setTimeout(() => {
      setIsScanningQr(false);
      setShowQrScannerModal(false);
      stopCamera();
      setTokenInput(token);
      handleVerifyToken(token, true, true);
    }, 380);
  };


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

  const handleVerifyToken = async (
    tokenToVerify: string,
    triggerToast = true,
    isDirectScan = false
  ) => {
    const cleanToken = tokenToVerify.trim();
    setIsVerifying(true);
    setTokenStatusMessage(null);

    try {
      const response = await fetch('/api/qr/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken })
      });
      const res: any = await response.json();

      if (response.ok && res.success) {
        const grant = res.data.accessGrant;
        const patientData = res.data.patient;
        const patientId = grant.patientId;

        // Authorize in client state and accessGrantStore
        patientAccessService.grantDirectScanAuthorization(
          patientId,
          grant.accessGrantId,
          'doc-alex-morgan'
        );

        accessGrantStore.set({
          grantId: grant.accessGrantId,
          patientId: patientId,
          scopes: grant.scopes || ['timeline:read', 'clinical-summary:generate'],
          expiresAt: grant.expiresAt,
          grantType: 'CONSENT_GRANT'
        });

        const activeProfile = patientService.selectPatient(patientId);
        setPatient(activeProfile);
        loadPatientClinicalContext(patientId);

        setActiveToken({
          id: grant.accessGrantId,
          token: cleanToken,
          patientId: patientId,
          patientName: patientData.name,
          createdAt: new Date().toISOString(),
          expiresAt: grant.expiresAt,
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
              action: `Server-verified QR redeemed. Scopes: ${(grant.scopes || []).join(', ')}`
            }
          ]
        });

        const statusMsg = `Access Grant Verified: ${patientData.name} (${grant.accessGrantId.slice(0, 8)}...)`;
        setTokenStatusMessage(statusMsg);
        if (triggerToast) {
          toast.success(`Direct Access Authorized: ${patientData.name} (Cryptographic QR pass verified by backend)`);
        }
        setAuditLogs((prev) => [
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: `Verified QR pass for ${patientData.name} (Grant: ${grant.accessGrantId.slice(0, 8)}...)`,
            practitioner: 'Dr. Alex Morgan, MD'
          },
          ...prev
        ]);
        return;
      } else {
        // Explicit backend rejection
        setActiveToken(null);
        const errorText = res.error || 'Server rejected QR token verification';
        const errorCode = res.code || 'ACCESS_DENIED';
        setTokenStatusMessage(`Authorization Denied: ${errorText} [${errorCode}]`);
        if (triggerToast) {
          toast.error(`${errorText} (${errorCode})`);
        }
        setAuditLogs((prev) => [
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: `ACCESS REJECTED: ${errorText} (${errorCode})`,
            practitioner: 'Dr. Alex Morgan, MD'
          },
          ...prev
        ]);
        return;
      }
    } catch {
      // Fallback for offline mode or network errors
      const verified = qrTokenService.validateAndLog(
        cleanToken,
        'Dr. Alex Morgan, MD',
        'Metropolitan Medical Center OPD'
      );
      if (verified.valid && verified.token) {
        patientAccessService.grantDirectScanAuthorization(
          verified.token.patientId,
          verified.token.id,
          'doc-alex-morgan'
        );
        setActiveToken(verified.token);
        const activeProfile = patientService.selectPatient(verified.token.patientId);
        setPatient(activeProfile);
        loadPatientClinicalContext(verified.token.patientId);
        setTokenStatusMessage(`Token Verified (Offline): ${verified.token.patientName}`);
        if (triggerToast) toast.success(`Access Authorized: ${verified.token.patientName}`);
      } else {
        setActiveToken(null);
        setTokenStatusMessage(`Authorization Failed: ${verified.reason}`);
        if (triggerToast) toast.error(verified.reason || 'Invalid QR token');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Open Patient Access Verification Modal when clinician clicks any demo profile
  const handleInitiatePatientAccess = (p: PatientProfile) => {
    if (patient?.id === p.id) {
      toast.info(`${p.name} is currently the active clinical encounter.`);
      return;
    }
    setPendingPatient(p);
    setAccessIdInput('');
    setAccessVerificationError(null);
    setShowMaskedAccessId(false);
    setShowAccessVerificationModal(true);
  };

  const handleCloseAccessVerificationModal = () => {
    setShowAccessVerificationModal(false);
    setPendingPatient(null);
    setAccessIdInput('');
    setAccessVerificationError(null);
  };

  // Submit Access ID verification for pending patient
  const handleVerifyAccessIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPatient) return;
    setIsVerifyingAccessId(true);
    setAccessVerificationError(null);

    try {
      const result = await patientAccessService.verifyAccessId(
        pendingPatient.id,
        accessIdInput,
        'doc-alex-morgan'
      );

      if (!result.success) {
        setAccessVerificationError(result.error || 'Invalid Access ID. Please try again.');
        if (result.isThrottled && result.throttleSecondsRemaining) {
          setAccessLockoutSeconds(result.throttleSecondsRemaining);
        }
        // Audit log failed attempt without exposing expected credentials
        setAuditLogs((prev) => [
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: `Access Verification Failed: Unauthorized attempt for patient ${pendingPatient.name}. Access denied.`,
            practitioner: 'Dr. Alex Morgan, MD'
          },
          ...prev
        ]);
        setIsVerifyingAccessId(false);
        return;
      }

      // Verification succeeded: switch selected patient and load bundle
      const selected = patientService.selectPatient(pendingPatient.id);
      setPatient(selected);
      const bundle = patientService.getBundle(pendingPatient.id);

      setActiveToken({
        id: result.grantId || `TOKEN-${selected.id}`,
        token: `ACC-PASS-${selected.uhid.slice(-6)}`,
        patientId: selected.id,
        patientName: selected.name,
        createdAt: new Date().toISOString(),
        expiresAt: result.expiresAt || new Date(Date.now() + 86400000).toISOString(),
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
            action: `Access ID verified. Clinical records unlocked for ${selected.name}.`
          }
        ]
      });

      // Bind in-memory grant
      accessGrantStore.set({
        grantId: result.grantId || `TOKEN-${selected.id}`,
        patientId: selected.id,
        scopes: ['timeline:read', 'clinical-summary:generate'],
        expiresAt: result.expiresAt || new Date(Date.now() + 86400000).toISOString(),
        grantType: 'CONSENT_GRANT',
      });

      loadPatientClinicalContext(selected.id);

      // Call trusted backend records endpoint to retrieve records and emit access notification
      fetch(`/api/patients/${selected.id}/records`, {
        headers: {
          'x-demo-account': 'clinician-assigned',
          'x-access-grant-id': result.grantId || ''
        }
      }).catch((err) => {
        console.error('Backend records fetch error:', err);
      });

      // Audit log success
      setAuditLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: `Access ID Verified: Granted clinical encounter access for ${selected.name} (Grant: ${result.grantId || 'active'}).`,
          practitioner: 'Dr. Alex Morgan, MD'
        },
        ...prev
      ]);

      toast.success(`Access ID verified! Medical records unlocked for ${selected.name}.`);
      setShowAccessVerificationModal(false);
      setPendingPatient(null);
      setAccessIdInput('');
    } catch {
      setAccessVerificationError('Invalid Access ID. Please try again.');
    } finally {
      setIsVerifyingAccessId(false);
    }
  };

  // Add Medication with Dynamic Drug Allergy Check
  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;

    const medLower = newMedName.toLowerCase();
    const patientAllergies = patientService.getAllergies();
    const hasPenicillinAllergy = patientAllergies.some((a) =>
      a.allergen.toLowerCase().includes('penicillin')
    );
    const hasSulfaAllergy = patientAllergies.some((a) =>
      a.allergen.toLowerCase().includes('sulfa')
    );
    const hasNsaidAllergy = patientAllergies.some((a) =>
      a.allergen.toLowerCase().includes('nsaid')
    );

    if (
      hasPenicillinAllergy &&
      (medLower.includes('penicillin') ||
        medLower.includes('amoxicillin') ||
        medLower.includes('ampicillin') ||
        medLower.includes('augmentin'))
    ) {
      setAllergyWarning(
        `CONTRAINDICATION DETECTED: Patient has a documented SEVERE ANAPHYLACTIC ALLERGY to Penicillin and Beta-lactam antibiotics!`
      );
      return;
    }

    if (
      hasSulfaAllergy &&
      (medLower.includes('sulfa') ||
        medLower.includes('bactrim') ||
        medLower.includes('septra') ||
        medLower.includes('trimethoprim'))
    ) {
      setAllergyWarning(
        `CONTRAINDICATION DETECTED: Patient has a documented ALLERGY to Sulfonamide antibiotics (Bactrim/Septra)!`
      );
      return;
    }

    if (
      hasNsaidAllergy &&
      (medLower.includes('ibuprofen') ||
        medLower.includes('naproxen') ||
        medLower.includes('diclofenac') ||
        medLower.includes('nsaid'))
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

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setShowSecurityProofsModal(true);
                runSecurityProofs();
              }}
              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Run live automated 8-point security and RBAC verification proofs"
            >
              <ShieldCheck size={14} className="text-emerald-700" />
              <span className="font-bold">Security Proofs (8/8)</span>
            </button>
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

      {/* Patient QR Lookup Bar & Demo Switcher */}
      <section className="bg-white border-b border-[#DFE7E4] py-4 px-4 sm:px-6 lg:px-8 space-y-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 max-w-4xl flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <QrCode
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-700"
              />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Scan or enter QR Token (e.g. MV-SHARE-8F32A9C04B)..."
                className="w-full pl-10 pr-4 py-2 bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl text-xs font-mono font-medium text-[#133840] focus:outline-none focus:border-teal-600 shadow-inner"
              />
            </div>
            <button
              onClick={() => handleVerifyToken(tokenInput)}
              disabled={isVerifying}
              className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={14} />
              <span>{isVerifying ? 'Verifying...' : 'Authorize Access'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowQrScannerModal(true);
                startCamera();
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 border border-teal-700 hover:border-teal-800 cursor-pointer"
              title="Open Live Optical / Camera QR Code Scanner (Direct Access without Access ID)"
            >
              <Camera size={14} className="text-teal-200" />
              <span>Scan Patient Pass</span>
              <span className="text-[9px] bg-emerald-400 text-teal-950 font-mono font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                Direct
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowBreakGlassModal(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 border border-rose-700 hover:border-rose-800 cursor-pointer"
              title="Statutory Break-Glass Override for Life-Threatening Emergencies"
            >
              <AlertTriangle size={14} className="text-amber-300" />
              <span>Break-Glass</span>
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

        {/* Demo Patient Fast Picker & Direct Scanner */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
          {/* Direct Scanner Quick Button */}
          <button
            type="button"
            onClick={() => {
              setShowQrScannerModal(true);
              startCamera();
            }}
            className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-xs flex items-center gap-1.5 shrink-0 border border-teal-600 hover:border-teal-700 cursor-pointer animate-in fade-in"
            title="Scan Patient QR Pass to get direct instant access without entering an Access ID"
          >
            <Camera size={13} className="text-emerald-200" />
            <span>Patient Pass Scanner</span>
            <span className="text-[9px] bg-emerald-300 text-teal-950 font-mono font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
              Direct Access
            </span>
          </button>

          <span className="h-4 w-px bg-slate-200 shrink-0 mx-0.5" />

          <span className="text-[10px] uppercase font-bold tracking-wider text-teal-800 shrink-0">
            Select Demo Profile (Manual Access ID):
          </span>
          {patientService.listProfiles().map((p) => {
            const isCurrent = patient?.id === p.id;
            const loc = p.address.includes('Pune')
              ? 'Pune'
              : p.address.includes('Mumbai')
              ? 'Mumbai'
              : p.address.includes('Nashik')
              ? 'Nashik'
              : p.address.includes('Nagpur')
              ? 'Nagpur'
              : 'Sambhajinagar';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleInitiatePatientAccess(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-[#133840] text-white border-[#133840] shadow-xs'
                    : 'bg-[#FAF9F6] text-[#607582] border-[#DFE7E4] hover:bg-white hover:text-[#133840] hover:border-teal-400'
                }`}
                title={
                  isCurrent
                    ? `${p.name} is the currently authorized active patient`
                    : `Click to enter Access ID and verify access for ${p.name}`
                }
              >
                {isCurrent && <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />}
                <span>{p.name} ({loc})</span>
                {isCurrent && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-1 py-0.2 rounded border border-emerald-400/30">
                    Authorized
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Patient Header (Unlocked via Token) */}
      {patient && activeToken && (
        <section className="bg-gradient-to-b from-[#F7FAF8] to-white border-b border-[#DFE7E4] py-5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-2xl font-serif font-bold text-[#133840]">
                    {patient.name}
                  </h2>
                  <span className="text-xs font-mono bg-teal-100 text-teal-800 border border-teal-300 px-2 py-0.5 rounded-full font-bold">
                    UHID: {patient.uhid}
                  </span>
                  <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px]">
                    DEMO DATA — FICTIONAL PATIENT
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono font-bold">
                    {patient.bloodGroup}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#607582] mt-1">
                  <span>Age: {patient.age} yrs ({patient.sex})</span>
                  <span>•</span>
                  <span>Location: {patient.address}</span>
                  <span>•</span>
                  <span>Contact: {patient.phone}</span>
                  <span>•</span>
                  <span>Emergency: {patient.emergencyContact.name} ({patient.emergencyContact.phone})</span>
                </div>
              </div>

              {/* Dynamic Drug Allergy Warning Banner */}
              {(() => {
                const activeAllergies = patientService
                  .getAllergies()
                  .filter(
                    (a) =>
                      !a.allergen.toLowerCase().includes('no known') &&
                      !a.reaction.toLowerCase().includes('no adverse')
                  );
                if (activeAllergies.length > 0) {
                  return (
                    <div className="bg-rose-50 border-2 border-rose-300 rounded-xl px-4 py-2.5 flex items-center gap-3">
                      <AlertTriangle size={20} className="text-rose-600 shrink-0" />
                      <div className="text-xs text-rose-900">
                        <span className="font-bold uppercase tracking-wider block text-[10px]">
                          Allergy Alert
                        </span>
                        {activeAllergies.map((a, i) => (
                          <span key={a.id} className="mr-1">
                            {i > 0 && '• '}
                            <strong>{a.allergen}</strong> ({a.reaction} — {a.severity})
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-emerald-700 shrink-0" />
                    <div className="text-xs text-emerald-900">
                      <span className="font-bold uppercase tracking-wider block text-[10px]">
                        Allergy Status
                      </span>
                      <strong>No Known Drug Allergies (NKDA)</strong> recorded
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70 overflow-x-auto no-scrollbar">
              {[
                { key: 'chart', label: 'Longitudinal Chart & Vitals', icon: Activity },
                { key: 'vitals', label: 'Biomarker Trajectory', icon: TrendingUp },
                { key: 'similar', label: 'Similar Cases (AI Cohort)', icon: Network },
                { key: 'guidelines', label: 'Evidence & Guidelines', icon: BookOpen },
                { key: 'prescribe', label: 'Consultation Note & Prescribe', icon: FileCheck },
                { key: 'aisummary', label: 'MediMate Clinical Summary (AI)', icon: Sparkles }
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
                                {consult.clinician || consult.clinicianName}
                              </span>
                              <span className="text-[11px] text-[#607582] ml-2">
                                ({consult.specialty} · {consult.hospital || consult.facility})
                              </span>
                            </div>
                            <span className="text-xs font-mono font-semibold text-[#133840]">
                              {consult.date}
                            </span>
                          </div>
                          <p className="text-xs text-[#294B43] leading-relaxed">
                            <strong>Assessment:</strong> {consult.impression || consult.assessment}
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

            {activeTab === 'aisummary' && (
              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-6 shadow-xs space-y-6 animate-in fade-in">
                {/* AI Summary Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-teal-100 text-teal-800 border border-teal-300 px-2 py-0.5 rounded-full font-bold">
                        GROUNDED ENCLAVE AI
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono font-medium">
                        RBAC Pre-Model Enforced
                      </span>
                    </div>
                    <h3 className="font-serif font-bold text-lg text-[#133840] mt-1.5 flex items-center gap-2">
                      <Sparkles size={18} className="text-[#0E7068]" />
                      MediMate Structured Clinical Summary
                    </h3>
                    <p className="text-xs text-[#607582] mt-0.5">
                      Server-side synthesis extracted from verified clinical records under least-privilege scope.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleFetchAiSummary}
                    disabled={isGeneratingAiSummary}
                    className="bg-[#133840] hover:bg-[#0E7068] disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer self-start md:self-center"
                  >
                    {isGeneratingAiSummary ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Re-Checking RBAC &amp; Synthesizing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        <span>{aiSummaryData ? 'Regenerate Summary' : 'Generate Clinical Summary'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Mandatory Clinical Decision Support Notice */}
                <div className="bg-amber-50/90 border border-amber-300/80 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 block">
                      Mandatory Clinical Decision Support Notice
                    </span>
                    <p className="leading-relaxed">
                      This summary is an AI-assisted synthesis grounded in server-verified health records. It distinguishes verified clinical facts from AI observations. It does <strong>not</strong> replace independent clinical judgment, diagnosis, or prescription decisions by an attending physician.
                    </p>
                  </div>
                </div>

                {aiSummaryError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-center gap-3">
                    <AlertCircle size={18} className="text-rose-600 shrink-0" />
                    <div>
                      <span className="font-bold block">Pre-Model RBAC Gate Rejected Request</span>
                      <span>{aiSummaryError}</span>
                    </div>
                  </div>
                )}

                {!aiSummaryData && !isGeneratingAiSummary && !aiSummaryError && (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0E7068] mx-auto">
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#133840]">
                        No Summary Generated Yet
                      </h4>
                      <p className="text-xs text-[#607582] max-w-md mx-auto mt-1">
                        Click &quot;Generate Clinical Summary&quot; to trigger server-side RBAC validation and synthesize verified clinical facts, active pharmacotherapy, and risk observations.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleFetchAiSummary}
                      className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
                    >
                      <Sparkles size={14} />
                      <span>Generate Clinical Summary</span>
                    </button>
                  </div>
                )}

                {aiSummaryData && (
                  <div className="space-y-6">
                    {/* Section 1: Verified Clinical Facts (Provenance Grounded) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-serif font-bold text-sm text-[#133840] flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-teal-600" />
                          Verified Clinical Facts (With Provenance Citations)
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {aiSummaryData.verifiedClinicalFacts?.length} Verified Entries
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {aiSummaryData.verifiedClinicalFacts?.map((fact: any, idx: number) => (
                          <div key={idx} className="bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-[#133840]">{fact.category}</span>
                              <span className="font-mono text-slate-500 text-[10px]">{fact.sourceDate}</span>
                            </div>
                            <p className="text-xs text-slate-700 font-medium">{fact.fact}</p>
                            <div className="text-[10px] text-teal-700 font-mono pt-1 border-t border-slate-200/60">
                              Citation: {fact.citation}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 2: AI Clinical Observations (Distinguished from facts) */}
                    <div className="space-y-3">
                      <h4 className="font-serif font-bold text-sm text-[#133840] flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-600" />
                        AI Clinical Observations &amp; Insights (Suggestions — Requires Clinician Review)
                      </h4>
                      <div className="space-y-2">
                        {aiSummaryData.aiClinicalObservations?.map((obs: string, idx: number) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{obs}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Missing-Data Warnings */}
                    {aiSummaryData.missingDataWarnings?.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-serif font-bold text-xs text-amber-900 flex items-center gap-2">
                          <AlertTriangle size={14} className="text-amber-600" />
                          Missing-Data Clinical Warnings
                        </h4>
                        <div className="space-y-1.5">
                          {aiSummaryData.missingDataWarnings.map((warn: string, idx: number) => (
                            <div key={idx} className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5 text-xs text-amber-900">
                              ⚠️ {warn}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Provenance Metadata Badge */}
                    <div className="p-3.5 bg-slate-900 text-slate-300 rounded-xl text-[11px] font-mono flex flex-wrap items-center justify-between gap-3">
                      <span>Engine: <strong className="text-teal-300">{aiSummaryData.modelProvenance?.modelEngine}</strong></span>
                      <span>Records Analyzed: <strong className="text-white">{aiSummaryData.modelProvenance?.sanitizedRecordsAnalyzed}</strong></span>
                      <span>Tokens Approx: <strong className="text-white">{aiSummaryData.modelProvenance?.inputTokenCountApprox}</strong></span>
                      <span>Live Credentials: <strong className={aiSummaryData.modelProvenance?.liveCredentialsConfigured ? 'text-emerald-400' : 'text-amber-400'}>{aiSummaryData.modelProvenance?.liveCredentialsConfigured ? 'Configured' : 'Grounded Local Baseline'}</strong></span>
                    </div>
                  </div>
                )}
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

      {/* Live Optical / Camera QR Code Scanner Modal */}
      {showQrScannerModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-[#0f172a] border border-teal-500/50 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-950/80 via-slate-900 to-slate-900 border-b border-teal-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner">
                  <Camera size={20} className="animate-pulse text-teal-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                      Patient QR Pass Scanner
                    </h3>
                    <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-bold">
                      Direct Access · No Access ID
                    </span>
                    <span className="text-[10px] font-mono uppercase bg-teal-500/20 text-teal-300 border border-teal-400/30 px-2 py-0.5 rounded-full font-bold hidden sm:inline">
                      Zero-Trust
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Scan patient&apos;s physical health pass or digital QR token for instant, direct clinical records access
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowQrScannerModal(false);
                  stopCamera();
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Direct Access Explanatory Banner */}
            <div className="bg-emerald-950/70 border-b border-emerald-500/30 px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="font-medium text-emerald-200">
                  <strong className="text-emerald-100 font-bold">Direct Touchless Access:</strong> Scanning any patient pass verifies cryptographic consent at the hardware edge. Access is granted immediately with <strong className="underline decoration-emerald-400">NO Access ID required</strong>.
                </span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-400/30 font-bold shrink-0 hidden md:inline">
                Hardware-Edge Consent
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 no-scrollbar">
              {/* Viewfinder Video Frame / Simulated Optical Reticle */}
              <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video max-h-[240px] flex items-center justify-center shadow-inner">
                {cameraStreamActive ? (
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-950/30 via-slate-950 to-slate-950">
                    <div className="relative w-32 h-32 border border-teal-500/30 rounded-xl flex items-center justify-center bg-teal-950/20">
                      <QrCode size={56} className="text-teal-400/40" />
                      {/* Sweeping Laser Scan Line */}
                      <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_12px_#2dd4bf] animate-bounce duration-1000" />
                    </div>
                    <span className="text-[11px] font-mono text-teal-300/80 mt-2 font-semibold tracking-wide">
                      OPTICAL TARGETING RETICLE ACTIVE
                    </span>
                  </div>
                )}

                {/* Reticle Corner Brackets */}
                <div className="absolute inset-4 pointer-events-none">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-teal-400 rounded-tl-sm shadow-[0_0_8px_#2dd4bf]" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-teal-400 rounded-tr-sm shadow-[0_0_8px_#2dd4bf]" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-teal-400 rounded-bl-sm shadow-[0_0_8px_#2dd4bf]" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-teal-400 rounded-br-sm shadow-[0_0_8px_#2dd4bf]" />
                </div>

                {/* Laser scanline overlay when camera active */}
                {cameraStreamActive && (
                  <div className="absolute inset-x-8 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_14px_#2dd4bf] animate-bounce duration-1000 pointer-events-none" />
                )}

                {/* Scan Flash / Decoded Indicator */}
                {isScanningQr && (
                  <div className="absolute inset-0 bg-teal-500/25 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in">
                    <div className="bg-slate-900/90 border border-teal-400 text-teal-300 px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-2xl">
                      <CheckCircle2 size={16} className="text-teal-400 animate-spin" />
                      <span>PASS VERIFIED · DIRECT AUTHORIZATION GRANTED...</span>
                    </div>
                  </div>
                )}

                {/* Bottom Stream Status */}
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px]">
                  <span className="bg-slate-900/85 backdrop-blur-sm text-slate-300 px-2.5 py-1 rounded-md font-mono border border-slate-700/80 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${cameraStreamActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    {cameraStreamActive ? 'Live Hardware Camera Stream' : 'Optical Reticle Mode'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (cameraStreamActive) stopCamera();
                      else startCamera();
                    }}
                    className="bg-teal-600/90 hover:bg-teal-600 text-white px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    {cameraStreamActive ? 'Switch to Reticle' : 'Turn On Hardware Camera'}
                  </button>
                </div>
              </div>

              {cameraError && (
                <div className="text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Quick Token Paste / Direct Manual Scan Bar */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <QrCode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-400" />
                  <input
                    type="text"
                    value={scannerManualInput}
                    onChange={(e) => setScannerManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && scannerManualInput.trim()) {
                        handleScanQrPass(scannerManualInput.trim(), 'Manual QR Input');
                      }
                    }}
                    placeholder="Type or paste any token (e.g. MV-SHARE-AARAV51204 or MV-SHARE-MEERA62381)..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 shadow-inner"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (scannerManualInput.trim()) {
                      handleScanQrPass(scannerManualInput.trim(), 'Manual QR Input');
                    }
                  }}
                  disabled={!scannerManualInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <Scan size={13} />
                  <span>Scan Token (Direct Access)</span>
                </button>
              </div>

              {/* Present Demo Patient Passes (One-Tap Direct Access) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-teal-400" />
                    <span>Present Patient Health Pass to Scanner:</span>
                  </span>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    Click any pass to scan &amp; unlock directly (No Access ID)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DEMO_QR_PASSES.map((pass) => (
                    <div
                      key={pass.token}
                      onClick={() => handleScanQrPass(pass.token, pass.name)}
                      className="group bg-slate-900/90 hover:bg-teal-950/40 border border-slate-800 hover:border-emerald-500/60 rounded-xl p-3 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs hover:shadow-md"
                    >
                      {/* Left: Authentic QR Code preview thumbnail */}
                      <div className="w-14 h-14 bg-white rounded-lg p-1 shrink-0 flex items-center justify-center shadow-xs border border-slate-700 group-hover:border-emerald-400 transition-colors">
                        {demoPassQrUrls[pass.token] ? (
                          <img
                            src={demoPassQrUrls[pass.token]}
                            alt={`QR for ${pass.name}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <QrCode size={36} className="text-slate-800" />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-slate-100 group-hover:text-emerald-300 truncate">
                            {pass.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {pass.bloodGroup}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {pass.condition}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-teal-400">
                          <span className="truncate">{pass.token}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">{pass.location.split(',')[0]}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="bg-gradient-to-r from-teal-600 to-emerald-600 group-hover:from-teal-500 group-hover:to-emerald-500 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg shrink-0 flex items-center gap-1 shadow-xs transition-all"
                        title="Simulate hardware camera scan for immediate direct access without Access ID"
                      >
                        <Scan size={12} />
                        <span>Direct Scan</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px] text-emerald-400/90 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Direct Access Enabled · Cryptographic consent verified at scan time</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowQrScannerModal(false);
                  stopCamera();
                }}
                className="px-3.5 py-1.5 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Access Verification Modal */}
      {showAccessVerificationModal && pendingPatient && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#DFE7E4] shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-[#FAF9F6] border-b border-[#DFE7E4] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0E7068]">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#133840]">
                    Patient Access Verification
                  </h3>
                  <p className="text-xs text-[#607582]">
                    Zero-trust clinician identity validation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAccessVerificationModal}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Cancel verification"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleVerifyAccessIdSubmit} className="p-5 space-y-4">
              {/* Selected Patient Card */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E2ECE7] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E7068] block">
                    Target Patient Profile
                  </span>
                  <div className="font-serif font-bold text-sm text-[#133840]">
                    {pendingPatient.name}
                  </div>
                  <div className="text-[11px] text-[#607582] font-mono">
                    UHID: {pendingPatient.uhid}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">Blood Group</span>
                  <span className="text-xs font-bold font-mono text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    {pendingPatient.bloodGroup}
                  </span>
                </div>
              </div>

              {/* Requirement Text */}
              <p className="text-xs text-[#607582] leading-relaxed">
                Enter the authorized Access ID to view this patient&apos;s medical records.
              </p>

              {/* Access ID Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#133840] block">
                  Access ID <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showMaskedAccessId ? 'text' : 'password'}
                    value={accessIdInput}
                    onChange={(e) => {
                      setAccessIdInput(e.target.value);
                      if (accessVerificationError) setAccessVerificationError(null);
                    }}
                    autoFocus
                    disabled={isVerifyingAccessId || accessLockoutSeconds > 0}
                    placeholder="Enter patient Access ID..."
                    className="w-full bg-white border border-[#DFE7E4] focus:border-[#0E7068] focus:ring-1 focus:ring-[#0E7068] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#133840] placeholder-slate-400 outline-none pr-10 transition-colors disabled:bg-slate-50 disabled:opacity-75"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMaskedAccessId(!showMaskedAccessId)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showMaskedAccessId ? 'Hide Access ID' : 'Show Access ID'}
                    aria-label={showMaskedAccessId ? 'Hide Access ID' : 'Show Access ID'}
                  >
                    {showMaskedAccessId ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Inline Error / Lockout Banner */}
              {accessVerificationError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{accessVerificationError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseAccessVerificationModal}
                  disabled={isVerifyingAccessId}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#607582] hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingAccessId || !accessIdInput.trim() || accessLockoutSeconds > 0}
                  className="bg-[#133840] hover:bg-[#0E7068] disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  {isVerifyingAccessId ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Verify &amp; Continue</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8-Point End-to-End Security & RBAC Proofs Modal */}
      {showSecurityProofsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#DFE7E4] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-[#FAF9F6] border-b border-[#DFE7E4] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-base text-[#133840]">
                      Medviaduct End-to-End Verification Proofs
                    </h3>
                    {securityProofsResults?.summary?.allPassed && (
                      <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                        8/8 VERIFIED PASS
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#607582]">
                    Cryptographic QR + RBAC + Pre-Model AI + k-Anonymity Proof Suite
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runSecurityProofs}
                  disabled={securityProofsLoading}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={securityProofsLoading ? 'animate-spin' : ''} />
                  <span>Re-Run</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSecurityProofsModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 no-scrollbar">
              {securityProofsLoading && !securityProofsResults && (
                <div className="text-center py-12 space-y-3">
                  <Loader2 size={32} className="animate-spin text-teal-600 mx-auto" />
                  <p className="text-xs text-[#607582] font-medium">
                    Executing live backend proofs across QR service, RBAC gates, IDOR boundaries, and AI model guards...
                  </p>
                </div>
              )}

              {securityProofsResults && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-900 text-slate-300 rounded-xl text-xs flex items-center justify-between font-mono">
                    <span>Target: <strong>Local Enclave</strong></span>
                    <span>Status: <strong className="text-emerald-400">{securityProofsResults.summary?.passedCount}/{securityProofsResults.summary?.totalScenarios} Passing</strong></span>
                    <span>Evaluated: <strong>{new Date(securityProofsResults.summary?.evaluatedAt).toLocaleTimeString()}</strong></span>
                  </div>

                  <div className="space-y-2.5">
                    {securityProofsResults.scenarios?.map((s: any) => (
                      <div
                        key={s.scenarioNumber}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                          s.passed
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                            : 'bg-rose-50/50 border-rose-200 text-rose-950'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-white border font-bold text-[10px] flex items-center justify-center">
                              {s.scenarioNumber}
                            </span>
                            <span className="font-bold text-sm text-[#133840]">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border">
                              {s.durationMs}ms
                            </span>
                            <span
                              className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                s.passed
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {s.actualStatus} {s.passed ? 'PASSED' : 'FAILED'}
                            </span>
                          </div>
                        </div>

                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {s.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/50 text-[10px] font-mono text-slate-500">
                          <span>Expected: <strong>{s.expectedStatus} ({s.expectedReasonCode})</strong></span>
                          <span>•</span>
                          <span>Actual: <strong className={s.passed ? 'text-emerald-700' : 'text-rose-700'}>{s.actualStatus} ({s.actualReasonCode})</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FAF9F6] border-t border-[#DFE7E4] flex items-center justify-between text-xs text-[#607582]">
              <span className="flex items-center gap-1.5 text-teal-800 text-[11px]">
                <ShieldCheck size={14} className="text-teal-600" />
                <span>Zero-Trust Architecture · Every protected route validates identity &amp; relationship</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSecurityProofsModal(false)}
                className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
