'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from '@/components/link';
import QRCode from 'qrcode';
import {
  UserRound,
  ShieldCheck,
  AlertTriangle,
  Pill,
  FileText,
  Calendar,
  Activity,
  QrCode,
  Sparkles,
  Search,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  ChevronRight,
  Plus,
  RefreshCw,
  LogOut,
  Hospital,
  HeartPulse,
  Share2,
  FilePlus2,
  ExternalLink,
  Lock,
  ChevronDown,
  X,
  Camera,
  Scan,
  Smartphone,
  Radio,
  Volume2,
  ShieldAlert,
  PhoneCall,
  Wifi,
  Battery,
  CreditCard,
  Check,
  Loader2
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { patientService } from '@/services/patientService';
import { qrTokenService, type ExpirationDuration } from '@/services/qrTokenService';
import {
  securityService,
  type AvailableClinician,
  type ConsentDto,
} from '@/services/securityService';
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
} from '@/data/patientData';
import { MediMateChat } from './medimate-chat';

type TabKey =
  | 'overview'
  | 'conditions'
  | 'prescriptions'
  | 'consultations'
  | 'labs'
  | 'documents'
  | 'qr-pass';

interface PatientScanTarget {
  id: string;
  type: 'clinic' | 'medication' | 'lab';
  title: string;
  subtitle: string;
  code: string;
  tag: string;
  details: string;
}

const PRESET_PATIENT_SCAN_TARGETS: PatientScanTarget[] = [
  {
    id: 'target-clinic-morgan',
    type: 'clinic',
    title: 'Dr. Alex Morgan — OPD Consultation Desk #4',
    subtitle: 'Metropolitan Medical Center, OPD Block B',
    code: 'CLINIC-DESK:METRO-MMC:DOC-MORGAN',
    tag: 'Hospital Registration',
    details: 'Grant 24-hour consultation access to Dr. Alex Morgan for upcoming appointment.'
  },
  {
    id: 'target-med-metformin',
    type: 'medication',
    title: 'Metformin Hydrochloride 500mg (Extended Release)',
    subtitle: 'Scan medicine strip barcode to verify prescription & dosage schedule',
    code: 'BARCODE:MED-890104300182',
    tag: 'Medication Strip',
    details: 'Active prescription: 500 mg, Twice daily with meals. No adverse drug interactions.'
  },
  {
    id: 'target-med-telmisartan',
    type: 'medication',
    title: 'Telmisartan 40mg Strip',
    subtitle: 'Blood pressure control verification',
    code: 'BARCODE:MED-890104300941',
    tag: 'Medication Strip',
    details: 'Active prescription: 40 mg, Once daily in morning. Target BP < 130/80.'
  },
  {
    id: 'target-lab-cbc',
    type: 'lab',
    title: 'Metro Central Diagnostic Lab — CBC Platelet Panel',
    subtitle: 'Automated Hematology Investigation Report QR',
    code: 'LAB-QR:METRO-PATH:CBC-2026-92',
    tag: 'Diagnostic Lab',
    details: 'Verified Platelet Count: 184,000 /µL (Normal). Full recovery documented.'
  }
];

const playPatientScannerBeep = (type: 'scan' | 'success' | 'nfc') => {
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

    if (type === 'scan') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.09);
    } else if (type === 'nfc') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext blocked
  }
};

