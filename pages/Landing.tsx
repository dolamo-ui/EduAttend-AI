import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Radio, Bell, BarChart2, ShieldAlert, Building2, Smartphone,
  School, ClipboardCheck, TrendingUp, CheckCircle2, AlertCircle,
  BrainCircuit, ArrowRight, LogIn, LayoutDashboard, ChevronDown,
  Star, Users, Zap, Quote, Mail, Lock, Globe, GraduationCap,
} from 'lucide-react';

// ─── Logo component ───────────────────────────────────────────────────────────
function Logo({ size = 36, withText = false }: { size?: number; withText?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img
        src="/logo.png"
        alt="Attendance AI"
        style={{
          width: size, height: size,
          objectFit: 'contain',
          // The logo has a black bg — invert makes it white for dark backgrounds
          filter: 'brightness(0) invert(1) drop-shadow(0 0 6px rgba(34,197,94,.45))',
        }}
      />
      {withText && (
        <span style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 800,
          fontSize: '1.05rem', color: '#fff', letterSpacing: '-0.01em',
        }}>
          Attendance <span style={{ color: '#22c55e' }}>AI</span>
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Three.js hero canvas
// ─────────────────────────────────────────────────────────────────────────────
function HeroThree(): React.ReactElement {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = mountRef.current; if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 0, 6);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const fill = new THREE.PointLight(0x4ade80, 4, 20); fill.position.set(2, 2, 4); scene.add(fill);
    const rim  = new THREE.PointLight(0x38bdf8, 3, 20); rim.position.set(-3, -1, 3); scene.add(rim);
    const mainSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.7, roughness: 0.18, emissive: 0x166534, emissiveIntensity: 0.12 }),
    );
    mainSphere.position.set(0.3, 0, 0); scene.add(mainSphere);
    const wire = new THREE.Mesh(new THREE.SphereGeometry(1.18, 22, 22), new THREE.MeshBasicMaterial({ color: 0x4ade80, wireframe: true, transparent: true, opacity: 0.08 }));
    wire.position.copy(mainSphere.position); scene.add(wire);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.025, 16, 120), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.28 }));
    ring.rotation.x = Math.PI / 2.6; ring.position.copy(mainSphere.position); scene.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.012, 16, 120), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.18 }));
    ring2.rotation.x = Math.PI / 4; ring2.rotation.z = Math.PI / 6; ring2.position.copy(mainSphere.position); scene.add(ring2);
    type Sat = { mesh: THREE.Mesh; angle: number; speed: number; radius: number; yOff: number };
    const satellites: Sat[] = [];
    [0x38bdf8, 0xfbbf24, 0xf472b6, 0xa78bfa].forEach((c, i) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15 + Math.random() * 0.08, 32, 32), new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.3 }));
      scene.add(mesh);
      satellites.push({ mesh, angle: (i / 4) * Math.PI * 2, speed: 0.38 + i * 0.07, radius: 1.85 + i * 0.18, yOff: i % 2 === 0 ? 0.4 : -0.4 });
    });
    const pPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600 * 3; i++) pPos[i] = (Math.random() - 0.5) * 12;
    const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x4ade80, size: 0.03, transparent: true, opacity: 0.45 }));
    scene.add(particles);
    let mx = 0, my = 0;
    const onMouse = (e: MouseEvent) => { mx = (e.clientX / window.innerWidth - 0.5) * 1.4; my = (e.clientY / window.innerHeight - 0.5) * 1.4; };
    window.addEventListener('mousemove', onMouse);
    const onResize = () => { const nw = el.clientWidth, nh = el.clientHeight; camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh); };
    window.addEventListener('resize', onResize);
    let frameId: number;
    const clock = new THREE.Clock();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      mainSphere.rotation.y = t * 0.15; mainSphere.rotation.x = t * 0.06;
      wire.rotation.y = t * 0.1; ring.rotation.z = t * 0.12; ring2.rotation.y = t * 0.09; particles.rotation.y = t * 0.025;
      const bob = Math.sin(t * 0.7) * 0.12;
      mainSphere.position.y = bob; wire.position.y = ring.position.y = ring2.position.y = bob;
      satellites.forEach((s) => {
        s.angle += s.speed * 0.012;
        s.mesh.position.x = mainSphere.position.x + Math.cos(s.angle) * s.radius;
        s.mesh.position.y = bob + Math.sin(s.angle * 0.5) * s.yOff;
        s.mesh.position.z = Math.sin(s.angle) * s.radius * 0.6;
        s.mesh.rotation.y = t * 0.5;
      });
      camera.position.x += (mx * 0.5 - camera.position.x) * 0.05;
      camera.position.y += (-my * 0.35 - camera.position.y) * 0.05;
      camera.lookAt(mainSphere.position);
      fill.intensity = 3.5 + Math.sin(t * 1.2) * 0.8;
      renderer.render(scene, camera);
    };
    animate();
    return () => { cancelAnimationFrame(frameId); window.removeEventListener('mousemove', onMouse); window.removeEventListener('resize', onResize); renderer.dispose(); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement); };
  }, []);
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

