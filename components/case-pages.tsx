'use client';
import {useState,useEffect,lazy,Suspense} from 'react';
import Link from '@/components/link';
import {ArrowRight,ArrowUpRight,Check,Download,FileText,Leaf,Network,Plus,Search,Sparkles,Trash2,Upload,X,Shield,QrCode,Pill,Calendar} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Progress} from '@/components/ui/progress';
import {Skeleton} from '@/components/ui/skeleton';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {toast} from 'sonner';
import {caseService,researchService,newCase} from '@/services';
import {sampleCase} from '@/data/demo';
import type {ClinicalCase} from '@/types';
import {PageHead,Picker,Empty,useData,download} from './shared';
import {PaperCard} from './research-pages';
const ClinicalModel=lazy(()=>import('@/components/3d/clinical-model').then(m=>({default:m.ClinicalIntelligenceModel})));

export function Cases(){
  const data=useData();
  const [query,setQuery]=useState('');
  const [remove,setRemove]=useState<string|null>(null);
  const isPatient = data.user.role === 'patient';

  // For Patient role: strictly display only authenticated patient's personal record
  if (isPatient) {
    const personalRecord = data.cases[0] || sampleCase;
    return (
      <>
        <PageHead
          eyebrow="PERSONAL HEALTH RECORD · ENCRYPTED PATIENT PORTAL"
          title={`Health record for ${data.user.name}`}
          description="Your longitudinal care history, visit notes, active prescriptions and diagnostic reports."
        >
          <Link href="/qr-center" className="btn primary">
            <QrCode size={17}/> Generate Clinician Pass
          </Link>
        </PageHead>

        <div className="demo-banner">
          <Shield size={16}/>
          <span>Patient Privacy Enclave · Only your authorized medical records are visible. Other patient files are strictly isolated and inaccessible.</span>
        </div>

        <div className="patient-portal-grid">
          {/* Active Condition & Overview */}
          <div className="panel patient-card">
            <div className="panel-title">
              <span className="eyebrow">PRIMARY DIAGNOSIS & OBSERVATION</span>
              <span className="pill">Active Care Plan</span>
            </div>
            <h2>{personalRecord.title}</h2>
            <p className="patient-symptoms-text">{personalRecord.symptoms}</p>
            <div className="patient-vitals-strip">
              <div><strong>Age</strong><span>{personalRecord.age || '34'} years</span></div>
              <div><strong>Sex</strong><span>{personalRecord.sex}</span></div>
              <div><strong>Updated</strong><span>{new Date(personalRecord.updatedAt).toLocaleDateString('en-GB')}</span></div>
            </div>
            <Link href={'/case?id='+personalRecord.id} className="text-link">
              View Detailed Clinical Note <ArrowUpRight size={15}/>
            </Link>
          </div>

          {/* Active Prescriptions */}
          <div className="panel patient-card">
            <div className="panel-title">
              <span className="eyebrow">ACTIVE PRESCRIPTIONS</span>
              <Pill size={17}/>
            </div>
            <h3>Current Regimen</h3>
            <ul className="patient-prescription-list">
              <li>
                <strong>Paracetamol 500mg</strong>
                <span>Oral tablet · Every 6 hours as needed for febrile symptoms</span>
              </li>
              <li>
                <strong>Oral Rehydration Solution (ORS)</strong>
                <span>Fluid management · 2 liters daily with monitoring</span>
              </li>
            </ul>
            <p className="small muted">Prescribed by Metropolitan Medical Center Care Team.</p>
          </div>

          {/* Permitted Clinical Encounters */}
          <div className="panel patient-card">
            <div className="panel-title">
              <span className="eyebrow">VISIT & ENCOUNTER HISTORY</span>
              <Calendar size={17}/>
            </div>
            <div className="encounter-timeline">
              <div className="encounter-entry">
                <span className="encounter-date">28 Sep 2026</span>
                <div>
                  <strong>Ambulatory Care Follow-up</strong>
                  <p>Vital signs stable. Hemodynamic monitoring performed. Platelet recovery assessed.</p>
                </div>
              </div>
              <div className="encounter-entry">
                <span className="encounter-date">23 Sep 2026</span>
                <div>
                  <strong>Initial Acute Care Visit</strong>
                  <p>Presented with high fever and myalgia. Serial blood counts ordered.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Investigations & Lab Reports */}
          <div className="panel patient-card">
            <div className="panel-title">
              <span className="eyebrow">LABORATORY INVESTIGATIONS</span>
              <FileText size={17}/>
            </div>
            <h3>Verified Diagnostic Findings</h3>
            <p className="patient-lab-findings">{personalRecord.labs || 'Platelet count 92,000/µL; leukocytes 3,200/µL. Dengue NS1 antigen reactive.'}</p>
            <div className="patient-qr-share-box">
              <QrCode size={20}/>
              <div>
                <strong>Share this record securely</strong>
                <p>Generate a time-expiring QR code for your next physician encounter.</p>
              </div>
              <Link href="/qr-center" className="text-link">Open QR Pass →</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Clinician role: case directory and case management
  const results=data.cases.filter(c=>c.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PageHead eyebrow="THE CLINICAL JOURNAL" title="Your cases, connected." description="Keep each clinical question and its supporting context together.">
        <Link href="/case" className="btn primary"><Plus size={17}/>New case</Link>
      </PageHead>
      <div className="toolbar">
        <div className="search-box">
          <Search size={17}/>
          <input aria-label="Search cases" placeholder="Find a clinical case…" value={query} onChange={e=>setQuery(e.target.value)}/>
        </div>
        <span className="muted small">{results.length} cases · stored on this device</span>
      </div>
      <div className="case-grid">
        {results.map(c=>(
          <article className="panel case-card" key={c.id}>
            <div className="panel-title">
              <span className="pill">{c.status}</span>
              <button className="icon-button" aria-label={'Delete '+c.title} onClick={()=>setRemove(c.id)}>
                <Trash2 size={16}/>
              </button>
            </div>
            <FileText className="case-card-icon"/>
            <h2>{c.title}</h2>
            <p>{c.symptoms}</p>
            <div className="case-meta">
              {c.age||'—'} years · {c.sex}<br/>Updated {new Date(c.updatedAt).toLocaleDateString('en-GB')}
            </div>
            <Link href={'/case?id='+c.id} className="text-link">Open case <ArrowUpRight size={16}/></Link>
          </article>
        ))}
      </div>
      {!results.length&&<Empty title={query?'No matching cases':'A fresh page for your research'} description={query?'Try a different search term.':'Create your first clinical case or try the sample.'} href="/case" label="Create a case"/>}
      <AlertDialog open={!!remove} onOpenChange={()=>setRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this local case?</AlertDialogTitle>
            <AlertDialogDescription>The case and its attached local files will be removed from this browser.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep case</AlertDialogCancel>
            <AlertDialogAction onClick={()=>{if(remove)caseService.remove(remove);setRemove(null);toast.success('Case deleted')}}>Delete case</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
const fields=[['symptoms','Presenting symptoms','Describe the symptoms, onset and duration.'],['history','Medical history','Relevant conditions, travel, exposures and family history.'],['examination','Examination findings','Vitals and relevant physical findings.'],['labs','Laboratory results','Results with units, dates and reference ranges where available.'],['imaging','Imaging findings','Summarize the radiology report.'],['medications','Current medications','Medication names and relevant history.'],['observations','Additional observations','The question you would like the evidence to address.']] as const;
export function CaseEditor(){const [c,setC]=useState<ClinicalCase|null>(null);const [step,setStep]=useState(-1);const [tab,setTab]=useState('case');const [error,setError]=useState('');const steps=['Reading clinical information','Extracting medical entities','Matching sample cases','Indexing curated literature','Connecting illustrative trends','Building your evidence map'];useEffect(()=>{const q=new URLSearchParams(location.search);const id=q.get('id');setC(q.has('sample')?{...sampleCase,id:crypto.randomUUID()}:id?caseService.get(id)||newCase():newCase())},[]);if(!c)return <Skeleton className="editor-loading"/>;
const update=(key:string,value:string)=>setC({...c,[key]:value,analysis:undefined,status:'Draft'});
const save=()=>{try{setC(caseService.save(c));setError('');toast.success('Case saved on this device');return true}catch(e){setError((e as Error).message);return false}};
const analyze=async()=>{if(!save())return;setStep(0);try{const result=await caseService.analyze(c);for(let i=1;i<steps.length;i++){await new Promise(r=>setTimeout(r,170));setStep(i)}const next={...c,analysis:result,status:'Analyzed' as const};caseService.save(next);setC(next);setTab('results');toast.success('Demonstration evidence map ready')}catch(e){setError((e as Error).message)}finally{setStep(-1)}};
const attach=async(files:FileList|null)=>{if(!files)return;for(const file of Array.from(files)){if(file.size>1500000){toast.error(file.name+': keep each attachment under 1.5 MB');continue}if(!['application/pdf','image/png','image/jpeg','text/plain'].includes(file.type)){toast.error('Use PDF, PNG, JPEG or TXT files');continue}try{const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)});const content=file.type==='text/plain'?await file.text():'';setC(current=>current?{...current,attachments:[...current.attachments,{name:file.name,size:file.size,type:file.type,data:encoded}],observations:current.observations+(content?'\n'+content:''),analysis:undefined,status:'Draft'}:current);toast.success(file.name+' attached locally')}catch{toast.error('Could not read attachment')}}};
return <><PageHead eyebrow="MY CASE / CLINICAL WORKSPACE" title="Every detail has a story." description="Bring the clinical context together. Let the evidence guide your next question."><button className="btn secondary" onClick={()=>{setC({...sampleCase,id:crypto.randomUUID()});setTab('case')}}>Load sample case</button></PageHead><div className="demo-banner"><Leaf size={16}/><span>Local demo · Use de-identified examples. Files stay in this browser. PDF and images are stored for reference; extraction supports entered text and TXT files.</span></div><Tabs value={tab} onValueChange={setTab}><TabsList className="journal-tabs"><TabsTrigger value="case">01 · Clinical narrative</TabsTrigger><TabsTrigger value="results" disabled={!c.analysis}>02 · Evidence intelligence</TabsTrigger></TabsList><TabsContent value="case"><div className="editor-layout"><form className="panel case-form" onSubmit={e=>{e.preventDefault();void analyze()}}><div className="journal-heading"><span className="eyebrow">CLINICAL CASE NOTES</span><FileText size={21}/></div><label className="title-field">Case title<input required value={c.title} placeholder="Give your clinical question a title…" onChange={e=>update('title',e.target.value)}/></label><div className="patient-row"><label>Patient age<input type="number" min="0" max="120" value={c.age} onChange={e=>update('age',e.target.value)} placeholder="Years"/></label><label>Sex<Picker value={c.sex} onChange={v=>update('sex',v)} options={['Not specified','Female','Male','Intersex']} label="Patient sex"/></label></div>{fields.map(([key,label,placeholder],i)=><label className="narrative-field" key={key}><span><b>{String(i+1).padStart(2,'0')}</b>{label}</span><textarea required={key==='symptoms'} rows={key==='symptoms'?3:2} value={c[key]} placeholder={placeholder} onChange={e=>update(key,e.target.value)}/></label>)}{error&&<p role="alert" className="error-message">{error}</p>}<div className="form-actions"><button className="btn secondary" type="button" onClick={save}>Save draft</button><button className="btn primary" disabled={step>=0} type="submit"><Sparkles size={17}/>{step>=0?'Connecting the evidence…':'Analyze case'}<ArrowRight size={17}/></button></div>{step>=0&&<div className="analysis-progress" role="status"><Progress value={(step+1)/6*100}/><p>{steps[step]}…</p></div>}</form><aside><div className="panel attachment-panel"><Upload size={24}/><h3>Supporting material</h3><p>Add a document or image to keep the case context together.</p><label className="upload-zone"><Upload size={20}/><strong>Choose files</strong><span>PDF, PNG, JPG, TXT · up to 1.5 MB each</span><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={e=>void attach(e.target.files)}/></label>{c.attachments.map((f,i)=><div className="attachment" key={i}><FileText size={16}/><span><a href={f.data} download={f.name}>{f.name}</a><small>{Math.round(f.size/1024)} KB · click to download</small></span><button type="button" className="icon-button" aria-label={'Remove '+f.name} onClick={()=>setC({...c,attachments:c.attachments.filter((_,j)=>i!==j)})}><X size={15}/></button></div>)}</div><div className="panel process-note"><span className="eyebrow">A CONNECTED PERSPECTIVE</span><h3>From narrative<br/>to understanding.</h3>{['Clinical context','Key medical concepts','Similar experiences','Relevant literature','An evidence map'].map((t,i)=><div key={t}><span>{i+1}</span>{t}</div>)}<p>Results use demonstration services. Clinical interpretation stays with you.</p></div></aside></div></TabsContent><TabsContent value="results">{c.analysis&&<><div className="panel result-summary"><div className="panel-title"><span className="pill"><Sparkles size={13}/> DEMO ANALYSIS</span><button className="btn secondary" onClick={()=>download('medintel-case.json',JSON.stringify(c,null,2))}><Download size={16}/>Export case</button></div><h2>{c.title}</h2><p>{c.analysis.summary}</p><div className="chips">{c.analysis.entities.length?c.analysis.entities.map(e=><span className="chip" key={e}>{e}</span>):<span className="muted">No dictionary entities matched; your narrative is preserved above.</span>}</div><p className="footnote">{c.analysis.limitations}</p></div><div className="two-columns"><div className="panel"><div className="panel-title"><h2>Evidence map</h2><Network size={19}/></div><Suspense fallback={<Skeleton className="model-skeleton"/>}><ClinicalModel onSelect={(_,i)=>{if(i===5)location.href='/research';else if(i===6)location.href='/similar?case='+c.id;else if(i===7)location.href='/trends';else toast(c.analysis?.features[Math.max(0,i-1)]||c.analysis?.summary)}}/></Suspense><p className="small muted">Select a node to explore its context.</p></div><div className="panel"><h2>Clinical features</h2>{c.analysis.features.map((f,i)=><div className="feature-line" key={i}><Check size={16}/><p>{f}</p></div>)}</div></div><div className="section-heading compact-heading"><h2>Related reading</h2><Link className="text-link" href="/research">Open library →</Link></div><div className="research-grid">{c.analysis.researchIds.map(id=>researchService.get(id)).filter(Boolean).map(p=><PaperCard key={p!.id} paper={p!}/>)}</div></>}</TabsContent></Tabs></>}


