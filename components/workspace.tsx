'use client';
import {useEffect,useState} from 'react';
import Link from '@/components/link';
import {Bell,BookOpen,Bookmark,ChevronRight,FileText,Globe2,LayoutDashboard,Leaf,Network,Search,Settings,Sparkles,QrCode,Shield} from 'lucide-react';
import {SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarFooter,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarInset,SidebarTrigger} from '@/components/ui/sidebar';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Toaster} from 'sonner';
import {researchService} from '@/services';
import {Brand,Empty,useData} from './shared';
import {Dashboard,Similar,Trends} from './intelligence-pages';
import {Cases,CaseEditor} from './case-pages';
import {Research,ResearchDetail} from './research-pages';
import {Profile,Auth} from './profile-pages';
import {QrCenter} from './qr-center';

const clinicianNav=[['dashboard','Clinical Overview',LayoutDashboard],['cases','Patient cases',FileText],['similar','Similar cases',Network],['trends','Disease trends',Globe2],['research','Latest research',BookOpen],['qr-center','QR Center',QrCode],['saved','Saved research',Bookmark]] as const;
const patientNav=[['dashboard','My Health Journey',LayoutDashboard],['cases','My Health Record',FileText],['qr-center','My QR Pass',QrCode],['trends','Community trends',Globe2],['saved','Saved articles',Bookmark]] as const;
const adminNav=[['trends','Public Health Intelligence',Globe2],['dashboard','Surveillance Overview',LayoutDashboard],['research','Latest research',BookOpen],['saved','Saved research',Bookmark]] as const;

