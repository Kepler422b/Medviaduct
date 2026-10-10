'use client';

import React, { useState, useMemo } from 'react';
import Link from '@/components/link';
import {
  Globe2,
  BarChart3,
  ShieldCheck,
  Filter,
  Download,
  AlertTriangle,
  Layers,
  Search,
  Calendar,
  Activity,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Info,
  TrendingUp,
  Hospital,
  MapPin,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { toast, Toaster } from 'sonner';
import {
  MAHARASHTRA_DISTRICTS,
  MAHARASHTRA_DIVISIONS,
  MAHARASHTRA_SOURCES,
  type AdministrativeDivision,
  type SurveilledDisease,
  type DistrictSurveillanceRecord,
  formatPrivacySuppressed
} from '@/data/maharashtraData';
import { IndiaMap } from './india-map';

const DISEASES: SurveilledDisease[] = [
  'Dengue',
  'Malaria',
  'COVID-19',
  'Influenza H1N1',
  'Acute Diarrheal Disease',
  'Leptospirosis',
  'Chikungunya'
];

const TIME_RANGES = [
  { id: 'weekly', label: 'Weekly (Epi Week 41, 2026)' },
  { id: 'monthly', label: 'Monthly (Sep - Oct 2026)' },
  { id: 'annual', label: 'Annual (YTD 2026)' }
] as const;

export function AdminPortal() {
  const [selectedDivision, setSelectedDivision] = useState<AdministrativeDivision | 'All'>('All');
  const [selectedDisease, setSelectedDisease] = useState<SurveilledDisease>('Dengue');
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly' | 'annual'>('weekly');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictSurveillanceRecord | null>(
    () => MAHARASHTRA_DISTRICTS.find((d) => d.id === 'pune') || MAHARASHTRA_DISTRICTS[0]
  );

  // Filtered districts
  const filteredDistricts = useMemo(() => {
    return MAHARASHTRA_DISTRICTS.filter((d) => {
      const matchDiv = selectedDivision === 'All' || d.division === selectedDivision;
      const matchSearch =
        d.name.toLowerCase().includes(searchDistrict.toLowerCase()) ||
        d.headquarters.toLowerCase().includes(searchDistrict.toLowerCase()) ||
        d.division.toLowerCase().includes(searchDistrict.toLowerCase());
      return matchDiv && matchSearch;
    });
  }, [selectedDivision, searchDistrict]);

  // Aggregate stats across Maharashtra
  const summaryStats = useMemo(() => {
    let totalCases = 0;
    let totalPop = 0;
    let activeAlerts = 0;
    let reportingFacilities = 0;
    let totalUnits = 0;

    filteredDistricts.forEach((d) => {
      totalCases += d.diseases[selectedDisease].currentPeriodCases;
      totalPop += d.population2026;
      if (
        d.diseases[selectedDisease].alertLevel === 'Alert' ||
        d.diseases[selectedDisease].alertLevel === 'Outbreak Spike'
      ) {
        activeAlerts += 1;
      }
      reportingFacilities += d.reportingFacilities.reportingOnTime;
      totalUnits += d.reportingFacilities.total;
    });

    const completeness = totalUnits > 0 ? Number(((reportingFacilities / totalUnits) * 100).toFixed(1)) : 96;

    return {
      totalCases,
      totalPop,
      activeAlerts,
      completeness,
      totalUnits
    };
  }, [filteredDistricts, selectedDisease]);

  // Chart data for 6 Divisions
  const divisionChartData = useMemo(() => {
    return MAHARASHTRA_DIVISIONS.map((divMeta) => {
      const districtsInDiv = MAHARASHTRA_DISTRICTS.filter((d) => d.division === divMeta.division);
      const divCases = districtsInDiv.reduce(
        (acc, curr) => acc + curr.diseases[selectedDisease].currentPeriodCases,
        0
      );
      return {
        division: divMeta.division,
        cases: divCases,
        districts: districtsInDiv.length
      };
    });
  }, [selectedDisease]);

  // Privacy-safe CSV export handler
  const handleExportCSV = () => {
    const headers = [
      'District',
      'Division',
      'Population',
      'Reporting Completeness (%)',
      `${selectedDisease} Cases (Privacy Masked)`,
      'WoW Percent Change (%)',
      'Surveillance Alert Status'
    ];

    const rows = filteredDistricts.map((d) => {
      const info = d.diseases[selectedDisease];
      return [
        `"${d.name}"`,
        `"${d.division}"`,
        d.population2026,
        d.reportingFacilities.completenessPct,
        `"${formatPrivacySuppressed(info.currentPeriodCases)}"`,
        info.percentChange,
        `"${info.alertLevel}"`
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `medviaduct-maharashtra-${selectedDisease.toLowerCase()}-surveillance.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Privacy-suppressed surveillance dataset downloaded');
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
                  Public-Health Surveillance Enclave
                </span>
              </div>
            </Link>

            <span className="hidden md:inline-block h-4 w-px bg-slate-200 mx-1" />

            <div className="hidden md:flex items-center gap-1.5 text-xs text-[#607582] bg-[#F4F8F6] px-2.5 py-1 rounded-full border border-[#DFEAE4]">
              <ShieldCheck size={14} className="text-teal-600" />
              <span>Admin Session · <strong>Dr. Elena Rostova</strong> (National Health Surveillance)</span>
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
              href="/clinic"
              className="text-xs text-[#607582] hover:text-[#133840] font-medium px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Clinician Portal
            </Link>
            <Link
              href="/login"
              title="Sign out of admin"
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
            >
              <BarChart3 size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* Surveillance Controls Bar */}
      <section className="bg-white border-b border-[#DFE7E4] py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#133840]">
                Maharashtra 36-District Epidemiological Surveillance
              </h1>
            </div>
            <p className="text-xs text-[#607582] mt-0.5">
              Live statutory feeds from IDSP/IHIP, NHM Maharashtra and NCDC. Strict k-anonymity (N &lt; 10 masked).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            >
              <FileSpreadsheet size={15} />
              <span>Export Privacy-Safe CSV</span>
            </button>
          </div>
        </div>

        {/* Filters Strip */}
        <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Disease Picker */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#607582] mr-1 flex items-center gap-1">
              <Activity size={13} /> Disease:
            </span>
            {DISEASES.map((dis) => (
              <button
                key={dis}
                onClick={() => setSelectedDisease(dis)}
                className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                  selectedDisease === dis
                    ? 'bg-[#133840] text-white shadow-xs font-bold'
                    : 'bg-[#FAF9F6] text-[#607582] hover:text-[#133840] border border-[#DFE7E4]'
                }`}
              >
                {dis}
              </button>
            ))}
          </div>

          {/* Time Range & Division Selectors */}
          <div className="flex items-center gap-2 text-xs">
            {/* Division dropdown */}
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value as any)}
              className="bg-[#FAF9F6] border border-[#DFE7E4] rounded-lg px-2.5 py-1.5 text-xs text-[#133840] font-medium focus:outline-none focus:border-teal-600"
            >
              <option value="All">All 6 Divisions</option>
              {MAHARASHTRA_DIVISIONS.map((d) => (
                <option key={d.division} value={d.division}>
                  {d.division} Division
                </option>
              ))}
            </select>

            {/* Time range dropdown */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-[#FAF9F6] border border-[#DFE7E4] rounded-lg px-2.5 py-1.5 text-xs text-[#133840] font-medium focus:outline-none focus:border-teal-600"
            >
              {TIME_RANGES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Main Surveillance Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
            <div className="flex items-center justify-between text-[#607582] text-xs">
              <span>Reported {selectedDisease} Cases</span>
              <Activity size={16} className="text-teal-700" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#133840] mt-2">
              {summaryStats.totalCases.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#607582] mt-1">
              Across {filteredDistricts.length} monitoring districts
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
            <div className="flex items-center justify-between text-[#607582] text-xs">
              <span>Reporting Completeness</span>
              <Building2 size={16} className="text-teal-700" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#133840] mt-2">
              {summaryStats.completeness}%
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">
              {summaryStats.totalUnits.toLocaleString()} sentinel health facilities reporting
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
            <div className="flex items-center justify-between text-[#607582] text-xs">
              <span>Early Warning Alerts</span>
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div className="text-2xl font-serif font-bold text-amber-700 mt-2">
              {summaryStats.activeAlerts} Districts
            </div>
            <div className="text-[11px] text-amber-800 font-medium mt-1">
              Surpassed mean + 2 SD outbreak threshold
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#DFE7E4] p-4 shadow-xs">
            <div className="flex items-center justify-between text-[#607582] text-xs">
              <span>Data Freshness</span>
              <RefreshCw size={16} className="text-teal-700" />
            </div>
            <div className="text-base font-bold text-[#133840] mt-2 font-mono">
              10 Oct 2026, 06:00 IST
            </div>
            <div className="text-[11px] text-teal-800 font-medium mt-1">
              IDSP / IHIP live statutory feed
            </div>
          </div>
        </div>

        {/* Interactive 3D Globe + India Map + Maharashtra Drill-down */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#133840] flex items-center gap-2">
                <Globe2 size={18} className="text-teal-700" />
                Spatial Surveillance Drill-Down (3D Globe → India 36 States/UTs → Maharashtra 36 Districts)
              </h2>
              <p className="text-xs text-[#607582]">
                Interactive multi-tiered visual mapping. Click nodes to focus epidemiological boundaries.
              </p>
            </div>
          </div>

          <IndiaMap
            selectedDivision={selectedDivision}
            selectedDisease={selectedDisease}
            selectedDistrictId={selectedDistrict?.id}
            onDistrictSelect={(d) => setSelectedDistrict(d)}
          />
        </section>

        {/* Division Comparisons Chart */}
        <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                <BarChart3 size={18} className="text-teal-700" />
                Administrative Division Comparison: {selectedDisease} Burdens
              </h3>
              <p className="text-xs text-[#607582]">
                Aggregated cases across the 6 administrative divisions of Maharashtra.
              </p>
            </div>
          </div>

          <div className="h-64 w-full pt-4 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <BarChart data={divisionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F0" />
                <XAxis dataKey="division" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="cases" fill="#133840" radius={[6, 6, 0, 0]} name={`${selectedDisease} Cases`} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* District Rankings Table */}
        <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h3 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
                <Building2 size={18} className="text-teal-700" />
                District Surveillance Rankings & Alert Levels
              </h3>
              <p className="text-xs text-[#607582]">
                Sorted by reported incidence. Strict suppression enforced (counts &lt; 10 masked).
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8CA09A]" />
              <input
                type="text"
                value={searchDistrict}
                onChange={(e) => setSearchDistrict(e.target.value)}
                placeholder="Search district name..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#FAF9F6] border border-[#DFE7E4] rounded-lg text-xs text-[#133840] focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-[#E2ECE7] rounded-xl bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F6] border-b border-slate-200 text-[#607582] text-[10px] uppercase font-semibold">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">District Name</th>
                  <th className="p-3">Division</th>
                  <th className="p-3">Facilities</th>
                  <th className="p-3">Completeness</th>
                  <th className="p-3 font-bold text-[#133840]">{selectedDisease} Cases</th>
                  <th className="p-3">WoW Change</th>
                  <th className="p-3">Alert Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDistricts
                  .slice()
                  .sort(
                    (a, b) =>
                      b.diseases[selectedDisease].currentPeriodCases -
                      a.diseases[selectedDisease].currentPeriodCases
                  )
                  .map((dist, idx) => {
                    const info = dist.diseases[selectedDisease];
                    const isSpike = info.alertLevel === 'Outbreak Spike';
                    const isAlert = info.alertLevel === 'Alert';

                    return (
                      <tr key={dist.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-[#607582]">#{idx + 1}</td>
                        <td className="p-3 font-bold text-[#133840]">{dist.name}</td>
                        <td className="p-3 text-[#607582]">{dist.division}</td>
                        <td className="p-3 text-[#607582]">
                          {dist.reportingFacilities.reportingOnTime} / {dist.reportingFacilities.total}
                        </td>
                        <td className="p-3 font-mono text-teal-800">
                          {dist.reportingFacilities.completenessPct}%
                        </td>
                        <td className="p-3 font-bold text-[#133840]">
                          {formatPrivacySuppressed(info.currentPeriodCases)}
                        </td>
                        <td className="p-3 font-semibold">
                          <span className={info.percentChange > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {info.percentChange > 0 ? '+' : ''}
                            {info.percentChange}%
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isSpike
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : isAlert
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {info.alertLevel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Official Statutory Integration Sources */}
        <section className="bg-white rounded-2xl border border-[#DFE7E4] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-serif font-bold text-base text-[#133840] flex items-center gap-2">
              <ShieldCheck size={18} className="text-teal-700" />
              Statutory Public Health Data Source Citations
            </h3>
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Verified Integrations
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MAHARASHTRA_SOURCES.map((src) => (
              <div
                key={src.id}
                className="p-4 rounded-xl border border-[#DFECE6] bg-[#FAF9F6] space-y-2 text-xs flex flex-col justify-between"
              >
                <div>
                  <h4 className="font-bold text-sm text-[#133840]">{src.portal}</h4>
                  <p className="text-[#607582] text-[11px] mt-0.5">{src.agency}</p>
                  <p className="text-[#45635C] mt-2">{src.dataCoverage}</p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-[#8CA09A]">
                  <span>Cadence: {src.reportingCadence}</span>
                  <a
                    href={src.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-800 font-semibold hover:underline flex items-center gap-0.5"
                  >
                    Portal <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