export function PatientPortal() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [profile, setProfile] = useState<PatientProfile>(initialPatientProfile);
  const [allergies, setAllergies] = useState<Allergy[]>(initialAllergies);
  const [conditions, setConditions] = useState<ChronicCondition[]>(initialConditions);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialPrescriptions);
  const [consultations, setConsultations] = useState<ConsultationVisit[]>(initialConsultations);
  const [labs, setLabs] = useState<LabResult[]>(initialLabResults);
  const [imaging, setImaging] = useState<ImagingReport[]>(initialImagingReports);
  const [documents, setDocuments] = useState<MedicalDocument[]>(initialDocuments);
  const [qrTokens, setQrTokens] = useState<QrShareToken[]>(initialQrTokens);
  const [isMounted, setIsMounted] = useState(false);
  const [refillLoadingMap, setRefillLoadingMap] = useState<Record<string, boolean>>({});
  const [refillStatusMap, setRefillStatusMap] = useState<
    Record<string, { status: 'submitting' | 'submitted' | 'pending'; requestId: string }>
  >({});

  // Sync persisted refill requests from trusted backend when viewing prescriptions tab
  useEffect(() => {
    if (activeTab === 'prescriptions') {
      const demoAccount = profile.id === 'PAT-MH-51204' ? 'patient-b' : 'patient-a';
      fetch('/api/refill-requests', {
        headers: { 'x-demo-account': demoAccount }
      })
        .then((res) => res.json())
        .then((data: any) => {
          if (data.success && Array.isArray(data.data)) {
            const statusObj: Record<
              string,
              { status: 'submitting' | 'submitted' | 'pending'; requestId: string }
            > = {};
            data.data.forEach((r: any) => {
              if (r.status === 'PENDING_REVIEW') {
                statusObj[r.prescriptionId] = { status: 'submitted', requestId: r.requestId };
              }
            });
            setRefillStatusMap((prev) => ({ ...prev, ...statusObj }));
          }
        })
        .catch(() => {});
    }
  }, [activeTab, profile.id]);

  const handleRequestRefill = async (prescription: Prescription) => {
    const rxId = prescription.id;
    setRefillLoadingMap((prev) => ({ ...prev, [rxId]: true }));
    try {
      const demoAccount = profile.id === 'PAT-MH-51204' ? 'patient-b' : 'patient-a';
      const res = await fetch('/api/refill-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-account': demoAccount
        },
        body: JSON.stringify({
          prescriptionId: rxId,
          requestedQuantity: 30
        })
      });
      const data: any = await res.json();
      if (res.ok && data.success) {
        setRefillStatusMap((prev) => ({
          ...prev,
          [rxId]: { status: 'submitted', requestId: data.data?.requestId }
        }));
        // Decrement local prescription refills to reflect persisted server state
        setPrescriptions((prev) =>
          prev.map((p) =>
            p.id === rxId ? { ...p, refillsRemaining: Math.max(0, p.refillsRemaining - 1) } : p
          )
        );
        toast.success(
          `Refill request submitted for ${prescription.medicationName}! Pending pharmacy review.`
        );
      } else {
        toast.error(data.error || 'Failed to submit refill request.');
      }
    } catch {
      toast.error('Network error submitting refill request. Please retry.');
    } finally {
      setRefillLoadingMap((prev) => ({ ...prev, [rxId]: false }));
    }
  };

  const availableProfiles = patientService.listProfiles();

  const handleSwitchPatient = (patientId: string) => {
    const selected = patientService.selectPatient(patientId);
    setProfile(selected);
    setAllergies(patientService.getAllergies());
    setConditions(patientService.getConditions());
    setPrescriptions(patientService.getPrescriptions());
    setConsultations(patientService.getConsultations());
    setLabs(patientService.getLabResults());
    setImaging(patientService.getImagingReports());
    setDocuments(patientService.getDocuments());
    setQrTokens(qrTokenService.list());
    toast.success(`Active demo profile loaded: ${selected.name}`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // MediMate Assistant floating state
  const [showMediMate, setShowMediMate] = useState(false);

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState<MedicalDocument | null>(null);

  // QR Generation form state
  const [selectedDuration, setSelectedDuration] = useState<ExpirationDuration>('24_HOURS');
  const [recipientType, setRecipientType] = useState<
    'Clinician Verified' | 'Emergency Access' | 'Caregiver'
  >('Clinician Verified');
  const [recipientName, setRecipientName] = useState('Dr. Alex Morgan, MD');
  const [permittedCategories, setPermittedCategories] = useState({
    profile: true,
    consultations: true,
    medications: true,
    labResults: true,
    imaging: true,
    allergies: true,
    sensitiveNotes: false
  });
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');
  const [activeCreatedToken, setActiveCreatedToken] = useState<QrShareToken | null>(null);

  // MediVault Zero-Trust Consents & Single-Use QR State
  const [qrSubTab, setQrSubTab] = useState<'generator' | 'consents'>('generator');
  const [consents, setConsents] = useState<ConsentDto[]>([]);
  const [clinicians, setClinicians] = useState<AvailableClinician[]>([]);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedClinicianId, setSelectedClinicianId] = useState('');
  const [selectedConsentDuration, setSelectedConsentDuration] = useState<'15m' | '1h' | '24h'>('1h');
  const [consentScopes, setConsentScopes] = useState<{
    'timeline:read': boolean;
    'clinical-summary:generate': boolean;
  }>({
    'timeline:read': true,
    'clinical-summary:generate': true,
  });
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);
  const [singleUseQrPayload, setSingleUseQrPayload] = useState('');
  const [singleUseQrDataUrl, setSingleUseQrDataUrl] = useState('');
  const [singleUseQrExpiresAt, setSingleUseQrExpiresAt] = useState('');
  const [isGeneratingSingleUseQr, setIsGeneratingSingleUseQr] = useState(false);

  // Patient Camera & Optical Scanner State
  const [showPatientScannerModal, setShowPatientScannerModal] = useState(false);
  const [patientCameraStreamActive, setPatientCameraStreamActive] = useState(false);
  const [patientCameraError, setPatientCameraError] = useState<string | null>(null);
  const [isScanningPatientCode, setIsScanningPatientCode] = useState(false);
  const [scannedResultDetails, setScannedResultDetails] = useState<string | null>(null);
  const patientVideoRef = useRef<HTMLVideoElement | null>(null);
  const patientCameraStreamRef = useRef<MediaStream | null>(null);

  // Patient Mobile App & Smartphone Pass State
  const [showMobileAppModal, setShowMobileAppModal] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'wallet' | 'scanner' | 'emergency-id'>('wallet');
  const [nfcBeamingActive, setNfcBeamingActive] = useState(false);

  const startPatientCamera = async () => {
    setPatientCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPatientCameraError('Camera API not accessible in this browser context. High-resolution optical HUD active.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      patientCameraStreamRef.current = stream;
      if (patientVideoRef.current) {
        patientVideoRef.current.srcObject = stream;
        patientVideoRef.current.play().catch(() => {});
      }
      setPatientCameraStreamActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access camera';
      setPatientCameraError(`Camera permission unavailable (${msg}). High-resolution optical reticle active.`);
      setPatientCameraStreamActive(false);
    }
  };

  const stopPatientCamera = () => {
    if (patientCameraStreamRef.current) {
      patientCameraStreamRef.current.getTracks().forEach((track) => track.stop());
      patientCameraStreamRef.current = null;
    }
    setPatientCameraStreamActive(false);
  };

  useEffect(() => {
    if (!showPatientScannerModal && !showMobileAppModal) {
      stopPatientCamera();
    }
  }, [showPatientScannerModal, showMobileAppModal]);

  const handleExecutePatientScan = async (target: PatientScanTarget) => {
    setIsScanningPatientCode(true);
    playPatientScannerBeep('scan');

    setTimeout(async () => {
      setIsScanningPatientCode(false);
      playPatientScannerBeep('success');
      navigator.vibrate?.([40, 20, 40]);

      if (target.type === 'clinic') {
        try {
          const clinicianId = clinicians[0]?.clinicianId || 'doc-alex-morgan';
          const newConsent = await securityService.createConsent({
            clinicianId,
            scopes: ['timeline:read', 'clinical-summary:generate'],
            durationMinutes: 1440,
          });
          setConsents((prev) => [newConsent, ...prev]);
          await handleGenerateSingleUseQr(newConsent.id);
          toast.success(`Connected to Dr. Alex Morgan's Clinic! 24-Hour Consent Pass Granted.`);
        } catch {
          toast.success(`Connected to Dr. Alex Morgan's Clinic! 24-Hour Consent Pass Granted.`);
        }
      } else if (target.type === 'medication') {
        toast.success(`Medicine Barcode Verified: ${target.title}. Active prescription regimen cleared.`);
      } else {
        toast.success(`Diagnostic Report Verified & Synced: CBC Platelet Profile (184,000 /µL - Normal).`);
      }

      setScannedResultDetails(`Validated: ${target.title} (${target.code})`);
      setTimeout(() => {
        setShowPatientScannerModal(false);
        stopPatientCamera();
      }, 700);
    }, 600);
  };

  const handleTriggerNfcTap = () => {
    setNfcBeamingActive(true);
    playPatientScannerBeep('nfc');
    navigator.vibrate?.([60, 40, 60]);
    toast.success('NFC Contactless Pass Transmitted to Attending Clinician Terminal!');
    setTimeout(() => {
      setNfcBeamingActive(false);
    }, 1800);
  };

  const handleNativeSharePass = async () => {
    const activePass = qrTokens.find((t) => t.status === 'Active') || qrTokens[0];
    const shareData = {
      title: `${profile.name}'s MediVault Health Pass`,
      text: `Encrypted Digital Health Pass for ${profile.name} (UHID: ${profile.uhid}) - Token: ${activePass?.token || 'MV-SHARE-8F32A9C04B'}`,
      url: typeof window !== 'undefined' ? `${window.location.origin}/patient` : '',
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success('Health pass shared successfully');
      } catch {
        // user cancelled
      }
    } else {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(shareData.text);
        toast.success('Health pass link copied to clipboard!');
      }
    }
  };

  // Refresh data listener and mount sync
  useEffect(() => {
    setIsMounted(true);
    setProfile(patientService.getProfile());
    setAllergies(patientService.getAllergies());
    setConditions(patientService.getConditions());
    setPrescriptions(patientService.getPrescriptions());
    setConsultations(patientService.getConsultations());
    setLabs(patientService.getLabResults());
    setImaging(patientService.getImagingReports());
    setDocuments(patientService.getDocuments());
    setQrTokens(qrTokenService.list());

    // Load consents and clinicians
    securityService.listConsents().then(setConsents).catch(() => {});
    securityService.listClinicians().then((list) => {
      setClinicians(list);
      if (list.length > 0) setSelectedClinicianId(list[0].clinicianId);
    }).catch(() => {});

    const handlePatientChange = () => {
      setProfile(patientService.getProfile());
      setAllergies(patientService.getAllergies());
      setConditions(patientService.getConditions());
      setPrescriptions(patientService.getPrescriptions());
      setConsultations(patientService.getConsultations());
      setLabs(patientService.getLabResults());
      setImaging(patientService.getImagingReports());
      setDocuments(patientService.getDocuments());
    };

    const handleQrChange = () => {
      setQrTokens(qrTokenService.list());
    };

    window.addEventListener('medvia-patient-change', handlePatientChange);
    window.addEventListener('medvia-qr-change', handleQrChange);

    return () => {
      window.removeEventListener('medvia-patient-change', handlePatientChange);
      window.removeEventListener('medvia-qr-change', handleQrChange);
    };
  }, []);

  // Pre-generate QR for latest active token if available
  useEffect(() => {
    const active = qrTokens.find((t) => t.status === 'Active');
    if (active) {
      setActiveCreatedToken(active);
      const shareUrl = `${window.location.origin}/share/${active.token}`;
      QRCode.toDataURL(shareUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#123B46', light: '#FFFFFF' }
      })
        .then((url) => setGeneratedQrDataUrl(url))
        .catch(() => {});
    }
  }, [qrTokens]);

  // Handle QR creation
  const handleCreateQrPass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let serverToken: string | undefined = undefined;
      try {
        const durationMin =
          selectedDuration === '15_MINUTES' ? 15 :
          selectedDuration === '1_HOUR' ? 60 :
          selectedDuration === '24_HOURS' ? 1440 : 10080;

        const genRes = await fetch('/api/qr/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-demo-account': 'patient-a'
          },
          body: JSON.stringify({
            patientId: profile.id,
            patientName: profile.name,
            durationMinutes: durationMin,
            singleUse: false
          })
        });
        const genData: any = await genRes.json();
        if (genData.success && genData.data?.token) {
          serverToken = genData.data.token;
        }
      } catch {
        // network fallback
      }

      const newToken = qrTokenService.create({
        recipientType,
        recipientName,
        duration: selectedDuration,
        permittedCategories,
        customToken: serverToken
      });
      setActiveCreatedToken(newToken);
      setQrTokens(qrTokenService.list());

      const shareUrl = `${window.location.origin}/share/${newToken.token}`;
      const dataUrl = await QRCode.toDataURL(newToken.token, {
        width: 240,
        margin: 2,
        color: { dark: '#123B46', light: '#FFFFFF' }
      });
      setGeneratedQrDataUrl(dataUrl);

      toast.success(`Cryptographic QR Pass generated & verified (${newToken.token})`);
    } catch {
      toast.error('Could not generate QR code');
    }
  };

  // Revoke token
  const handleRevokeToken = async (tokenId: string, tokenString?: string) => {
    try {
      const tokenObj = qrTokenService.getById(tokenId);
      const raw = tokenString || tokenObj?.token;
      if (raw) {
        await fetch('/api/qr/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-demo-account': 'patient-a'
          },
          body: JSON.stringify({ token: raw })
        }).catch(() => {});
      }
      qrTokenService.revoke(tokenId);
      setQrTokens(qrTokenService.list());
      if (activeCreatedToken?.id === tokenId) {
        setActiveCreatedToken((prev) => (prev ? { ...prev, status: 'Revoked' } : null));
      }
      toast.info('Access token revoked immediately on server and client');
    } catch {
      toast.error('Failed to revoke access');
    }
  };

  // Create new clinician consent
  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinicianId) {
      toast.error('Please select an attending clinician.');
      return;
    }
    const scopes: ('timeline:read' | 'clinical-summary:generate')[] = [];
    if (consentScopes['timeline:read']) scopes.push('timeline:read');
    if (consentScopes['clinical-summary:generate']) scopes.push('clinical-summary:generate');
    if (scopes.length === 0) {
      toast.error('Please select at least one permission scope.');
      return;
    }

    const durationMinutes =
      selectedConsentDuration === '15m' ? 15 : selectedConsentDuration === '1h' ? 60 : 1440;

    setIsSubmittingConsent(true);
    try {
      const created = await securityService.createConsent({
        clinicianId: selectedClinicianId,
        scopes,
        durationMinutes,
      });
      setConsents((prev) => [created, ...prev]);
      setShowGrantModal(false);
      toast.success('Clinician consent granted successfully.');

      // Automatically generate a single-use QR for this newly created consent
      await handleGenerateSingleUseQr(created.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create consent';
      toast.error(msg);
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  // Revoke clinician consent
  const handleRevokeConsent = async (consentId: string) => {
    try {
      const revoked = await securityService.revokeConsent(consentId);
      setConsents((prev) => prev.map((c) => (c.id === consentId ? revoked : c)));
      if (singleUseQrPayload) {
        setSingleUseQrPayload('');
        setSingleUseQrDataUrl('');
      }
      toast.info('Clinician consent revoked immediately. Any active session locked.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke consent';
      toast.error(msg);
    }
  };

  // Generate single-use ephemeral QR token for consent
  const handleGenerateSingleUseQr = async (consentId: string) => {
    setIsGeneratingSingleUseQr(true);
    try {
      const res = await securityService.generateQr(consentId);
      setSingleUseQrPayload(res.payload);
      setSingleUseQrExpiresAt(res.expiresAt);

      const dataUrl = await QRCode.toDataURL(res.payload, {
        width: 256,
        margin: 2,
        color: { dark: '#123B46', light: '#FFFFFF' },
      });
      setSingleUseQrDataUrl(dataUrl);
      setQrSubTab('generator');
      toast.success('Single-use ephemeral QR token generated (5-min TTL).');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate QR token';
      toast.error(msg);
    } finally {
      setIsGeneratingSingleUseQr(false);
    }
  };

  // Simulated Document Upload
  const handleUploadSimulate = () => {
    const newDoc = patientService.addDocument({
      title: 'Discharge Summary · Health Checkup 2026',
      category: 'Clinical Summary',
      date: '2026-10-10',
      facility: 'Metropolitan Medical Center',
      author: 'Dr. Alex Morgan, MD',
      fileSize: '1.4 MB',
      fileType: 'PDF',
      summary: 'Annual preventive evaluation and ambulatory vitals profile. All metabolic markers verified.',
      tags: ['Preventive', 'Vitals', 'Annual']
    });
    toast.success(`Document uploaded successfully: "${newDoc.title}"`);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F4] text-[#133840] flex flex-col font-sans">
      <Toaster richColors position="top-right" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DFE7E4] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
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
                  Patient Health Enclave
                </span>
              </div>
            </Link>

            <span className="hidden md:inline-block h-4 w-px bg-slate-200 mx-1" />

            <div className="hidden md:flex items-center gap-1.5 text-xs text-[#607582] bg-[#F4F8F6] px-2.5 py-1 rounded-full border border-[#DFEAE4]">
              <ShieldCheck size={14} className="text-teal-600" />
              <span>ABHA ID: <strong className="text-[#133840] font-mono">{profile.abhaId}</strong></span>
            </div>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-3">
            {/* Demo Patient Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#F4F8F6] border border-[#DFEAE4] px-2.5 py-1 rounded-xl">
              <UserRound size={13} className="text-teal-700 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-wider text-teal-800 leading-none">
                  Demo Profile
                </span>
                <select
                  aria-label="Switch Demo Patient"
                  value={profile.id}
                  onChange={(e) => handleSwitchPatient(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#133840] focus:outline-none cursor-pointer pr-1 leading-tight"
                >
                  {availableProfiles.map((p) => {
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
                      <option key={p.id} value={p.id}>
                        {p.name} ({loc})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Quick Switch Portals */}
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/clinic"
                className="text-xs text-[#607582] hover:text-[#133840] font-medium px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Clinician Portal
              </Link>
              <Link
                href="/admin"
                className="text-xs text-[#607582] hover:text-[#133840] font-medium px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Surveillance Admin
              </Link>
            </div>

            {/* MediMate Assistant Launcher Button */}
            <button
              type="button"
              onClick={() => setShowMediMate(!showMediMate)}
              aria-label="Launch MediMate AI Clinical Assistant"
              className="inline-flex items-center justify-center whitespace-nowrap gap-2 sm:gap-2.5 w-auto sm:w-[160px] h-[44px] sm:h-[46px] px-3 sm:px-4 rounded-[14px] bg-gradient-to-r from-[#0E7068] to-[#133840] hover:from-[#0B5E57] hover:to-[#0F2D33] text-white text-[14px] sm:text-[15px] font-medium shadow-[0_2px_8px_rgba(14,112,104,0.22)] hover:shadow-[0_4px_12px_rgba(14,112,104,0.32)] transition-all cursor-pointer shrink-0 self-center border border-teal-600/30 select-none active:scale-[0.98]"
            >
              <Sparkles size={15} className="text-teal-200 shrink-0 animate-pulse" />
              <span className="font-medium whitespace-nowrap">MediMate AI</span>
              <span className="w-2 h-2 rounded-full bg-[#2DD4BF] shrink-0 shadow-[0_0_6px_rgba(45,212,191,0.7)]" />
            </button>

            {/* Profile Avatar Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-teal-100 border border-teal-300 text-teal-900 font-semibold text-xs flex items-center justify-center">
                {getInitials(profile.name)}
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold leading-tight">{profile.name}</div>
                <div className="text-[10px] text-[#607582]">UHID: {profile.uhid}</div>
              </div>
              <Link
                href="/login"
                title="Sign out of enclave"
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg ml-1"
              >
                <LogOut size={16} />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Patient Profile Hero Header Banner */}
      <section className="bg-gradient-to-b from-white to-[#F7FAF8] border-b border-[#DFE7E4] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#133840]">
                {profile.name}
              </h1>
              <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-medium">
                Verified Enclave
              </span>
              <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                DEMO DATA — FICTIONAL PATIENT
              </span>
              <span className="text-xs bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-mono font-bold">
                {profile.bloodGroup}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-[#607582]">
              <span><strong>Age:</strong> {profile.age} yrs ({profile.sex})</span>
              <span>•</span>
              <span><strong>UHID:</strong> <code className="font-mono text-[#133840]">{profile.uhid}</code></span>
              <span>•</span>
              <span><strong>Location:</strong> {profile.address}</span>
              <span>•</span>
              <span><strong>Primary Care:</strong> {profile.primaryCarePhysician.name} ({profile.primaryCarePhysician.hospital})</span>
              <span>•</span>
              <span><strong>Contact:</strong> {profile.phone}</span>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => {
                setShowPatientScannerModal(true);
                startPatientCamera();
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-teal-700 hover:border-teal-800"
              title="Point camera to scan hospital registration QR or medication barcode"
            >
              <Camera size={14} className="text-teal-200" />
              <span>Scan Clinic / Barcode</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMobileAppModal(true)}
              className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-purple-800"
              title="Open MediVault Mobile Smartphone App with Apple/Google Wallet Health Pass"
            >
              <Smartphone size={14} className="text-purple-200" />
              <span>Mobile App & Wallet</span>
            </button>

            <button
              onClick={() => setActiveTab('qr-pass')}
              className="bg-white hover:bg-teal-50 text-[#133840] border border-[#CAD9D3] hover:border-teal-500 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <QrCode size={14} className="text-teal-700" />
              <span>Share QR Pass</span>
            </button>

            <button
              onClick={handleUploadSimulate}
              className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Upload size={14} />
              <span>Upload Record</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="max-w-7xl mx-auto mt-6 pt-2 border-t border-slate-200/60 overflow-x-auto no-scrollbar flex items-center gap-1 sm:gap-2">
          {[
            { key: 'overview', label: 'Summary Overview', icon: Activity },
            { key: 'conditions', label: 'Allergies & Conditions', icon: AlertTriangle, count: allergies.length },
            { key: 'prescriptions', label: 'Prescriptions', icon: Pill, count: prescriptions.filter(p => p.status === 'Active').length },
            { key: 'consultations', label: 'Consultations', icon: Calendar, count: consultations.length },
            { key: 'labs', label: 'Labs & Imaging', icon: HeartPulse, count: labs.length },
            { key: 'documents', label: 'Medical Documents', icon: FileText, count: documents.length },
            { key: 'qr-pass', label: 'Secure QR Pass', icon: QrCode, badge: 'Live' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#133840] text-white shadow-xs font-semibold'
                    : 'text-[#607582] hover:text-[#133840] hover:bg-white/80'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-teal-300' : 'text-[#8DA39C]'} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full uppercase font-bold tracking-wider">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* ===================== TAB 1: OVERVIEW ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Critical Alert Bar (Allergies) */}
            {(() => {
              const activeAllergies = allergies.filter(
                (a) =>
                  !a.allergen.toLowerCase().includes('no known') &&
                  !a.reaction.toLowerCase().includes('no adverse')
              );
              if (activeAllergies.length > 0) {
                return (
                  <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
                    <AlertTriangle size={20} className="text-amber-700 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                        Critical Drug Allergy Recorded
                      </h4>
                      <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                        {activeAllergies.map((a, i) => (
                          <span key={a.id} className="mr-1">
                            {i > 0 && '• '}
                            <strong>{a.allergen}</strong> ({a.reaction} — {a.severity})
                          </span>
                        ))}
                        . Do not administer without allergy consultation.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('conditions')}
                      className="text-xs font-semibold text-amber-900 underline hover:text-amber-950 shrink-0"
                    >
                      View Details
                    </button>
                  </div>
                );
              }
              return (
                <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
                  <CheckCircle2 size={20} className="text-emerald-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      No Known Drug Allergies (NKDA) Recorded
                    </h4>
                    <p className="text-xs text-emerald-900/90 mt-0.5 leading-relaxed">
                      No clinical adverse reactions or drug hypersensitivities documented in this patient enclave.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('conditions')}
                    className="text-xs font-semibold text-emerald-900 underline hover:text-emerald-950 shrink-0"
                  >
                    View Details
                  </button>
                </div>
              );
            })()}

            {/* Quick Metrics KPI Grid */}
            {(() => {
              const activeMeds = prescriptions.filter((p) => p.status === 'Active');
              const medSummary =
                activeMeds.length > 0
                  ? activeMeds.map((p) => `${p.medicationName} ${p.dosage}`).join(', ')
                  : 'No active medications';

              const keyParam =
                labs[0]?.parameters?.find((p) =>
                  [
                    'HbA1c',
                    'Glycated Hemoglobin (HbA1c)',
                    'LDL-Cholesterol (Direct)',
                    'Hemoglobin',
                    'Peak Expiratory Flow Rate (PEFR)'
                  ].includes(p.name)
                ) || labs[0]?.parameters?.[0];

              const keyParamTitle = keyParam ? keyParam.name : conditions[0]?.condition || 'Health Status';
              const keyParamValue = keyParam ? `${keyParam.value} ${keyParam.unit}` : 'Stable';
              const keyParamSub = keyParam
                ? keyParam.isAbnormal
                  ? `Clinical Review · Ref: ${keyParam.referenceRange}`
                  : `Target Met · Ref: ${keyParam.referenceRange}`
                : conditions[0]?.status || 'Verified';

              const latestBp = consultations[0]?.vitals?.bloodPressure || '120/80 mmHg';
              const latestPulse = consultations[0]?.vitals?.pulse ?? consultations[0]?.vitals?.heartRate ?? 72;
              const latestOxygen = consultations[0]?.vitals?.oxygen ?? consultations[0]?.vitals?.oxygenSaturation ?? 99;

              const activeQrCount = qrTokens.filter((t) => t.status === 'Active').length;
              const activeQrRecipient =
                qrTokens.find((t) => t.status === 'Active')?.recipientName || 'Zero active passes';

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
                    <div className="flex items-center justify-between text-[#607582] text-xs">
                      <span>Active Medications</span>
                      <Pill size={16} className="text-teal-700" />
                    </div>
                    <div className="text-2xl font-serif font-bold text-[#133840] mt-2">
                      {activeMeds.length}
                    </div>
                    <div className="text-[11px] text-teal-800 font-medium mt-1 truncate" title={medSummary}>
                      {medSummary}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
                    <div className="flex items-center justify-between text-[#607582] text-xs">
                      <span className="truncate pr-1">{keyParamTitle}</span>
                      <Activity size={16} className="text-teal-700 shrink-0" />
                    </div>
                    <div className="text-2xl font-serif font-bold text-[#133840] mt-2 truncate">
                      {keyParamValue}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
                      {keyParamSub}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
                    <div className="flex items-center justify-between text-[#607582] text-xs">
                      <span>Blood Pressure (Last OPD)</span>
                      <HeartPulse size={16} className="text-teal-700" />
                    </div>
                    <div className="text-2xl font-serif font-bold text-[#133840] mt-2">
                      {latestBp}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-medium mt-1">
                      Pulse: {latestPulse} bpm · SpO2: {latestOxygen}%
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
                    <div className="flex items-center justify-between text-[#607582] text-xs">
                      <span>Secure QR Share Pass</span>
                      <QrCode size={16} className="text-teal-700" />
                    </div>
                    <div className="text-2xl font-serif font-bold text-[#133840] mt-2">
                      {activeQrCount} Active
                    </div>
                    <div className="text-[11px] text-teal-800 font-medium mt-1 truncate" title={activeQrRecipient}>
                      {activeQrRecipient}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Split Grid: Recent Consultations & Medication Schedule */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Recent Consultations */}
              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                    <Calendar size={18} className="text-teal-700" />
                    Recent Clinical Encounters
                  </h3>
                  <button
                    onClick={() => setActiveTab('consultations')}
                    className="text-xs text-teal-700 font-semibold hover:underline"
                  >
                    View All ({consultations.length})
                  </button>
                </div>

                <div className="space-y-3">
                  {consultations.slice(0, 2).map((visit) => (
                    <div
                      key={visit.id}
                      className="p-3.5 rounded-xl border border-[#E6EDE9] bg-[#FAF9F6] space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#133840]">{visit.clinician || visit.clinicianName}</div>
                          <div className="text-[11px] text-[#607582]">
                            {visit.specialty} · {visit.hospital || visit.facility}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-[#DFE7E4] text-[#607582]">
                          {visit.date}
                        </span>
                      </div>
                      <p className="text-xs text-[#2A4D45] line-clamp-2 leading-relaxed">
                        <strong>Impression:</strong> {visit.impression || visit.assessment}
                      </p>
                      <div className="text-[11px] text-[#607582] flex gap-3 pt-1 border-t border-slate-200/60 font-mono">
                        <span>BP: {visit.vitals.bloodPressure}</span>
                        <span>HR: {visit.vitals.pulse ?? visit.vitals.heartRate} bpm</span>
                        <span>SpO2: {visit.vitals.oxygen ?? visit.vitals.oxygenSaturation}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Active Daily Medication Schedule */}
              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                    <Pill size={18} className="text-teal-700" />
                    Daily Medication Schedule
                  </h3>
                  <button
                    onClick={() => setActiveTab('prescriptions')}
                    className="text-xs text-teal-700 font-semibold hover:underline"
                  >
                    Manage Prescriptions
                  </button>
                </div>

                <div className="space-y-2.5">
                  {prescriptions
                    .filter((p) => p.status === 'Active')
                    .map((med) => (
                      <div
                        key={med.id}
                        className="p-3 rounded-xl border border-[#E3ECE8] bg-white flex items-center justify-between hover:border-teal-300 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-[#133840]">
                            {med.medicationName} ({med.dosage})
                          </div>
                          <div className="text-[11px] text-[#607582]">
                            {med.frequency} · {med.timing}
                          </div>
                          <div className="text-[10px] text-teal-800">
                            Indication: {med.indication}
                          </div>
                        </div>
                        <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-mono">
                          {med.refillsRemaining} Refills left
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* MediMate Assistant Prompt Spotlight Card */}
            <div className="bg-gradient-to-r from-[#133840] to-[#1D4E59] rounded-2xl p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 text-teal-300 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles size={16} />
                  <span>Personal AI Health Companion</span>
                </div>
                <h3 className="font-serif text-xl font-bold">Have questions about your test results?</h3>
                <p className="text-xs text-teal-100/90 leading-relaxed">
                  MediMate can translate medical jargon into plain English, explain your latest HbA1c or platelet trend, and draft targeted questions for your next clinic appointment.
                </p>
              </div>

              <button
                onClick={() => setShowMediMate(true)}
                className="bg-teal-400 hover:bg-teal-300 text-[#133840] font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shrink-0 flex items-center gap-2"
              >
                <span>Launch MediMate AI</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: ALLERGIES & CONDITIONS ===================== */}
        {activeTab === 'conditions' && (
          <div className="space-y-6">
            {/* Allergies Section */}
            <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#133840] flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-600" />
                    Recorded Drug & Environmental Allergies
                  </h3>
                  <p className="text-xs text-[#607582]">
                    Verified contraindications synchronized with hospital dispensing systems.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allergies.map((allergy) => (
                  <div
                    key={allergy.id}
                    className={`p-4 rounded-xl border space-y-2 ${
                      allergy.severity === 'Severe' || allergy.severity === 'Life-threatening'
                        ? 'border-rose-300 bg-rose-50/50'
                        : 'border-amber-200 bg-amber-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#133840]">
                        {allergy.allergen}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          allergy.severity === 'Severe'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {allergy.severity} Reaction
                      </span>
                    </div>

                    <div className="text-xs text-[#284941]">
                      <strong>Observed Reaction:</strong> {allergy.reaction}
                    </div>

                    {allergy.notes && (
                      <p className="text-[11px] text-[#607582] italic">
                        {allergy.notes}
                      </p>
                    )}

                    <div className="text-[10px] text-[#8CA09A] pt-1 border-t border-slate-200/50 flex justify-between">
                      <span>Type: {allergy.type}</span>
                      <span>Recorded: {allergy.recordedDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chronic Conditions Section */}
            <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#133840] flex items-center gap-2">
                    <Activity size={18} className="text-teal-700" />
                    Chronic Conditions & Diagnoses
                  </h3>
                  <p className="text-xs text-[#607582]">
                    Longitudinal medical problems recorded in your clinical trajectory.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {conditions.map((cond) => (
                  <div
                    key={cond.id}
                    className="p-4 rounded-xl border border-[#E3ECE8] bg-[#FAF9F6] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#133840]">{cond.condition}</span>
                        <code className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[#607582]">
                          ICD-10: {cond.icd10}
                        </code>
                      </div>
                      <p className="text-xs text-[#45635C]">{cond.notes}</p>
                      <div className="text-[11px] text-[#8CA09A]">
                        Diagnosed {cond.diagnosedDate} by {cond.diagnosingClinician}
                      </div>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold border whitespace-nowrap self-start sm:self-auto ${
                        cond.status.includes('Controlled')
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : cond.status.includes('Resolved')
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {cond.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: PRESCRIPTIONS ===================== */}
        {activeTab === 'prescriptions' && (
          <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#133840] flex items-center gap-2">
                  <Pill size={18} className="text-teal-700" />
                  Prescriptions & Medication Management
                </h3>
                <p className="text-xs text-[#607582]">
                  Active prescriptions with verified dosages, instructions and refill allowances.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 font-medium">
                  {prescriptions.filter((p) => p.status === 'Active').length} Active Drugs
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {prescriptions.map((med) => {
                const isActive = med.status === 'Active';
                return (
                  <div
                    key={med.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'border-[#CADBD5] bg-white shadow-xs'
                        : 'border-[#E5ECE9] bg-[#FAF9F6] opacity-75'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-[#133840]">{med.medicationName}</h4>
                          <span className="text-xs font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {med.dosage}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {med.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#607582] mt-0.5">
                          Generic: {med.genericName} • Route: {med.route}
                        </p>
                      </div>

                      <div className="text-xs text-right font-mono text-[#45635C]">
                        {med.frequency} ({med.timing})
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[#8CA09A] uppercase block">Instructions</span>
                        <span className="text-[#25453E] font-medium">{med.instructions}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8CA09A] uppercase block">Prescribed By</span>
                        <span className="text-[#25453E]">{med.prescribedBy} ({med.startDate})</span>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-2">
                        <div>
                          <span className="text-[10px] text-[#8CA09A] uppercase block">Refills Left</span>
                          <span className="font-mono font-bold text-teal-800">{med.refillsRemaining} remaining</span>
                        </div>
                        {isActive && (
                          <div className="flex items-center gap-1.5">
                            {refillStatusMap[med.id]?.status === 'submitted' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-medium">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                Request submitted • Notification pending
                              </span>
                            ) : med.refillsRemaining <= 0 ? (
                              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-medium">
                                No refills left
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRequestRefill(med)}
                                disabled={refillLoadingMap[med.id]}
                                className="bg-teal-50 hover:bg-teal-100 disabled:opacity-50 text-teal-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-200 transition-colors flex items-center gap-1.5"
                              >
                                {refillLoadingMap[med.id] ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin text-teal-700" />
                                    Submitting...
                                  </>
                                ) : (
                                  'Request Refill'
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: CONSULTATIONS ===================== */}
        {activeTab === 'consultations' && (
          <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#133840] flex items-center gap-2">
                  <Calendar size={18} className="text-teal-700" />
                  Clinical Consultation Timeline
                </h3>
                <p className="text-xs text-[#607582]">
                  Chronological records of OPD evaluations, emergency encounters, and care summaries.
                </p>
              </div>
            </div>

            <div className="relative pl-6 border-l-2 border-teal-200 space-y-6 my-4">
              {consultations.map((visit) => (
                <div key={visit.id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-teal-600 shadow-xs" />

                  <div className="p-4 rounded-xl border border-[#DFECE6] bg-[#FAF9F6] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-[#133840]">{visit.clinician || visit.clinicianName}</h4>
                          <span className="text-xs text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {visit.specialty}
                          </span>
                        </div>
                        <p className="text-xs text-[#607582]">{visit.hospital || visit.facility}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-[#133840]">{visit.date}</span>
                        <span className="block text-[10px] text-[#8CA09A]">{visit.type}</span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200/60 text-xs space-y-1.5">
                      <div>
                        <strong className="text-[#133840]">Chief Complaint:</strong> {visit.chiefComplaint}
                      </div>
                      <div>
                        <strong className="text-[#133840]">Clinical Impression:</strong> {visit.impression || visit.assessment}
                      </div>
                      <div className="text-teal-900 font-medium">
                        <strong>Plan / Follow-up:</strong> {visit.plan}
                      </div>
                    </div>

                    {/* Vitals pill strip */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#607582] pt-1">
                      <span className="bg-slate-100 px-2 py-0.5 rounded">BP: {visit.vitals.bloodPressure}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded">Pulse: {visit.vitals.pulse ?? visit.vitals.heartRate} bpm</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded">Temp: {visit.vitals.temperature}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded">SpO2: {visit.vitals.oxygen ?? visit.vitals.oxygenSaturation}%</span>
                      {visit.vitals.weightKg && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded">Weight: {visit.vitals.weightKg} kg</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 5: LABS & IMAGING ===================== */}
        {activeTab === 'labs' && (
          <div className="space-y-6">
            {/* Laboratory Reports */}
            <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#133840] flex items-center gap-2">
                    <HeartPulse size={18} className="text-teal-700" />
                    Laboratory Investigation Panels
                  </h3>
                  <p className="text-xs text-[#607582]">
                    Hematology, serology and metabolic panels with reference thresholds and clinical flags.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {labs.map((panel) => (
                  <div key={panel.id} className="p-4 rounded-xl border border-[#DFECE6] bg-[#FAF9F6] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-[#133840]">{panel.testName}</h4>
                          <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-[#607582]">
                            {panel.category}
                          </span>
                        </div>
                        <p className="text-xs text-[#607582]">
                          Ordered by {panel.orderedBy} • Performed at {panel.laboratory}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-[#133840]">{panel.date}</span>
                        <span className="block text-[10px] text-emerald-700 font-semibold">{panel.status}</span>
                      </div>
                    </div>

                    {/* Metrics Table */}
                    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[#607582] text-[10px] uppercase font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Parameter</th>
                            <th className="p-2.5">Result</th>
                            <th className="p-2.5">Reference Range</th>
                            <th className="p-2.5">Flag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {panel.parameters.map((param, pIdx) => (
                            <tr key={pIdx} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-medium text-[#133840]">{param.name}</td>
                              <td className="p-2.5 font-mono font-bold text-[#133840]">
                                {param.value} {param.unit}
                              </td>
                              <td className="p-2.5 font-mono text-[#607582] text-[11px]">
                                {param.referenceRange}
                              </td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    param.flag === 'Abnormal' || param.flag === 'High'
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : param.flag === 'Low'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  }`}
                                >
                                  {param.flag}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Imaging Reports */}
            <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#133840] flex items-center gap-2">
                    <Eye size={18} className="text-teal-700" />
                    Diagnostic Imaging Reports
                  </h3>
                  <p className="text-xs text-[#607582]">
                    Ultrasound, Radiography, and CT interpretation summaries.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imaging.map((img) => (
                  <div key={img.id} className="p-4 rounded-xl border border-[#DFECE6] bg-[#FAF9F6] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#133840]">{img.modality}: {img.anatomy || img.bodyRegion}</span>
                      <span className="text-[10px] font-mono text-[#607582]">{img.date}</span>
                    </div>
                    <div className="text-xs text-[#284941]">
                      <strong>Findings:</strong> {img.findings}
                    </div>
                    <div className="text-xs text-teal-900 font-medium">
                      <strong>Impression:</strong> {img.impression}
                    </div>
                    <div className="text-[10px] text-[#8CA09A] pt-2 border-t border-slate-200 flex justify-between">
                      <span>Radiologist: {img.radiologist}</span>
                      <span>{img.facility}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 6: MEDICAL DOCUMENTS ===================== */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#133840] flex items-center gap-2">
                  <FileText size={18} className="text-teal-700" />
                  Medical Documents & Care Summaries
                </h3>
                <p className="text-xs text-[#607582]">
                  Encrypted files, discharge summaries, and lab PDFs stored in this device enclave.
                </p>
              </div>

              <button
                onClick={handleUploadSimulate}
                className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-xs"
              >
                <Upload size={14} />
                <span>Upload New PDF</span>
              </button>
            </div>

            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl border border-[#E3ECE8] bg-[#FAF9F6] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-teal-300 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-teal-700 shrink-0" />
                      <h4 className="font-bold text-sm text-[#133840]">{doc.title}</h4>
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-[#607582]">
                        {doc.fileType} • {doc.fileSize}
                      </span>
                    </div>
                    <p className="text-xs text-[#45635C]">{doc.summary}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#8CA09A]">
                      <span>Uploaded {doc.date}</span>
                      <span>•</span>
                      <span>{doc.facility}</span>
                      <span>•</span>
                      <span>Author: {doc.author}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="bg-white hover:bg-teal-50 text-teal-800 border border-[#CADBD3] text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      onClick={() => toast.success(`Downloading ${doc.title}`)}
                      className="p-1.5 text-slate-500 hover:text-[#133840] hover:bg-slate-100 rounded-lg transition-colors"
                      title="Download document"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 7: CONSENTS & SECURE QR PASS ===================== */}
        {activeTab === 'qr-pass' && (
          <div className="space-y-6">
            {/* Top Subnav Toggle */}
            <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl border border-[#DFE7E4] shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQrSubTab('generator')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    qrSubTab === 'generator'
                      ? 'bg-[#133840] text-white shadow-xs'
                      : 'bg-[#FAF9F6] text-[#607582] hover:bg-slate-100'
                  }`}
                >
                  <QrCode size={15} />
                  <span>Secure QR Health Pass Generator</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQrSubTab('consents')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    qrSubTab === 'consents'
                      ? 'bg-[#133840] text-white shadow-xs'
                      : 'bg-[#FAF9F6] text-[#607582] hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck size={15} />
                  <span>Doctor Consents & Permissions ({consents.filter((c) => c.status === 'active').length})</span>
                </button>
              </div>

              {qrSubTab === 'consents' && (
                <button
                  type="button"
                  onClick={() => setShowGrantModal(true)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Grant Clinician Access</span>
                </button>
              )}
            </div>

            {/* SubTab 1: Doctor Consents Management */}
            {qrSubTab === 'consents' && (
              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#133840]">
                      Clinician Access Consents
                    </h3>
                    <p className="text-xs text-[#607582]">
                      Manage granular, revocable zero-trust data access granted to verified clinicians.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#607582]">
                    {consents.length} total consent records
                  </span>
                </div>

                <div className="overflow-x-auto border border-[#E2ECE7] rounded-xl bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F6] border-b border-slate-200 text-[#607582] text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="p-3">Attending Clinician</th>
                        <th className="p-3">Authorized Scopes</th>
                        <th className="p-3">Issued At</th>
                        <th className="p-3">Expires At</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {consents.map((consent) => {
                        const clinician = clinicians.find((c) => c.clinicianId === consent.clinicianId);
                        const isExpired = new Date(consent.expiresAt).getTime() <= Date.now();
                        const isRevoked = consent.status === 'revoked';
                        const isActive = !isRevoked && !isExpired;

                        return (
                          <tr key={consent.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-[#133840]">
                                {consent.clinicianName || clinician?.name || 'Verified Attending Clinician'}
                              </div>
                              <div className="text-[10px] text-[#607582] font-mono">
                                {clinician ? `${clinician.licenseNumber} · ${clinician.hospital || 'Hospital OPD'}` : consent.clinicianId.slice(0, 8)}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {consent.scopes.map((scope) => (
                                  <span
                                    key={scope}
                                    className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium"
                                  >
                                    {scope}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-[#607582]">
                              {isMounted
                                ? new Date(consent.createdAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : consent.createdAt.slice(0, 10)}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-[#607582]">
                              {isMounted
                                ? new Date(consent.expiresAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : consent.expiresAt.slice(0, 10)}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : isRevoked
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {isActive ? 'Active' : isRevoked ? 'Revoked' : 'Expired'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isActive && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateSingleUseQr(consent.id)}
                                      disabled={isGeneratingSingleUseQr}
                                      className="bg-[#133840] hover:bg-[#0E7068] text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <QrCode size={12} />
                                      <span>Generate QR</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeConsent(consent.id)}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                    >
                                      Revoke
                                    </button>
                                  </>
                                )}
                                {!isActive && (
                                  <span className="text-[11px] text-slate-400 font-mono">Inactive</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SubTab 2: Secure Ephemeral QR Pass Generator with Time Limit & Consent Selection */}
            {qrSubTab === 'generator' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-[#DFE7E4] p-6 shadow-xs space-y-6">
                  <div className="pb-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                        <QrCode size={18} />
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-xl text-[#133840]">
                          Secure Ephemeral QR Sharing Pass
                        </h3>
                        <p className="text-xs text-[#607582]">
                          Zero health records embedded in the QR image. The QR code encodes only a short-lived token validated server-side.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-full font-semibold">
                        🔒 Zero-Trust Encrypted
                      </span>
                    </div>
                  </div>

                  {/* Two Column Generator: Form (Left) & Live QR Pass (Right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Form: Config permissions */}
                    <form onSubmit={handleCreateQrPass} className="lg:col-span-7 space-y-5">
                      {/* 1. Recipient Scope */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#133840]">
                          1. Authorized Recipient Scope
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {[
                            { type: 'Clinician Verified', label: 'Doctor / Hospital' },
                            { type: 'Emergency Access', label: 'ER Triage' },
                            { type: 'Caregiver', label: 'Family / Caregiver' }
                          ].map((rec) => (
                            <button
                              key={rec.type}
                              type="button"
                              onClick={() => setRecipientType(rec.type as any)}
                              className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                                recipientType === rec.type
                                  ? 'border-[#133840] bg-teal-50/70 text-[#133840] shadow-xs ring-1 ring-[#133840]'
                                  : 'border-[#DFE7E4] bg-white text-[#607582] hover:bg-[#FAF9F6]'
                              }`}
                            >
                              {rec.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[#133840]">Recipient Name / Reference</label>
                        <input
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="e.g. Dr. Alex Morgan, MD"
                          className="w-full bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl px-3.5 py-2 text-xs text-[#133840] focus:outline-none focus:border-teal-600"
                        />
                      </div>

                      {/* 2. Expiration Duration (Time Limit Selection) */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#133840]">
                          2. Pass Validity & Expiration (Time Limit)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { dur: '15_MINUTES', label: '15 Minutes', note: 'Emergency / Triage' },
                            { dur: '1_HOUR', label: '1 Hour', note: 'Single OPD Visit' },
                            { dur: '24_HOURS', label: '24 Hours', note: 'Standard Hospital' },
                            { dur: '7_DAYS', label: '7 Days', note: 'Caregiver / Home' }
                          ].map((d) => (
                            <button
                              key={d.dur}
                              type="button"
                              onClick={() => setSelectedDuration(d.dur as ExpirationDuration)}
                              className={`p-2.5 rounded-xl border text-xs text-center transition-all cursor-pointer ${
                                selectedDuration === d.dur
                                  ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold shadow-xs ring-1 ring-teal-600'
                                  : 'border-[#DFE7E4] bg-white text-[#607582] hover:bg-[#FAF9F6]'
                              }`}
                            >
                              <div className="font-semibold">{d.label}</div>
                              <div className="text-[10px] text-[#8CA09A] mt-0.5">{d.note}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. Category granular checkboxes (Consent Selection) */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#133840]">
                          3. Permitted Record Categories (Granular Consent Selection)
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[
                            { key: 'profile', label: 'Patient Demographics' },
                            { key: 'allergies', label: 'Drug Allergies' },
                            { key: 'medications', label: 'Prescriptions & Drugs' },
                            { key: 'labResults', label: 'Laboratory Test Panels' },
                            { key: 'imaging', label: 'Radiology & Imaging' },
                            { key: 'consultations', label: 'Consultation Timeline' },
                            { key: 'sensitiveNotes', label: 'Confidential Notes' }
                          ].map((cat) => (
                            <label
                              key={cat.key}
                              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E4ECE7] cursor-pointer hover:bg-teal-50/40 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={(permittedCategories as any)[cat.key]}
                                onChange={(e) =>
                                  setPermittedCategories({
                                    ...permittedCategories,
                                    [cat.key]: e.target.checked
                                  })
                                }
                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                              />
                              <span className="text-[#133840] font-medium text-xs">{cat.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-[#133840] hover:bg-[#0E7068] text-white py-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RefreshCw size={14} />
                        <span>Generate & Issue Secure QR Pass</span>
                      </button>
                    </form>

                    {/* Right Column: Live QR Pass Card */}
                    <div className="lg:col-span-5 bg-gradient-to-b from-[#FAF9F6] to-white rounded-2xl border-2 border-[#CADBD5] p-5 flex flex-col items-center text-center shadow-sm">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-800 mb-1">
                        <Lock size={13} />
                        <span>Active Medviaduct Health Pass</span>
                      </div>
                      <p className="text-[11px] text-[#607582] max-w-xs">
                        Scan using the Clinician Portal or recipient camera.
                      </p>

                      {/* QR Canvas Render */}
                      <div className="mt-4 p-3 bg-white rounded-2xl border border-slate-200 shadow-inner">
                        {generatedQrDataUrl ? (
                          <img
                            src={generatedQrDataUrl}
                            alt="Medviaduct Secure Health Pass"
                            className="w-48 h-48 object-contain rounded-lg"
                          />
                        ) : (
                          <div className="w-48 h-48 flex items-center justify-center text-xs text-[#8CA09A]">
                            Generating Pass...
                          </div>
                        )}
                      </div>

                      {activeCreatedToken && (
                        <div className="w-full mt-4 space-y-2 text-xs">
                          <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-slate-200 space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-[#607582]">Token ID:</span>
                              <code className="font-mono font-bold text-[#133840]">
                                {activeCreatedToken.token}
                              </code>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-[#607582]">Recipient:</span>
                              <span className="font-medium text-[#133840]">
                                {activeCreatedToken.recipientName || activeCreatedToken.recipientType}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-[#607582]">Expires:</span>
                              <span className="font-mono text-rose-700 font-semibold">
                                {isMounted
                                  ? new Date(activeCreatedToken.expiresAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : '24h'}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/share/${activeCreatedToken.token}`
                                );
                                toast.success('Shareable link copied to clipboard');
                              }}
                              className="flex-1 bg-white hover:bg-slate-50 border border-slate-300 py-2 rounded-lg text-xs font-semibold text-[#133840] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Copy size={12} />
                              <span>Copy Link</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeToken(activeCreatedToken.id)}
                              className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-2 rounded-lg text-xs font-semibold text-rose-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <XCircle size={12} />
                              <span>Revoke Now</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Access Audit Trail Log */}
                <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                      <ShieldCheck size={18} className="text-teal-700" />
                      QR Token Access Audit & Verification History
                    </h4>
                    <span className="text-xs text-[#607582]">
                      {qrTokens.length} total tokens tracked
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-[#E2ECE7] rounded-xl bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF9F6] border-b border-slate-200 text-[#607582] text-[10px] uppercase font-semibold">
                        <tr>
                          <th className="p-3">Token Code</th>
                          <th className="p-3">Recipient</th>
                          <th className="p-3">Created</th>
                          <th className="p-3">Expires At</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-center">Scans</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {qrTokens.map((tok) => (
                          <tr key={tok.id} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-[#133840]">{tok.token}</td>
                            <td className="p-3 text-[#133840] font-medium">
                              {tok.recipientName || tok.recipientType}
                            </td>
                            <td className="p-3 text-[#607582] font-mono text-[11px]">
                              {isMounted ? new Date(tok.createdAt).toLocaleDateString() : tok.createdAt.slice(0, 10)}
                            </td>
                            <td className="p-3 text-[#607582] font-mono text-[11px]">
                              {isMounted ? new Date(tok.expiresAt).toLocaleTimeString() : tok.expiresAt.slice(11, 19)}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  tok.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : tok.status === 'Revoked'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {tok.status}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-center">{tok.scanCount}</td>
                            <td className="p-3 text-right">
                              {tok.status === 'Active' ? (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeToken(tok.id)}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                                >
                                  Revoke
                                </button>
                              ) : (
                                <span className="text-slate-400 font-mono text-[11px]">Locked</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating MediMate AI Assistant Drawer */}
      <MediMateChat
        isOpen={showMediMate}
        onClose={() => setShowMediMate(false)}
        isFloating={true}
      />

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {previewDoc.category} · {previewDoc.fileType}
                </span>
                <h3 className="text-base font-serif font-bold text-[#133840] mt-1.5">
                  {previewDoc.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="bg-[#FAF9F6] p-4 rounded-xl border border-slate-200 text-xs text-[#294B43] space-y-2">
              <div>
                <strong>Document Summary:</strong> {previewDoc.summary}
              </div>
              <div className="text-[11px] text-[#607582] pt-2 border-t border-slate-200 space-y-1">
                <div>Facility: {previewDoc.facility}</div>
                <div>Authoring Clinician: {previewDoc.author}</div>
                <div>Recorded Date: {previewDoc.date}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#607582] hover:bg-slate-100"
              >
                Close
              </button>
              <button
                onClick={() => {
                  toast.success(`Downloaded ${previewDoc.title}`);
                  setPreviewDoc(null);
                }}
                className="bg-[#133840] hover:bg-[#0E7068] text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>Download Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Grant Clinician Access Modal Dialog */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
                  <ShieldCheck size={22} className="text-teal-700" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-[#133840]">
                    Grant Clinician Access Consent
                  </h3>
                  <p className="text-xs text-[#607582]">
                    Authorize an attending doctor to access your medical records securely.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGrantModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGrantConsent} className="space-y-4 text-xs">
              {/* Clinician Picker */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#133840] block">
                  Select Attending Clinician <span className="text-rose-600">*</span>
                </label>
                <select
                  value={selectedClinicianId}
                  onChange={(e) => setSelectedClinicianId(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl px-3 py-2 text-xs text-[#133840] font-medium focus:outline-none focus:border-teal-600"
                >
                  {clinicians.map((c) => (
                    <option key={c.clinicianId} value={c.clinicianId}>
                      {c.name || 'Verified Attending Doctor'} · {c.specialty || 'General Practice'} ({c.licenseNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Granular Scope Checkboxes */}
              <div className="space-y-2">
                <label className="font-bold text-[#133840] block">
                  Permitted Access Scopes <span className="text-rose-600">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2ECE7] cursor-pointer hover:bg-teal-50/40">
                    <input
                      type="checkbox"
                      checked={consentScopes['timeline:read']}
                      onChange={(e) =>
                        setConsentScopes({
                          ...consentScopes,
                          'timeline:read': e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <div className="font-bold text-[#133840]">timeline:read</div>
                      <div className="text-[11px] text-[#607582]">
                        Allows attending doctor to read consultation notes, encounter history, diagnoses, and lab results.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2ECE7] cursor-pointer hover:bg-teal-50/40">
                    <input
                      type="checkbox"
                      checked={consentScopes['clinical-summary:generate']}
                      onChange={(e) =>
                        setConsentScopes({
                          ...consentScopes,
                          'clinical-summary:generate': e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <div className="font-bold text-[#133840]">clinical-summary:generate</div>
                      <div className="text-[11px] text-[#607582]">
                        Allows clinician to generate synthesized, automated clinical handover summaries.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Validity Duration Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#133840] block">
                  Validity Duration <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '15m', label: '15 Minutes', note: 'Emergency / Triage' },
                    { id: '1h', label: '1 Hour', note: 'Standard OPD Visit' },
                    { id: '24h', label: '24 Hours', note: 'Inpatient Observation' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedConsentDuration(d.id as '15m' | '1h' | '24h')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedConsentDuration === d.id
                          ? 'border-teal-700 bg-teal-50 text-teal-900 font-bold shadow-xs'
                          : 'border-[#DFE7E4] bg-[#FAF9F6] text-[#607582] hover:bg-white'
                      }`}
                    >
                      <div className="text-xs">{d.label}</div>
                      <div className="text-[10px] text-[#8CA09A]">{d.note}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConsent}
                  className="bg-[#133840] hover:bg-[#0E7068] disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <ShieldCheck size={14} />
                  <span>{isSubmittingConsent ? 'Granting...' : 'Authorize & Issue Consent'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Live Optical / Camera Patient Scanner Modal */}
      {showPatientScannerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0F1E24] text-white rounded-3xl border border-teal-500/30 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-teal-900/50 bg-[#13272F]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <Scan size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Patient Optical Scanner</h3>
                  <p className="text-xs text-teal-300/80">Scan Clinic Desks, Medication Barcodes &amp; Lab Reports</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPatientScannerModal(false);
                  stopPatientCamera();
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Viewfinder View */}
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-teal-500/40 shadow-inner flex items-center justify-center">
                <video
                  ref={patientVideoRef}
                  className={`w-full h-full object-cover ${patientCameraStreamActive ? 'block' : 'hidden'}`}
                  playsInline
                  muted
                />

                {!patientCameraStreamActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0a181e] via-[#0b1b22] to-[#081318]">
                    {/* Targeting Reticle Grid */}
                    <div className="w-48 h-48 border border-teal-500/30 rounded-2xl relative flex items-center justify-center">
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-teal-400" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-teal-400" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-teal-400" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-teal-400" />
                      <Camera size={36} className="text-teal-400/60 animate-pulse" />
                    </div>
                    <div className="mt-3 text-xs font-mono tracking-wider text-teal-300/80 uppercase">
                      Optical Reticle Ready · Aim at Barcode or QR
                    </div>
                  </div>
                )}

                {/* Laser scanline animation */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_12px_#2dd4bf] animate-[bounce_2.5s_ease-in-out_infinite] pointer-events-none" />

                {/* Overlay Controls */}
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-teal-500/30 text-[11px] font-mono text-teal-300">
                    <span className={`w-2 h-2 rounded-full ${patientCameraStreamActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    {patientCameraStreamActive ? 'Live Camera Feed' : 'Optical Sensor Mode'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (patientCameraStreamActive) stopPatientCamera();
                      else startPatientCamera();
                    }}
                    className="bg-teal-600/90 hover:bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm shadow transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera size={13} />
                    <span>{patientCameraStreamActive ? 'Switch to Reticle' : 'Turn On Camera'}</span>
                  </button>
                </div>
              </div>

              {/* Camera Error Notice if any */}
              {patientCameraError && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-amber-400" />
                  <span>{patientCameraError}</span>
                </div>
              )}

              {/* Scanned Result Notice if any */}
              {scannedResultDetails && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                  <span>{scannedResultDetails}</span>
                </div>
              )}

              {/* 1-Click Interactive Scan Targets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold text-teal-200">Present Medical Target or Tap Below to Scan:</span>
                  <span className="text-[11px] text-teal-400/80">Simulate hardware scan</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {PRESET_PATIENT_SCAN_TARGETS.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      disabled={isScanningPatientCode}
                      onClick={() => handleExecutePatientScan(target)}
                      className="p-3 rounded-2xl bg-white/5 hover:bg-teal-900/30 border border-white/10 hover:border-teal-500/50 text-left transition-all duration-150 flex items-start justify-between gap-3 group cursor-pointer disabled:opacity-50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white group-hover:text-teal-200">
                            {target.title}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            {target.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">{target.subtitle}</p>
                        <p className="text-[10px] text-teal-300/80 font-mono">{target.details}</p>
                      </div>
                      <div className="shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                          <Scan size={14} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-teal-900/50 bg-[#13272F] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowPatientScannerModal(false);
                  stopPatientCamera();
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Smartphone App & Digital Wallet Pass Modal */}
      {showMobileAppModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Smartphone Frame */}
          <div className="relative w-full max-w-[390px] bg-slate-950 rounded-[44px] p-3.5 border-4 border-slate-700/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col my-auto text-white">
            {/* Dynamic Island / Notch */}
            <div className="w-28 h-5 bg-black rounded-full mx-auto mb-2 flex items-center justify-center gap-1.5 shadow-inner">
              <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-800" />
              <div className="w-2 h-2 rounded-full bg-[#0a1a20]" />
            </div>

            {/* Mobile Status Bar */}
            <div className="flex items-center justify-between px-3 text-[11px] text-slate-300 font-medium mb-3">
              <span>9:41</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold">5G</span>
                <Wifi size={13} />
                <Battery size={14} />
              </div>
            </div>

            {/* Mobile Header */}
            <div className="flex items-center justify-between px-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 font-bold text-xs">
                  {getInitials(profile.name)}
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">{profile.name}</div>
                  <div className="text-[10px] text-teal-300/80 font-mono">UHID: {profile.uhid}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileAppModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Mobile Tab Navigation */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900/90 rounded-2xl my-3 text-[10px] font-medium border border-slate-800">
              {[
                { id: 'wallet', label: 'Pass', icon: CreditCard },
                { id: 'scanner', label: 'Scanner', icon: Camera },
                { id: 'emergency-id', label: 'SOS ID', icon: ShieldAlert },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = mobileActiveTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMobileActiveTab(t.id as typeof mobileActiveTab)}
                    className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-teal-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Content Area */}
            <div className="space-y-3 min-h-[360px] max-h-[460px] overflow-y-auto px-1 py-1">
              {/* TAB 1: Digital Health Pass & Apple/Google Wallet */}
              {mobileActiveTab === 'wallet' && (
                <div className="space-y-3">
                  {/* Apple/Google Wallet Pass Card */}
                  <div className="bg-gradient-to-br from-teal-900 via-teal-950 to-slate-900 border border-teal-500/40 rounded-3xl p-4 shadow-xl relative overflow-hidden">
                    {/* Holographic Security Shimmer Line */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-center justify-between border-b border-teal-700/40 pb-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <HeartPulse size={15} className="text-teal-400" />
                        <span className="text-[11px] font-bold tracking-wide uppercase text-teal-200">
                          MediVault Health Pass
                        </span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-teal-400/20 text-teal-300 border border-teal-400/30 px-2 py-0.5 rounded-full">
                        ABHA VERIFIED
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-bold text-white">{profile.name}</div>
                        <div className="text-[10px] text-teal-300/80 font-mono">{profile.age} yrs · {profile.sex}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block uppercase">Blood Group</span>
                        <span className="text-sm font-black text-rose-300 font-mono">{profile.bloodGroup}</span>
                      </div>
                    </div>

                    {/* QR Code Presentation in Wallet */}
                    <div className="bg-white p-2.5 rounded-2xl shadow-inner flex flex-col items-center justify-center my-2 text-slate-900">
                      {singleUseQrDataUrl ? (
                        <img
                          src={singleUseQrDataUrl}
                          alt="Single Use QR"
                          className="w-36 h-36 object-contain"
                        />
                      ) : (
                        <div className="w-36 h-36 bg-slate-100 rounded-xl flex flex-col items-center justify-center p-2 text-center">
                          <QrCode size={56} className="text-teal-900" />
                          <span className="text-[9px] font-mono font-bold text-teal-900 mt-1">
                            MV-PASS-{profile.uhid.slice(-4)}
                          </span>
                        </div>
                      )}
                      <span className="text-[9px] font-mono text-slate-500 mt-1">
                        Dynamic Encrypted Token · Rotates Every 15m
                      </span>
                    </div>

                    {/* Allergies / Medical Badges */}
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="text-slate-400">Allergies:</span>
                      <span className="font-bold text-rose-300">
                        {allergies.map((a) => a.allergen).join(', ') || 'No known allergies'}
                      </span>
                    </div>
                  </div>

                  {/* NFC Touchless Reader Action */}
                  <button
                    type="button"
                    onClick={handleTriggerNfcTap}
                    className={`w-full p-3 rounded-2xl border transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                      nfcBeamingActive
                        ? 'bg-teal-500 text-white border-teal-300 shadow-[0_0_20px_#14b8a6]'
                        : 'bg-teal-950/60 hover:bg-teal-900/80 text-teal-200 border-teal-500/40'
                    }`}
                  >
                    <Radio size={16} className={nfcBeamingActive ? 'animate-ping' : ''} />
                    <span className="text-xs font-bold">
                      {nfcBeamingActive ? 'Transmitting Pass via NFC...' : 'Hold Near Clinician Reader (NFC)'}
                    </span>
                  </button>

                  {/* Share & Wallet Export Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleNativeSharePass}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 size={13} className="text-teal-400" />
                      <span>Share Pass</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.success('Pass exported to Apple & Google Wallet format (.pkpass)!')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard size={13} className="text-amber-400" />
                      <span>Add to Wallet</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Mobile Optical Scanner */}
              {mobileActiveTab === 'scanner' && (
                <div className="space-y-3">
                  <div className="bg-black rounded-2xl border border-teal-500/40 p-4 relative aspect-[4/3] flex flex-col items-center justify-center text-center overflow-hidden">
                    <div className="w-32 h-32 border border-teal-400/40 rounded-xl relative flex items-center justify-center">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-teal-400" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-teal-400" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-teal-400" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-teal-400" />
                      <Scan size={28} className="text-teal-400 animate-pulse" />
                    </div>
                    <div className="absolute inset-x-0 h-0.5 bg-teal-400/80 shadow-[0_0_8px_#2dd4bf] animate-[bounce_2s_ease-in-out_infinite]" />
                    <span className="text-[10px] font-mono text-teal-300 mt-3">AIM SMARTPHONE CAMERA</span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-teal-200 block">Tap Target to Test Scan:</span>
                    {PRESET_PATIENT_SCAN_TARGETS.slice(0, 3).map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => handleExecutePatientScan(target)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-teal-950/40 border border-slate-800 hover:border-teal-500/40 text-left transition-colors flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div className="truncate pr-2">
                          <div className="font-bold text-white truncate">{target.title}</div>
                          <div className="text-[10px] text-slate-400 truncate">{target.tag}</div>
                        </div>
                        <Scan size={14} className="text-teal-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: Emergency Medical ID (Lockscreen SOS Pass) */}
              {mobileActiveTab === 'emergency-id' && (
                <div className="space-y-3">
                  <div className="bg-rose-950/60 border border-rose-600/60 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-rose-800/60 pb-2">
                      <div className="flex items-center gap-1.5 text-rose-300">
                        <ShieldAlert size={16} />
                        <span className="text-xs font-black uppercase tracking-wider">
                          Emergency Medical ID
                        </span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-rose-500/20 text-rose-200 border border-rose-500/30 px-2 py-0.5 rounded-full">
                        NDHM §33
                      </span>
                    </div>

                    <div className="text-[11px] text-rose-100/90 leading-tight">
                      Accessible without passcode for first responders and ER clinicians.
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-black/40 rounded-xl p-2 border border-rose-800/40">
                        <span className="text-[10px] text-rose-300 block font-bold uppercase">Blood Group</span>
                        <span className="text-base font-black text-white">{profile.bloodGroup}</span>
                      </div>
                      <div className="bg-black/40 rounded-xl p-2 border border-rose-800/40">
                        <span className="text-[10px] text-rose-300 block font-bold uppercase">Severe Allergy</span>
                        <span className="text-xs font-bold text-rose-200">
                          {allergies.map((a) => a.allergen).join(', ') || 'None Reported'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-black/40 rounded-xl p-2 border border-rose-800/40 space-y-1 text-xs">
                      <span className="text-[10px] text-rose-300 block font-bold uppercase">Chronic Conditions</span>
                      <div className="text-[11px] text-slate-200 font-medium">
                        {conditions.map((c) => c.condition).join(', ') || 'None recorded'}
                      </div>
                    </div>

                    <div className="bg-black/40 rounded-xl p-2.5 border border-rose-800/40 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-rose-300 block font-bold uppercase">Emergency Contact</span>
                        <span className="text-xs font-bold text-white">
                          {profile.emergencyContact?.name || 'Rohan Deshmukh'} ({profile.emergencyContact?.relation || 'Spouse'})
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {profile.emergencyContact?.phone || '+91 98201 44820'}
                        </span>
                      </div>
                      <a
                        href={`tel:${profile.emergencyContact?.phone || '+919820144820'}`}
                        className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-colors cursor-pointer shadow-md"
                      >
                        <PhoneCall size={15} />
                      </a>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Smartphone Bottom Home Bar */}
            <div className="w-32 h-1 bg-slate-600 rounded-full mx-auto mt-3 mb-1" />
          </div>
        </div>
      )}
    </div>
  );
}
