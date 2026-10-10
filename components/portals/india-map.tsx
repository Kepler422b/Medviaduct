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
  TrendingDown,
  Shield,
  RotateCw,
  RotateCcw,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Building2,
  Users,
  ExternalLink,
  X
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
import {
  MAHARASHTRA_GEO_PATHS,
  MAHARASHTRA_MAP_VIEWBOX,
  type DistrictGeoPath
} from '@/data/maharashtraGeoPaths';

interface IndiaMapProps {
  selectedDivision?: AdministrativeDivision | 'All';
  selectedDisease?: SurveilledDisease;
  onDistrictSelect?: (district: DistrictSurveillanceRecord | null) => void;
  selectedDistrictId?: string;
}

// ----------------- TREND SPARKLINE COMPONENT -----------------
function TrendSparkline({
  data,
  color = '#0E7068',
  height = 68,
  unit = 'cases'
}: {
  data: { week: string; cases: number }[];
  color?: string;
  height?: number;
  unit?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  if (!data || data.length === 0) return null;

  const width = 320;
  const paddingX = 12;
  const paddingY = 12;
  const cases = data.map((d) => d.cases);
  const minVal = Math.min(...cases);
  const maxVal = Math.max(...cases);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((d.cases - minVal) / range) * (height - 2 * paddingY);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - 2} L ${points[0].x.toFixed(1)} ${height - 2} Z`;

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        style={{ height: `${height}px` }}
      >
        <defs>
          <linearGradient id={`sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Shaded area */}
        <path d={areaD} fill={`url(#sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')})`} />

        {/* Baseline guideline */}
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          stroke="#E2E8F0"
          strokeDasharray="2 3"
          strokeWidth="1"
        />

        {/* Trend line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive points */}
        {points.map((pt, i) => {
          const isLatest = i === points.length - 1;
          const isHovered = hoverIndex === i;

          return (
            <g
              key={pt.week}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 4.5 : isLatest ? 3.5 : 2.5}
                fill={isHovered || isLatest ? '#FFFFFF' : color}
                stroke={color}
                strokeWidth={isHovered || isLatest ? 2.5 : 1.5}
                className="transition-all"
              />
              <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />
            </g>
          );
        })}
      </svg>

      {/* Week Labels & Hover Readout */}
      <div className="flex items-center justify-between text-[10px] text-[#607582] mt-1 font-mono">
        <span>{data[0]?.week}</span>
        {hoverIndex !== null ? (
          <span className="font-semibold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            {data[hoverIndex].week}: {formatPrivacySuppressed(data[hoverIndex].cases)} {unit}
          </span>
        ) : (
          <span className="text-[10px] text-[#71867E]">
            Min: {formatPrivacySuppressed(minVal)} · Max: {formatPrivacySuppressed(maxVal)}
          </span>
        )}
        <span>{data[data.length - 1]?.week} (Latest)</span>
      </div>
    </div>
  );
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

  // Division filter state (defaults to prop selectedDivision or 'All')
  const [divisionFilter, setDivisionFilter] = useState<AdministrativeDivision | 'All'>(
    selectedDivision || 'All'
  );

  useEffect(() => {
    if (selectedDivision) {
      setDivisionFilter(selectedDivision);
    }
  }, [selectedDivision]);

  // Active district state (initial state null = All Maharashtra overview)
  const [activeDistrict, setActiveDistrict] = useState<DistrictSurveillanceRecord | null>(() => {
    if (selectedDistrictId) {
      return MAHARASHTRA_DISTRICTS.find((d) => d.id === selectedDistrictId) || null;
    }
    return null;
  });

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

  const handleSelectDistrict = (district: DistrictSurveillanceRecord | null) => {
    setActiveDistrict(district);
    if (onDistrictSelect) {
      onDistrictSelect(district);
    }
  };

  // Map viewport pan & zoom states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    district: DistrictSurveillanceRecord;
  } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.35, 3.5));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(z - 0.35, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setActiveDistrict(null);
    setHoveredDistrictId(null);
    setTooltip(null);
    if (onDistrictSelect) {
      onDistrictSelect(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Filtered districts
  const filteredDistricts = useMemo(() => {
    return MAHARASHTRA_DISTRICTS.filter((d) => {
      const matchesDivision = divisionFilter === 'All' || d.division === divisionFilter;
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.headquarters.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.division.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDivision && matchesSearch;
    });
  }, [divisionFilter, searchQuery]);

  // Statewide aggregated statistics
  const statewideStats = useMemo(() => {
    let currentTotal = 0;
    let previousTotal = 0;
    let totalFacilities = 0;
    let reportingOnTimeTotal = 0;
    const alertCounts = { Baseline: 0, Watch: 0, Alert: 0, 'Outbreak Spike': 0 };

    const weekKeys =
      MAHARASHTRA_DISTRICTS[0]?.diseases[selectedDisease]?.weeklyTrend?.map((w) => w.week) || [];
    const weeklySums = new Array(weekKeys.length).fill(0);

    MAHARASHTRA_DISTRICTS.forEach((d) => {
      const dis = d.diseases[selectedDisease];
      if (dis) {
        currentTotal += dis.currentPeriodCases;
        previousTotal += dis.previousPeriodCases;
        alertCounts[dis.alertLevel] = (alertCounts[dis.alertLevel] || 0) + 1;

        dis.weeklyTrend.forEach((wt, idx) => {
          weeklySums[idx] += wt.cases;
        });
      }
      totalFacilities += d.reportingFacilities.total;
      reportingOnTimeTotal += d.reportingFacilities.reportingOnTime;
    });

    const wowPercent =
      previousTotal > 0
        ? Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1))
        : 0;

    const weeklyTrend = weekKeys.map((week, idx) => ({
      week,
      cases: weeklySums[idx]
    }));

    const completeness =
      totalFacilities > 0
        ? Number(((reportingOnTimeTotal / totalFacilities) * 100).toFixed(1))
        : 94.2;

    return {
      currentTotal,
      previousTotal,
      wowPercent,
      alertCounts,
      weeklyTrend,
      totalFacilities,
      reportingOnTimeTotal,
      completeness
    };
  }, [selectedDisease]);

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
          fill: '#FEE2E2',
          stroke: '#F87171',
          text: 'Outbreak Spike'
        };
      case 'Alert':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          dot: 'bg-amber-500',
          fill: '#FFEDD5',
          stroke: '#FB923C',
          text: 'Alert'
        };
      case 'Watch':
        return {
          bg: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          dot: 'bg-yellow-500',
          fill: '#FEF9C3',
          stroke: '#FDE047',
          text: 'Watch'
        };
      default:
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dot: 'bg-emerald-500',
          fill: '#E6F4EA',
          stroke: '#86EFAC',
          text: 'Baseline'
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

            {/* VIEW 3: MAHARASHTRA 36-DISTRICT INTERACTIVE CHOROPLETH MAP */}
            {viewLevel === 'maharashtra' && (
              <div className="w-full p-4 flex flex-col lg:flex-row gap-5 items-stretch">
                {/* Left Column: District Boundary Map (approx 62%) */}
                <div className="w-full lg:w-[62%] bg-white rounded-2xl border border-[#DFE7E4] p-4 flex flex-col shadow-xs relative">
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2.5 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-bold text-[#133840] uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin size={14} className="text-teal-700" />
                        Maharashtra District Surveillance
                      </h4>
                      <p className="text-[11px] text-[#607582] mt-0.5">
                        District-level disease monitoring across Maharashtra
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#607582] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                        Epi Week 41, 2026
                      </span>
                      <span className="text-[11px] font-semibold text-teal-900 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Activity size={12} className="text-teal-700" />
                        {selectedDisease}
                      </span>
                    </div>
                  </div>

                  {/* Division Filter Toolbar */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 text-xs">
                    <span className="text-[10px] font-bold text-[#607582] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                      <Filter size={11} className="text-teal-700" />
                      Division:
                    </span>
                    <button
                      onClick={() => setDivisionFilter('All')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
                        divisionFilter === 'All'
                          ? 'bg-[#133840] text-white shadow-xs'
                          : 'bg-[#F2F6F4] text-[#607582] hover:bg-[#E2EDE8] hover:text-[#133840]'
                      }`}
                    >
                      All (36)
                    </button>
                    {MAHARASHTRA_DIVISIONS.map((div) => {
                      const isCurrent = divisionFilter === div.division;
                      const count = MAHARASHTRA_DISTRICTS.filter((d) => d.division === div.division).length;
                      return (
                        <button
                          key={div.division}
                          onClick={() => setDivisionFilter(div.division)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
                            isCurrent
                              ? 'bg-[#133840] text-white shadow-xs'
                              : 'bg-[#F2F6F4] text-[#607582] hover:bg-[#E2EDE8] hover:text-[#133840]'
                          }`}
                        >
                          {div.division} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Map Canvas Container */}
                  <div
                    ref={mapContainerRef}
                    className="relative flex-1 min-h-[470px] bg-gradient-to-b from-[#F9FCFA] to-[#F1F6F4] rounded-xl border border-[#DFE7E4] overflow-hidden flex items-center justify-center select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => {
                      handleMouseUp();
                      setHoveredDistrictId(null);
                      setTooltip(null);
                    }}
                  >
                    {/* Compact Floating Map Zoom & Reset Controls */}
                    <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-[#DFE7E4] shadow-sm">
                      <button
                        onClick={handleZoomIn}
                        title="Zoom In (+)"
                        className="p-1.5 rounded-lg text-[#133840] hover:bg-teal-50 transition-colors"
                      >
                        <ZoomIn size={14} />
                      </button>
                      <button
                        onClick={handleZoomOut}
                        title="Zoom Out (-)"
                        disabled={zoom <= 1}
                        className={`p-1.5 rounded-lg text-[#133840] hover:bg-teal-50 transition-colors ${
                          zoom <= 1 ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                      >
                        <ZoomOut size={14} />
                      </button>
                      <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />
                      <button
                        onClick={handleResetView}
                        title="Reset View / Zoom to State"
                        className="px-2 py-1 text-[11px] font-medium text-[#133840] hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <RotateCcw size={12} className="text-teal-700" />
                        <span>Reset View</span>
                      </button>
                    </div>

                    {/* SVG Map Canvas */}
                    <svg
                      viewBox={`0 0 ${MAHARASHTRA_MAP_VIEWBOX.width} ${MAHARASHTRA_MAP_VIEWBOX.height}`}
                      className={`w-full h-full max-h-[510px] transition-transform ${
                        zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                      }`}
                    >
                      <defs>
                        <filter id="selectedGlow" x="-15%" y="-15%" width="130%" height="130%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#0E7068" floodOpacity="0.45" />
                        </filter>
                      </defs>

                      <g
                        transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                        style={{
                          transformOrigin: '400px 333px',
                          transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                        }}
                      >
                        {/* District Boundary Polygons */}
                        {MAHARASHTRA_GEO_PATHS.map((geo) => {
                          const districtRecord = MAHARASHTRA_DISTRICTS.find((d) => d.id === geo.id);
                          const diseaseData = districtRecord?.diseases[selectedDisease];
                          const alertLevel = diseaseData?.alertLevel || 'Baseline';
                          const badge = getAlertBadge(alertLevel);

                          const isSelected = activeDistrict?.id === geo.id;
                          const isHovered = hoveredDistrictId === geo.id;
                          const isDivisionActive = divisionFilter === 'All' || geo.division === divisionFilter;

                          // Compute Fill Color
                          let fill = badge.fill;
                          if (isSelected) {
                            fill = '#DCEFE5'; // Pale mint active highlight
                          } else if (isHovered) {
                            fill = alertLevel === 'Baseline' ? '#C6E8D5' : badge.fill;
                          } else if (!isDivisionActive) {
                            fill = '#EFF3F1';
                          }

                          // Compute Stroke & Width
                          const stroke = isSelected || isHovered ? '#0E7068' : badge.stroke;
                          const strokeWidth = isSelected ? 2.8 / zoom : isHovered ? 2.2 / zoom : 1.05 / zoom;
                          const opacity = isDivisionActive ? 1 : 0.32;

                          return (
                            <path
                              key={geo.id}
                              d={geo.path}
                              fill={fill}
                              stroke={stroke}
                              strokeWidth={strokeWidth}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              opacity={opacity}
                              filter={isSelected ? 'url(#selectedGlow)' : undefined}
                              className="transition-colors duration-150 cursor-pointer outline-none"
                              role="button"
                              tabIndex={0}
                              aria-label={`${geo.name} District - ${alertLevel}`}
                              onMouseEnter={(e) => {
                                setHoveredDistrictId(geo.id);
                                if (districtRecord && mapContainerRef.current) {
                                  const rect = mapContainerRef.current.getBoundingClientRect();
                                  setTooltip({
                                    x: e.clientX - rect.left,
                                    y: e.clientY - rect.top,
                                    district: districtRecord
                                  });
                                }
                              }}
                              onMouseMove={(e) => {
                                if (districtRecord && mapContainerRef.current) {
                                  const rect = mapContainerRef.current.getBoundingClientRect();
                                  setTooltip({
                                    x: e.clientX - rect.left,
                                    y: e.clientY - rect.top,
                                    district: districtRecord
                                  });
                                }
                              }}
                              onMouseLeave={() => {
                                setHoveredDistrictId(null);
                                setTooltip(null);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (districtRecord) {
                                  handleSelectDistrict(districtRecord);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  if (districtRecord) handleSelectDistrict(districtRecord);
                                }
                              }}
                            />
                          );
                        })}

                        {/* District Readable Labels */}
                        <g pointerEvents="none" className="select-none">
                          {MAHARASHTRA_GEO_PATHS.map((geo) => {
                            const isSelected = activeDistrict?.id === geo.id;
                            const isDivisionActive = divisionFilter === 'All' || geo.division === divisionFilter;
                            if (!isDivisionActive) return null;

                            const isSmall = ['mumbai-city', 'mumbai-suburban', 'bhandara'].includes(geo.id);
                            const displayText = isSmall ? geo.code.replace('MH-', '') : geo.name;
                            const fontSize = isSelected ? 11 : isSmall ? 8 : 9.5;

                            return (
                              <g key={`lbl-${geo.id}`}>
                                {/* White Halo for High Contrast */}
                                <text
                                  x={geo.labelX}
                                  y={geo.labelY}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fontSize={fontSize}
                                  fontWeight={isSelected ? 700 : 600}
                                  stroke="#FFFFFF"
                                  strokeWidth={3}
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                                >
                                  {displayText}
                                </text>
                                {/* Foreground Text */}
                                <text
                                  x={geo.labelX}
                                  y={geo.labelY}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fontSize={fontSize}
                                  fontWeight={isSelected ? 700 : 600}
                                  fill={isSelected ? '#0E7068' : '#133840'}
                                >
                                  {displayText}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      </g>
                    </svg>

                    {/* Interactive Floating Tooltip */}
                    {tooltip && (
                      <div
                        className="absolute z-30 pointer-events-none bg-white/95 backdrop-blur-md rounded-xl border border-[#DFE7E4] p-2.5 shadow-lg max-w-[220px] transition-all transform -translate-x-1/2 -translate-y-full"
                        style={{
                          left: `${Math.max(80, Math.min(tooltip.x, (mapContainerRef.current?.clientWidth || 500) - 80))}px`,
                          top: `${Math.max(10, tooltip.y - 12)}px`
                        }}
                      >
                        <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100">
                          <span className="font-serif font-bold text-xs text-[#133840] truncate">
                            {tooltip.district.name}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold border ${
                              getAlertBadge(tooltip.district.diseases[selectedDisease].alertLevel).bg
                            }`}
                          >
                            {tooltip.district.diseases[selectedDisease].alertLevel}
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-[10px]">
                          <div className="flex justify-between text-[#607582]">
                            <span>Division:</span>
                            <span className="font-medium text-[#133840]">{tooltip.district.division}</span>
                          </div>
                          <div className="flex justify-between text-[#607582]">
                            <span>{selectedDisease}:</span>
                            <span className="font-bold text-[#133840]">
                              {formatPrivacySuppressed(tooltip.district.diseases[selectedDisease].currentPeriodCases)} cases
                            </span>
                          </div>
                          <div className="flex justify-between text-[#607582]">
                            <span>WoW Change:</span>
                            <span
                              className={
                                tooltip.district.diseases[selectedDisease].percentChange > 0
                                  ? 'text-rose-600 font-semibold'
                                  : 'text-emerald-600 font-semibold'
                              }
                            >
                              {tooltip.district.diseases[selectedDisease].percentChange > 0 ? '+' : ''}
                              {tooltip.district.diseases[selectedDisease].percentChange}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 pt-1 border-t border-slate-100 text-[8.5px] text-[#71867E] text-center">
                          Click to inspect district profile
                        </div>
                      </div>
                    )}

                    {/* Surveillance Level Legend (Bottom-Left) */}
                    <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md rounded-xl border border-[#DFE7E4] p-2 shadow-xs">
                      <div className="text-[9.5px] font-bold text-[#133840] uppercase tracking-wider mb-1.5">
                        Surveillance Levels
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#607582]">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-[#E6F4EA] border border-[#86EFAC]" />
                          Baseline
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-[#FEF9C3] border border-[#FDE047]" />
                          Watch
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-[#FFEDD5] border border-[#FB923C]" />
                          Alert
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-[#FEE2E2] border border-[#F87171]" />
                          Outbreak
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-[#DCEFE5] border-2 border-[#0E7068]" />
                          Selected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: District Profile Panel (approx 38%) */}
                <div className="w-full lg:w-[38%] bg-[#FAF9F6] rounded-2xl border border-[#DFE7E4] p-4 flex flex-col justify-between shadow-xs">
                  {activeDistrict ? (
                    /* ================= DISTRICT SELECTED PROFILE ================= */
                    <div className="flex flex-col h-full justify-between space-y-3.5">
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-[#E3ECE8]">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-[#607582]">
                              MAHARASHTRA / {activeDistrict.division.toUpperCase()} DIVISION · {activeDistrict.code}
                            </div>
                            <h3 className="text-xl font-serif font-bold text-[#133840] mt-0.5">
                              {activeDistrict.name}
                            </h3>
                            <div className="text-[11px] text-[#607582] mt-0.5">
                              Headquarters: <strong className="text-slate-800 font-medium">{activeDistrict.headquarters}</strong> · Pop: <strong className="text-slate-800 font-medium">{(activeDistrict.population2026 / 1_000_000).toFixed(2)}M</strong>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                                getAlertBadge(activeDistrict.diseases[selectedDisease].alertLevel).bg
                              }`}
                            >
                              {activeDistrict.diseases[selectedDisease].alertLevel}
                            </span>
                            <button
                              onClick={() => handleResetView()}
                              className="text-[10px] text-teal-800 hover:text-teal-950 font-medium flex items-center gap-0.5 transition-colors"
                            >
                              <RotateCcw size={10} />
                              Reset to State
                            </button>
                          </div>
                        </div>

                        {/* Selected Disease Key Numbers Card */}
                        <div className="mt-3.5 border border-[#DFECE6] rounded-xl p-3 bg-white shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#133840] flex items-center gap-1.5">
                              <Activity size={14} className="text-teal-700" />
                              {selectedDisease} Surveillance
                            </span>
                            <span className="text-[10px] font-mono text-[#607582] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              Epi Week 41
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <div>
                              <div className="text-2xl font-serif font-bold text-[#133840]">
                                {formatPrivacySuppressed(
                                  activeDistrict.diseases[selectedDisease].currentPeriodCases
                                )}
                              </div>
                              <div className="text-[10px] text-[#607582]">Reported Cases</div>
                            </div>

                            <div className="text-right">
                              <div
                                className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                                  activeDistrict.diseases[selectedDisease].percentChange > 0
                                    ? 'text-rose-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {activeDistrict.diseases[selectedDisease].percentChange > 0 ? (
                                  <TrendingUp size={13} />
                                ) : (
                                  <TrendingDown size={13} />
                                )}
                                {activeDistrict.diseases[selectedDisease].percentChange > 0 ? '+' : ''}
                                {activeDistrict.diseases[selectedDisease].percentChange}%
                              </div>
                              <div className="text-[10px] text-[#607582]">vs previous week</div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-[#607582]">Test Positivity Rate (TPR):</span>
                            <span className="font-semibold text-slate-800 font-mono">
                              {activeDistrict.diseases[selectedDisease].testPositivityPct}%
                            </span>
                          </div>
                        </div>

                        {/* 8-Week Trend Chart */}
                        <div className="mt-3 border border-[#DFECE6] rounded-xl p-3 bg-white shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-[#133840] flex items-center gap-1.5">
                              <TrendingUp size={13} className="text-teal-700" />
                              8-Week Epidemiological Trend
                            </span>
                            <span className="text-[9.5px] text-[#607582]">W34 – W41</span>
                          </div>

                          <TrendSparkline
                            data={activeDistrict.diseases[selectedDisease].weeklyTrend}
                            color="#0E7068"
                            height={70}
                          />
                        </div>

                        {/* Facility Reporting Completeness */}
                        <div className="mt-3 bg-white p-3 rounded-xl border border-[#DFECE6] shadow-xs">
                          <div className="text-[11px] font-semibold text-[#133840] flex justify-between">
                            <span className="flex items-center gap-1.5">
                              <Building2 size={13} className="text-teal-700" />
                              Facility Reporting Completeness
                            </span>
                            <span className="font-mono text-teal-800 font-bold">
                              {activeDistrict.reportingFacilities.completenessPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden my-2">
                            <div
                              className="bg-teal-600 h-full rounded-full transition-all"
                              style={{
                                width: `${activeDistrict.reportingFacilities.completenessPct}%`
                              }}
                            />
                          </div>
                          <div className="text-[10px] text-[#607582] flex justify-between">
                            <span>On-time reporting</span>
                            <span className="font-medium text-slate-700">
                              {activeDistrict.reportingFacilities.reportingOnTime} /{' '}
                              {activeDistrict.reportingFacilities.total} health facilities
                            </span>
                          </div>
                        </div>

                        {/* Source citation and Privacy callout */}
                        <div className="mt-3 text-[9.5px] text-[#607582] bg-white/80 p-2.5 rounded-lg border border-[#E0E8E4] flex items-start gap-1.5">
                          <Shield size={13} className="text-teal-700 shrink-0 mt-0.5" />
                          <div>
                            Aggregated under Maharashtra Health Dept & IDSP statutory rules. Small-cohort privacy suppression (N &lt; 10 masked). Reporting Date: Oct 10, 2026.
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex flex-col gap-1.5">
                        <button
                          onClick={() => setShowDetailModal(true)}
                          className="w-full bg-[#133840] hover:bg-[#0E7068] text-white py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <span>View District Details</span>
                          <ArrowUpRight size={14} />
                        </button>

                        <button
                          onClick={() => handleResetView()}
                          className="w-full text-xs text-[#607582] hover:text-[#133840] py-1 text-center font-medium transition-colors"
                        >
                          ← Return to All Maharashtra Overview
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ================= ALL MAHARASHTRA STATE-LEVEL OVERVIEW ================= */
                    <div className="flex flex-col h-full justify-between space-y-3.5">
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-[#E3ECE8]">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-[#607582]">
                              STATE-LEVEL SURVEILLANCE OVERVIEW
                            </div>
                            <h3 className="text-xl font-serif font-bold text-[#133840] mt-0.5">
                              Maharashtra (All 36 Districts)
                            </h3>
                            <p className="text-[11px] text-[#607582] mt-0.5">
                              Consolidated IDSP monitoring across 6 administrative divisions
                            </p>
                          </div>

                          <span className="text-xs px-2.5 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-teal-800 font-semibold">
                            Statewide
                          </span>
                        </div>

                        {/* Statewide Totals Card */}
                        <div className="mt-3.5 border border-[#DFECE6] rounded-xl p-3.5 bg-white shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#133840] flex items-center gap-1.5">
                              <Activity size={14} className="text-teal-700" />
                              Statewide {selectedDisease} Total
                            </span>
                            <span className="text-[10px] font-mono text-[#607582] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              Epi Week 41
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <div>
                              <div className="text-3xl font-serif font-bold text-[#133840]">
                                {formatPrivacySuppressed(statewideStats.currentTotal)}
                              </div>
                              <div className="text-[10px] text-[#607582]">Total Monitored Cases</div>
                            </div>

                            <div className="text-right">
                              <div
                                className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                                  statewideStats.wowPercent > 0 ? 'text-rose-600' : 'text-emerald-600'
                                }`}
                              >
                                {statewideStats.wowPercent > 0 ? (
                                  <TrendingUp size={13} />
                                ) : (
                                  <TrendingDown size={13} />
                                )}
                                {statewideStats.wowPercent > 0 ? '+' : ''}
                                {statewideStats.wowPercent}%
                              </div>
                              <div className="text-[10px] text-[#607582]">vs previous week</div>
                            </div>
                          </div>
                        </div>

                        {/* Alert Breakdown across 36 Districts */}
                        <div className="mt-3 space-y-1.5">
                          <div className="text-[11px] font-bold text-[#133840] uppercase tracking-wider flex items-center justify-between">
                            <span>District Alert Distribution</span>
                            <span className="text-[10px] text-[#607582] font-normal">36 Districts</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-emerald-900 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Baseline
                              </span>
                              <span className="text-xs font-bold text-emerald-900 font-mono">
                                {statewideStats.alertCounts.Baseline}
                              </span>
                            </div>

                            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-amber-900 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500" /> Watch
                              </span>
                              <span className="text-xs font-bold text-amber-900 font-mono">
                                {statewideStats.alertCounts.Watch}
                              </span>
                            </div>

                            <div className="bg-orange-50/70 border border-orange-200 rounded-lg p-2 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-orange-900 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-orange-500" /> Alert
                              </span>
                              <span className="text-xs font-bold text-orange-900 font-mono">
                                {statewideStats.alertCounts.Alert}
                              </span>
                            </div>

                            <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-2 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-rose-900 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500" /> Outbreak
                              </span>
                              <span className="text-xs font-bold text-rose-900 font-mono">
                                {statewideStats.alertCounts['Outbreak Spike']}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 8-Week Statewide Trend Sparkline */}
                        <div className="mt-3 border border-[#DFECE6] rounded-xl p-3 bg-white shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-[#133840] flex items-center gap-1.5">
                              <TrendingUp size={13} className="text-teal-700" />
                              Statewide 8-Week Trajectory
                            </span>
                            <span className="text-[9.5px] text-[#607582]">W34 – W41</span>
                          </div>

                          <TrendSparkline
                            data={statewideStats.weeklyTrend}
                            color="#0E7068"
                            height={68}
                          />
                        </div>

                        {/* Coverage Overview */}
                        <div className="mt-3 bg-white p-2.5 rounded-xl border border-[#DFECE6] text-[11px] text-[#607582] flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-teal-700" />
                            Active Reporting Units
                          </span>
                          <span className="font-semibold text-slate-800">
                            {statewideStats.reportingOnTimeTotal} / {statewideStats.totalFacilities} ({statewideStats.completeness}%)
                          </span>
                        </div>

                        {/* Selection Guidance Callout */}
                        <div className="mt-3 text-[10px] text-teal-900 bg-teal-50/80 p-2.5 rounded-xl border border-teal-200/80 flex items-start gap-2">
                          <Info size={14} className="text-teal-700 shrink-0 mt-0.5" />
                          <span>
                            Click on any district boundary on the map or choose a division above to drill into local cases, testing rates, and weekly trajectories.
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 text-center text-[10px] text-[#71867E]">
                        Statewide Public Health Surveillance Feed · IDSP Maharashtra
                      </div>
                    </div>
                  )}
                </div>

                {/* District Epidemiological Dossier Modal */}
                {showDetailModal && activeDistrict && (
                  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-[#DFE7E4] shadow-2xl max-w-xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-[#607582]">
                            {activeDistrict.division} Division · Code: {activeDistrict.code}
                          </span>
                          <h3 className="text-xl font-serif font-bold text-[#133840]">
                            {activeDistrict.name} District Dossier
                          </h3>
                          <p className="text-xs text-[#607582]">
                            Headquarters: {activeDistrict.headquarters} · Est. Population: {(activeDistrict.population2026 / 1_000_000).toFixed(2)}M
                          </p>
                        </div>

                        <button
                          onClick={() => setShowDetailModal(false)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Disease Surveillance Matrix */}
                      <div>
                        <h4 className="text-xs font-bold text-[#133840] uppercase tracking-wider mb-2">
                          Monitored Pathogens (Epi Week 41)
                        </h4>

                        <div className="space-y-2">
                          {Object.entries(activeDistrict.diseases).map(([diseaseName, dData]) => {
                            const badge = getAlertBadge(dData.alertLevel);
                            const isTarget = diseaseName === selectedDisease;

                            return (
                              <div
                                key={diseaseName}
                                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                  isTarget ? 'bg-teal-50/70 border-teal-300' : 'bg-[#FAF9F6] border-slate-100'
                                }`}
                              >
                                <div>
                                  <div className="font-semibold text-[#133840] flex items-center gap-1.5">
                                    {diseaseName}
                                    {isTarget && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-200/80 text-teal-900 font-normal">
                                        Active Filter
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[#607582]">
                                    TPR: {dData.testPositivityPct}% · WoW:{' '}
                                    <span className={dData.percentChange > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                      {dData.percentChange > 0 ? '+' : ''}{dData.percentChange}%
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <div className="font-bold text-[#133840]">
                                      {formatPrivacySuppressed(dData.currentPeriodCases)}
                                    </div>
                                    <div className="text-[9px] text-[#607582]">cases</div>
                                  </div>

                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}`}>
                                    {dData.alertLevel}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={() => setShowDetailModal(false)}
                          className="px-4 py-2 bg-[#133840] text-white rounded-xl text-xs font-semibold hover:bg-[#0E7068] transition-colors"
                        >
                          Close Dossier
                        </button>
                      </div>
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