export default function Workspace({section,paperId}:{section:string;paperId?:string}){
  const data=useData();
  const [notice,setNotice]=useState(false);
  const userRole = data.user.role || 'clinician';

  useEffect(()=>{document.documentElement.classList.toggle('reduce-motion',data.reducedMotion)},[data.reducedMotion]);
  useEffect(()=>{const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>}}).modelContext;if(!context)return;const ctrl=new AbortController();Promise.resolve(context.registerTool({name:'search_research',title:'Search MEDVIADUCT research',description:'Search the curated research library without changing saved records.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true},execute:(input:unknown)=>{if(!input||typeof (input as {query:unknown}).query!=='string')throw new Error('query must be text');return researchService.search((input as {query:string}).query).map(p=>({id:p.id,title:p.title,url:p.url}))}},{signal:ctrl.signal})).catch(()=>{});return()=>ctrl.abort()},[]);

  if(section==='login'||section==='signup')return <><Auth signup={section==='signup'}/><Toaster richColors/></>;

  const activeNav = userRole === 'admin' ? adminNav : userRole === 'patient' ? patientNav : clinicianNav;
  const navCaption = userRole === 'admin' ? 'PUBLIC-HEALTH ENCLAVE' : userRole === 'patient' ? 'PERSONAL HEALTH RECORDS' : 'CLINICAL WORKSPACE';
  const roleBadge = userRole === 'admin' ? 'Administrator · Surveillance Mode' : userRole === 'patient' ? 'Patient · Personal Records' : 'Clinician · Provider Session';

  // Privacy protection: strictly block administrators from individual patient records
  const isAdminBlocked = userRole === 'admin' && (section === 'cases' || section === 'case' || section === 'similar');

  return (
    <SidebarProvider>
      <Sidebar className="app-sidebar">
        <SidebarHeader><Brand/></SidebarHeader>
        <SidebarContent>
          <div className="nav-caption">{navCaption}</div>
          <SidebarMenu>
            {activeNav.map(([id,label,Icon])=>(
              <SidebarMenuItem key={id}>
                <SidebarMenuButton asChild isActive={section===id||(id==='cases'&&section==='case')}>
                  <Link href={'/'+id}>
                    <Icon size={18}/>
                    <span>{label}</span>
                    {id==='saved'&&data.saved.length>0&&<span className="count">{data.saved.length}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-note">
            <Leaf size={23}/>
            <h4>{userRole === 'admin' ? 'Population Perspective' : userRole === 'patient' ? 'Your Health Journey' : 'A Little Perspective'}</h4>
            <p>{userRole === 'admin' ? 'Surveillance insights protect individual patient privacy by design.' : userRole === 'patient' ? 'Your personal medical history, stored safely on your device.' : 'Every case is a starting point for a better question.'}</p>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <Link className="profile-link" href="/profile">
            <span className="avatar">{data.user.name.split(' ').slice(-2).map(x=>x[0]).join('')}</span>
            <span><strong>{data.user.name}</strong><small>{data.user.profession}</small></span>
            <Settings size={16}/>
          </Link>
          <Link className="demo-label" href="/login" title="Switch workspace role">{roleBadge}</Link>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="app-inset">
        <header className="workspace-topbar">
          <div className="breadcrumb">
            <SidebarTrigger/>
            <span>{userRole === 'admin' ? 'Public Health' : userRole === 'patient' ? 'Patient Portal' : 'Clinical Workspace'}</span>
            <ChevronRight size={14}/>
            <strong>{activeNav.find(n=>n[0]===section)?.[1]|| (section==='case'?'Clinical case':section==='detail'?'Research detail':'Settings')}</strong>
          </div>
          <form className="global-search" action="/research">
            <Search size={16}/>
            <input aria-label="Search research" name="q" placeholder="Search the evidence…"/>
          </form>
          <button className="icon-button" aria-label="Notifications" onClick={()=>setNotice(true)}>
            <Bell size={19}/>
          </button>
        </header>
        <main className="workspace-main">
          {isAdminBlocked ? (
            <div className="panel admin-privacy-guard">
              <div className="guard-header">
                <Shield size={36} className="text-teal" />
                <span className="eyebrow">PATIENT PRIVACY PROTECTION · STRICT ACCESS ENFORCEMENT</span>
              </div>
              <h2>Individual patient records are restricted</h2>
              <p className="guard-lead">
                In strict compliance with health data privacy regulations, Administrator accounts are prohibited from accessing individual identifiable patient clinical records.
              </p>
              <div className="guard-notice-box">
                <strong>Enforced Protections:</strong>
                <ul>
                  <li>Direct query and URL parameter access to patient files is blocked at both client and server layers.</li>
                  <li>Administrative access is strictly isolated to aggregate disease surveillance.</li>
                  <li>Minimum group-size suppression (N ≥ 10) prevents small-subgroup re-identification.</li>
                </ul>
              </div>
              <Link href="/trends" className="btn primary">
                Open Public Health Intelligence <ChevronRight size={16}/>
              </Link>
            </div>
          ) : section==='dashboard'?<Dashboard/>
            :section==='cases'?<Cases/>
            :section==='case'?<CaseEditor/>
            :section==='similar'?<Similar/>
            :section==='trends'?<Trends/>
            :section==='research'||section==='saved'?<Research savedOnly={section==='saved'}/>
            :section==='detail'?<ResearchDetail id={paperId||''}/>
            :section==='qr-center'?<QrCenter/>
            :section==='profile'?<Profile/>
            :<Empty title="This page has not been found" description="Return to your clinical workspace." href="/dashboard" label="Open overview"/>}
        </main>
        <div className="workspace-footer">
          <span>MEDVIADUCT · Clinical Intelligence. Backed by Evidence.</span>
          <span>{userRole === 'admin' ? 'Population surveillance · Enforced privacy controls' : userRole === 'patient' ? 'Personal health enclave · Patient owned' : 'Research support · Illustrative analysis and trends'}</span>
        </div>
      </SidebarInset>
      <Dialog open={notice} onOpenChange={setNotice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspace notifications</DialogTitle>
            <DialogDescription>Updates from your local demonstration workspace.</DialogDescription>
          </DialogHeader>
          <div className="notification">
            <Sparkles/>
            <div>
              <strong>Your {userRole === 'admin' ? 'surveillance' : userRole === 'patient' ? 'patient' : 'research'} space is ready</strong>
              <p>{userRole === 'admin' ? 'Explore aggregate epidemiological data across global monitoring zones.' : userRole === 'patient' ? 'Review your personal medical history and generate sharing QR tokens.' : 'Explore a sample case or create your own. Analysis and trends use demonstration services.'}</p>
            </div>
          </div>
          <div className="notification">
            <Bookmark/>
            <div>
              <strong>{data.saved.length} saved publications</strong>
              <p>Your reading list is stored on this device.</p>
              <Link href="/saved" className="text-link">Open reading list →</Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster richColors position="bottom-right"/>
    </SidebarProvider>
  );
}



