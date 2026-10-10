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
  X
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
  const [qrSubTab, setQrSubTab] = useState<'consents' | 'generator'>('consents');
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
      const newToken = qrTokenService.create({
        recipientType,
        recipientName,
        duration: selectedDuration,
        permittedCategories
      });
      setActiveCreatedToken(newToken);

      const shareUrl = `${window.location.origin}/share/${newToken.token}`;
      const dataUrl = await QRCode.toDataURL(shareUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#123B46', light: '#FFFFFF' }
      });
      setGeneratedQrDataUrl(dataUrl);

      toast.success(`Secure QR Pass generated (${newToken.token})`);
    } catch (err: unknown) {
      toast.error('Could not generate QR code');
    }
  };

  // Revoke token
  const handleRevokeToken = (tokenId: string) => {
    try {
      qrTokenService.revoke(tokenId);
      toast.info('Access token revoked immediately');
    } catch (err: unknown) {
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
              onClick={() => setShowMediMate(!showMediMate)}
              className="bg-gradient-to-r from-teal-700 to-[#133840] hover:from-teal-800 hover:to-[#0E2C33] text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
            >
              <Sparkles size={14} className="text-teal-300 animate-pulse" />
              <span>MediMate AI</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </button>

            {/* Profile Avatar Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-teal-100 border border-teal-300 text-teal-900 font-semibold text-xs flex items-center justify-center">
                AD
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
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#133840]">
                {profile.name}
              </h1>
              <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-medium">
                Verified Enclave
              </span>
              <span className="text-xs bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-mono">
                {profile.bloodGroup}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-[#607582]">
              <span><strong>Age:</strong> {profile.age} yrs ({profile.sex})</span>
              <span>•</span>
              <span><strong>UHID:</strong> <code className="font-mono text-[#133840]">{profile.uhid}</code></span>
              <span>•</span>
              <span><strong>Primary Care:</strong> {profile.primaryCarePhysician.name} ({profile.primaryCarePhysician.hospital})</span>
              <span>•</span>
              <span><strong>Contact:</strong> {profile.phone}</span>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('qr-pass')}
              className="bg-white hover:bg-teal-50 text-[#133840] border border-[#CAD9D3] hover:border-teal-500 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            >
              <QrCode size={15} className="text-teal-700" />
              <span>Share Records via QR</span>
            </button>
            <button
              onClick={handleUploadSimulate}
              className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
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
            <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
              <AlertTriangle size={20} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Critical Drug Allergy Recorded
                </h4>
                <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                  Severe anaphylactic sensitivity to <strong>Penicillin & Beta-lactams</strong>. Moderate urticaria with <strong>NSAIDs (Ibuprofen / Naproxen)</strong>. Do not administer without allergy consultation.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('conditions')}
                className="text-xs font-semibold text-amber-900 underline hover:text-amber-950 shrink-0"
              >
                View Details
              </button>
            </div>

            {/* Quick Metrics KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
                <div className="flex items-center justify-between text-[#607582] text-xs">
                  <span>Active Medications</span>
                  <Pill size={16} className="text-teal-700" />
                </div>
                <div className="text-2xl font-serif font-bold text-[#133840] mt-2">
                  {prescriptions.filter((p) => p.status === 'Active').length}
                </div>
                <div className="text-[11px] text-teal-800 font-medium mt-1">
                  Metformin 500mg, Telmisartan 40mg
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
                <div className="flex items-center justify-between text-[#607582] text-xs">
                  <span>Glycemic Status (HbA1c)</span>
                  <Activity size={16} className="text-teal-700" />
                </div>
                <div className="text-2xl font-serif font-bold text-[#133840] mt-2">
                  6.8%
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-1">
                  Controlled · Target &lt; 7.0%
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
                <div className="flex items-center justify-between text-[#607582] text-xs">
                  <span>Blood Pressure (Last OPD)</span>
                  <HeartPulse size={16} className="text-teal-700" />
                </div>
                <div className="text-2xl font-serif font-bold text-[#133840] mt-2">
                  124 / 82
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-1">
                  Normotensive on Telmisartan
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
                <div className="flex items-center justify-between text-[#607582] text-xs">
                  <span>Secure QR Share Pass</span>
                  <QrCode size={16} className="text-teal-700" />
                </div>
                <div className="text-2xl font-serif font-bold text-[#133840] mt-2">
                  {qrTokens.filter((t) => t.status === 'Active').length} Active
                </div>
                <div className="text-[11px] text-teal-800 font-medium mt-1">
                  Authorized for Dr. Alex Morgan
                </div>
              </div>
            </div>

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
                          <div className="text-xs font-bold text-[#133840]">{visit.clinician}</div>
                          <div className="text-[11px] text-[#607582]">
                            {visit.specialty} · {visit.hospital}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-[#DFE7E4] text-[#607582]">
                          {visit.date}
                        </span>
                      </div>
                      <p className="text-xs text-[#2A4D45] line-clamp-2 leading-relaxed">
                        <strong>Impression:</strong> {visit.impression}
                      </p>
                      <div className="text-[11px] text-[#607582] flex gap-3 pt-1 border-t border-slate-200/60 font-mono">
                        <span>BP: {visit.vitals.bloodPressure}</span>
                        <span>HR: {visit.vitals.pulse} bpm</span>
                        <span>SpO2: {visit.vitals.oxygen}%</span>
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
                          <button
                            onClick={() => toast.success(`Refill request sent for ${med.medicationName}`)}
                            className="bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-200 transition-colors"
                          >
                            Request Refill
                          </button>
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
                          <h4 className="font-bold text-sm text-[#133840]">{visit.clinician}</h4>
                          <span className="text-xs text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {visit.specialty}
                          </span>
                        </div>
                        <p className="text-xs text-[#607582]">{visit.hospital}</p>
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
                        <strong className="text-[#133840]">Clinical Impression:</strong> {visit.impression}
                      </div>
                      <div className="text-teal-900 font-medium">
                        <strong>Plan / Follow-up:</strong> {visit.plan}
                      </div>
                    </div>

                    {/* Vitals pill strip */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#607582] pt-1">
                      <span className="bg-slate-100 px-2 py-0.5 rounded">BP: {visit.vitals.bloodPressure}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded">Pulse: {visit.vitals.pulse} bpm</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded">Temp: {visit.vitals.temperature}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded">SpO2: {visit.vitals.oxygen}%</span>
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
                      <span className="font-bold text-sm text-[#133840]">{img.modality}: {img.anatomy}</span>
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
                  <span>Single-Use QR Pass Generator</span>
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

            {/* SubTab 2: Single-Use Ephemeral QR Pass Generator */}
            {qrSubTab === 'generator' && (
              <div className="bg-white rounded-2xl border border-[#DFE7E4] p-6 shadow-xs space-y-6">
                <div className="pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                      <QrCode size={18} />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-xl text-[#133840]">
                        Single-Use Ephemeral QR Health Pass
                      </h3>
                      <p className="text-xs text-[#607582]">
                        Zero clinical data embedded in the QR image. Encodes an ephemeral token strictly consumed upon doctor redemption.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left Column: Select Consent & Issue QR */}
                  <div className="lg:col-span-7 space-y-5">
                    <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#DFE7E4] space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#133840] block">
                        Select Authorized Consent
                      </label>
                      <select
                        value={selectedClinicianId}
                        onChange={(e) => setSelectedClinicianId(e.target.value)}
                        className="w-full bg-white border border-[#DFE7E4] rounded-xl px-3 py-2 text-xs text-[#133840] font-medium focus:outline-none focus:border-teal-600"
                      >
                        {consents
                          .filter((c) => c.status === 'active' && new Date(c.expiresAt).getTime() > Date.now())
                          .map((c) => (
                            <option key={c.id} value={c.clinicianId}>
                              {c.clinicianName || 'Verified Attending Clinician'} (Scopes: {c.scopes.join(', ')})
                            </option>
                          ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const activeConsent = consents.find(
                            (c) => c.status === 'active' && new Date(c.expiresAt).getTime() > Date.now()
                          );
                          if (activeConsent) {
                            handleGenerateSingleUseQr(activeConsent.id);
                          } else {
                            setShowGrantModal(true);
                          }
                        }}
                        disabled={isGeneratingSingleUseQr}
                        className="w-full bg-[#133840] hover:bg-[#0E7068] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isGeneratingSingleUseQr ? 'animate-spin' : ''} />
                        <span>{isGeneratingSingleUseQr ? 'Generating Ephemeral Token...' : 'Generate Fresh Single-Use QR'}</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-900">
                        <Lock size={13} />
                        <span>Zero-Trust Ephemeral Guarantee</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        This token expires strictly in <strong>5 minutes</strong>. When your clinician redeems it, an in-memory access grant is minted, and this QR token is permanently burned. No clinical data is ever stored in the QR image itself.
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Live QR Render */}
                  <div className="lg:col-span-5 bg-gradient-to-b from-[#FAF9F6] to-white rounded-2xl border-2 border-[#CADBD5] p-5 flex flex-col items-center text-center shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-800 mb-1">
                      <Lock size={13} />
                      <span>Live Single-Use Health Pass</span>
                    </div>
                    <p className="text-[11px] text-[#607582] max-w-xs">
                      Present to attending clinician for one-time redemption.
                    </p>

                    {/* QR Canvas Render */}
                    <div className="mt-4 p-3 bg-white rounded-2xl border border-slate-200 shadow-inner">
                      {singleUseQrDataUrl || generatedQrDataUrl ? (
                        <img
                          src={singleUseQrDataUrl || generatedQrDataUrl}
                          alt="Medviaduct Single-Use QR Pass"
                          className="w-52 h-52 object-contain rounded-lg"
                        />
                      ) : (
                        <div className="w-52 h-52 flex items-center justify-center text-xs text-[#8CA09A]">
                          Generate a Pass to view QR
                        </div>
                      )}
                    </div>

                    {/* Copyable Token Code */}
                    {(singleUseQrPayload || activeCreatedToken) && (
                      <div className="w-full mt-4 space-y-2 text-xs">
                        <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-[#607582]">Token String:</span>
                            <span className="font-mono text-rose-700 text-[10px] font-bold">5-Min Single-Use</span>
                          </div>
                          <code className="font-mono font-bold text-[11px] text-[#133840] break-all block bg-white p-2 rounded border border-slate-200 text-left">
                            {singleUseQrPayload || activeCreatedToken?.token}
                          </code>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const val = singleUseQrPayload || activeCreatedToken?.token || '';
                            navigator.clipboard.writeText(val);
                            toast.success('Single-use token code copied to clipboard');
                          }}
                          className="w-full bg-white hover:bg-slate-50 border border-slate-300 py-2 rounded-lg text-xs font-semibold text-[#133840] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Copy size={13} />
                          <span>Copy Token Code</span>
                        </button>
                      </div>
                    )}
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
    </div>
  );
}
