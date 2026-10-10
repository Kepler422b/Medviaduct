'use client';

import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import {
  Globe2,
  MapPin,
  ChevronRight,
  Layers,
  Table as TableIcon,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Eye,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Shield,
  RotateCw,
  Info
} from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  MAHARASHTRA_DISTRICTS,
  MAHARASHTRA_DIVISIONS,
  type DistrictSurveillanceRecord,
  type AdministrativeDivision,
  type SurveilledDisease,
  type SurveillanceAlertLevel,
  formatPrivacySuppressed
} from '@/data/maharashtraData';
import { INDIA_STATES_DATA, type StateSurveillanceRecord } from '@/data/indiaData';

interface IndiaMapProps {
  selectedDivision?: AdministrativeDivision | 'All';
  selectedDisease?: SurveilledDisease;
  onDistrictSelect?: (district: DistrictSurveillanceRecord) => void;
  selectedDistrictId?: string;
}

// ----------------- 3D GLOBE COMPONENT -----------------
function Globe3D({ onSelectIndia }: { onSelectIndia: () => void }) {
  const globeRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (globeRef.current && !hovered) {
      globeRef.current.rotation.y += delta * 0.12;
    }
  });

  // Calculate India 3D position on sphere (radius = 2.2)
  // India approx: lat 20.59° N, lng 78.96° E
  const phi = (90 - 20.59) * (Math.PI / 180);
  const theta = (78.96 + 180) * (Math.PI / 180);
  const radius = 2.22;
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return (
    <group ref={globeRef}>
      {/* Base Globe Sphere */}
      <mesh>
        <sphereGeometry args={[2.2, 48, 48]} />
        <meshStandardMaterial
          color="#123B46"
          roughness={0.65}
          metalness={0.15}
          wireframe={false}
        />
      </mesh>

      {/* Subtle longitude/latitude grid cage */}
      <mesh>
        <sphereGeometry args={[2.21, 24, 24]} />
        <meshBasicMaterial color="#237C78" wireframe transparent opacity={0.25} />
      </mesh>

      {/* Atmosphere outer glow */}
      <mesh>
        <sphereGeometry args={[2.35, 32, 32]} />
        <meshBasicMaterial color="#70D6FF" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>

      {/* India Marker Beacon */}
      <group position={[x, y, z]}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onSelectIndia();
          }}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color="#2DD4BF" />
        </mesh>

        <mesh>
          <ringGeometry args={[0.09, 0.14, 24]} />
          <meshBasicMaterial color="#82BE90" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>

        <Html distanceFactor={6} position={[0, 0.22, 0]} center>
          <button
            onClick={onSelectIndia}
            className="group whitespace-nowrap bg-[#133840]/90 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded-full border border-teal-400/60 shadow-lg flex items-center gap-1.5 hover:scale-105 transition-transform"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>India Surveillance Hub</span>
            <ArrowUpRight size={12} className="text-teal-300" />
          </button>
        </Html>
      </group>
    </group>
  );
}

