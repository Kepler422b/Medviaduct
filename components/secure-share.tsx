'use client';
import {useEffect,useState} from 'react';
import {ShieldCheck,AlertTriangle} from 'lucide-react';
import {API_BASE} from '@/services/api';
import {qrApi} from '@/services/qrApi';
export function SecureShare({token}:{token:string}){
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state,setState]=useState<any>();
  const [error,setError]=useState('');
  
  useEffect(()=>{
    if(API_BASE) {
      qrApi.resolve(token).then(setState).catch(e=>setError(e.message));
    } else {
      setError('This secure report needs a configured MediVault backend.');
    }
  },[token]);

  if(error)return <main className="public-report"><AlertTriangle/><h1>Report unavailable</h1><p>{error}</p></main>;
  if(!state)return <main className="public-report"><ShieldCheck/><p>Verifying secure MediVault token…</p></main>;
  
  return <main className="public-report"><div className="public-mark"><ShieldCheck size={18}/> VERIFIED MEDIVAULT RESOURCE</div><p className="eyebrow">SECURE CLINICAL INTELLIGENCE</p><h1>{state.title}</h1><p className="report-owner">Shared by {state.owner} · {state.resourceType.replaceAll('_',' ')}</p><section className="report-card"><h2>Summary</h2><p>{state.resource.summary}</p>{state.resource.analysis&&<><h2>Analysis</h2><pre>{JSON.stringify(state.resource.analysis,null,2)}</pre></>}{state.resource.evidence&&<><h2>Evidence</h2><pre>{JSON.stringify(state.resource.evidence,null,2)}</pre></>}</section><p className="report-foot">Access verified by MediVault. This report is for clinical intelligence support and does not diagnose patients.</p></main>
}
