'use client';
import {useState,useEffect,type FormEvent} from 'react';
import Link from '@/components/link';
import {ArrowLeft,ArrowRight,Check,LogOut,UserRound,Hospital,ChartNoAxesCombined,Shield,Sparkles,Lock} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {toast} from 'sonner';
import {authService,writeState} from '@/services';
import type {User,UserRole} from '@/types';
import {PageHead,Picker,Brand,useData} from './shared';

export function Profile(){const data=useData();const [user,setUser]=useState<User>(data.user);const [notifications,setNotifications]=useState(data.notifications);const [motion,setMotion]=useState(data.reducedMotion);useEffect(()=>{setUser(data.user)},[data.user]);return <><PageHead eyebrow="PROFILE & PREFERENCES" title="A workspace that feels like yours." description="Your professional details and local demonstration preferences."/><div className="settings-layout"><form className="panel settings-form" onSubmit={e=>{e.preventDefault();try{authService.update(user);toast.success('Profile saved on this device')}catch{toast.error('Could not save profile')}}}><div className="profile-summary"><span className="avatar large">{user.name.split(' ').slice(-2).map(x=>x[0]).join('')}</span><div><h2>Your professional profile</h2><p>Shown within this browser’s workspace</p></div></div>{(['name','email','profession','organization'] as const).map(k=><label key={k}>{k[0].toUpperCase()+k.slice(1)}<input required value={user[k]} type={k==='email'?'email':'text'} onChange={e=>setUser({...user,[k]:e.target.value})}/></label>)}<button className="btn primary">Save profile <Check size={16}/></button></form><div><div className="panel preferences"><h2>Preferences</h2><div><label htmlFor="notifications"><strong>Workspace updates</strong><span>Remember your preference for future connected notifications.</span></label><Switch id="notifications" checked={notifications} onCheckedChange={v=>{setNotifications(v);writeState({notifications:v});toast.success('Notification preference saved')}}/></div><div><label htmlFor="motion"><strong>Reduced motion</strong><span>Limit movement in this workspace.</span></label><Switch id="motion" checked={motion} onCheckedChange={v=>{setMotion(v);writeState({reducedMotion:v});document.documentElement.classList.toggle('reduce-motion',v);toast.success('Motion preference saved')}}/></div></div><div className="panel"><h3>About this workspace</h3><p className="small muted">Cases, attachments, reading lists and preferences are stored locally in this browser. There is no connected clinical AI service, cloud account or live surveillance feed.</p><button className="btn secondary" onClick={()=>{authService.signOut();location.href='/login'}}><LogOut size={16}/>Leave demo session</button></div></div></div></>}

const ROLES: {
  id: UserRole;
  title: string;
  label: string;
  description: string;
  helper: string;
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
    label: 'PERSONAL HEALTH RECORDS',
    description: 'Access your personal health journey, visit history and prescriptions.',
    helper: 'Personal Health Enclave · View your permitted visits, diagnoses, prescriptions and secure QR tokens.',
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
    label: 'CLINICAL WORKSPACE',
    description: 'Access authorized patient records and manage clinical encounters.',
    helper: 'Authorized Clinical Workspace · Access requires verified credentials, patient QR lookup and audit logging.',
    buttonLabel: 'Continue as Clinician',
    signupButtonLabel: 'Create Clinician Profile',
    icon: Hospital,
    defaultName: 'Dr. Alex Morgan',
    defaultEmail: 'clinician@hospital.org',
    defaultProfession: 'Physician',
    defaultOrganization: 'Metropolitan Medical Center',
    destination: '/cases',
  },
  {
    id: 'admin',
    title: 'Administrator',
    label: 'PUBLIC-HEALTH INTELLIGENCE',
    description: 'Explore aggregate disease trends across regions, time periods and condition categories.',
    helper: 'Public Health Intelligence · Aggregated population data with strict group suppression (N ≥ 10). Individual records protected.',
    buttonLabel: 'Continue as Administrator',
    signupButtonLabel: 'Create Administrator Profile',
    icon: ChartNoAxesCombined,
    defaultName: 'Dr. Elena Rostova',
    defaultEmail: 'admin@publichealth.gov',
    defaultProfession: 'Public Health Administrator',
    defaultOrganization: 'National Health Surveillance',
    destination: '/trends',
  },
];

