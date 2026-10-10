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
  Activity
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
    defaultName: 'Sarah Jenkins',
    defaultEmail: 'patient@example.com',
    defaultProfession: 'Patient',
    defaultOrganization: 'Personal Health Enclave',
    destination: '/dashboard',
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
    destination: '/cases',
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
    destination: '/trends',
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
    try {
      const activeEmail = email.trim() || selectedRole.defaultEmail;
      authService.signIn(activeEmail, password, role);
      if (signup) {
        authService.update({
          name: name.trim() || selectedRole.defaultName,
          email: activeEmail,
          profession: profession.trim() || selectedRole.defaultProfession,
          organization: organization.trim() || selectedRole.defaultOrganization,
          role,
        });
      }
      location.href = selectedRole.destination;
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="auth-page">
      {/* Blurred pastel radial gradient aura */}
      <div className="auth-ambient-aura" aria-hidden="true">
        <div className="aura-blob aura-sky-blue" />
        <div className="aura-blob aura-pale-teal" />
        <div className="aura-blob aura-lavender" />
      </div>

      <div className="auth-container">
        {/* Top Navbar */}
        <header className="auth-navbar">
          <Link className="auth-brand" href="/">
            <span className="auth-brand-badge">
              <Activity size={18} />
            </span>
            <div className="auth-brand-text">
              <span className="auth-brand-name">MEDVIADUCT</span>
              <span className="auth-brand-sub">CLINICAL INTELLIGENCE</span>
            </div>
          </Link>

          <nav className="auth-nav-links">
            <Link href="/dashboard" className="auth-nav-link">Platform</Link>
            <Link href="/#privacy" className="auth-nav-link">Privacy</Link>
            <Link href="/" className="auth-nav-btn">
              Back to home <ArrowUpRight size={14} />
            </Link>
          </nav>
        </header>

        {/* Main Two-Column Content Grid */}
        <main className="auth-main-grid">
          {/* Left Column: Hero */}
          <section className="auth-hero-section">
            <div className="auth-eyebrow-tag">
              <span className="auth-dot" /> SECURE ACCESS · PERSONALIZED WORKSPACES
            </div>

            <h1 className="auth-hero-title">
              <span className="auth-hero-line1">The right access.</span>
              <span className="auth-hero-line2">The right insight.</span>
            </h1>

            <p className="auth-hero-desc">
              One connected health platform for personal records, clinical care and privacy-preserving public-health intelligence.
            </p>

            <div className="auth-feature-list">
              <div className="auth-feature-item">
                <div className="auth-feature-icon-circle icon-patient">
                  <UserRound size={20} />
                </div>
                <div>
                  <h3 className="auth-feature-title">Patient records</h3>
                  <p className="auth-feature-text">
                    View your longitudinal health history, visit details and prescriptions — securely in one place.
                  </p>
                </div>
              </div>

              <div className="auth-feature-item">
                <div className="auth-feature-icon-circle icon-clinical">
                  <Hospital size={20} />
                </div>
                <div>
                  <h3 className="auth-feature-title">Clinical workspace</h3>
                  <p className="auth-feature-text">
                    Access authorized patient records and manage clinical encounters with trusted tools.
                  </p>
                </div>
              </div>

              <div className="auth-feature-item">
                <div className="auth-feature-icon-circle icon-public">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="auth-feature-title">Public-health insights</h3>
                  <p className="auth-feature-text">
                    Explore anonymized population trends across regions, time periods and conditions.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Login Card */}
          <section className="auth-card-panel">
            <div className="auth-card-header">
              <span className="auth-card-eyebrow">
                {signup ? 'NEW USER REGISTRATION' : 'CHOOSE YOUR WORKSPACE'}
              </span>
              <h2 className="auth-card-title">
                {signup ? 'Create your workspace' : 'Welcome to Medviaduct'}
              </h2>
              <p className="auth-card-subtitle">
                Choose your secure workspace to continue.
              </p>
            </div>

            {/* Three selectable role cards */}
            <div className="role-selector-grid" role="radiogroup" aria-label="Select your workspace role">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const isSelected = r.id === role;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`role-select-card ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectRole(r.id)}
                  >
                    <div className="role-card-top">
                      <span className="role-icon-wrap">
                        <Icon size={19} />
                      </span>
                      {isSelected && (
                        <span className="role-check-badge">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="role-card-name">{r.title}</div>
                    <p className="role-card-summary">{r.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Role Context & Security Banner */}
            <div className="role-security-banner">
              <ShieldCheck size={16} className="role-banner-shield" />
              <span>{selectedRole.bannerText}</span>
            </div>

            {/* Form */}
            <form className="auth-form" onSubmit={submit}>
              {signup && (
                <div className="auth-field-group">
                  <label className="auth-field-label">Full name</label>
                  <div className="auth-input-wrapper">
                    <UserRound size={16} className="auth-input-icon" />
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={selectedRole.defaultName}
                      autoComplete="name"
                      className="auth-input-control"
                    />
                  </div>
                </div>
              )}

              <div className="auth-field-group">
                <label className="auth-field-label">Work or personal email</label>
                <div className="auth-input-wrapper">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={selectedRole.defaultEmail}
                    autoComplete="email"
                    className="auth-input-control"
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="auth-input-control has-toggle"
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {signup && (
                <>
                  <div className="auth-field-group">
                    <label className="auth-field-label">Profession</label>
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
                  <div className="auth-field-group">
                    <label className="auth-field-label">Organization</label>
                    <div className="auth-input-wrapper">
                      <Hospital size={16} className="auth-input-icon" />
                      <input
                        required
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder={selectedRole.defaultOrganization}
                        className="auth-input-control"
                      />
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div role="alert" className="auth-error-banner">
                  {error}
                </div>
              )}

              <button className="auth-submit-btn" type="submit">
                {signup
                  ? selectedRole.signupButtonLabel
                  : `Continue as ${selectedRole.roleName}`}
                <ArrowRight size={16} />
              </button>

              <div className="auth-divider">
                <span>or</span>
              </div>

              <Link href={selectedRole.destination} className="auth-explore-link">
                Explore without signing in →
              </Link>

              <div className="auth-privacy-footer">
                <Lock size={14} className="auth-privacy-lock" />
                <span>
                  Your data is protected with encryption, role-based access and privacy safeguards designed for clinical and public-health use.
                </span>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}