function useReveal(): void {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } }), { threshold: 0.1 });
    document.querySelectorAll('.scroll-reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

type LucideIcon = React.FC<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;
interface Feature     { Icon: LucideIcon; title: string; desc: string; color: string; bg: string; }
interface Testimonial { name: string; role: string; avatar: string; quote: string; stars: number; }
interface Stat        { num: string; label: string; Icon: LucideIcon; }
interface Step        { step: string; Icon: LucideIcon; title: string; desc: string; color: string; }

const FEATURES: Feature[] = [
  { Icon: Radio,        title: 'Real-time Tracking',    desc: 'Instant attendance capture with live dashboards updating every second for every class.',     color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  { Icon: Bell,         title: 'Parent Alerts',          desc: 'Automated SMS & email notifications the moment a student is marked absent or late.',         color: '#38bdf8', bg: 'rgba(56,189,248,0.1)'  },
  { Icon: BarChart2,    title: 'Teacher Dashboard',      desc: 'Weekly trends, class analytics, and one-click export tools purpose-built for educators.',    color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  { Icon: BrainCircuit, title: 'AI Risk Prediction',     desc: 'Machine learning flags at-risk students weeks before issues escalate into serious problems.', color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
  { Icon: Building2,    title: 'Multi-class Management', desc: "Principals get a complete bird's-eye view across every class and year group in the school.",  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  { Icon: Smartphone,   title: 'Mobile Ready',           desc: 'Works seamlessly on phones, tablets, and desktops — mark attendance from anywhere, anytime.', color: '#fb923c', bg: 'rgba(251,146,60,0.1)'  },
];

const TESTIMONIALS: Testimonial[] = [
  { name: 'Dr. Amira Hassan',  role: 'Principal, Al-Noor Academy',   avatar: 'A', stars: 5, quote: 'Edu Attend AI transformed how we manage student presence. The AI risk alerts saved us from losing three students who were silently struggling.' },
  { name: 'Mr. James Carter',  role: 'Head Teacher, Westbrook High', avatar: 'J', stars: 5, quote: 'The teacher dashboard is incredibly intuitive. I can see my entire class attendance at a glance — saves me 2 hours every single week.'        },
  { name: 'Sarah Okonkwo',     role: 'Parent',                        avatar: 'S', stars: 5, quote: 'I get a notification the moment my son misses school. As a working parent, this kind of peace of mind is absolutely invaluable.'               },
];

const STATS: Stat[] = [
  { num: '98%',  label: 'Accuracy Rate',    Icon: CheckCircle2 },
  { num: '500+', label: 'Schools Enrolled', Icon: School       },
  { num: '2M+',  label: 'Students Tracked', Icon: Users        },
  { num: '<1s',  label: 'Real-time Sync',   Icon: Zap          },
];

const STEPS: Step[] = [
  { step: '01', Icon: School,         title: 'Set Up Your School', desc: 'Add your classes, teachers and students in under 5 minutes. Import from CSV or enter manually.',         color: '#22c55e' },
  { step: '02', Icon: ClipboardCheck, title: 'Mark Attendance',    desc: 'Teachers mark attendance from any device. The system instantly syncs and notifies parents in real time.', color: '#38bdf8' },
  { step: '03', Icon: TrendingUp,     title: 'Get Insights',       desc: 'The AI analyses patterns and flags at-risk students before attendance issues become serious problems.',    color: '#fbbf24' },
];

export default function Landing(): React.ReactElement {
  useReveal();
  const [activeTesti, setActiveTesti] = useState(0);
  useEffect(() => { const t = setInterval(() => setActiveTesti((p) => (p + 1) % TESTIMONIALS.length), 5200); return () => clearInterval(t); }, []);
  const goLogin     = () => { window.location.href = '/login';     };
  const goDashboard = () => { window.location.href = '/dashboard'; };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", background: '#0f1729', color: '#f0f4ff', overflowX: 'hidden', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeUp   {from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn   {from{opacity:0}to{opacity:1}}
        @keyframes floatY   {0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes pulseRing{0%{box-shadow:0 0 0 0 rgba(34,197,94,.4)}70%{box-shadow:0 0 0 12px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
        .scroll-reveal{opacity:0;transform:translateY(36px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1)}
        .scroll-reveal.is-visible{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.05s}.d2{transition-delay:.12s}.d3{transition-delay:.19s}.d4{transition-delay:.26s}.d5{transition-delay:.33s}.d6{transition-delay:.40s}
        .nav-link{color:rgba(255,255,255,.6);text-decoration:none;font-size:.88rem;font-weight:500;transition:color .18s}
        .nav-link:hover{color:#fff}
        .btn-primary{display:inline-flex;align-items:center;gap:8px;background:#22c55e;color:#fff;font-weight:700;font-size:.95rem;padding:12px 28px;border-radius:10px;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:background .2s,transform .15s,box-shadow .2s;box-shadow:0 4px 20px rgba(34,197,94,.35)}
        .btn-primary:hover{background:#16a34a;transform:translateY(-2px);box-shadow:0 8px 28px rgba(34,197,94,.45)}
        .btn-outline{display:inline-flex;align-items:center;gap:8px;background:transparent;color:rgba(255,255,255,.8);font-weight:600;font-size:.9rem;padding:11px 24px;border-radius:10px;border:1.5px solid rgba(255,255,255,.2);cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
        .btn-outline:hover{border-color:rgba(255,255,255,.5);color:#fff;background:rgba(255,255,255,.06)}
        .btn-ghost{background:rgba(255,255,255,.08);color:#fff;font-weight:600;font-size:.85rem;padding:9px 20px;border-radius:8px;border:1px solid rgba(255,255,255,.12);cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .18s;display:inline-flex;align-items:center;gap:6px}
        .btn-ghost:hover{background:rgba(255,255,255,.14)}
        .feat-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:28px 26px;transition:transform .25s,border-color .25s,box-shadow .25s}
        .feat-card:hover{transform:translateY(-6px);border-color:rgba(255,255,255,.14);box-shadow:0 20px 48px rgba(0,0,0,.25)}
        .stat-badge{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:22px 20px;text-align:center;transition:transform .2s,border-color .2s}
        .stat-badge:hover{transform:translateY(-4px);border-color:rgba(34,197,94,.3)}
        .testi-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:36px 32px;max-width:680px;margin:0 auto}
        .hero-chip{position:absolute;background:rgba(15,23,41,.78);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 14px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:#fff;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.3)}
        .step-card{position:relative;padding:32px 28px;background:rgba(255,255,255,.035);border-radius:20px;border:1px solid rgba(255,255,255,.07);transition:transform .25s,border-color .25s}
        .step-card:hover{transform:translateY(-5px);border-color:rgba(255,255,255,.14)}
        .footer-link{color:rgba(255,255,255,.38);text-decoration:none;font-size:.85rem;transition:color .18s}
        .footer-link:hover{color:#fff}
        @media(max-width:768px){.hero-two-col{flex-direction:column!important}.hero-right{display:none!important}.nav-links-row{display:none!important}}
      `}</style>

      {/* NAV */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 48px', height:64, background:'rgba(15,23,41,0.88)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <Logo size={40} withText />
        <div className="nav-links-row" style={{ display:'flex', alignItems:'center', gap:32 }}>
          {['#features','#how-it-works','#testimonials'].map((h,i)=>(<a key={i} href={h} className="nav-link">{['Features','How It Works','Testimonials'][i]}</a>))}
          <a href="#" className="nav-link">Pricing</a>
        </div>
        <div className="nav-links-row" style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={goLogin}     className="btn-ghost"><LogIn size={14}/> Log In</button>
          <button onClick={goDashboard} className="btn-primary" style={{ padding:'8px 20px', fontSize:'0.85rem' }}><LayoutDashboard size={14}/> Dashboard</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f1729 0%,#111827 40%,#0d1f35 100%)', display:'flex', alignItems:'stretch', paddingTop:64, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(rgba(255,255,255,0.042) 1px,transparent 1px)', backgroundSize:'36px 36px' }}/>
        <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(34,197,94,0.08) 0%,transparent 70%)', top:'10%', left:'-8%', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(56,189,248,0.07) 0%,transparent 70%)', bottom:'5%', right:'5%', pointerEvents:'none' }}/>

        <div className="hero-two-col" style={{ display:'flex', alignItems:'center', width:'100%', maxWidth:1240, margin:'0 auto', padding:'0 48px', gap:0 }}>
          <div style={{ flex:'0 0 52%', paddingRight:40, animation:'fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) both' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.28)', borderRadius:999, padding:'6px 16px', marginBottom:28 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulseRing 2s ease-in-out infinite' }}/>
              <span style={{ fontSize:'0.75rem', fontWeight:600, color:'#4ade80', letterSpacing:'0.08em', textTransform:'uppercase' }}>AI-Powered Education Platform</span>
            </div>
            <h1 style={{ fontFamily:"'Sora',sans-serif", fontSize:'clamp(2.4rem,4.5vw,3.6rem)', fontWeight:800, lineHeight:1.12, letterSpacing:'-0.03em', color:'#fff', marginBottom:22 }}>
              Better Attendance<br/>For <span style={{ color:'#22c55e' }}>Educators</span>
            </h1>
            <p style={{ fontSize:'1.05rem', color:'rgba(255,255,255,0.58)', lineHeight:1.75, maxWidth:460, marginBottom:38, fontWeight:400 }}>
              Streamline your attendance taking process and save valuable teaching time with our intelligent tracking system.
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:48 }}>
              <button onClick={goDashboard} className="btn-primary">Get Started <ArrowRight size={16}/></button>
              <button onClick={goLogin}     className="btn-outline"><LogIn size={15}/> Sign In</button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
              {[{n:'500+',l:'Schools'},{n:'2M+',l:'Students'},{n:'98%',l:'Accuracy'}].map((s)=>(
                <div key={s.l} style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:"'Sora',sans-serif", fontSize:'1.4rem', fontWeight:800, color:'#fff' }}>{s.n}</div>
                  <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.45)', fontWeight:500, marginTop:2 }}>{s.l}</div>
                </div>
              ))}
              <div style={{ width:1, height:36, background:'rgba(255,255,255,0.1)' }}/>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Globe size={13} color="rgba(255,255,255,0.4)"/>
                <span style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.45)', fontWeight:500 }}>Trusted by educators worldwide</span>
              </div>
            </div>
          </div>

          <div className="hero-right" style={{ flex:1, position:'relative', minHeight:520, animation:'fadeIn 1.1s 0.25s both' }}>
            <HeroThree/>
            {[
              { style:{ top:'12%', left:'5%' }, delay:'0s',   color:'#4ade80', bg:'rgba(34,197,94,0.2)',  border:'rgba(34,197,94,0.3)',  Icon:CheckCircle2, sub:'Today',     val:'96% Present' },
              { style:{ top:'18%', right:'4%'},  delay:'.6s',  color:'#7dd3fc', bg:'rgba(56,189,248,0.2)', border:'rgba(56,189,248,0.3)', Icon:Bell,         sub:'Alert sent', val:'2 absences'  },
              { style:{ bottom:'22%', left:'8%'},delay:'1.1s', color:'#fbbf24', bg:'rgba(251,191,36,0.2)', border:'rgba(251,191,36,0.3)', Icon:TrendingUp,   sub:'This week',  val:'↑ 3% better' },
              { style:{ bottom:'28%',right:'6%'},delay:'1.8s', color:'#c4b5fd', bg:'rgba(167,139,250,0.2)',border:'rgba(167,139,250,0.3)',Icon:BrainCircuit, sub:'AI Insight', val:'Risk: 1 student'},
            ].map((chip,i)=>(
              <div key={i} className="hero-chip" style={{ ...chip.style, animation:`floatY ${3.8+i*.3}s ease-in-out infinite ${chip.delay}` }}>
                <div style={{ width:30, height:30, borderRadius:9, background:chip.bg, border:`1px solid ${chip.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <chip.Icon size={15} color={chip.color}/>
                </div>
                <div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:500 }}>{chip.sub}</div>
                  <div style={{ fontSize:13, fontWeight:700 }}>{chip.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:4, animation:'floatY 2.5s ease-in-out infinite' }}>
          <div style={{ width:1, height:32, background:'linear-gradient(to bottom,rgba(34,197,94,0.5),transparent)' }}/>
          <ChevronDown size={14} color="rgba(255,255,255,0.25)"/>
        </div>
      </section>

      {/* STATS */}
      <div style={{ background:'rgba(255,255,255,0.03)', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'36px 48px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          {STATS.map((s,i)=>(
            <div key={i} className="stat-badge scroll-reveal" style={{ transitionDelay:`${i*0.07}s` }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <s.Icon size={17} color="#4ade80"/>
                </div>
              </div>
              <div style={{ fontFamily:"'Sora',sans-serif", fontSize:'2rem', fontWeight:800, color:'#22c55e', lineHeight:1 }}>{s.num}</div>
              <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.45)', marginTop:6, fontWeight:500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" style={{ padding:'96px 48px', maxWidth:1240, margin:'0 auto' }}>
        <div className="scroll-reveal" style={{ textAlign:'center', marginBottom:60 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.22)', borderRadius:999, padding:'5px 16px', fontSize:'0.72rem', fontWeight:700, color:'#4ade80', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>
            <Zap size={11} color="#4ade80"/> Core Capabilities
          </div>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em', lineHeight:1.2, marginBottom:16 }}>
            Everything your school needs.<br/><span style={{ color:'#22c55e' }}>Nothing you don't.</span>
          </h2>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'1rem', maxWidth:500, margin:'0 auto', lineHeight:1.75 }}>Purpose-built for modern educational institutions that demand precision, speed, and insight.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20 }}>
          {FEATURES.map((f,i)=>(
            <div key={i} className={`feat-card scroll-reveal d${(i%6)+1}`}>
              <div style={{ width:50, height:50, borderRadius:14, background:f.bg, border:`1px solid ${f.color}30`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
                <f.Icon size={22} color={f.color} strokeWidth={1.8}/>
              </div>
              <div style={{ width:32, height:3, borderRadius:999, background:f.color, marginBottom:14, opacity:0.8 }}/>
              <h3 style={{ fontFamily:"'Sora',sans-serif", fontSize:'1.05rem', fontWeight:700, color:'#fff', marginBottom:10 }}>{f.title}</h3>
              <p style={{ fontSize:'0.875rem', color:'rgba(255,255,255,0.5)', lineHeight:1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ background:'rgba(255,255,255,0.025)', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'96px 48px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div className="scroll-reveal" style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.22)', borderRadius:999, padding:'5px 16px', fontSize:'0.72rem', fontWeight:700, color:'#7dd3fc', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>
              <ClipboardCheck size={11} color="#7dd3fc"/> How It Works
            </div>
            <h2 style={{ fontFamily:"'Sora',sans-serif", fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em' }}>
              Up and running in <span style={{ color:'#38bdf8' }}>minutes</span>
            </h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:32 }}>
            {STEPS.map((s,i)=>(
              <div key={i} className={`step-card scroll-reveal d${i+1}`}>
                <div style={{ fontFamily:"'Sora',sans-serif", fontSize:'3.5rem', fontWeight:800, color:'rgba(255,255,255,0.05)', position:'absolute', top:20, right:24, lineHeight:1, userSelect:'none' }}>{s.step}</div>
                <div style={{ width:52, height:52, borderRadius:16, background:`${s.color}18`, border:`1.5px solid ${s.color}40`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
                  <s.Icon size={24} color={s.color} strokeWidth={1.8}/>
                </div>
                <h3 style={{ fontFamily:"'Sora',sans-serif", fontSize:'1.1rem', fontWeight:700, color:'#fff', marginBottom:10 }}>{s.title}</h3>
                <p style={{ fontSize:'0.875rem', color:'rgba(255,255,255,0.5)', lineHeight:1.7 }}>{s.desc}</p>
                <div style={{ marginTop:20, width:36, height:3, borderRadius:999, background:s.color, opacity:0.7 }}/>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" style={{ padding:'96px 48px' }}>
        <div style={{ maxWidth:800, margin:'0 auto', textAlign:'center' }}>
          <div className="scroll-reveal" style={{ marginBottom:52 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.22)', borderRadius:999, padding:'5px 16px', fontSize:'0.72rem', fontWeight:700, color:'#c4b5fd', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>
              <Star size={11} color="#c4b5fd" fill="#c4b5fd"/> Testimonials
            </div>
            <h2 style={{ fontFamily:"'Sora',sans-serif", fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em' }}>
              What educators <span style={{ color:'#a78bfa' }}>are saying</span>
            </h2>
          </div>
          <div className="testi-card scroll-reveal">
            <div style={{ display:'flex', justifyContent:'center', marginBottom:18 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Quote size={18} color="#4ade80"/>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:4, marginBottom:20 }}>
              {Array.from({ length: TESTIMONIALS[activeTesti].stars }).map((_,i)=><Star key={i} size={14} color="#fbbf24" fill="#fbbf24"/>)}
            </div>
            <p style={{ fontSize:'1.08rem', color:'rgba(255,255,255,0.82)', lineHeight:1.78, fontStyle:'italic', marginBottom:28 }}>{TESTIMONIALS[activeTesti].quote}</p>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg,#22c55e,#16a34a)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'1.1rem', flexShrink:0 }}>{TESTIMONIALS[activeTesti].avatar}</div>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontWeight:700, fontSize:'0.95rem', color:'#fff' }}>{TESTIMONIALS[activeTesti].name}</div>
                <div style={{ fontSize:'0.8rem', color:'#22c55e', marginTop:2 }}>{TESTIMONIALS[activeTesti].role}</div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:28 }}>
            {TESTIMONIALS.map((_,i)=><button key={i} onClick={()=>setActiveTesti(i)} style={{ width:i===activeTesti?26:8, height:8, borderRadius:999, background:i===activeTesti?'#22c55e':'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', padding:0, transition:'all 0.25s' }}/>)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:'80px 48px', background:'linear-gradient(135deg,rgba(34,197,94,0.07) 0%,rgba(56,189,248,0.06) 100%)', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="scroll-reveal" style={{ maxWidth:640, margin:'0 auto', textAlign:'center' }}>
          <div style={{ display:'flex', justifyContent:'center', gap:12, marginBottom:28 }}>
            {([{Icon:School,color:'#22c55e',bg:'rgba(34,197,94,0.12)'},{Icon:BrainCircuit,color:'#38bdf8',bg:'rgba(56,189,248,0.12)'},{Icon:ShieldAlert,color:'#fbbf24',bg:'rgba(251,191,36,0.12)'}] as {Icon:LucideIcon;color:string;bg:string}[]).map(({Icon,color,bg},i)=>(
              <div key={i} style={{ width:44, height:44, borderRadius:12, background:bg, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon size={20} color={color} strokeWidth={1.8}/></div>
            ))}
          </div>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontSize:'clamp(1.7rem,3vw,2.4rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em', marginBottom:16 }}>Ready to transform your school?</h2>
          <p style={{ fontSize:'1rem', color:'rgba(255,255,255,0.5)', lineHeight:1.75, marginBottom:36 }}>Join hundreds of schools already saving time and improving outcomes with Attendance AI.</p>
          <div style={{ display:'flex', justifyContent:'center', gap:14, flexWrap:'wrap' }}>
            <button onClick={goDashboard} className="btn-primary">Launch Dashboard <ArrowRight size={16}/></button>
            <button onClick={goLogin}     className="btn-outline"><LogIn size={15}/> Sign In</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'#0b1120', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'56px 48px 32px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', gap:36, marginBottom:40 }}>
            <div style={{ maxWidth:260 }}>
              <Logo size={44} withText />
              <p style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.35)', lineHeight:1.7, marginTop:14 }}>AI-powered attendance management for modern schools.</p>
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                {([Mail,Globe,Lock] as LucideIcon[]).map((Icon,i)=>(
                  <div key={i} style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <Icon size={14} color="rgba(255,255,255,0.45)"/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'12px 48px' }}>
              {[{label:'Features',href:'#features'},{label:'How It Works',href:'#how-it-works'},{label:'Testimonials',href:'#testimonials'},{label:'Dashboard',href:'/dashboard'},{label:'Sign In',href:'/login'},{label:'Privacy',href:'#'}].map((l)=>(
                <a key={l.label} href={l.href} className="footer-link">{l.label}</a>
              ))}
            </div>
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:22, display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.22)' }}>© {new Date().getFullYear()} Attendance AI. All rights reserved.</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Zap size={12} color="rgba(34,197,94,0.6)"/>
              <span style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.22)' }}>Powered by AI · Built for Educators</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}