export function IndiaMap({
  selectedDivision = 'All',
  selectedDisease = 'Dengue',
  onDistrictSelect,
  selectedDistrictId
}: IndiaMapProps) {
  // Navigation level: 'globe' | 'national' | 'maharashtra'
  const [viewLevel, setViewLevel] = useState<'globe' | 'national' | 'maharashtra'>('maharashtra');
  const [viewMode, setViewMode] = useState<'map' | 'table'>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDistrict, setActiveDistrict] = useState<DistrictSurveillanceRecord | null>(
    () => MAHARASHTRA_DISTRICTS.find((d) => d.id === (selectedDistrictId || 'pune')) || MAHARASHTRA_DISTRICTS[0]
  );
  const [activeState, setActiveState] = useState<StateSurveillanceRecord | null>(
    () => INDIA_STATES_DATA.find((s) => s.id === 'maharashtra') || INDIA_STATES_DATA[0]
  );

  // Sync selection if prop changes
  useEffect(() => {
    if (selectedDistrictId) {
      const match = MAHARASHTRA_DISTRICTS.find((d) => d.id === selectedDistrictId);
      if (match) setActiveDistrict(match);
    }
  }, [selectedDistrictId]);

  const handleSelectDistrict = (district: DistrictSurveillanceRecord) => {
    setActiveDistrict(district);
    if (onDistrictSelect) {
      onDistrictSelect(district);
    }
  };

  // Filtered districts
  const filteredDistricts = useMemo(() => {
    return MAHARASHTRA_DISTRICTS.filter((d) => {
      const matchesDivision = selectedDivision === 'All' || d.division === selectedDivision;
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.headquarters.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.division.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDivision && matchesSearch;
    });
  }, [selectedDivision, searchQuery]);

  // Filtered national states
  const filteredStates = useMemo(() => {
    return INDIA_STATES_DATA.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.zone.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Alert color helper
  const getAlertBadge = (level: SurveillanceAlertLevel | 'Baseline' | 'Watch' | 'Alert' | 'Outbreak Spike') => {
    switch (level) {
      case 'Outbreak Spike':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-800',
          dot: 'bg-rose-500',
          fill: '#F43F5E'
        };
      case 'Alert':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          dot: 'bg-amber-500',
          fill: '#F59E0B'
        };
      case 'Watch':
        return {
          bg: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          dot: 'bg-yellow-500',
          fill: '#EAB308'
        };
      default:
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dot: 'bg-emerald-500',
          fill: '#10B981'
        };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#DFE7E4] shadow-sm overflow-hidden flex flex-col">
      {/* Top Breadcrumb & Control Bar */}
      <div className="bg-[#FAF9F6] border-b border-[#DFE7E4] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-xs text-[#607582]">
          <button
            onClick={() => setViewLevel('globe')}
            className={`flex items-center gap-1 font-medium transition-colors hover:text-[#133840] ${
              viewLevel === 'globe' ? 'text-[#133840] font-semibold' : ''
            }`}
          >
            <Globe2 size={14} className="text-teal-700" />
            <span>Globe 3D</span>
          </button>

          <ChevronRight size={13} className="text-slate-300" />

          <button
            onClick={() => setViewLevel('national')}
            className={`font-medium transition-colors hover:text-[#133840] ${
              viewLevel === 'national' ? 'text-[#133840] font-semibold' : ''
            }`}
          >
            India (36 States/UTs)
          </button>

          <ChevronRight size={13} className="text-slate-300" />

          <button
            onClick={() => setViewLevel('maharashtra')}
            className={`font-medium transition-colors hover:text-[#133840] ${
              viewLevel === 'maharashtra' ? 'text-[#133840] font-semibold' : ''
            }`}
          >
            Maharashtra (36 Districts)
          </button>

          {viewLevel === 'maharashtra' && activeDistrict && (
            <>
              <ChevronRight size={13} className="text-slate-300" />
              <span className="text-teal-900 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                {activeDistrict.name}
              </span>
            </>
          )}
        </div>

        {/* View Toggle (Map vs Accessible Table) */}
        <div className="flex items-center gap-2">
          <div className="bg-white p-0.5 rounded-lg border border-[#DCE4E1] flex items-center shadow-xs">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'map'
                  ? 'bg-[#133840] text-white shadow-xs'
                  : 'text-[#607582] hover:text-[#133840]'
              }`}
            >
              <Layers size={13} />
              <span>Map View</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#133840] text-white shadow-xs'
                  : 'text-[#607582] hover:text-[#133840]'
              }`}
            >
              <TableIcon size={13} />
              <span>Accessible Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewport Content */}
      <div className="relative min-h-[440px] flex-1 flex flex-col md:flex-row bg-[#FDFBF7]">
        {/* ===================== MAP / 3D CANVAS VIEW ===================== */}
        {viewMode === 'map' ? (
          <>
            {/* VIEW 1: 3D GLOBE */}
            {viewLevel === 'globe' && (
              <div className="relative w-full h-[480px] bg-[#0E282E] flex items-center justify-center">
                <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
                  <ambientLight intensity={0.65} />
                  <pointLight position={[10, 10, 10]} intensity={1.2} />
                  <Suspense fallback={null}>
                    <Globe3D onSelectIndia={() => setViewLevel('national')} />
                  </Suspense>
                  <OrbitControls
                    enableZoom={true}
                    minDistance={3.5}
                    maxDistance={8}
                    autoRotate={false}
                  />
                </Canvas>

                {/* Floating Globe Overlay HUD */}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md rounded-xl p-3 border border-white/40 shadow-lg text-xs max-w-xs pointer-events-auto">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-[#133840]">Global Surveillance Coordinate</span>
                  </div>
                  <p className="text-[11px] text-[#607582]">
                    Rotate sphere to explore. Click the glowing marker at{' '}
                    <strong className="text-teal-800">lat: 20.59° N, lng: 78.96° E</strong> to drill
                    into India.
                  </p>
                  <button
                    onClick={() => setViewLevel('national')}
                    className="mt-2.5 w-full bg-[#133840] hover:bg-[#0E7068] text-white py-1.5 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Inspect India (36 States & UTs)</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 2: NATIONAL INDIA MAP */}
            {viewLevel === 'national' && (
              <div className="w-full p-4 flex flex-col md:flex-row gap-4">
                {/* SVG National Grid/Map Representation */}
                <div className="flex-1 bg-white rounded-xl border border-[#DFE7E4] p-4 flex flex-col items-center justify-center min-h-[420px]">
                  <div className="w-full flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#133840]">
                        National Surveillance Grid (28 States + 8 UTs)
                      </h4>
                      <p className="text-[11px] text-[#607582]">
                        Select any territory to view sentinel facilities & disease burdens.
                      </p>
                    </div>
                    <button
                      onClick={() => setViewLevel('maharashtra')}
                      className="bg-[#133840] hover:bg-[#0E7068] text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <span>Drill into Maharashtra First</span>
                      <ArrowUpRight size={13} />
                    </button>
                  </div>

                  {/* Grid of Indian States categorized by Zone */}
                  <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredStates.map((state) => {
                      const isSelected = activeState?.id === state.id;
                      const badge = getAlertBadge(state.alertLevel);
                      const isMh = state.id === 'maharashtra';

                      return (
                        <div
                          key={state.id}
                          onClick={() => {
                            setActiveState(state);
                            if (isMh) setViewLevel('maharashtra');
                          }}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isMh
                              ? 'border-teal-500 bg-teal-50/60 shadow-xs'
                              : isSelected
                              ? 'border-[#133840] bg-slate-50 shadow-xs'
                              : 'border-[#E3ECE8] bg-white hover:border-teal-300 hover:bg-[#F9FCFA]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-[#133840]">
                              {state.name}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${badge.bg}`}
                            >
                              {state.code}
                            </span>
                          </div>

                          <div className="text-[10px] text-[#607582] mt-1 flex items-center justify-between">
                            <span>Zone: {state.zone}</span>
                            <span className="font-medium text-slate-700">
                              {state.dengueCases.toLocaleString()} Dengue
                            </span>
                          </div>

                          {isMh && (
                            <div className="mt-1.5 pt-1 border-t border-teal-200/60 flex items-center justify-between text-[10px] font-semibold text-teal-800">
                              <span>Flagship Surveillance</span>
                              <span className="flex items-center gap-0.5">
                                Drill down <ArrowUpRight size={11} />
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* State Inspector Sidebar */}
                {activeState && (
                  <div className="w-full md:w-80 bg-white rounded-xl border border-[#DFE7E4] p-4 flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-[#607582]">
                            {activeState.type} · {activeState.zone} Zone
                          </span>
                          <h3 className="text-base font-serif font-bold text-[#133840]">
                            {activeState.name}
                          </h3>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            getAlertBadge(activeState.alertLevel).bg
                          }`}
                        >
                          {activeState.alertLevel}
                        </span>
                      </div>

                      <div className="space-y-3 mt-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-[#FAF9F6] p-2 rounded-lg border border-slate-100">
                            <span className="text-[10px] text-[#607582] block">Capital</span>
                            <span className="font-semibold text-[#133840]">
                              {activeState.capital}
                            </span>
                          </div>
                          <div className="bg-[#FAF9F6] p-2 rounded-lg border border-slate-100">
                            <span className="text-[10px] text-[#607582] block">Population</span>
                            <span className="font-semibold text-[#133840]">
                              {(activeState.population2026 / 1000000).toFixed(1)}M
                            </span>
                          </div>
                        </div>

                        <div className="bg-[#F8FAF9] p-3 rounded-lg border border-[#DFECE6] space-y-2">
                          <div className="text-[11px] font-semibold text-[#133840] flex items-center justify-between">
                            <span>Reporting Facilities</span>
                            <span className="font-mono text-teal-700">
                              {activeState.reportingCompletenessPct}% on-time
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-teal-600 h-full rounded-full"
                              style={{ width: `${activeState.reportingCompletenessPct}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-[#607582] flex justify-between">
                            <span>Active Facilities</span>
                            <span className="font-medium text-slate-800">
                              {activeState.reportingFacilities.toLocaleString()} sentinel units
                            </span>
                          </div>
                        </div>

                        {/* Disease summary */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between p-1.5 rounded bg-slate-50">
                            <span className="text-[#607582]">Dengue Cases</span>
                            <span className="font-semibold text-[#133840]">
                              {activeState.dengueCases.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between p-1.5 rounded bg-slate-50">
                            <span className="text-[#607582]">Malaria Cases</span>
                            <span className="font-semibold text-[#133840]">
                              {activeState.malariaCases.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between p-1.5 rounded bg-slate-50">
                            <span className="text-[#607582]">COVID-19 Cases</span>
                            <span className="font-semibold text-[#133840]">
                              {activeState.covidCases.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setViewLevel('maharashtra')}
                      className="mt-4 w-full bg-[#133840] hover:bg-[#0E7068] text-white py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>Open Maharashtra 36 Districts</span>
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: MAHARASHTRA 36-DISTRICT MAP */}
            {viewLevel === 'maharashtra' && (
              <div className="w-full p-4 flex flex-col lg:flex-row gap-4">
                {/* 36-District Interactive Cluster Map */}
                <div className="flex-1 bg-white rounded-xl border border-[#DFE7E4] p-4 flex flex-col">
                  {/* Top Bar with Division selector */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-bold text-[#133840] uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin size={14} className="text-teal-700" />
                        Maharashtra 36-District Surveillance Map
                      </h4>
                      <p className="text-[11px] text-[#607582]">
                        Showing active monitoring for <strong className="text-teal-900">{selectedDisease}</strong>.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Baseline
                      </span>
                      <span className="flex items-center gap-1 text-amber-700 font-medium ml-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> Alert
                      </span>
                      <span className="flex items-center gap-1 text-rose-700 font-medium ml-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Outbreak
                      </span>
                    </div>
                  </div>

                  {/* 36-District Cluster Grid categorized by Division */}
                  <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                    {MAHARASHTRA_DIVISIONS.filter(
                      (div) => selectedDivision === 'All' || div.division === selectedDivision
                    ).map((divMeta) => {
                      const divDistricts = filteredDistricts.filter(
                        (d) => d.division === divMeta.division
                      );
                      if (divDistricts.length === 0) return null;

                      return (
                        <div key={divMeta.division} className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-[#133840] bg-[#FAF9F6] px-2.5 py-1 rounded-md border border-[#ECEFEA]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-teal-600" />
                              {divMeta.division} Division ({divDistricts.length} Districts)
                            </span>
                            <span className="text-[10px] text-[#607582] font-normal">
                              {divMeta.keyDistricts}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {divDistricts.map((district) => {
                              const isSelected = activeDistrict?.id === district.id;
                              const diseaseData = district.diseases[selectedDisease];
                              const badge = getAlertBadge(diseaseData.alertLevel);

                              return (
                                <button
                                  key={district.id}
                                  onClick={() => handleSelectDistrict(district)}
                                  className={`p-2 rounded-xl text-left border transition-all ${
                                    isSelected
                                      ? 'border-[#133840] bg-teal-50/80 ring-2 ring-teal-500/30 shadow-xs'
                                      : 'border-[#E3ECE8] bg-white hover:border-teal-300 hover:bg-[#F9FCFA]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs text-[#133840] truncate">
                                      {district.name}
                                    </span>
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`}
                                      title={diseaseData.alertLevel}
                                    />
                                  </div>

                                  <div className="mt-1 flex items-center justify-between text-[10px]">
                                    <span className="text-[#607582]">Cases:</span>
                                    <span className="font-semibold text-slate-800">
                                      {formatPrivacySuppressed(diseaseData.currentPeriodCases)}
                                    </span>
                                  </div>

                                  <div className="text-[9px] text-[#71867E] flex justify-between mt-0.5">
                                    <span>WoW:</span>
                                    <span
                                      className={
                                        diseaseData.percentChange > 0
                                          ? 'text-rose-600 font-semibold'
                                          : 'text-emerald-600 font-semibold'
                                      }
                                    >
                                      {diseaseData.percentChange > 0 ? '+' : ''}
                                      {diseaseData.percentChange}%
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected District Deep-Dive Inspector */}
                {activeDistrict && (
                  <div className="w-full lg:w-88 bg-white rounded-xl border border-[#DFE7E4] p-4 flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#607582]">
                            {activeDistrict.division} Division · Code: {activeDistrict.code}
                          </span>
                          <h3 className="text-lg font-serif font-bold text-[#133840]">
                            {activeDistrict.name}
                          </h3>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                            getAlertBadge(activeDistrict.diseases[selectedDisease].alertLevel).bg
                          }`}
                        >
                          {activeDistrict.diseases[selectedDisease].alertLevel}
                        </span>
                      </div>

                      <div className="mt-3 space-y-3">
                        {/* Demographic & Reporting stats */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-[#FAF9F6] p-2.5 rounded-lg border border-slate-100">
                            <span className="text-[10px] text-[#607582] block">Headquarters</span>
                            <span className="font-semibold text-[#133840]">
                              {activeDistrict.headquarters}
                            </span>
                          </div>
                          <div className="bg-[#FAF9F6] p-2.5 rounded-lg border border-slate-100">
                            <span className="text-[10px] text-[#607582] block">Est. Population</span>
                            <span className="font-semibold text-[#133840]">
                              {(activeDistrict.population2026 / 1000000).toFixed(2)}M
                            </span>
                          </div>
                        </div>

                        {/* Facility Completeness */}
                        <div className="bg-[#F8FAF9] p-3 rounded-lg border border-[#DFECE6]">
                          <div className="text-[11px] font-semibold text-[#133840] flex justify-between">
                            <span>Reporting Completeness</span>
                            <span className="font-mono text-teal-800">
                              {activeDistrict.reportingFacilities.completenessPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden my-1.5">
                            <div
                              className="bg-teal-600 h-full rounded-full"
                              style={{
                                width: `${activeDistrict.reportingFacilities.completenessPct}%`
                              }}
                            />
                          </div>
                          <div className="text-[10px] text-[#607582] flex justify-between">
                            <span>Reporting on time</span>
                            <span>
                              {activeDistrict.reportingFacilities.reportingOnTime} /{' '}
                              {activeDistrict.reportingFacilities.total} health facilities
                            </span>
                          </div>
                        </div>

                        {/* Monitored Disease Detail */}
                        <div className="border border-[#E2EAE6] rounded-xl p-3 bg-gradient-to-b from-[#FAF9F6] to-white space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#133840]">
                              {selectedDisease} Surveillance
                            </span>
                            <span className="text-[10px] font-mono text-[#607582]">Epi Week 41</span>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <div className="text-2xl font-serif font-bold text-[#133840]">
                              {formatPrivacySuppressed(
                                activeDistrict.diseases[selectedDisease].currentPeriodCases
                              )}
                            </div>
                            <div
                              className={`text-xs font-semibold flex items-center gap-0.5 ${
                                activeDistrict.diseases[selectedDisease].percentChange > 0
                                  ? 'text-rose-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              <TrendingUp size={13} />
                              {activeDistrict.diseases[selectedDisease].percentChange > 0 ? '+' : ''}
                              {activeDistrict.diseases[selectedDisease].percentChange}% vs last week
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px]">
                            <span className="text-[#607582]">Test Positivity Rate (TPR)</span>
                            <span className="font-semibold text-slate-800">
                              {activeDistrict.diseases[selectedDisease].testPositivityPct}%
                            </span>
                          </div>
                        </div>

                        {/* Privacy Statement Callout */}
                        <div className="text-[10px] text-[#607582] bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-start gap-1.5">
                          <Shield size={12} className="text-teal-700 shrink-0 mt-0.5" />
                          <span>
                            Aggregated under Maharashtra Health Dept & IDSP privacy suppression rules (N &lt; 10 masked).
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2">
                      <button
                        onClick={() => setViewLevel('national')}
                        className="w-full text-xs text-[#607582] hover:text-[#133840] py-1.5 text-center font-medium transition-colors"
                      >
                        ← Back to National Overview
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ===================== ACCESSIBLE TABLE VIEW ===================== */
          <div className="w-full p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8CA09A]"
                />
                <input
                  type="text"
                  placeholder="Search district, division, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#DFE7E4] rounded-lg text-xs text-[#133840] placeholder:text-[#8CA09A] focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="text-xs text-[#607582]">
                Showing {filteredDistricts.length} of {MAHARASHTRA_DISTRICTS.length} Maharashtra districts
              </div>
            </div>

            <div className="overflow-x-auto border border-[#DFE7E4] rounded-xl bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F6] border-b border-[#DFE7E4] text-[#607582] font-medium uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">District</th>
                    <th className="py-2.5 px-3">Division</th>
                    <th className="py-2.5 px-3">Population</th>
                    <th className="py-2.5 px-3">Reporting Units</th>
                    <th className="py-2.5 px-3">Completeness</th>
                    <th className="py-2.5 px-3">{selectedDisease} Cases</th>
                    <th className="py-2.5 px-3">WoW Change</th>
                    <th className="py-2.5 px-3">Alert Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEFEA]">
                  {filteredDistricts.map((district) => {
                    const diseaseData = district.diseases[selectedDisease];
                    const badge = getAlertBadge(diseaseData.alertLevel);

                    return (
                      <tr
                        key={district.id}
                        onClick={() => handleSelectDistrict(district)}
                        className={`hover:bg-[#F9FCFA] cursor-pointer transition-colors ${
                          activeDistrict?.id === district.id ? 'bg-teal-50/50' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-[#133840]">
                          {district.name}
                        </td>
                        <td className="py-2.5 px-3 text-[#607582]">{district.division}</td>
                        <td className="py-2.5 px-3 text-[#607582]">
                          {(district.population2026 / 1000000).toFixed(2)}M
                        </td>
                        <td className="py-2.5 px-3 text-[#607582]">
                          {district.reportingFacilities.reportingOnTime} /{' '}
                          {district.reportingFacilities.total}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-teal-800">
                            {district.reportingFacilities.completenessPct}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#133840]">
                          {formatPrivacySuppressed(diseaseData.currentPeriodCases)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={
                              diseaseData.percentChange > 0
                                ? 'text-rose-600 font-semibold'
                                : 'text-emerald-600 font-semibold'
                            }
                          >
                            {diseaseData.percentChange > 0 ? '+' : ''}
                            {diseaseData.percentChange}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}`}
                          >
                            {diseaseData.alertLevel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
