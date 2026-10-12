'use client';
import {useState,useEffect,type FormEvent} from 'react';
import Link from '@/components/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  LogOut,
  UserRound,
  Hospital,
  BriefcaseMedical,
  BarChart3,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  Activity,
  KeyRound,
  X,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {toast} from 'sonner';
import {authService,writeState} from '@/services';
import type {User,UserRole} from '@/types';
import {PageHead,Picker,useData} from './shared';

export function Profile(){const data=useData();const [user,setUser]=useState<User>(data.user);const [notifications,setNotifications]=useState(data.notifications);const [motion,setMotion]=useState(data.reducedMotion);useEffect(()=>{setUser(data.user)},[data.user]);return <><PageHead eyebrow="PROFILE & PREFERENCES" title="A workspace that feels like yours." description="Your professional details and local demonstration preferences."/><div className="settings-layout"><form className="panel settings-form" onSubmit={e=>{e.preventDefault();try{authService.update(user);toast.success('Profile saved on this device')}catch{toast.error('Could not save profile')}}}><div className="profile-summary"><span className="avatar large">{user.name.split(' ').slice(-2).map(x=>x[0]).join('')}</span><div><h2>Your professional profile</h2><p>Shown within this browser’s workspace</p></div></div>{(['name','email','profession','organization'] as const).map(k=><label key={k}>{k[0].toUpperCase()+k.slice(1)}<input required value={user[k]} type={k==='email'?'email':'text'} onChange={e=>setUser({...user,[k]:e.target.value})}/></label>)}<button className="btn primary">Save profile <Check size={16}/></button></form><div><div className="panel preferences"><h2>Preferences</h2><div><label htmlFor="notifications"><strong>Workspace updates</strong><span>Remember your preference for future connected notifications.</span></label><Switch id="notifications" checked={notifications} onCheckedChange={v=>{setNotifications(v);writeState({notifications:v});toast.success('Notification preference saved')}}/></div><div><label htmlFor="motion"><strong>Reduced motion</strong><span>Limit movement in this workspace.</span></label><Switch id="motion" checked={motion} onCheckedChange={v=>{setMotion(v);writeState({reducedMotion:v});document.documentElement.classList.toggle('reduce-motion',v);toast.success('Motion preference saved')}}/></div></div><div className="panel"><h3>About this workspace</h3><p className="small muted">Cases, attachments, reading lists and preferences are stored locally in this browser. There is no connected clinical AI service, cloud account or live surveillance feed.</p><button className="btn secondary" onClick={()=>{authService.signOut();location.href='/login'}}><LogOut size={16}/>Leave demo session</button></div></div></div></>}

const ROLES: {
  id: UserRole;
  title: string;
  roleName: string;
  label: string;
  description: string;
  bannerText: string;
  buttonLabel: string;
  signupButtonLabel: string;
  icon: typeof UserRound;
  defaultName: string;
  defaultEmail: string;
  defaultProfession: string;
  defaultOrganization: string;
  destination: string;
}[] = [
  {
    id: 'patient',
    title: 'Patient',
    roleName: 'Patient',
    label: 'PERSONAL HEALTH RECORDS',
    description: 'Access your personal health journey, visit history and prescriptions.',
    bannerText: 'Patient records selected · Personal health enclave and encrypted data.',
    buttonLabel: 'Continue as Patient',
    signupButtonLabel: 'Create Patient Profile',
    icon: UserRound,
    defaultName: 'Ananya Deshmukh',
    defaultEmail: 'patient@example.com',
    defaultProfession: 'Patient',
    defaultOrganization: 'Personal Health Enclave',
    destination: '/patient',
  },
  {
    id: 'clinician',
    title: 'Clinician / Hospital',
    roleName: 'Clinician',
    label: 'CLINICAL WORKSPACE',
    description: 'Access authorized patient records and manage clinical encounters.',
    bannerText: 'Clinical workspace selected · Verified access and audit logging.',
    buttonLabel: 'Continue as Clinician',
    signupButtonLabel: 'Create Clinician Profile',
    icon: BriefcaseMedical,
    defaultName: 'Dr. Alex Morgan',
    defaultEmail: 'clinician@hospital.org',
    defaultProfession: 'Physician',
    defaultOrganization: 'Metropolitan Medical Center',
    destination: '/clinic',
  },
  {
    id: 'admin',
    title: 'Administrator',
    roleName: 'Administrator',
    label: 'PUBLIC-HEALTH INTELLIGENCE',
    description: 'Explore anonymized regional trends and aggregate analytics.',
    bannerText: 'Public-health insights selected · Enforced anonymization and regional trends.',
    buttonLabel: 'Continue as Administrator',
    signupButtonLabel: 'Create Administrator Profile',
    icon: BarChart3,
    defaultName: 'Dr. Elena Rostova',
    defaultEmail: 'admin@publichealth.gov',
    defaultProfession: 'Public Health Administrator',
    defaultOrganization: 'National Health Surveillance',
    destination: '/admin',
  },
];