export function Auth({signup}:{signup:boolean}){
  const [role, setRole] = useState<UserRole>('clinician');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('demo-password-123');
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('Physician');
  const [organization, setOrganization] = useState('');
  const [error, setError] = useState('');
  const [google, setGoogle] = useState(false);

  const selectedRole = ROLES.find(r => r.id === role) || ROLES[1];

  // Set default placeholder values when role changes if fields are empty
  const handleSelectRole = (newRole: UserRole) => {
    setRole(newRole);
    setError('');
    const config = ROLES.find(r => r.id === newRole);
    if (config) {
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
    <main className="auth-page">
      <Link href="/" className="auth-back">
        <ArrowLeft size={16}/> Back to Medviaduct
      </Link>

      {/* LEFT COLUMN: BRANDING & ROLE MISSION */}
      <div className="auth-intro">
        <div className="auth-brand-lockup">
          <Brand />
        </div>
        
        <div className="auth-eyebrow-tag">
          SECURE ACCESS · PERSONALIZED WORKSPACES
        </div>

        <h1 className="auth-hero-title">
          The right access.<br/>
          <em>The right insight.</em>
        </h1>

        <p className="auth-hero-desc">
          A connected health platform for personal records, clinical care and privacy-preserving public-health intelligence.
        </p>

        <div className="auth-feature-list">
          <div className="auth-feature-item">
            <span className="auth-feature-icon"><UserRound size={17}/></span>
            <div>
              <strong>Patient Self-Ownership</strong>
              <p>Encrypted personal health record with granular, time-bound QR permissions for clinical encounters.</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon"><Hospital size={17}/></span>
            <div>
              <strong>Clinical Intelligence</strong>
              <p>Authorized provider access for longitudinal chart review, differential reasoning and evidence synthesis.</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon"><ChartNoAxesCombined size={17}/></span>
            <div>
              <strong>Public-Health Enclave</strong>
              <p>Population surveillance with strict minimum group-size suppression (N ≥ 10) to safeguard individual anonymity.</p>
            </div>
          </div>
        </div>

        <div className="auth-footer-statement">
          <Shield size={14} />
          <span>Secure patient records. Smarter public health.</span>
        </div>
      </div>

      {/* RIGHT COLUMN: REFINED WHITE LIQUID-GLASS LOGIN CARD */}
      <div className="auth-glass-panel">
        <div className="auth-card-inner">
          <div className="auth-header-block">
            <span className="eyebrow auth-eyebrow">
              {signup ? 'NEW USER REGISTRATION' : 'CHOOSE YOUR WORKSPACE'}
            </span>
            <h2 className="auth-form-title">
              {signup ? 'Create your workspace' : 'Welcome to Medviaduct'}
            </h2>
            <p className="auth-form-subtitle">
              Choose your workspace to continue securely.
            </p>
          </div>

          {/* THREE ROLE SELECTION CARDS */}
          <div className="role-selector" role="radiogroup" aria-label="Select your workspace role">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const isSelected = r.id === role;
              return (
                <div
                  key={r.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  className={`role-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectRole(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectRole(r.id);
                    }
                  }}
                >
                  <div className="role-card-header">
                    <span className="role-card-icon">
                      <Icon size={19} />
                    </span>
                    <span className="role-card-badge">{r.label}</span>
                    {isSelected && (
                      <span className="role-active-check">
                        <Check size={13} />
                      </span>
                    )}
                  </div>
                  <h3 className="role-card-title">{r.title}</h3>
                  <p className="role-card-desc">{r.description}</p>
                </div>
              );
            })}
          </div>

          {/* ROLE CONTEXT BANNER */}
          <div className="role-context-banner">
            <Sparkles size={15} />
            <p>{selectedRole.helper}</p>
          </div>

          {/* AUTHENTICATION FORM */}
          <form className="auth-fields-form" onSubmit={submit}>
            <p className="auth-demo-notice">
              <Lock size={13} />
              <span>This demonstration opens a local session with verified permissions. No plaintext passwords stored.</span>
            </p>

            {signup && (
              <label className="auth-label">
                <span>Full name</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selectedRole.defaultName}
                  autoComplete="name"
                />
              </label>
            )}

            <label className="auth-label">
              <span>Work or personal email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={selectedRole.defaultEmail}
                autoComplete="email"
              />
            </label>

            <label className="auth-label">
              <span>Demo password</span>
              <input
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="off"
              />
            </label>

            {signup && (
              <>
                <label className="auth-label">
                  <span>Profession</span>
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
                </label>
                <label className="auth-label">
                  <span>Organization</span>
                  <input
                    required
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder={selectedRole.defaultOrganization}
                  />
                </label>
              </>
            )}

            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}

            <button className="btn primary auth-submit-btn" type="submit">
              {signup ? selectedRole.signupButtonLabel : selectedRole.buttonLabel}
              <ArrowRight size={17} />
            </button>

            <button
              className="btn secondary auth-google-btn"
              type="button"
              onClick={() => setGoogle(true)}
            >
              Continue with Google
            </button>

            <div className="auth-secondary-links">
              <p>
                {signup ? 'Already have a demo profile?' : 'New to Medviaduct?'}{' '}
                <Link className="text-link" href={signup ? '/login' : '/signup'}>
                  {signup ? 'Sign in' : 'Create a profile'}
                </Link>
              </p>
              <Link href={selectedRole.destination} className="text-link auth-quiet-link">
                Explore {selectedRole.title} without signing in →
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* GOOGLE DIALOG */}
      <Dialog open={google} onOpenChange={setGoogle}>
        <DialogContent className="auth-dialog-content">
          <DialogHeader>
            <DialogTitle>Google sign-in is not connected</DialogTitle>
            <DialogDescription>
              This demonstration uses a verified local role session without external third-party identity providers. Continue with a local demo session as {selectedRole.title} to explore the workspace.
            </DialogDescription>
          </DialogHeader>
          <Link className="btn primary" href={selectedRole.destination}>
            Continue as {selectedRole.title} <ArrowRight size={16}/>
          </Link>
        </DialogContent>
      </Dialog>
    </main>
  );
}



