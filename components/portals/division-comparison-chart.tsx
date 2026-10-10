'use client';

import React, { useState, useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Activity,
  Info
} from 'lucide-react';
import {
  MAHARASHTRA_DISTRICTS,
  type AdministrativeDivision,
  type SurveilledDisease,
  formatPrivacySuppressed
} from '@/data/maharashtraData';

interface DivisionComparisonChartProps {
  selectedDisease?: SurveilledDisease;
}

type ChartMetric = 'cases' | 'wow' | 'incidence';

interface ReportingPeriodOption {
  id: string;
  label: string;
  weekIndex: number;
  prevWeekIndex: number;
}

const REPORTING_PERIODS: ReportingPeriodOption[] = [
  { id: 'w41', label: 'Week 41, 2026', weekIndex: 7, prevWeekIndex: 6 },
  { id: 'w40', label: 'Week 40, 2026', weekIndex: 6, prevWeekIndex: 5 },
  { id: 'w39', label: 'Week 39, 2026', weekIndex: 5, prevWeekIndex: 4 },
  { id: 'w52', label: 'Week 52, 2024', weekIndex: 7, prevWeekIndex: 6 }
];

export function DivisionComparisonChart({
  selectedDisease = 'Dengue'
}: DivisionComparisonChartProps) {
  const [metric, setMetric] = useState<ChartMetric>('cases');
  const [period, setPeriod] = useState<ReportingPeriodOption>(REPORTING_PERIODS[0]);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  // Six divisions in exact order from reference preview
  const orderedDivisions: AdministrativeDivision[] = useMemo(
    () => [
      'Konkan',
      'Pune',
      'Nashik',
      'Chhatrapati Sambhajinagar',
      'Amravati',
      'Nagpur'
    ],
    []
  );

  // Calculate real application data across the 6 divisions
  const chartData = useMemo(() => {
    return orderedDivisions.map((divName) => {
      const districts = MAHARASHTRA_DISTRICTS.filter((d) => d.division === divName);
      const totalPopulation = districts.reduce((acc, d) => acc + d.population2026, 0);

      // Sum cases for current period and previous period
      let currentCases = 0;
      let previousCases = 0;

      districts.forEach((d) => {
        const dis = d.diseases[selectedDisease];
        if (dis) {
          if (dis.weeklyTrend && dis.weeklyTrend.length > 0) {
            const currItem = dis.weeklyTrend[period.weekIndex];
            const prevItem = dis.weeklyTrend[period.prevWeekIndex];
            currentCases += currItem ? currItem.cases : dis.currentPeriodCases;
            previousCases += prevItem ? prevItem.cases : dis.previousPeriodCases;
          } else {
            currentCases += dis.currentPeriodCases;
            previousCases += dis.previousPeriodCases;
          }
        }
      });

      // Calculate week-over-week percentage change safely
      const wowChange =
        previousCases > 0
          ? Number((((currentCases - previousCases) / previousCases) * 100).toFixed(1))
          : 0;

      // Cases per 100,000 population
      const currentIncidence =
        totalPopulation > 0
          ? Number(((currentCases / totalPopulation) * 100000).toFixed(1))
          : 0;
      const previousIncidence =
        totalPopulation > 0
          ? Number(((previousCases / totalPopulation) * 100000).toFixed(1))
          : 0;

      return {
        division: divName,
        displayName:
          divName === 'Chhatrapati Sambhajinagar'
            ? 'Chhatrapati Sambhajinagar'
            : divName,
        shortName:
          divName === 'Chhatrapati Sambhajinagar' ? 'Chh. Sambhajinagar' : divName,
        currentCases,
        previousCases,
        wowChange,
        currentIncidence,
        previousIncidence,
        population: totalPopulation,
        districtsCount: districts.length
      };
    });
  }, [orderedDivisions, selectedDisease, period]);

  // Compute maximum cases to calibrate left Y-axis domain
  const maxPrimaryValue = useMemo(() => {
    if (metric === 'incidence') {
      const maxInc = Math.max(
        ...chartData.map((d) => Math.max(d.currentIncidence, d.previousIncidence)),
        10
      );
      return Math.ceil(maxInc * 1.3);
    }
    const maxVal = Math.max(
      ...chartData.map((d) => Math.max(d.currentCases, d.previousCases)),
      100
    );
    // Round up to nearest 200 with 25% headspace for labels
    return Math.ceil((maxVal * 1.25) / 200) * 200;
  }, [chartData, metric]);

  // Compute percentage bounds for right Y-axis
  const percentageDomain = useMemo(() => {
    const changes = chartData.map((d) => d.wowChange);
    const minVal = Math.min(...changes, -10);
    const maxVal = Math.max(...changes, 25);
    const lower = Math.floor(minVal / 10) * 10;
    const upper = Math.ceil(maxVal / 10) * 10;
    return [lower, upper];
  }, [chartData]);

  // Custom Line Dot renderer with value badge matching preview
  const renderCustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) return null;

    const wow = payload.wowChange;
    if (wow == null) return null;

    const isPositive = Number(wow) >= 0;
    const dotColor = isPositive ? '#DC2626' : '#0A4D4A';
    const badgeBorder = isPositive ? '#FCA5A5' : '#A7D7C5';
    const badgeText = `${isPositive ? '+' : ''}${wow}%`;

    // Position badge above dot for positive, below dot for negative
    const badgeY = isPositive ? cy - 14 : cy + 16;

    return (
      <g key={`marker-${payload.division}`} className="select-none">
        {/* Circular Marker with White Outer Stroke */}
        <circle
          cx={cx}
          cy={cy}
          r={5.5}
          fill={dotColor}
          stroke="#FFFFFF"
          strokeWidth={2}
        />

        {/* Badge Pill Background */}
        <rect
          x={cx - 24}
          y={badgeY - 9.5}
          width={48}
          height={18}
          rx={5}
          fill="#FFFFFF"
          stroke={badgeBorder}
          strokeWidth={1}
          filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.08))"
        />

        {/* Badge Text */}
        <text
          x={cx}
          y={badgeY + 3.5}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={700}
          fill={dotColor}
        >
          {badgeText}
        </text>
      </g>
    );
  };

  // Custom Rich Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const isPositive = data.wowChange >= 0;
    const diff = data.currentCases - data.previousCases;

    return (
      <div className="bg-white/95 backdrop-blur-md border border-[#DFE7E4] rounded-xl p-3.5 shadow-xl text-xs space-y-2 min-w-[220px]">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <span className="font-serif font-bold text-sm text-[#133840]">
            {data.division} Division
          </span>
          <span className="text-[10px] text-[#607582] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            {data.districtsCount} Districts
          </span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-[#607582]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#CCE8DE] border border-[#A7D7C5]" />
              Previous Period:
            </span>
            <strong className="text-slate-800 font-mono">
              {metric === 'incidence'
                ? `${data.previousIncidence} / 100k`
                : formatPrivacySuppressed(data.previousCases)}
            </strong>
          </div>

          <div className="flex items-center justify-between text-[#607582]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0A4D4A]" />
              Current Period:
            </span>
            <strong className="text-slate-900 font-bold font-mono">
              {metric === 'incidence'
                ? `${data.currentIncidence} / 100k`
                : formatPrivacySuppressed(data.currentCases)}
            </strong>
          </div>

          <div className="flex items-center justify-between text-[#607582]">
            <span>Net Case Shift:</span>
            <strong
              className={`font-mono font-semibold ${
                isPositive ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {diff > 0 ? `+${diff}` : diff} cases
            </strong>
          </div>

          <div className="flex items-center justify-between text-[#607582] pt-1 border-t border-slate-100">
            <span>Week-over-Week (%):</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isPositive
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {isPositive ? '+' : ''}
              {data.wowChange}%
            </span>
          </div>

          <div className="flex items-center justify-between text-[#607582]">
            <span>Population Base:</span>
            <span className="font-mono text-slate-700">
              {(data.population / 1000000).toFixed(2)}M
            </span>
          </div>
        </div>
      </div>
    );
  };

  const currentDataKey = metric === 'incidence' ? 'currentIncidence' : 'currentCases';
  const prevDataKey = metric === 'incidence' ? 'previousIncidence' : 'previousCases';

  return (
    <div className="bg-white rounded-2xl border border-[#DFE7E4] p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        {/* Title & Icon */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F4F1] border border-[#CCE8DE] flex items-center justify-center text-[#0E7068] shrink-0">
            <BarChart3 size={20} />
          </div>

          <div>
            <h3 className="font-serif font-bold text-lg sm:text-xl text-[#133840] leading-snug">
              Administrative Division Comparison: {selectedDisease} Burdens
            </h3>
            <p className="text-xs text-[#607582] mt-0.5">
              Current vs. previous period cases across Maharashtra's six administrative divisions.
            </p>
          </div>
        </div>

        {/* Controls: Metric Selector & Reporting Period */}
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          {/* Metric Selector Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#607582] font-medium hidden sm:inline">
              Metric:
            </span>

            <div className="inline-flex items-center p-0.5 bg-[#FAF9F6] border border-[#DFE7E4] rounded-xl text-xs">
              <button
                onClick={() => setMetric('cases')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  metric === 'cases'
                    ? 'bg-[#D8F0E7] text-[#0A4D4A] font-semibold border border-[#96D6C4] shadow-xs'
                    : 'text-[#607582] hover:text-[#133840]'
                }`}
              >
                Total Cases
              </button>

              <button
                onClick={() => setMetric('wow')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  metric === 'wow'
                    ? 'bg-[#D8F0E7] text-[#0A4D4A] font-semibold border border-[#96D6C4] shadow-xs'
                    : 'text-[#607582] hover:text-[#133840]'
                }`}
              >
                Week-over-Week Change
              </button>

              <button
                onClick={() => setMetric('incidence')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  metric === 'incidence'
                    ? 'bg-[#D8F0E7] text-[#0A4D4A] font-semibold border border-[#96D6C4] shadow-xs'
                    : 'text-[#607582] hover:text-[#133840]'
                }`}
              >
                Cases per 100,000
              </button>
            </div>
          </div>

          {/* Reporting Period Selector */}
          <div className="relative">
            <button
              onClick={() => setIsPeriodDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F2F6F4] border border-[#DFE7E4] rounded-xl text-xs text-[#133840] transition-colors"
            >
              <Calendar size={14} className="text-[#0E7068]" />
              <div className="text-left">
                <span className="text-[9.5px] text-[#607582] block leading-none">
                  Reporting Period
                </span>
                <span className="font-semibold text-xs text-[#133840] leading-tight flex items-center gap-1">
                  {period.label}
                  <ChevronDown size={11} className="text-[#607582]" />
                </span>
              </div>
            </button>

            {isPeriodDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-[#DFE7E4] rounded-xl shadow-lg p-1 w-48 text-xs">
                {REPORTING_PERIODS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setPeriod(opt);
                      setIsPeriodDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between ${
                      period.id === opt.id
                        ? 'bg-teal-50 text-teal-900 font-semibold'
                        : 'text-[#607582] hover:bg-slate-50 hover:text-[#133840]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {period.id === opt.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Combination Chart */}
      <div className="w-full pt-2 min-w-0">
        <div className="h-[360px] sm:h-[390px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 28, right: 36, left: 14, bottom: 12 }}
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#EEF3F0"
                vertical={false}
              />

              {/* X Axis */}
              <XAxis
                dataKey="displayName"
                stroke="#94A3B8"
                tickLine={true}
                axisLine={{ stroke: '#CBD5E1' }}
                tick={{ fontSize: 11.5, fill: '#334155', fontWeight: 500 }}
                interval={0}
              />

              {/* Left Y Axis: Reported Cases / Incidence */}
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#94A3B8"
                tickLine={true}
                axisLine={{ stroke: '#CBD5E1' }}
                domain={[0, maxPrimaryValue]}
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickFormatter={(val) => val.toLocaleString()}
                label={{
                  value:
                    metric === 'incidence'
                      ? 'Cases per 100k'
                      : 'Reported Cases',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 0,
                  style: {
                    textAnchor: 'middle',
                    fill: '#64748B',
                    fontSize: 11,
                    fontWeight: 500
                  }
                }}
              />

              {/* Right Y Axis: Week-over-Week Change (%) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#94A3B8"
                tickLine={true}
                axisLine={{ stroke: '#CBD5E1' }}
                domain={percentageDomain}
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickFormatter={(val) => `${val}%`}
                label={{
                  value: 'Week-over-Week Change (%)',
                  angle: 90,
                  position: 'insideRight',
                  offset: 0,
                  style: {
                    textAnchor: 'middle',
                    fill: '#64748B',
                    fontSize: 11,
                    fontWeight: 500
                  }
                }}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Bar 1: Previous Period Cases (Pale Mint) */}
              <Bar
                yAxisId="left"
                dataKey={prevDataKey}
                fill="#CCE8DE"
                name="Previous Period Cases"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              >
                <LabelList
                  dataKey={prevDataKey}
                  position="top"
                  offset={6}
                  formatter={(val: any) =>
                    typeof val === 'number' ? val.toLocaleString() : val
                  }
                  style={{
                    fontSize: 11,
                    fill: '#607582',
                    fontWeight: 500
                  }}
                />
              </Bar>

              {/* Bar 2: Current Period Cases (Deep Teal) */}
              <Bar
                yAxisId="left"
                dataKey={currentDataKey}
                fill="#0A4D4A"
                name="Current Period Cases"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              >
                <LabelList
                  dataKey={currentDataKey}
                  position="top"
                  offset={6}
                  formatter={(val: any) =>
                    typeof val === 'number' ? val.toLocaleString() : val
                  }
                  style={{
                    fontSize: 11.5,
                    fill: '#0A4D4A',
                    fontWeight: 700
                  }}
                />
              </Bar>

              {/* Line: Week-over-Week Change with Circular Markers & Badges */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="wowChange"
                stroke="#D97706"
                strokeWidth={1.8}
                strokeDasharray="4 4"
                dot={renderCustomDot}
                activeDot={{
                  r: 7,
                  fill: '#0E7068',
                  stroke: '#FFFFFF',
                  strokeWidth: 2
                }}
                isAnimationActive={false}
                name="Week-over-Week Change (%)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-3.5 border-t border-slate-100 text-xs text-[#607582]">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#CCE8DE] border border-[#B2DDD0]" />
            <span className="font-medium text-[#475569]">
              Previous Period Cases
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#0A4D4A]" />
            <span className="font-medium text-[#475569]">
              Current Period Cases
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-3 border-t-2 border-dashed border-[#D97706]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] border border-white" />
              <span className="w-3 border-t-2 border-dashed border-[#D97706]" />
            </span>
            <span className="font-medium text-[#475569]">
              Week-over-Week Change (%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