export function Auth({signup}:{signup:boolean}){
  const [role, setRole] = useState<UserRole>('clinician');
  const [email, setEmail] = useState('clinician@hospital.org');
  const [password, setPassword] = useState('demo-password-123');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('Physician');
  const [organization, setOrganization] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OAuth Handshake State
  const [oauthModal, setOauthModal] = useState<{
    isOpen: boolean;
    provider: 'google' | 'abha';
    loading: boolean;
    stage: 'prompt' | 'authorizing' | 'success';
  }>({
    isOpen: false,
    provider: 'google',
    loading: false,
    stage: 'prompt',
  });

  const handleStartOAuth = (provider: 'google' | 'abha') => {
    setOauthModal({
      isOpen: true,
      provider,
      loading: false,
      stage: 'prompt',
    });
  };

  const handleExecuteOAuthConsent = () => {
    setOauthModal((prev) => ({ ...prev, loading: true, stage: 'authorizing' }));

    setTimeout(() => {
      const activeProvider = oauthModal.provider;
      const targetUser =
        role === 'patient'
          ? {
              name: 'Ananya Deshmukh',
              email: activeProvider === 'google' ? 'ananya.deshmukh@gmail.com' : 'ananya.deshmukh@abha.in',
              profession: 'Patient',
              organization: 'Personal Health Enclave (OAuth Verified)',
              role: 'patient' as const,
              destination: '/patient',
            }
          : role === 'admin'
          ? {
              name: 'Dr. Elena Rostova',
              email: 'elena.rostova@publichealth.gov',
              profession: 'Public Health Administrator',
              organization: 'National Health Surveillance',
              role: 'admin' as const,
              destination: '/admin',
            }
          : {
              name: 'Dr. Alex Morgan',
              email: activeProvider === 'google' ? 'alex.morgan@hospital.org' : 'alex.morgan@abha.in',
              profession: 'Physician',
              organization: 'Metropolitan Medical Center',
              role: 'clinician' as const,
              destination: '/clinic',
            };

      authService.signIn(targetUser.email, 'oauth-token-authenticated', targetUser.role);
      authService.update(targetUser);

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'medvia.oauth.session',
          JSON.stringify({
            provider: activeProvider,
            providerName:
              activeProvider === 'google'
                ? 'Google Identity Services (OAuth 2.0 / OIDC)'
                : 'ABHA National Health ID Gateway (NDHM §24)',
            account: targetUser.email,
            name: targetUser.name,
            role: targetUser.role,
            authenticatedAt: new Date().toISOString(),
          })
        );
      }

      setOauthModal((prev) => ({ ...prev, loading: false, stage: 'success' }));
      toast.success(
        `Authenticated via ${activeProvider === 'google' ? 'Google' : 'ABHA'} OAuth! Welcome, ${targetUser.name}`
      );

      setTimeout(() => {
        location.href = targetUser.destination;
      }, 700);
    }, 1100);
  };

  const selectedRole = ROLES.find(r => r.id === role) || ROLES[1];

  const handleSelectRole = (newRole: UserRole) => {
    setRole(newRole);
    setError('');
    const config = ROLES.find(r => r.id === newRole);
    if (config) {
      if (!email || ROLES.some(r => r.defaultEmail === email)) {
        setEmail(config.defaultEmail);
      }
      if (!name || ROLES.some(r => r.defaultName === name)) {
        setName(config.defaultName);
      }
      if (!organization || ROLES.some(r => r.defaultOrganization === organization)) {
        setOrganization(config.defaultOrganization);
      }
      setProfession(config.defaultProfession);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const activeEmail = email.trim() || selectedRole.defaultEmail;

      if (signup) {
        authService.signIn(activeEmail, password, role);
        authService.update({
          name: name.trim() || selectedRole.defaultName,
          email: activeEmail,
          profession: profession.trim() || selectedRole.defaultProfession,
          organization: organization.trim() || selectedRole.defaultOrganization,
          role,
        });
        toast.success(`Account registered! Continuing as ${selectedRole.roleName}`);
      } else {
        authService.signIn(activeEmail, password, role);
        toast.success(`Signed in as ${selectedRole.roleName}`);
      }

      location.href = selectedRole.destination;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mv-auth-page">
      {/* Blurred pastel radial gradient aura */}
      <div className="mv-auth-aura" aria-hidden="true">
        <div className="mv-auth-aura-blob mv-aura-sky-blue" />
        <div className="mv-auth-aura-blob mv-aura-mint" />
        <div className="mv-auth-aura-blob mv-aura-lavender" />
      </div>

      {/* Top Floating Pill Navbar */}
      <div className="mv-auth-nav-wrap">
        <header className="mv-auth-navbar">
          <Link className="mv-auth-brand" href="/">
            <span className="mv-auth-brand-badge">
              <Activity size={20} strokeWidth={2.2} />
            </span>
            <div className="mv-auth-brand-text">
              <span className="mv-auth-brand-name">MEDVIADUCT</span>
              <span className="mv-auth-brand-sub">CLINICAL INTELLIGENCE</span>
            </div>
          </Link>

          <nav className="mv-auth-nav-links">
            <Link href="/dashboard" className="mv-auth-nav-link">Platform</Link>
            <Link href="/#privacy" className="mv-auth-nav-link">Privacy</Link>
            <Link href="/" className="mv-auth-nav-btn">
              Back to home <ArrowUpRight size={14} />
            </Link>
          </nav>
        </header>
      </div>

      {/* Main Two-Column Content Grid */}
      <div className="mv-auth-body-wrap">
        <main className="mv-auth-grid">
          {/* Left Column: Hero */}
          <section className="mv-auth-hero">
            <div className="mv-auth-eyebrow">
              <span className="mv-auth-dot" /> SECURE ACCESS · PERSONALIZED WORKSPACES
            </div>

            <h1 className="mv-auth-hero-title">
              <span className="mv-auth-title-line1">The right access.</span>
              <span className="mv-auth-title-line2">The right insight.</span>
            </h1>

            <p className="mv-auth-hero-desc">
              One connected health platform for personal records, clinical care and privacy-preserving public-health intelligence.
            </p>

            <div className="mv-auth-feature-list">
              <div className="mv-auth-feature-item">
                <div className="mv-auth-feature-icon mv-auth-icon-patient">
                  <UserRound size={20} />
                </div>
                <div>
                  <h3 className="mv-auth-feature-title">Patient records</h3>
                  <p className="mv-auth-feature-text">
                    View your longitudinal health history, visit details and prescriptions — securely in one place.
                  </p>
                </div>
              </div>

              <div className="mv-auth-feature-item">
                <div className="mv-auth-feature-icon mv-auth-icon-clinical">
                  <Hospital size={20} />
                </div>
                <div>
                  <h3 className="mv-auth-feature-title">Clinical workspace</h3>
                  <p className="mv-auth-feature-text">
                    Access authorized patient records and manage clinical encounters with trusted tools.
                  </p>
                </div>
              </div>

              <div className="mv-auth-feature-item">
                <div className="mv-auth-feature-icon mv-auth-icon-public">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="mv-auth-feature-title">Public-health insights</h3>
                  <p className="mv-auth-feature-text">
                    Explore anonymized population trends across regions, time periods and conditions.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Login Card */}
          <section className="mv-auth-card">
            <div className="mv-auth-card-header">
              <span className="mv-auth-card-eyebrow">
                {signup ? 'NEW USER REGISTRATION' : 'CHOOSE YOUR WORKSPACE'}
              </span>
              <h2 className="mv-auth-card-title">
                {signup ? 'Create your workspace' : 'Welcome to Medviaduct'}
              </h2>
              <p className="mv-auth-card-subtitle">
                Choose your secure workspace to continue.
              </p>
            </div>

            {/* Three selectable role cards */}
            <div className="mv-auth-role-grid" role="radiogroup" aria-label="Select your workspace role">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const isSelected = r.id === role;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`mv-auth-role-card ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectRole(r.id)}
                    style={{
                      padding: '12px 10px',
                      minHeight: '76px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div className="mv-auth-role-top" style={{ marginBottom: '6px' }}>
                      <span className="mv-auth-role-icon">
                        <Icon size={19} />
                      </span>
                      {isSelected && (
                        <span className="mv-auth-check-badge">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="mv-auth-role-name" style={{ margin: 0 }}>
                      {r.title}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Role Context & Security Banner */}
            <div className="mv-auth-security-banner">
              <ShieldCheck size={16} className="mv-auth-banner-shield" />
              <span>{selectedRole.bannerText}</span>
            </div>

            {/* Quick OAuth Authentication Section */}
            <div className="mv-auth-oauth-section" style={{ margin: '14px 0 16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleStartOAuth('google')}
                className="mv-oauth-btn mv-oauth-google"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google ({selectedRole.roleName})</span>
              </button>

              <button
                type="button"
                onClick={() => handleStartOAuth('abha')}
                className="mv-oauth-btn mv-oauth-abha"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid #133840',
                  background: '#133840',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
              >
                <ShieldCheck size={16} style={{ color: '#2dd4bf', flexShrink: 0 }} />
                <span>Continue with ABHA / ABDM OAuth (Gov ID)</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
                <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                  or continue with credentials
                </span>
                <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>
            </div>

            {/* Form */}
            <form className="mv-auth-form" onSubmit={submit}>
              {signup && (
                <div className="mv-auth-field">
                  <label className="mv-auth-label">Full name</label>
                  <div className="mv-auth-input-wrap">
                    <UserRound size={16} className="mv-auth-input-icon" />
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={selectedRole.defaultName}
                      autoComplete="name"
                      className="mv-auth-input"
                    />
                  </div>
                </div>
              )}

              <div className="mv-auth-field">
                <label className="mv-auth-label">Work or personal email</label>
                <div className="mv-auth-input-wrap">
                  <Mail size={16} className="mv-auth-input-icon" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={selectedRole.defaultEmail}
                    autoComplete="email"
                    className="mv-auth-input"
                  />
                </div>
              </div>

              <div className="mv-auth-field">
                <label className="mv-auth-label">Password</label>
                <div className="mv-auth-input-wrap">
                  <Lock size={16} className="mv-auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="mv-auth-input has-toggle"
                  />
                  <button
                    type="button"
                    className="mv-auth-pw-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {signup && (
                <>
                  <div className="mv-auth-field">
                    <label className="mv-auth-label">Profession</label>
                    <Picker
                      value={profession}
                      onChange={setProfession}
                      options={
                        role === 'patient'
                          ? ['Patient', 'Caregiver', 'Patient Advocate']
                          : role === 'admin'
                          ? ['Public Health Administrator', 'Epidemiologist', 'Surveillance Analyst', 'Health Director']
                          : ['Physician', 'Specialist', 'Hospital Clinician', 'Medical Researcher', 'Nurse Practitioner']
                      }
                      label="Profession"
                    />
                  </div>
                  <div className="mv-auth-field">
                    <label className="mv-auth-label">Organization</label>
                    <div className="mv-auth-input-wrap">
                      <Hospital size={16} className="mv-auth-input-icon" />
                      <input
                        required
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder={selectedRole.defaultOrganization}
                        className="mv-auth-input"
                      />
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div role="alert" className="mv-auth-error">
                  {error}
                </div>
              )}

              <button className="mv-auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span>Authenticating...</span>
                ) : signup ? (
                  <>
                    {selectedRole.signupButtonLabel}
                    <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    Continue as {selectedRole.roleName}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="mv-auth-divider">
                <span>or</span>
              </div>

              <Link href={selectedRole.destination} className="mv-auth-explore">
                Explore without signing in →
              </Link>

              <div className="mv-auth-privacy">
                <Lock size={14} />
                <span>
                  Your data is protected with encryption, role-based access and privacy safeguards designed for clinical and public-health use.
                </span>
              </div>
            </form>
          </section>
        </main>
      </div>

      {/* OAuth Handshake & Consent Dialog */}
      {oauthModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
            {/* Modal Provider Top Bar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                {oauthModal.provider === 'google' ? (
                  <svg style={{ width: '18px', height: '18px', flexShrink: 0 }} viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-teal-700 flex items-center justify-center text-white">
                    <ShieldCheck size={13} />
                  </div>
                )}
                <span className="font-bold text-xs text-slate-800">
                  {oauthModal.provider === 'google'
                    ? 'Google Identity Services (OAuth 2.0)'
                    : 'ABHA National Digital Health Gateway'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOauthModal({ isOpen: false, provider: 'google', loading: false, stage: 'prompt' })}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="font-bold text-base text-slate-900">
                  {oauthModal.provider === 'google' ? 'Sign in with Google' : 'Authenticate with ABHA'}
                </h3>
                <p className="text-xs text-slate-500">
                  to continue to <strong className="text-teal-900 font-serif">Medviaduct Health Intelligence</strong>
                </p>
              </div>

              {/* Selected Persona Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 border border-teal-300 text-teal-800 font-bold text-sm flex items-center justify-center shrink-0">
                  {role === 'patient' ? 'AD' : role === 'admin' ? 'ER' : 'AM'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-slate-900 truncate">
                    {role === 'patient'
                      ? 'Ananya Deshmukh'
                      : role === 'admin'
                      ? 'Dr. Elena Rostova'
                      : 'Dr. Alex Morgan'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    {role === 'patient'
                      ? (oauthModal.provider === 'google' ? 'ananya.deshmukh@gmail.com' : 'ABHA ID: 91-4820-1049-2810')
                      : role === 'admin'
                      ? 'elena.rostova@publichealth.gov'
                      : (oauthModal.provider === 'google' ? 'alex.morgan@hospital.org' : 'DOC-MH-8192@abha.in')}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  {selectedRole.roleName}
                </span>
              </div>

              {/* Scopes disclosure */}
              <div className="space-y-1.5 text-xs text-slate-600 bg-amber-50/60 border border-amber-200/80 p-3 rounded-xl">
                <div className="font-semibold text-amber-950 flex items-center gap-1.5 text-[11px]">
                  <Lock size={12} className="text-amber-700" />
                  <span>Requested OpenID Connect Scopes:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                  <li>Verify full name, email, and identity tokens</li>
                  <li>Link zero-trust personal health enclave and audit keys</li>
                  {role === 'patient' && <li>Access personal consultations, lab tests & prescriptions</li>}
                  {role === 'clinician' && <li>Verify clinical practitioner NPI license and hospital credentials</li>}
                </ul>
              </div>

              {/* Handshake status */}
              {oauthModal.stage === 'authorizing' && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono font-bold text-teal-800 bg-teal-50 rounded-xl border border-teal-200 animate-pulse">
                  <Sparkles size={14} className="animate-spin text-teal-600" />
                  <span>Exchanging OAuth 2.0 PKCE cryptographic tokens...</span>
                </div>
              )}

              {oauthModal.stage === 'success' && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200">
                  <Check size={16} className="text-emerald-600" />
                  <span>OAuth Identity Confirmed! Redirecting to {selectedRole.roleName} Portal...</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setOauthModal({ isOpen: false, provider: 'google', loading: false, stage: 'prompt' })}
                disabled={oauthModal.loading}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteOAuthConsent}
                disabled={oauthModal.loading || oauthModal.stage === 'success'}
                className="bg-[#133840] hover:bg-[#0E7068] text-white font-bold px-5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{oauthModal.loading ? 'Authorizing...' : 'Authorize & Sign In'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




