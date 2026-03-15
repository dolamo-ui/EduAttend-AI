import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardCheck, History, Users, GraduationCap,
  School, UserCircle, Camera, Settings, Bell, User,
  Menu, LogOut, TrendingUp, BookOpen, Home, UserPlus, ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import { useAuth } from '../src/context/AuthContext';
import { RouteKey, canAccess, UserRole } from '../src/types/auth';

interface NavItem { label:string; icon:LucideIcon; path:string; routeKey:string; section:'overview'|'management'|'admin'|'ai'|'parent'; }
interface LayoutProps { children:React.ReactNode; currentPageName:string; }

const NAV_ITEMS: NavItem[] = [
  { label:'Dashboard',          icon:LayoutDashboard, path:'/dashboard',          routeKey:'dashboard',          section:'overview'   },
  { label:'Attendance',         icon:ClipboardCheck,  path:'/attendance',         routeKey:'attendance',         section:'overview'   },
  { label:'Attendance History', icon:History,         path:'/attendance-history', routeKey:'attendance-history', section:'overview'   },
  { label:'Progress',           icon:TrendingUp,      path:'/student-progress',   routeKey:'student-progress',   section:'overview'   },
  { label:'Students',           icon:Users,           path:'/students',           routeKey:'students',           section:'management' },
  { label:'Teachers',           icon:GraduationCap,   path:'/teachers',           routeKey:'teachers',           section:'management' },
  { label:'Classes',            icon:School,          path:'/classes',            routeKey:'classes',            section:'management' },
  { label:'Parents',            icon:UserCircle,      path:'/parents',            routeKey:'parents',            section:'management' },
  { label:'Settings',           icon:Settings,        path:'/settings',           routeKey:'settings',           section:'management' },
  // ── Admin (principal only) ────────────────────────────────────────────────
  { label:'Staff Approvals',    icon:ShieldCheck,     path:'/approvals',          routeKey:'approvals',          section:'admin'      },
  { label:'Add Teacher',        icon:UserPlus,        path:'/invite-teacher',     routeKey:'invite-teacher',     section:'admin'      },
  // ── AI ────────────────────────────────────────────────────────────────────
  { label:'AI Photo Lab',       icon:Camera,          path:'/aiphotolab',         routeKey:'aiphotolab',         section:'ai'         },
  { label:'Lesson Planning',    icon:BookOpen,        path:'/lesson-planning',    routeKey:'lesson-planning',    section:'ai'         },
  // ── Parent ────────────────────────────────────────────────────────────────
  { label:'My Child',           icon:Home,            path:'/parent-portal',      routeKey:'parent-portal',      section:'parent'     },
];

const SECTION_LABELS: Record<string,string> = { overview:'Overview', management:'Management', admin:'Administration', ai:'AI Tools', parent:'My Family' };
const SECTION_ORDER = ['overview','management','admin','ai','parent'] as const;

function RoleBadge({ role }: { role:UserRole }) {
  const s = { PRINCIPAL:{bg:'rgba(255,255,255,0.15)',color:'#fff',border:'rgba(255,255,255,0.3)'}, TEACHER:{bg:'rgba(167,243,208,0.2)',color:'#6ee7b7',border:'rgba(110,231,183,0.3)'}, PARENT:{bg:'rgba(253,230,138,0.25)',color:'#fde68a',border:'rgba(253,230,138,0.35)'} }[role];
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:999, fontSize:9, fontWeight:800, letterSpacing:'0.07em', textTransform:'uppercase', background:s.bg, color:s.color, border:`1px solid ${s.border}`, fontFamily:"'Sora',sans-serif" }}>{role}</span>;
}

function Avatar({ src, initials, size=36 }: { src?:string; initials:string; size?:number }) {
  const [err, setErr] = useState(false);
  if (src && !err) return <img src={src} alt={initials} onError={()=>setErr(true)} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>;
  return <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:Math.round(size*.35), userSelect:'none', fontFamily:"'Sora',sans-serif" }}>{initials}</div>;
}

