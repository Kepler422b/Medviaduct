'use client';
import {useEffect,useState,type ReactNode} from 'react';
import Link from '@/components/link';
import {Activity,ArrowRight,BookOpen} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {readState,defaults} from '@/services';
export function useData(){const [data,setData]=useState(defaults);useEffect(()=>{const refresh=()=>setData(readState());refresh();window.addEventListener('medintel-change',refresh);return()=>window.removeEventListener('medintel-change',refresh)},[]);return data}
export function Brand(){return <Link className="brand" href="/"><span className="brand-mark"><Activity size={23}/></span>MEDVIADUCT<span className="brand-sub">CLINICAL INTELLIGENCE</span></Link>}
export function Picker({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:string[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="picker"><SelectValue/></SelectTrigger><SelectContent>{options.map(v=><SelectItem value={v} key={v}>{v}</SelectItem>)}</SelectContent></Select>}
export function PageHead({eyebrow,title,description,children}:{eyebrow:string;title:string;description:string;children?:ReactNode}){return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>}
export function Empty({title,description,href,label}:{title:string;description:string;href?:string;label?:string}){return <div className="empty-state"><BookOpen size={32}/><h3>{title}</h3><p>{description}</p>{href&&<Link href={href} className="btn primary">{label}<ArrowRight size={16}/></Link>}</div>}
export function download(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}



