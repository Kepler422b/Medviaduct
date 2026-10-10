'use client';

import React, { useEffect, useState } from 'react';
import Link from '@/components/link';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  User,
  HeartPulse,
  Pill,
  Calendar,
  FileText,
  Activity,
  ArrowLeft,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { qrTokenService } from '@/services/qrTokenService';
import { API_BASE } from '@/services/api';
import { qrApi } from '@/services/qrApi';

export function SecureShare({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // First try local token resolver
      const localResult = qrTokenService.resolveToken(token, {
        name: 'Verified Portal Consumer',
        facility: 'Direct Link Scan Session'
      });
      if (localResult) {
        setData(localResult);
        setLoading(false);
        return;
      }
    } catch (err: any) {
      if (err.message && !API_BASE) {
        setError(err.message);
        setLoading(false);
        return;
      }
    }

    // Fallback to backend API if configured
    if (API_BASE) {
      qrApi
        .resolve(token)
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch((e) => {
          setError(e.message);
          setLoading(false);
        });
    } else if (!data) {
      setError(
        'Invalid, expired, or non-existent QR access token. Please ask the patient to generate a new pass.'
      );
      setLoading(false);
    }
  }, [token]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF9F4] flex flex-col items-center justify-center p-4 text-[#133840]">
        <div className="bg-white p-8 rounded-2xl border border-[#DFE7E4] shadow-md flex flex-col items-center gap-3">
          <ShieldCheck className="text-teal-600 animate-pulse" size={36} />
          <p className="text-sm font-semibold">Verifying secure Medviaduct token…</p>
          <span className="text-xs text-[#607582] font-mono">{token}</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#FAF9F4] flex flex-col items-center justify-center p-4 text-[#133840]">
        <div className="bg-white p-8 rounded-2xl border border-rose-200 max-w-md w-full shadow-md text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-xl font-serif font-bold text-rose-950">Access Pass Unavailable</h1>
          <p className="text-xs text-[#607582] leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:underline"
            >
              <ArrowLeft size={14} /> Back to Medviaduct Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { patient, permittedCategories } = data;

  return (
    <main className="min-h-screen bg-[#FAF9F4] text-[#133840] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Verification Banner */}
        <div className="bg-white rounded-2xl border border-[#CADBD5] p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#133840] text-white font-bold flex items-center justify-center text-sm">
                M
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-700 block">
                  Verified Medviaduct Health Pass
                </span>
                <h1 className="text-lg font-serif font-bold text-[#133840]">
                  Authorized Patient Clinical Summary
                </h1>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Token: {token}
              </span>
              <div className="text-[10px] text-[#607582] mt-0.5">
                Expires: {new Date(data.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Patient Demographics */}
          {permittedCategories?.profile && patient?.profile && (
            <div className="bg-[#FAF9F6] p-4 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-serif font-bold text-[#133840]">
                    {patient.profile.name}
                  </h2>
                  <div className="text-xs text-[#607582]">
                    Age: {patient.profile.age} yrs ({patient.profile.sex}) • Blood Group: {patient.profile.bloodGroup}
                  </div>
                </div>
                <div className="text-xs font-mono text-[#607582]">
                  UHID: {patient.profile.uhid}
                </div>
              </div>
            </div>
          )}

          {/* Allergies */}
          {permittedCategories?.allergies && patient?.allergies && patient.allergies.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-600" />
                Critical Allergies & Contraindications
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {patient.allergies.map((alg: any) => (
                  <div
                    key={alg.id}
                    className="p-3 rounded-lg border border-rose-200 bg-rose-50/60 text-xs space-y-1"
                  >
                    <div className="flex justify-between font-bold text-rose-950">
                      <span>{alg.allergen}</span>
                      <span className="text-[10px] bg-rose-100 px-1.5 py-0.2 rounded font-semibold">
                        {alg.severity}
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-900">Reaction: {alg.reaction}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Medications */}
          {permittedCategories?.medications && patient?.prescriptions && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#133840] flex items-center gap-1.5">
                <Pill size={14} className="text-teal-700" />
                Active Prescriptions
              </h3>
              <div className="space-y-2">
                {patient.prescriptions
                  .filter((p: any) => p.status === 'Active')
                  .map((med: any) => (
                    <div
                      key={med.id}
                      className="p-3 rounded-lg border border-[#DFECE6] bg-[#FAF9F6] text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-[#133840]">{med.medicationName}</span>
                        <span className="text-teal-800 font-mono ml-2">({med.dosage})</span>
                        <div className="text-[11px] text-[#607582]">{med.instructions}</div>
                      </div>
                      <span className="font-mono text-[11px] text-[#45635C]">{med.frequency}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recent Lab Panels */}
          {permittedCategories?.labResults && patient?.labResults && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#133840] flex items-center gap-1.5">
                <HeartPulse size={14} className="text-teal-700" />
                Recent Laboratory Investigations
              </h3>
              <div className="space-y-2">
                {patient.labResults.slice(0, 2).map((lab: any) => (
                  <div
                    key={lab.id}
                    className="p-3 rounded-lg border border-[#DFECE6] bg-[#FAF9F6] text-xs space-y-1.5"
                  >
                    <div className="flex justify-between font-bold text-[#133840]">
                      <span>{lab.testName}</span>
                      <span className="font-mono text-[#607582]">{lab.date}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {lab.parameters.map((p: any, idx: number) => (
                        <span
                          key={idx}
                          className="bg-white px-2 py-0.5 rounded border border-slate-200"
                        >
                          {p.name}: <strong className="font-mono">{p.value} {p.unit}</strong> ({p.flag})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#8CA09A]">
            <span className="flex items-center gap-1">
              <Lock size={12} className="text-teal-700" />
              Secured with temporary token permissions.
            </span>
            <Link href="/clinic" className="text-teal-800 font-semibold hover:underline">
              Open in Clinician Workbench →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