interface DDItem { label:string; icon?:React.ReactNode; href?:string; onClick?:()=>void; danger?:boolean; }
function DropdownMenu({ trigger, header, items }: { trigger:React.ReactNode; header?:React.ReactNode; items:(DDItem|'separator')[] }) {
  const [open,setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);}; document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h); },[]);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ cursor:'pointer' }}>{trigger}</div>
      {open && (
        <div style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:240, background:'#fff', border:'1.5px solid #e8edf3', borderRadius:16, boxShadow:'0 16px 48px rgba(0,0,0,0.14)', zIndex:100, overflow:'hidden', padding:'4px 0', fontFamily:"'Sora',sans-serif" }}>
          {header && (<><div style={{ padding:'14px 16px 12px' }}>{header}</div><div style={{ borderTop:'1px solid #f1f5f9', margin:'0 8px' }}/></>)}
          {items.map((item,i) => {
            if (item==='separator') return <div key={i} style={{ borderTop:'1px solid #f1f5f9', margin:'4px 8px' }}/>;
            const inner = <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', fontSize:13, fontWeight:600, color:item.danger?'#dc2626':'#374151', cursor:'pointer', transition:'background 0.15s' }} onMouseEnter={e=>(e.currentTarget.style.background=item.danger?'#fef2f2':'#f8fafc')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>{item.icon}{item.label}</div>;
            return item.href ? <Link key={i} to={item.href} onClick={()=>setOpen(false)} style={{ textDecoration:'none' }}>{inner}</Link> : <div key={i} onClick={()=>{item.onClick?.();setOpen(false);}}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}

function NavLink({ item, isActive, onClick }: { item:NavItem; isActive:boolean; onClick?:()=>void }) {
  const Icon = item.icon;
  const [hov, setHov] = useState(false);
  return (
    <Link to={item.path} onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, textDecoration:'none', fontFamily:"'Sora',sans-serif", fontSize:13, fontWeight:600, background:isActive?'rgba(255,255,255,0.15)':hov?'rgba(255,255,255,0.06)':'transparent', color:isActive?'#fff':hov?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.65)', transition:'all 0.18s' }}>
      <Icon size={15} style={{ flexShrink:0, opacity:isActive?1:hov?0.85:0.65 }}/>
      <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.label}</span>
      {isActive && <span style={{ width:5, height:5, borderRadius:'50%', background:'#fff', flexShrink:0, opacity:0.9 }}/>}
    </Link>
  );
}

