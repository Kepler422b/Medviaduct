'use client';
import {useState, useEffect, useRef, lazy, Suspense} from 'react';
import Link from '@/components/link';
import {
  ArrowUpRight, ArrowRight, Activity, Network, BookOpen, FileText, Globe2,
  ShieldCheck, Clock, LineChart, Key, QrCode, Users, Lock, Database, Menu, X,
  CheckCircle2, Shield
} from 'lucide-react';
import {Brand} from './shared';
import {trends} from '@/data/demo';

const ClinicalModel = lazy(() => import('@/components/3d/clinical-model').then(m => ({default: m.ClinicalIntelligenceModel})));

const nodeCopy = [
  'The core of secure healthcare insights.',
  'Longitudinal patient history at a glance.',
  'Detailed context for every patient encounter.',
  'Tracked medications and active prescriptions.',
  'Aggregated patterns across populations.',
  'Geographic analysis of public health.',
  'Strict role-based access and data protection.'
];

export default function MedIntel() {
  const [scene, setScene] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('south-asia');
  const [timeRange, setTimeRange] = useState<'8 weeks' | '4 weeks'>('8 weeks');
  const [conditionFilter, setConditionFilter] = useState('All');

  const landingRef = useRef<HTMLElement>(null);
  const approachRef = useRef<HTMLElement>(null);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isManualScroll = useRef(false);
  const manualTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      setIsScrolled((prev) => (prev !== scrolled ? scrolled : prev));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSelectStep = (idx: number) => {
    setScene(idx);
    isManualScroll.current = true;
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(() => {
      isManualScroll.current = false;
    }, 850);
    const targetEl = stageRefs.current[idx];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const cards = stageRefs.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      () => {
        if (isManualScroll.current) return;

        // Determine active step based on focal viewing position
        const focalY = window.innerHeight * 0.40;
        let closestIdx = 0;
        let minDiff = Infinity;

        stageRefs.current.forEach((el, i) => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const diff = Math.abs(centerY - focalY);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        });

        setScene((prev) => (prev !== closestIdx ? closestIdx : prev));
      },
      {
        rootMargin: '-15% 0px -25% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1.0]
      }
    );

    cards.forEach((card) => observer.observe(card));

    return () => {
      observer.disconnect();
      if (manualTimer.current) clearTimeout(manualTimer.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      return;
    }

    const container = landingRef.current;
    if (!container) return;

    container.classList.add('reveal-ready');

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.classList.add('is-revealed');
            obs.unobserve(el);
            setTimeout(() => {
              el.classList.add('reveal-done');
            }, 1000);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    const elements = container.querySelectorAll('.reveal-section, .reveal-item, .reveal-card');
    elements.forEach((el) => observer.observe(el));

    const handleHash = () => {
      const hash = window.location.hash;
      if (hash) {
        const target = container.querySelector(hash);
        if (target) {
          target.classList.add('is-revealed', 'reveal-done');
          target.querySelectorAll('.reveal-section, .reveal-item, .reveal-card').forEach((el) => {
            el.classList.add('is-revealed', 'reveal-done');
          });
        }
      }
    };
    window.addEventListener('hashchange', handleHash);

    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  const journey = [
    ['01 / THE CLINICAL JOURNEY', 'A clinical question', 'Start with the patient\'s story. Bring symptoms, history and investigations into one thoughtful narrative.'],
    ['02 / THE CLINICAL JOURNEY', 'The meaningful details', 'Organize the medical concepts in the case while preserving the clinical context that makes it unique.'],
    ['03 / CONNECTED CONTEXT', 'A connected history', 'Bring previous visits, diagnoses and prescription history together to help authorized clinicians understand the patient\'s journey.'],
    ['04 / SECURE ACCESS', 'The right information, securely', 'Use QR-enabled access to locate a patient record, with clinician authentication and authorization checked before access is granted.'],
    ['05 / SHARED PATTERNS', 'Beyond a single case', 'Eligible clinical events contribute to population-level analysis through controlled aggregation rather than exposing individual records.'],
    ['06 / PUBLIC HEALTH INTELLIGENCE', 'Patterns across regions', 'Explore aggregate disease counts across locations, reporting periods and condition categories to understand changing trends.'],
    ['07 / PRIVACY BY DESIGN', 'Insight with boundaries', 'Role-based permissions, minimum group-size suppression and restricted analytics access help protect individual patient identities.']
  ];

  // Active trend metrics for public health section
  const activeTrend = trends.find((t) => t.id === selectedRegion) || trends[0];
  const displayedSeries = timeRange === '4 weeks' ? activeTrend.series.slice(-4) : activeTrend.series;
  const maxCases = Math.max(...displayedSeries.map((s) => s.cases), 100);

  const chartPoints = displayedSeries.map((d, i) => {
    const x = (i / (displayedSeries.length - 1 || 1)) * 380 + 20;
    const y = 145 - (d.cases / maxCases) * 105;
    return { x, y, ...d };
  });

  const linePath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = chartPoints.length > 0
    ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} 150 L ${chartPoints[0].x} 150 Z`
    : '';

  return (
    <main ref={landingRef} className="landing">
      {/* Ambient Gemini-inspired Aura Lighting */}
      <div className="gemini-aura-container" aria-hidden="true">
        {/* Top-Left: Graceful Iridescent Flowing Arc */}
        <svg className="aura-arc-top-left" viewBox="0 0 320 420" fill="none">
          <defs>
            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#70D6FF" stopOpacity="0.85" />
              <stop offset="45%" stopColor="#8BE0BB" stopOpacity="0.75" />
              <stop offset="85%" stopColor="#B8B3FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#B8B3FF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="arcGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#70D6FF" stopOpacity="0.14" />
              <stop offset="50%" stopColor="#8BE0BB" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#FAFAF6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M-20 -20 C 70 110, 110 230, 40 390 L -20 390 Z" fill="url(#arcGlow)" />
          <path d="M-10 -10 C 75 105, 115 225, 45 385" stroke="url(#arcGrad)" strokeWidth="1.75" strokeLinecap="round" />
        </svg>

        {/* Top-Right: Sculptural 3D Liquid-Glass Mint/Cyan Ribbon */}
        <svg className="aura-ribbon-top-right" viewBox="0 0 520 520" fill="none">
          <defs>
            <linearGradient id="ribbonBody" x1="15%" y1="10%" x2="85%" y2="85%">
              <stop offset="0%" stopColor="#8BE0BB" stopOpacity="0.88" />
              <stop offset="45%" stopColor="#70D6FF" stopOpacity="0.78" />
              <stop offset="80%" stopColor="#8BE0BB" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#70D6FF" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="ribbonHighlight" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.65" />
              <stop offset="75%" stopColor="#8BE0BB" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ribbonGlow" cx="60%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#8BE0BB" stopOpacity="0.5" />
              <stop offset="60%" stopColor="#70D6FF" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#70D6FF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path
            d="M 230 0 C 350 22, 490 125, 510 280 C 475 400, 365 480, 260 460 C 345 380, 430 295, 390 175 C 355 85, 275 25, 230 0 Z"
            fill="url(#ribbonGlow)"
          />
          <path
            d="M 250 0 C 370 25, 495 130, 505 270 C 465 385, 375 440, 280 430 C 355 360, 435 280, 395 170 C 365 85, 290 25, 250 0 Z"
            fill="url(#ribbonBody)"
            stroke="rgba(255, 255, 255, 0.7)"
            strokeWidth="1.5"
          />
          <path
            d="M 270 12 C 380 38, 480 135, 490 260 C 450 350, 380 405, 305 400 C 370 340, 430 265, 395 170 C 370 95, 305 35, 270 12 Z"
            fill="url(#ribbonHighlight)"
            opacity="0.75"
          />
          <path
            d="M 280 8 C 390 32, 498 130, 502 255"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>

        {/* Lower-Left: Glossy 3D Glass Sphere */}
        <div className="aura-orb-glass-left" />

        {/* Bottom-Center: Floating Translucent Liquid Droplet */}
        <div className="aura-orb-glass-center" />
      </div>

      {/* 2. Floating Rounded Navbar */}
      <header className={`topbar ${isScrolled ? 'scrolled' : ''}`}>
        <Brand />

        <nav className="desktop-nav">
          <a href="#workflows">Workflows</a>
          <a href="#approach">Clinical Journey</a>
          <a href="#intelligence">Health Intelligence</a>
          <a href="#privacy">Privacy</a>
          <Link href="/login">Sign in</Link>
          <Link className="btn primary" href="/dashboard">
            Open workspace <ArrowUpRight size={16} />
          </Link>
        </nav>

        <div className="mobile-nav-toggle">
          <Link className="btn primary" href="/dashboard" style={{ padding: '8px 14px', fontSize: '12px' }}>
            Open workspace
          </Link>
          <button
            className="icon-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#16191C'
            }}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            className="mobile-dropdown"
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: '4%',
              right: '4%',
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(20px)',
              padding: '20px',
              borderRadius: '24px',
              boxShadow: '0 12px 40px rgba(22, 25, 28, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              border: '1px solid rgba(22, 25, 28, 0.08)'
            }}
          >
            <a href="#workflows" onClick={() => setMobileMenuOpen(false)}>Workflows</a>
            <a href="#approach" onClick={() => setMobileMenuOpen(false)}>Clinical Journey</a>
            <a href="#intelligence" onClick={() => setMobileMenuOpen(false)}>Health Intelligence</a>
            <a href="#privacy" onClick={() => setMobileMenuOpen(false)}>Privacy</a>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
          </div>
        )}
      </header>

      {/* 3. Hero Section - Split Layout with Dark Charcoal Panel */}
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> CONNECTED CARE · PRIVACY-FIRST INTELLIGENCE
          </div>
          <h1>
            Better patient care.<br />
            A clearer picture of <br />
            <em className="hero-gradient-text">public health.</em>
          </h1>
          <p>
            Connect longitudinal patient records with privacy-preserving health intelligence. Give clinicians the context they need and help public-health teams understand disease trends without exposing individual identities.
          </p>
          <div className="actions">
            <Link className="btn primary" href="/case">
              Access Patient Records <ArrowRight size={17} />
            </Link>
            <Link className="btn secondary" href="/dashboard">
              Explore Health Insights <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="hero-foot">
            <span>
              <QrCode size={16} color="#82BE90" /> QR-enabled clinical records
            </span>
            <span>
              <Lock size={16} color="#4C75F2" /> Role-based access
            </span>
            <span>
              <LineChart size={16} color="#82BE90" /> Aggregate health trends
            </span>
          </div>
        </div>

        {/* Right side: Large Charcoal Panel with Ambient Gradient */}
        <div className="hero-visual-panel">
          {/* Decorative Floating 3D Orbs */}
          <div className="deco-orb orb-mint" style={{ width: '56px', height: '56px', top: '14%', left: '8%' }} />
          <div className="deco-orb orb-cobalt" style={{ width: '44px', height: '44px', bottom: '16%', right: '10%' }} />
          <div className="deco-orb orb-mint" style={{ width: '22px', height: '22px', top: '42%', right: '12%', opacity: 0.6 }} />

          <Suspense fallback={<div className="orb"><Network size={80} strokeWidth={0.8} /></div>}>
            <ClinicalModel descriptions={nodeCopy} />
          </Suspense>

          {/* Floating Information Cards */}
          <div className="float-card float-one">
            <BookOpen size={20} color="#82BE90" />
            <div>
              <small>CONNECTED CARE</small>
              <strong>Every visit adds context.</strong>
            </div>
          </div>
          <div className="float-card float-two">
            <Activity size={20} color="#4C75F2" />
            <div>
              <small>PUBLIC HEALTH</small>
              <strong>Patterns that inform decisions.</strong>
            </div>
          </div>

          {/* Thin flowing sinusoidal wave */}
          <svg className="flowing-wave" viewBox="0 0 800 24" fill="none" style={{ position: 'absolute', bottom: '38px', left: 0, right: 0, opacity: 0.4 }}>
            <path d="M0 12 Q 100 0, 200 12 T 400 12 T 600 12 T 800 12" stroke="#82BE90" strokeWidth="1.5" fill="none" />
          </svg>

          <div className="orbit-label">Two workflows · One privacy-first platform</div>
        </div>
      </section>

      {/* Core Principles Divider */}
      <div className="principles reveal-section">
        <span><ShieldCheck size={17} color="#82BE90" /> Secure clinical access</span>
        <span><Clock size={17} color="#4C75F2" /> Longitudinal patient history</span>
        <span><LineChart size={17} color="#82BE90" /> Privacy-preserving analytics</span>
        <span><Key size={17} color="#4C75F2" /> Role-separated permissions</span>
      </div>

      {/* 5. Clinical Journey Section — "One Case. A Connected Journey." */}
      <section
        id="approach"
        ref={approachRef}
        className="section approach-section"
        style={{ padding: '80px 7%' }}
      >
        <div className="journey-container">
          <div className="journey-sticky-col">
            <div className="journey-headline">
              <span className="eyebrow"><span /> ONE CASE. A CONNECTED JOURNEY.</span>
              <h2 style={{ margin: '12px 0 0', fontSize: '2.8rem', lineHeight: 1.18 }}>
                Insight grows<br />
                <em style={{ color: '#82BE90', fontStyle: 'italic' }}>with perspective.</em>
              </h2>
            </div>

            {/* 7 Numbered Step Indicators */}
            <div style={{ display: 'flex', gap: '10px', margin: '2.2rem 0', flexWrap: 'wrap' }}>
              {journey.map((_, i) => (
                <button
                  key={i}
                  className="journey-step-btn"
                  onClick={() => handleSelectStep(i)}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.95rem',
                    fontWeight: scene === i ? 700 : 500,
                    cursor: 'pointer',
                    background: scene === i ? '#82BE90' : 'rgba(255, 255, 255, 0.8)',
                    color: scene === i ? '#16191C' : '#5D7279',
                    border: scene === i ? '2px solid #82BE90' : '1px solid rgba(22, 25, 28, 0.12)',
                    boxShadow: scene === i ? '0 4px 14px rgba(130, 190, 144, 0.4)' : 'none'
                  }}
                  aria-label={`Go to step ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Visualization Area as a Dark Rounded Panel */}
            <div className="journey-model-wrap">
              <div
                className="dark-panel"
                style={{
                  height: '380px',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div
                  className="story-model"
                  style={{
                    width: '100%',
                    height: '320px',
                    minWidth: 0,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Suspense fallback={<div className="orb" />}>
                    <ClinicalModel
                      compact
                      activeIndex={scene}
                      onSelect={(_, idx) => handleSelectStep(idx)}
                      labels={['SYMPTOMS', 'RESEARCH', 'LABS', 'TRENDS', 'DISEASES', 'IMAGING', 'SIMILAR CASES']}
                    />
                  </Suspense>
                </div>
                <p style={{ textAlign: 'center', margin: 0, fontSize: '11px', color: '#AAB8B5', letterSpacing: '0.5px' }}>
                  Every connection starts with a case.
                </p>
              </div>
            </div>
          </div>

          <div className="journey-scroll-col">
            {journey.map(([category, title, desc], idx) => (
              <div
                key={idx}
                ref={(el) => { stageRefs.current[idx] = el; }}
                className={`journey-stage-card ${scene === idx ? 'active' : ''}`}
                onClick={() => handleSelectStep(idx)}
                style={{
                  padding: '3rem 2.5rem',
                  borderRadius: '24px',
                  border: '1px solid rgba(22, 25, 28, 0.08)',
                  background: scene === idx ? '#FFFFFF' : 'rgba(255, 255, 255, 0.45)',
                  boxShadow: scene === idx ? '0 16px 40px rgba(22, 25, 28, 0.08)' : 'none',
                  opacity: scene === idx ? 1 : 0.45,
                  cursor: 'pointer',
                  minHeight: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  scrollMarginTop: '110px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span className="eyebrow" style={{ color: scene === idx ? '#16191C' : '#5D7279', fontWeight: 700 }}>
                    <span style={{ background: scene === idx ? '#82BE90' : '#AAB8B5' }} />
                    {category}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: scene === idx ? '#16191C' : '#5D7279',
                      background: scene === idx ? '#DCEFE5' : 'transparent',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      border: scene === idx ? '1px solid #82BE90' : '1px solid rgba(22, 25, 28, 0.1)'
                    }}
                  >
                    STEP 0{idx + 1}
                  </span>
                </div>
                <h3 style={{ fontSize: '2.1rem', color: '#173B46', marginBottom: '1rem', lineHeight: 1.25 }}>
                  {title}
                </h3>
                <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: '#5D7279', margin: 0 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Dark Editorial Feature Panels — "One platform. Two distinct workflows." */}
      <section id="workflows" className="section" style={{ padding: '80px 7%' }}>
        <div className="reveal-item" style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3.5rem' }}>
          <div style={{ flex: '1 1 500px' }}>
            <div className="eyebrow"><span /> ONE PLATFORM · TWO DISTINCT WORKFLOWS</div>
            <h2 style={{ margin: '10px 0 0', fontSize: '2.6rem', color: '#173B46' }}>
              Different needs. One responsible approach to health data.
            </h2>
          </div>
          <p style={{ flex: '1 1 380px', margin: 0, fontSize: '1.1rem', lineHeight: 1.7, color: '#5D7279' }}>
            Connect individual patient care with population-level insights, without compromising the boundaries between them.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px' }}>
          {/* CARD A — CLINICAL RECORDS (Crisp White Editorial Card) */}
          <div
            className="hover-card reveal-card reveal-delay-0"
            style={{
              background: '#FFFFFF',
              borderRadius: '28px',
              border: '1px solid rgba(22, 25, 28, 0.08)',
              padding: '3.2rem 2.8rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 30px rgba(22, 25, 28, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#DCEFE5', color: '#173B46', padding: '8px 12px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} color="#82BE90" />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>01 · CLINICAL RECORDS</span>
              </div>
            </div>

            <h3 style={{ fontSize: '1.85rem', color: '#173B46', marginBottom: '1rem', lineHeight: 1.3 }}>
              A more complete picture of every patient.
            </h3>
            <p style={{ color: '#5D7279', fontSize: '1.02rem', lineHeight: 1.7, marginBottom: '2rem' }}>
              Give authorized clinicians a secure, consolidated view of visit history, diagnoses, and prescriptions through an authenticated QR-enabled workflow.
            </p>

            {/* Feature labels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#173B46', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="#82BE90" /> QR-enabled patient lookup
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#173B46', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="#82BE90" /> Authenticated clinician access
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#173B46', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="#82BE90" /> Longitudinal medical history
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#173B46', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="#82BE90" /> Auditable access activity
              </div>
            </div>

            {/* Visual Panel inside Card A */}
            <div style={{ background: '#DCEFE5', borderRadius: '18px', padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(130, 190, 144, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#FFFFFF', padding: '10px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <QrCode size={24} color="#16191C" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#173B46', fontSize: '0.95rem' }}>Patient QR Credential</div>
                  <div style={{ fontSize: '0.8rem', color: '#5D7279' }}>Cryptographically signed token · Verified on scan</div>
                </div>
                <ShieldCheck size={20} color="#82BE90" style={{ marginLeft: 'auto' }} />
              </div>
            </div>

            <Link href="/case" className="btn primary" style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
              Explore Clinical Records <ArrowRight size={16} />
            </Link>
          </div>

          {/* CARD B — HEALTH INTELLIGENCE (Cinematic Dark Charcoal Panel) */}
          <div
            className="hover-card reveal-card reveal-delay-100 dark-panel"
            style={{
              padding: '3.2rem 2.8rem',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#82BE90', padding: '8px 12px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(130, 190, 144, 0.3)' }}>
                <Globe2 size={16} color="#82BE90" />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>02 · HEALTH INTELLIGENCE</span>
              </div>
            </div>

            <h3 style={{ fontSize: '1.85rem', color: '#FFFFFF', marginBottom: '1rem', lineHeight: 1.3 }}>
              Understand trends, not identities.
            </h3>
            <p style={{ color: '#AAB8B5', fontSize: '1.02rem', lineHeight: 1.7, marginBottom: '2rem' }}>
              Explore eligible case counts across regions, time periods, and condition categories through privacy-preserving aggregate analytics.
            </p>

            {/* Feature labels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="#4C75F2" /> Regional disease trends
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="#4C75F2" /> Time-based comparisons
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="#4C75F2" /> Condition-category filters
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="#4C75F2" /> Minimum group-size suppression
              </div>
            </div>

            {/* Visual Panel inside Card B */}
            <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '18px', padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#82BE90', letterSpacing: '0.05em' }}>ILLUSTRATIVE REGIONAL ACTIVITY</span>
                <span style={{ fontSize: '0.7rem', color: '#AAB8B5', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px' }}>N &ge; 10 PROTECTED</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '85px', fontSize: '0.8rem', color: '#FFFFFF' }}>South Asia</span>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '85%', height: '100%', background: '#82BE90', borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#82BE90', fontWeight: 600 }}>+12.4%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '85px', fontSize: '0.8rem', color: '#FFFFFF' }}>South America</span>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '68%', height: '100%', background: '#4C75F2', borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#4C75F2', fontWeight: 600 }}>+8.2%</span>
                </div>
              </div>
            </div>

            <Link href="/trends" className="btn mint-pill" style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
              Explore Health Intelligence <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="reveal-item" style={{ marginTop: '3.5rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#5D7279', fontSize: '0.95rem', fontWeight: 600 }}>
          <ShieldCheck size={18} color="#82BE90" />
          Two workflows · Strict access separation · Privacy by design
        </div>
      </section>

      {/* How MediVault Works Section */}
      <section className="section" style={{ padding: '80px 7%' }}>
        <div className="section-heading reveal-item" style={{ marginBottom: '45px' }}>
          <div>
            <div className="eyebrow"><span /> HOW MEDIVAULT WORKS</div>
            <h2 style={{ fontSize: '2.5rem', color: '#173B46' }}>From individual care to population-level insight.</h2>
          </div>
          <p style={{ maxWidth: '420px', color: '#5D7279' }}>
            One connected workflow. Two distinct purposes. Privacy at every step.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          <div className="panel reveal-card reveal-delay-0" style={{ position: 'relative', padding: '2.2rem 1.8rem', borderRadius: '24px', border: '1px solid rgba(22, 25, 28, 0.08)', background: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
            <span style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '3rem', fontWeight: 800, color: 'rgba(22, 25, 28, 0.06)', lineHeight: 1 }}>01</span>
            <div style={{ background: '#DCEFE5', color: '#173B46', borderRadius: '14px', padding: '12px', display: 'inline-flex', marginBottom: '1.5rem', alignSelf: 'flex-start' }}>
              <FileText size={22} color="#173B46" />
            </div>
            <h3 style={{ fontSize: '1.3rem', color: '#173B46', marginBottom: '0.75rem' }}>Record</h3>
            <p style={{ color: '#5D7279', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Build a connected clinical history with visits, diagnoses and prescriptions.
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#82BE90', marginTop: 'auto' }}>PATIENT HISTORY</span>
          </div>

          <div className="panel reveal-card reveal-delay-100" style={{ position: 'relative', padding: '2.2rem 1.8rem', borderRadius: '24px', border: '1px solid rgba(22, 25, 28, 0.08)', background: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
            <span style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '3rem', fontWeight: 800, color: 'rgba(22, 25, 28, 0.06)', lineHeight: 1 }}>02</span>
            <div style={{ background: '#DCEFE5', color: '#173B46', borderRadius: '14px', padding: '12px', display: 'inline-flex', marginBottom: '1.5rem', alignSelf: 'flex-start' }}>
              <QrCode size={22} color="#173B46" />
            </div>
            <h3 style={{ fontSize: '1.3rem', color: '#173B46', marginBottom: '0.75rem' }}>Authorize</h3>
            <p style={{ color: '#5D7279', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Verify clinician identity and permissions before releasing a patient record.
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#82BE90', marginTop: 'auto' }}>SECURE QR ACCESS</span>
          </div>

          <div className="panel reveal-card reveal-delay-200" style={{ position: 'relative', padding: '2.2rem 1.8rem', borderRadius: '24px', border: '1px solid rgba(22, 25, 28, 0.08)', background: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
            <span style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '3rem', fontWeight: 800, color: 'rgba(22, 25, 28, 0.06)', lineHeight: 1 }}>03</span>
            <div style={{ background: '#DCEFE5', color: '#173B46', borderRadius: '14px', padding: '12px', display: 'inline-flex', marginBottom: '1.5rem', alignSelf: 'flex-start' }}>
              <Network size={22} color="#173B46" />
            </div>
            <h3 style={{ fontSize: '1.3rem', color: '#173B46', marginBottom: '0.75rem' }}>Aggregate</h3>
            <p style={{ color: '#5D7279', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Group eligible cases by region, reporting period and condition, with privacy checks.
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#82BE90', marginTop: 'auto' }}>PRIVACY FILTERS</span>
          </div>

          <div className="panel reveal-card reveal-delay-300" style={{ position: 'relative', padding: '2.2rem 1.8rem', borderRadius: '24px', border: '1px solid rgba(22, 25, 28, 0.08)', background: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
            <span style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '3rem', fontWeight: 800, color: 'rgba(22, 25, 28, 0.06)', lineHeight: 1 }}>04</span>
            <div style={{ background: '#DCEFE5', color: '#173B46', borderRadius: '14px', padding: '12px', display: 'inline-flex', marginBottom: '1.5rem', alignSelf: 'flex-start' }}>
              <Activity size={22} color="#173B46" />
            </div>
            <h3 style={{ fontSize: '1.3rem', color: '#173B46', marginBottom: '0.75rem' }}>Understand</h3>
            <p style={{ color: '#5D7279', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Explore approved disease trends without exposing individual patient identities.
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#82BE90', marginTop: 'auto' }}>HEALTH INTELLIGENCE</span>
          </div>
        </div>

        <div className="reveal-item" style={{ marginTop: '3.5rem', background: '#DCEFE5', borderRadius: '20px', padding: '1.8rem 2.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', border: '1px solid rgba(130, 190, 144, 0.3)' }}>
          <div style={{ color: '#173B46', flexShrink: 0 }}><ShieldCheck size={36} color="#173B46" /></div>
          <div>
            <h4 style={{ color: '#173B46', fontSize: '1.15rem', marginBottom: '0.25rem', fontWeight: 700 }}>Privacy is built into the workflow.</h4>
            <p style={{ color: '#5D7279', fontSize: '0.95rem', margin: 0 }}>
              Clinicians access authorized patient records. Administrators access approved aggregate statistics only.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Public-Health Intelligence Section — Dark Charcoal Dashboard Panel */}
      <section id="intelligence" className="section" style={{ padding: '80px 7%' }}>
        <div className="section-heading reveal-item" style={{ marginBottom: '35px' }}>
          <div>
            <div className="eyebrow"><span /> PUBLIC-HEALTH INTELLIGENCE PREVIEW</div>
            <h2 style={{ fontSize: '2.6rem', color: '#173B46' }}>Explore disease trends across regions and time.</h2>
          </div>
          <p style={{ maxWidth: '450px', color: '#5D7279' }}>
            Inspect aggregate surveillance patterns with enforced privacy boundaries and minimum group-size suppression.
          </p>
        </div>

        {/* White Liquid-Glass Dashboard Container */}
        <div className="liquid-glass-dashboard reveal-card" style={{ padding: '3.5rem 3rem' }}>
          {/* Top Controls Toolbar */}
          <div className="glass-toolbar">
            {/* Region Selector Chips */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#526A74', marginRight: '6px', letterSpacing: '0.05em' }}>REGION:</span>
              {trends.map((t) => (
                <button
                  key={t.id}
                  className={`glass-filter-chip ${selectedRegion === t.id ? 'active' : ''}`}
                  onClick={() => setSelectedRegion(t.id)}
                >
                  {t.region}
                </button>
              ))}
            </div>

            {/* Time Period & Disease Filter */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className={`glass-filter-chip ${timeRange === '8 weeks' ? 'active' : ''}`}
                onClick={() => setTimeRange('8 weeks')}
              >
                8 Weeks
              </button>
              <button
                className={`glass-filter-chip ${timeRange === '4 weeks' ? 'active' : ''}`}
                onClick={() => setTimeRange('4 weeks')}
              >
                4 Weeks
              </button>
              <button
                className={`glass-filter-chip ${conditionFilter === 'All' ? 'active' : ''}`}
                onClick={() => setConditionFilter('All')}
              >
                All Conditions
              </button>
              <button
                className={`glass-filter-chip ${conditionFilter === 'Dengue' ? 'active' : ''}`}
                onClick={() => setConditionFilter('Dengue')}
              >
                Dengue
              </button>
            </div>
          </div>

          {/* Aggregate Case Count KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', margin: '2.5rem 0' }}>
            <div className="glass-kpi-card">
              <div style={{ fontSize: '0.75rem', color: '#173B46', fontWeight: 700, letterSpacing: '0.05em' }}>AGGREGATE CASE COUNT</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#4C75F2', margin: '8px 0', lineHeight: 1 }}>
                {activeTrend.activity.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#647983' }}>Illustrative recent cases in {activeTrend.region}</div>
            </div>

            <div className="glass-kpi-card">
              <div style={{ fontSize: '0.75rem', color: '#173B46', fontWeight: 700, letterSpacing: '0.05em' }}>TREND DIRECTION</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#438A67', margin: '8px 0', lineHeight: 1 }}>
                {activeTrend.change > 0 ? `+${activeTrend.change}%` : `${activeTrend.change}%`}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#647983' }}>Change vs. baseline surveillance period</div>
            </div>

            <div className="glass-kpi-card">
              <div style={{ fontSize: '0.75rem', color: '#173B46', fontWeight: 700, letterSpacing: '0.05em' }}>SURVEILLANCE LEVEL</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#173B46', margin: '8px 0', lineHeight: 1.1 }}>
                {activeTrend.level}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#438A67', fontWeight: 600 }}>Active surveillance protocol</div>
            </div>

            <div className="glass-kpi-card privacy-card">
              <div style={{ fontSize: '0.75rem', color: '#173B46', fontWeight: 700, letterSpacing: '0.05em' }}>PRIVACY STATUS</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#438A67', margin: '8px 0', lineHeight: 1.1 }}>
                Enforced
              </div>
              <div style={{ fontSize: '0.8rem', color: '#647983' }}>Minimum group size &ge; 10 active</div>
            </div>
          </div>

          {/* Trend Chart & Regional Comparison Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', alignItems: 'center' }}>
            {/* SVG Interactive Trend Chart */}
            <div className="glass-subpanel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h4 style={{ color: '#173B46', fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                    {activeTrend.disease} Trends · {activeTrend.region}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: '#647983' }}>Weekly aggregated reports ({timeRange})</span>
                </div>
                <span style={{ background: '#EAF1FF', color: '#3A63DE', border: '1px solid #D2E1FC', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>
                  Cobalt Series
                </span>
              </div>

              {/* Chart SVG Canvas */}
              <div style={{ width: '100%', height: '170px' }}>
                <svg width="100%" height="100%" viewBox="0 0 420 160" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="cobaltAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4C75F2" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#4C75F2" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <line x1="20" y1="40" x2="400" y2="40" stroke="#E7EEEC" strokeDasharray="3 3" />
                  <line x1="20" y1="90" x2="400" y2="90" stroke="#E7EEEC" strokeDasharray="3 3" />
                  <line x1="20" y1="145" x2="400" y2="145" stroke="#E7EEEC" />

                  {/* Area Fill & Stroke */}
                  {areaPath && <path d={areaPath} fill="url(#cobaltAreaGrad)" />}
                  {linePath && <path d={linePath} fill="none" stroke="#4C75F2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                  {/* Data Points */}
                  {chartPoints.map((p, idx) => (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r="4.5" fill="#82BE90" stroke="#FFFFFF" strokeWidth="2" />
                      <text x={p.x} y="158" fill="#70838B" fontSize="9" textAnchor="middle">{p.week}</text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Regional Comparisons Progress Bars */}
            <div className="glass-subpanel regional-subpanel">
              <h4 style={{ color: '#173B46', fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 700 }}>Regional Comparisons</h4>
              <p style={{ color: '#647983', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                Normalized aggregate surveillance activity across active reporting zones
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {trends.map((t) => {
                  const percent = Math.min(Math.round((t.activity / 1400) * 100), 100);
                  const isSelected = t.id === selectedRegion;
                  return (
                    <div key={t.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                        <span style={{ color: isSelected ? '#245A43' : '#344E59', fontWeight: isSelected ? 700 : 500 }}>
                          {t.region}
                        </span>
                        <span style={{ color: '#70838B', fontSize: '0.8rem' }}>
                          {t.activity.toLocaleString()} cases
                        </span>
                      </div>
                      <div style={{ height: '7px', background: '#E7EEEC', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: isSelected ? '#82BE90' : '#4C75F2',
                            borderRadius: '4px',
                            boxShadow: isSelected ? '0 0 10px rgba(130, 190, 144, 0.35)' : 'none',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Surveillance Disclaimer Banner */}
          <div className="glass-dashboard-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#526A74', fontSize: '0.85rem', maxWidth: '680px' }}>
              <Shield size={18} color="#438A67" style={{ flexShrink: 0 }} />
              <span>
                <strong style={{ color: '#173B46' }}>ILLUSTRATIVE AGGREGATE METRICS</strong> — Case counts shown are synthetic demonstration figures. Identifiable individual data is never exposed. Minimum group-size suppression is strictly enforced.
              </span>
            </div>

            <Link
              href="/trends"
              className="btn mint-pill"
              style={{
                background: '#82BE90',
                color: '#173B46',
                border: '1px solid #82BE90',
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(130, 190, 144, 0.35)'
              }}
            >
              Explore Full Health Intelligence <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Privacy and Security Section — Pale Mint Background with Charcoal Panels */}
      <section id="privacy" className="pale-mint-section reveal-section" style={{ padding: '80px 7%', margin: '0 4% 80px' }}>
        <div className="section-heading" style={{ marginBottom: '50px' }}>
          <div>
            <div className="eyebrow" style={{ color: '#173B46' }}><span /> PRIVACY BY DESIGN</div>
            <h2 style={{ fontSize: '2.8rem', color: '#173B46', lineHeight: 1.2 }}>
              Privacy isn't a feature. It's the foundation.
            </h2>
          </div>
          <p style={{ maxWidth: '520px', color: '#5D7279', fontSize: '1.05rem', lineHeight: 1.7 }}>
            MediVault separates individual clinical care from population-level intelligence through enforced permissions, restricted data access, and minimum group-size protections.
          </p>
        </div>

        {/* Three Compact Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '50px' }}>
          <div className="reveal-card reveal-delay-0" style={{ background: '#FFFFFF', borderRadius: '24px', padding: '2.5rem 2rem', border: '1px solid rgba(22, 25, 28, 0.06)', boxShadow: '0 8px 24px rgba(22, 25, 28, 0.04)' }}>
            <div style={{ background: '#16191C', color: '#82BE90', width: '44px', height: '44px', borderRadius: '12px', display: 'grid', placeItems: 'center', marginBottom: '1.5rem' }}>
              <QrCode size={22} />
            </div>
            <h4 style={{ color: '#173B46', fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700 }}>Authorized clinical access</h4>
            <p style={{ color: '#5D7279', fontSize: '0.95rem', lineHeight: 1.7, margin: 0 }}>
              Ephemeral QR tokens initiate access to a specific record, with clinician credentials and authorization verified on every encounter.
            </p>
          </div>

          <div className="reveal-card reveal-delay-100" style={{ background: '#FFFFFF', borderRadius: '24px', padding: '2.5rem 2rem', border: '1px solid rgba(22, 25, 28, 0.06)', boxShadow: '0 8px 24px rgba(22, 25, 28, 0.04)' }}>
            <div style={{ background: '#16191C', color: '#4C75F2', width: '44px', height: '44px', borderRadius: '12px', display: 'grid', placeItems: 'center', marginBottom: '1.5rem' }}>
              <Users size={22} />
            </div>
            <h4 style={{ color: '#173B46', fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700 }}>Role-separated permissions</h4>
            <p style={{ color: '#5D7279', fontSize: '0.95rem', lineHeight: 1.7, margin: 0 }}>
              Distinct boundaries ensure clinicians interact only with clinical care records, while administrators view aggregate epidemiological metrics only.
            </p>
          </div>

          <div className="reveal-card reveal-delay-200" style={{ background: '#FFFFFF', borderRadius: '24px', padding: '2.5rem 2rem', border: '1px solid rgba(22, 25, 28, 0.06)', boxShadow: '0 8px 24px rgba(22, 25, 28, 0.04)' }}>
            <div style={{ background: '#16191C', color: '#82BE90', width: '44px', height: '44px', borderRadius: '12px', display: 'grid', placeItems: 'center', marginBottom: '1.5rem' }}>
              <Database size={22} />
            </div>
            <h4 style={{ color: '#173B46', fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700 }}>Privacy-preserving aggregation</h4>
            <p style={{ color: '#5D7279', fontSize: '0.95rem', lineHeight: 1.7, margin: 0 }}>
              Minimum cohort thresholds (N &ge; 10) prevent small-group identity re-identification in disease trend reporting and spatial queries.
            </p>
          </div>
        </div>

        {/* Architectural Flow Panel */}
        <div style={{ background: '#16191C', borderRadius: '24px', padding: '45px 35px', color: '#FFFFFF', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ padding: '10px 20px', background: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', borderRadius: '9999px', fontWeight: 600, fontSize: '13px' }}>
                CLINICIAN ENCOUNTER
              </span>
              <ArrowRight size={18} color="#82BE90" />
              <span style={{ padding: '10px 20px', border: '1px dashed rgba(255, 255, 255, 0.25)', borderRadius: '9999px', fontSize: '13px', color: '#AAB8B5' }}>
                QR AUTH & VERIFICATION
              </span>
              <ArrowRight size={18} color="#82BE90" />
              <span style={{ padding: '10px 20px', background: '#82BE90', color: '#16191C', borderRadius: '9999px', fontWeight: 700, fontSize: '13px' }}>
                PERMITTED PATIENT RECORD
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ padding: '10px 20px', background: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', borderRadius: '9999px', fontWeight: 600, fontSize: '13px' }}>
                ADMINISTRATOR / PUBLIC HEALTH
              </span>
              <ArrowRight size={18} color="#4C75F2" />
              <span style={{ padding: '10px 20px', border: '1px dashed rgba(255, 255, 255, 0.25)', borderRadius: '9999px', fontSize: '13px', color: '#AAB8B5' }}>
                COHORT AGGREGATION & SUPPRESSION
              </span>
              <ArrowRight size={18} color="#4C75F2" />
              <span style={{ padding: '10px 20px', background: '#4C75F2', color: '#FFFFFF', borderRadius: '9999px', fontWeight: 700, fontSize: '13px' }}>
                APPROVED AGGREGATE TRENDS
              </span>
            </div>
          </div>
          <p style={{ marginTop: '30px', maxWidth: '650px', marginInline: 'auto', fontSize: '12px', color: '#AAB8B5', lineHeight: 1.8 }}>
            The administrator workflow cannot access identifiable patient records. Privacy thresholds provide an essential boundary between clinical care and population surveillance.
          </p>
        </div>
      </section>

      {/* 9. Closing Call-To-Action Section (Cinematic Dark Panel) */}
      <section className="reveal-section" style={{ margin: '0 4% 80px' }}>
        <div
          className="dark-panel"
          style={{
            textAlign: 'center',
            padding: '90px 40px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Subtle Decorative Ambient Orbs */}
          <div className="deco-orb orb-mint" style={{ width: '80px', height: '80px', top: '10%', right: '15%', opacity: 0.5 }} />
          <div className="deco-orb orb-cobalt" style={{ width: '65px', height: '65px', bottom: '15%', left: '12%', opacity: 0.5 }} />

          {/* Thin flowing wave */}
          <svg className="flowing-wave" viewBox="0 0 1200 32" fill="none" style={{ position: 'absolute', top: '24px', left: 0, right: 0, opacity: 0.35 }}>
            <path d="M0 16 Q 75 4, 150 16 T 300 16 T 450 16 T 600 16 T 750 16 T 900 16 T 1050 16 T 1200 16" stroke="#82BE90" strokeWidth="1.5" fill="none" />
          </svg>

          <div className="eyebrow" style={{ justifyContent: 'center', color: '#82BE90', marginBottom: '16px' }}>
            <span style={{ background: '#82BE90' }} /> YOUR WORKFLOW, CONNECTED
          </div>
          <h2 style={{ fontSize: '3rem', lineHeight: 1.25, color: '#FFFFFF', margin: '0 0 20px' }}>
            Better care starts with<br />better-connected information.
          </h2>
          <p style={{ maxWidth: '580px', marginInline: 'auto', marginBottom: '35px', color: '#AAB8B5', fontSize: '1.1rem', lineHeight: 1.7 }}>
            Bring secure clinical access and privacy-preserving public-health insights into one thoughtfully designed platform.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn mint-pill" href="/case">
              Get Started <ArrowUpRight size={17} />
            </Link>
            <Link className="btn" href="/dashboard" style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
              Explore the Platform
            </Link>
          </div>
        </div>
      </section>

      {/* 10. Refined Dark Footer */}
      <footer>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'grid', placeItems: 'center', background: '#16191C', color: '#82BE90', width: '36px', height: '36px', borderRadius: '10px', border: '1px solid rgba(130, 190, 144, 0.4)' }}>
            <Activity size={20} />
          </span>
          <strong style={{ letterSpacing: '2px', color: '#FFFFFF' }}>MEDIVAULT</strong>
        </div>
        <span>Secure Patient Records. Smarter Public Health.</span>
        <div style={{ display: 'flex', gap: '22px', justifyContent: 'center', margin: '15px 0', flexWrap: 'wrap', fontSize: '14px' }}>
          <Link href="/dashboard">Platform</Link>
          <Link href="/case">Clinical Records</Link>
          <Link href="/trends">Health Intelligence</Link>
          <Link href="#privacy">Privacy & Security</Link>
          <Link href="/login">Contact</Link>
        </div>
        <small>Designed for secure clinical workflows and responsible public-health analytics.</small>
      </footer>
    </main>
  );
}