function StaffSidebar({ user, isSidebarOpen, setIsSidebarOpen, logout, location, grouped }: { user:NonNullable<ReturnType<typeof useAuth>['user']>; isSidebarOpen:boolean; setIsSidebarOpen:(v:boolean)=>void; logout:()=>void; location:ReturnType<typeof useLocation>; grouped:Partial<Record<string,NavItem[]>>; }) {
  const initials = user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const isActive = (p:string) => location.pathname===p||location.pathname.startsWith(p+'/');
  return (
    <aside style={{ position:'fixed', left:0, top:0, height:'100%', width:256, background:'linear-gradient(180deg,#1e3a8a 0%,#1e40af 60%,#2563eb 100%)', zIndex:50, display:'flex', flexDirection:'column', transform:isSidebarOpen?'translateX(0)':'translateX(-100%)', transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)', boxShadow:isSidebarOpen?'6px 0 32px rgba(30,58,138,0.3)':'none', fontFamily:"'Sora',sans-serif" }}>
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🏫</div>
          <div><div style={{ fontSize:15, fontWeight:900, color:'#fff', letterSpacing:'-0.02em' }}>EduAttend AI</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:500, marginTop:1 }}>Attendance Management</div></div>
        </div>
        {/* ── School code pill — visible to principal ── */}
        {user.role==='PRINCIPAL' && user.schoolCode && (
          <div style={{ marginTop:12, padding:'8px 12px', borderRadius:10, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.18)', cursor:'pointer' }}
            onClick={()=>{ navigator.clipboard.writeText(user.schoolCode!); }}>
            <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>School Code (tap to copy)</div>
            <div style={{ fontSize:15, fontWeight:900, color:'#fde68a', letterSpacing:'0.06em', fontFamily:'monospace' }}>{user.schoolCode}</div>
          </div>
        )}
      </div>
      <nav style={{ flex:1, overflowY:'auto', padding:'14px 10px', display:'flex', flexDirection:'column', gap:20 }}>
        {SECTION_ORDER.map(section => {
          const items = grouped[section];
          if (!items?.length) return null;
          return (
            <div key={section}>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.35)', padding:'0 14px', marginBottom:4 }}>{SECTION_LABELS[section]}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>{items.map(item=><NavLink key={item.path} item={item} isActive={isActive(item.path)} onClick={()=>window.innerWidth<1024&&setIsSidebarOpen(false)}/>)}</div>
            </div>
          );
        })}
      </nav>
      <div style={{ padding:'14px', borderTop:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
        {user.role==='TEACHER'&&user.assignedClass&&<div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'7px 12px', marginBottom:10, border:'1px solid rgba(255,255,255,0.15)' }}><School size={13} color="rgba(255,255,255,0.6)"/><span style={{ fontSize:12, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>Class {user.assignedClass}</span></div>}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Avatar src={user.avatar} initials={initials} size={36}/>
          <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.name}</div><div style={{ marginTop:3 }}><RoleBadge role={user.role}/></div></div>
          <button onClick={logout} style={{ padding:7, borderRadius:9, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.18)')} onMouseLeave={e=>(e.currentTarget.style.background='rgba(255,255,255,0.1)')}><LogOut size={14}/></button>
        </div>
      </div>
    </aside>
  );
}

function ParentSidebar({ user, isSidebarOpen, setIsSidebarOpen, logout, location }: { user:NonNullable<ReturnType<typeof useAuth>['user']>; isSidebarOpen:boolean; setIsSidebarOpen:(v:boolean)=>void; logout:()=>void; location:ReturnType<typeof useLocation>; }) {
  const initials = user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const links = [{ path:'/parent-portal', label:"My Child's Attendance", icon:<Home size={15}/>, active:location.pathname==='/parent-portal' },{ path:'/attendance-history', label:'Attendance History', icon:<History size={15}/>, active:location.pathname==='/attendance-history' }];
  return (
    <aside style={{ position:'fixed', left:0, top:0, height:'100%', width:256, background:'linear-gradient(180deg,#78350f 0%,#92400e 55%,#b45309 100%)', zIndex:50, display:'flex', flexDirection:'column', transform:isSidebarOpen?'translateX(0)':'translateX(-100%)', transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)', fontFamily:"'Sora',sans-serif" }}>
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}><div style={{ display:'flex', alignItems:'center', gap:11 }}><div style={{ width:38, height:38, borderRadius:12, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🏫</div><div><div style={{ fontSize:15, fontWeight:900, color:'#fff', letterSpacing:'-0.02em' }}>EduAttend AI</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:500, marginTop:1 }}>Parent & Family Portal</div></div></div></div>
      {user.childName&&<div style={{ margin:'14px 12px 0', padding:'13px 14px', borderRadius:14, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.18)' }}><div style={{ fontSize:9, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.45)', marginBottom:8 }}>Your Child</div><div style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ width:38, height:38, borderRadius:11, background:'rgba(255,255,255,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:900, color:'#fff', flexShrink:0 }}>{user.childName[0].toUpperCase()}</div><div><div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{user.childName}</div><div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:1 }}>Class {user.childClass}</div></div></div></div>}
      <nav style={{ flex:1, overflowY:'auto', padding:'14px 10px' }}>
        <div style={{ fontSize:9, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.35)', padding:'0 14px', marginBottom:6 }}>My Family</div>
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          {links.map(l=><Link key={l.path} to={l.path} onClick={()=>window.innerWidth<1024&&setIsSidebarOpen(false)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, textDecoration:'none', background:l.active?'rgba(255,255,255,0.15)':'transparent', color:l.active?'#fff':'rgba(255,255,255,0.65)', fontSize:13, fontWeight:600, transition:'all 0.18s' }} onMouseEnter={e=>{if(!l.active)e.currentTarget.style.background='rgba(255,255,255,0.06)';}} onMouseLeave={e=>{if(!l.active)e.currentTarget.style.background='transparent';}}>{l.icon}<span style={{ flex:1 }}>{l.label}</span>{l.active&&<span style={{ width:5, height:5, borderRadius:'50%', background:'#fde68a' }}/>}</Link>)}
        </div>
      </nav>
      <div style={{ padding:'14px', borderTop:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}><div style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:'rgba(255,255,255,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:'#fff' }}>{initials}</div><div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.name}</div><div style={{ marginTop:3 }}><RoleBadge role={user.role}/></div></div><button onClick={logout} style={{ padding:7, borderRadius:9, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.18)')} onMouseLeave={e=>(e.currentTarget.style.background='rgba(255,255,255,0.1)')}><LogOut size={14}/></button></div></div>
    </aside>
  );
}

function TopHeader({ user, isParent, isSidebarOpen, setIsSidebarOpen, currentPageName, logout }: { user:NonNullable<ReturnType<typeof useAuth>['user']>; isParent:boolean; isSidebarOpen:boolean; setIsSidebarOpen:(v:boolean)=>void; currentPageName:string; logout:()=>void; }) {
  const initials = user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const hBg = isParent?'#7c2d12':'#fff';
  const items: (DDItem|'separator')[] = [
    ...(!isParent?[{ label:'Profile', icon:<User size={14}/>, href:'/profile' } as DDItem]:[]),
    ...(user.role==='PRINCIPAL'?[{ label:'Settings', icon:<Settings size={14}/>, href:'/settings' } as DDItem, { label:'Staff Approvals', icon:<ShieldCheck size={14}/>, href:'/approvals' } as DDItem, { label:'Add Teacher', icon:<UserPlus size={14}/>, href:'/invite-teacher' } as DDItem]:[]),
    'separator' as const,
    { label:'Sign Out', icon:<LogOut size={14}/>, onClick:logout, danger:true },
  ];
  return (
    <header style={{ position:'sticky', top:0, zIndex:40, background:hBg, borderBottom:`1.5px solid ${isParent?'#92400e':'#e8edf3'}`, boxShadow:isParent?'0 2px 12px rgba(120,45,18,0.2)':'0 1px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ display:'flex', alignItems:'center', padding:'0 20px', height:60, gap:12 }}>
        <button onClick={()=>setIsSidebarOpen(!isSidebarOpen)} style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', background:isParent?'rgba(255,255,255,0.1)':'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', color:isParent?'#fde68a':'#64748b', flexShrink:0 }} onMouseEnter={e=>(e.currentTarget.style.background=isParent?'rgba(255,255,255,0.18)':'#e2e8f0')} onMouseLeave={e=>(e.currentTarget.style.background=isParent?'rgba(255,255,255,0.1)':'#f1f5f9')}><Menu size={17}/></button>
        {currentPageName&&<span className="page-badge" style={{ display:'none', padding:'4px 12px', borderRadius:999, fontSize:11, fontWeight:700, background:isParent?'rgba(255,255,255,0.12)':'#eef2ff', color:isParent?'#fde68a':'#6366f1', border:`1px solid ${isParent?'rgba(253,230,138,0.3)':'#c7d2fe'}`, fontFamily:"'Sora',sans-serif", letterSpacing:'0.02em' }}>{currentPageName}</span>}
        {isParent&&user.childName&&<div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#fde68a', fontFamily:"'Sora',sans-serif" }}><span>👶</span><span>{user.childName} · Class {user.childClass}</span></div>}
        <div style={{ flex:1 }}/>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', background:isParent?'rgba(255,255,255,0.1)':'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', color:isParent?'#fde68a':'#64748b', position:'relative', flexShrink:0 }}><Bell size={16}/><span style={{ position:'absolute', top:7, right:7, width:7, height:7, borderRadius:'50%', background:'#ef4444', border:`2px solid ${hBg}` }}/></button>
          <DropdownMenu trigger={<Avatar src={user.avatar} initials={initials} size={36}/>}
            header={<div style={{ fontFamily:"'Sora',sans-serif" }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#0f172a' }}>{user.name}</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{user.email}</div>
              {user.role==='PRINCIPAL'&&user.schoolCode&&(
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'#fef9c3', border:'1px solid #fde68a', cursor:'pointer' }} onClick={()=>navigator.clipboard.writeText(user.schoolCode!)}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#92400e', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>School Code (click to copy)</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#92400e', letterSpacing:'0.06em', fontFamily:'monospace' }}>{user.schoolCode}</div>
                </div>
              )}
              <div style={{ marginTop:6 }}><span style={{ display:'inline-block', padding:'2px 10px', borderRadius:999, fontSize:10, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', background:isParent?'#fef3c7':'#eef2ff', color:isParent?'#92400e':'#6366f1', border:`1px solid ${isParent?'#fde68a':'#c7d2fe'}`, fontFamily:"'Sora',sans-serif" }}>{user.role}</span></div>
            </div>}
            items={items}/>
        </div>
      </div>
      <style>{`@media(min-width:640px){.page-badge{display:inline-flex!important;align-items:center;}}`}</style>
    </header>
  );
}

export default function Layout({ children, currentPageName }: LayoutProps): React.ReactElement {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window!=='undefined'?window.innerWidth>=1024:true);
  useEffect(() => { if(window.innerWidth<1024)setIsSidebarOpen(false); }, [location.pathname]);
  if (!user) return <>{children}</>;
  const isParent = user.role==='PARENT';
  const visibleItems = NAV_ITEMS.filter(item => { try{return canAccess(user.role,item.routeKey as RouteKey);}catch{return false;} });
  const grouped = SECTION_ORDER.reduce<Partial<Record<string,NavItem[]>>>((acc,sec) => { const items=visibleItems.filter(i=>i.section===sec); if(items.length)acc[sec]=items; return acc; },{});
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');*,*::before,*::after{box-sizing:border-box;}body{margin:0;background:#f6f8fc;font-family:'Sora',sans-serif;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px;}`}</style>
      <div style={{ display:'flex', minHeight:'100vh', background:'#f6f8fc' }}>
        {isSidebarOpen&&<div onClick={()=>setIsSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', zIndex:40, backdropFilter:'blur(2px)' }} className="lg-hidden"/>}
        {isParent
          ? <ParentSidebar user={user} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} logout={logout} location={location}/>
          : <StaffSidebar  user={user} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} logout={logout} location={location} grouped={grouped}/>}
        <main style={{ flex:1, marginLeft:isSidebarOpen?256:0, transition:'margin-left 0.28s cubic-bezier(0.4,0,0.2,1)', display:'flex', flexDirection:'column', minHeight:'100vh', minWidth:0 }} className="main-content">
          <TopHeader user={user} isParent={isParent} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} currentPageName={currentPageName} logout={logout}/>
          <div style={{ flex:1, padding:'28px', maxWidth:1400, width:'100%', margin:'0 auto' }}>{children}</div>
        </main>
      </div>
      <style>{`@media(min-width:1024px){.lg-hidden{display:none!important;}}@media(max-width:1023px){.main-content{margin-left:0!important;}}@media(max-width:639px){.main-content>div:last-child{padding:16px!important;}}`}</style>
    </>
  );
}