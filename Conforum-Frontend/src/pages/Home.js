import React, { useEffect, useState, useRef } from "react";
import Layout from "../components/Layout";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/Auth";

const slides = [
  "https://images.unsplash.com/photo-1558008258-3256797b43f3?w=1600&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=1600&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1600&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1600&auto=format&fit=crop&q=85",
];

const DYNAMIC_WORDS = ["Conferences", "Research", "Collaboration", "Innovation", "Academia"];

const DotField = () => {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const dots = useRef([]);
  const raf = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H;
    const SP = 34;
    const build = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      dots.current = [];
      for (let r = 0; r * SP <= H + SP; r++)
        for (let c = 0; c * SP <= W + SP; c++)
          dots.current.push({ x: c * SP, y: r * SP, ox: c * SP, oy: r * SP, vx: 0, vy: 0 });
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const { x: mx, y: my } = mouse.current;
      const R = 105;
      dots.current.forEach((d) => {
        const dx = mx - d.ox, dy = my - d.oy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = Math.max(0, 1 - dist / R);
        const tx = d.ox - (dx / dist) * force * 20, ty = d.oy - (dy / dist) * force * 20;
        d.vx += (tx - d.x) * 0.13; d.vy += (ty - d.y) * 0.13;
        d.vx *= 0.68; d.vy *= 0.68; d.x += d.vx; d.y += d.vy;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1.4 + force * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(75,112,122,${0.06 + force * 0.2})`;
        ctx.fill();
      });
      raf.current = requestAnimationFrame(draw);
    };
    const onMove = (e) => { const r = canvas.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
    window.addEventListener("resize", build);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    build(); draw();
    return () => {
      window.removeEventListener("resize", build);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf.current);
    };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "all", zIndex: 0 }} />;
};

const NetworkBg = () => {
  const canvasRef = useRef(null);
  const raf = useRef(null);
  const nodes = useRef([]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H;
    const build = () => {
      W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight;
      const n = Math.floor((W * H) / 12000);
      nodes.current = Array.from({ length: Math.max(n, 20) }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28,
        r: 1.4 + Math.random() * 1.8,
        pulse: Math.random() * Math.PI * 2, ps: .007 + Math.random() * .012,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      nodes.current.forEach(n => {
        n.pulse += n.ps; n.vx *= .995; n.vy *= .995; n.x += n.vx; n.y += n.vy;
        if (n.x < 0) { n.x = 0; n.vx *= -1; } if (n.x > W) { n.x = W; n.vx *= -1; }
        if (n.y < 0) { n.y = 0; n.vy *= -1; } if (n.y > H) { n.y = H; n.vy *= -1; }
      });
      for (let i = 0; i < nodes.current.length; i++) {
        for (let j = i + 1; j < nodes.current.length; j++) {
          const a = nodes.current[i], b = nodes.current[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 140) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(168,196,184,${(1 - d / 140) * .18})`;
            ctx.lineWidth = .8; ctx.stroke();
          }
        }
      }
      nodes.current.forEach(n => {
        const p = .5 + Math.sin(n.pulse) * .5;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + p * .6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168,196,184,${.12 + p * .1})`; ctx.fill();
      });
      raf.current = requestAnimationFrame(draw);
    };
    window.addEventListener("resize", build); build(); draw();
    return () => { window.removeEventListener("resize", build); cancelAnimationFrame(raf.current); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }} />;
};

const PaleNetBg = () => {
  const canvasRef = useRef(null);
  const raf = useRef(null);
  const nodes = useRef([]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H;
    const build = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      const n = Math.floor((W * H) / 11000);
      nodes.current = Array.from({ length: Math.max(n, 22) }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.32, vy: (Math.random() - 0.5) * 0.32,
        r: 1.3 + Math.random() * 1.6,
        pulse: Math.random() * Math.PI * 2,
        ps: 0.008 + Math.random() * 0.014,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      nodes.current.forEach(n => {
        n.pulse += n.ps;
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0) { n.x = 0; n.vx *= -1; } if (n.x > W) { n.x = W; n.vx *= -1; }
        if (n.y < 0) { n.y = 0; n.vy *= -1; } if (n.y > H) { n.y = H; n.vy *= -1; }
      });
      for (let i = 0; i < nodes.current.length; i++) {
        for (let j = i + 1; j < nodes.current.length; j++) {
          const a = nodes.current[i], b = nodes.current[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 135) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(75,112,122,${(1 - d / 135) * 0.13})`;
            ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
      }
      nodes.current.forEach(n => {
        const p = 0.5 + Math.sin(n.pulse) * 0.5;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + p * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(75,112,122,${0.1 + p * 0.12})`; ctx.fill();
      });
      raf.current = requestAnimationFrame(draw);
    };
    window.addEventListener("resize", build); build(); draw();
    return () => { window.removeEventListener("resize", build); cancelAnimationFrame(raf.current); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
};

const TypewriterWord = () => {
  const [wi, setWi] = useState(0); const [text, setText] = useState(""); const [phase, setPhase] = useState("typing");
  useEffect(() => {
    const word = DYNAMIC_WORDS[wi]; let t;
    if (phase === "typing") {
      if (text.length < word.length) t = setTimeout(() => setText(word.slice(0, text.length + 1)), 80);
      else t = setTimeout(() => setPhase("pause"), 1400);
    } else if (phase === "pause") {
      t = setTimeout(() => setPhase("erasing"), 200);
    } else {
      if (text.length > 0) t = setTimeout(() => setText(text.slice(0, -1)), 45);
      else { setWi(i => (i + 1) % DYNAMIC_WORDS.length); setPhase("typing"); }
    }
    return () => clearTimeout(t);
  }, [text, phase, wi]);
  return <span>{text}<span className="cf-cur">|</span></span>;
};

const Ico = ({ d, vb = "0 0 38 38", extra = {} }) => (
  <svg width="26" height="26" viewBox={vb} fill="none" stroke="#4B707A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...extra}>
    {d}
  </svg>
);
const IconAuthor = () => <Ico d={<><rect x="8" y="4" width="19" height="26" rx="3" /><path d="M22 4v4.5A1.5 1.5 0 0023.5 10H27" /><line x1="12" y1="16" x2="23" y2="16" /><line x1="12" y1="21" x2="20" y2="21" /><path d="M23 27l2 2 4-4" strokeWidth="2" /></>} />;
const IconReviewer = () => <Ico d={<><circle cx="17" cy="17" r="9" /><line x1="23.5" y1="23.5" x2="33" y2="33" strokeWidth="2.4" /><line x1="13" y1="17" x2="21" y2="17" /><line x1="17" y1="13" x2="17" y2="21" /></>} />;
const IconAdmin = () => <Ico d={<><circle cx="19" cy="13" r="5.5" /><path d="M8 36c0-6.627 5.373-12 12-12s12 5.373 12 12" /><rect x="27" y="26" width="8" height="8" rx="2" /><line x1="31" y1="28" x2="31" y2="32" /><line x1="29" y1="30" x2="33" y2="30" /></>} />;
const IconOrganizer = () => <Ico d={<><rect x="5" y="8" width="28" height="24" rx="3" /><line x1="5" y1="16" x2="33" y2="16" /><line x1="13" y1="5" x2="13" y2="11" /><line x1="25" y1="5" x2="25" y2="11" /><line x1="11" y1="23" x2="17" y2="23" /><line x1="11" y1="28" x2="15" y2="28" /><line x1="22" y1="23" x2="28" y2="23" /><line x1="22" y1="28" x2="28" y2="28" /></>} />;
const IconGlobe = () => <Ico d={<><circle cx="19" cy="19" r="14" /><ellipse cx="19" cy="19" rx="6" ry="14" /><line x1="5" y1="19" x2="33" y2="19" /><line x1="7" y1="12" x2="31" y2="12" /><line x1="7" y1="26" x2="31" y2="26" /></>} extra={{ width: 30, height: 30 }} />;
const IconShield = () => <Ico d={<><path d="M19 4l13 5v9c0 7-5.5 12.5-13 15C11.5 30.5 6 25 6 18V9z" /><polyline points="13 19 17 23 25 15" /></>} extra={{ width: 30, height: 30 }} />;
const IconLightning = () => <Ico d={<><polygon points="21,3 7,21 18,21 17,35 31,17 20,17" /></>} extra={{ width: 30, height: 30 }} />;

const services = [
  { title: "Author", desc: "Submit papers, track revisions, and follow your manuscript through every stage of the review process.", Icon: IconAuthor, num: "01" },
  { title: "Reviewer", desc: "Access structured evaluation tools, manage assignments, and provide consistent, high-quality feedback.", Icon: IconReviewer, num: "02" },
  { title: "Administrator", desc: "Oversee all users, conferences, and submissions from a single unified control panel.", Icon: IconAdmin, num: "03" },
  { title: "Organizer", desc: "Design your programme, set deadlines, manage tracks, and communicate with all participants.", Icon: IconOrganizer, num: "04" },
];

const howItWorks = [
  { step: "01", title: "Create or Join a Conference", body: "Organizers set up a conference in minutes. Researchers find and register for events relevant to their field." },
  { step: "02", title: "Submit Your Research", body: "Authors upload papers through a guided, structured submission flow with real-time deadline tracking." },
  { step: "03", title: "Peer Review Process", body: "Reviewers are matched to submissions. Feedback is collected, scored, and surfaced to authors transparently." },
  { step: "04", title: "Decision & Publication", body: "Organizers issue decisions. Accepted papers are archived and made discoverable on the platform." },
];

const whyUs = [
  { Icon: IconGlobe, title: "Global Reach", body: "Conferences from 48+ countries. Researchers connect across borders without barriers." },
  { Icon: IconShield, title: "Blind Review System", body: "Double-blind peer review with identity protection built into every submission." },
  { Icon: IconLightning, title: "Real-time Updates", body: "Instant notifications at every stage — submission, review, decision, and publication." },
];

const missionPills = ["Open Science", "Global Collaboration", "Fair Review", "Data Privacy", "Accessibility"];

const whySlides = [
  {
    title: "Global Reach",
    body: "Conferences from 48+ countries. Researchers connect across borders, share discoveries, and build international collaborations without barriers.",
    tag: "01 / Community",
    img: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&auto=format&fit=crop&q=80",
    accent: "#C5D9A4",
  },
  {
    title: "Blind Review System",
    body: "Double-blind peer review with identity protection built into every submission. Quality is the only metric that matters — nothing else.",
    tag: "02 / Integrity",
    img: "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=900&auto=format&fit=crop&q=80",
    accent: "#A8C4B8",
  },
  {
    title: "Real-time Updates",
    body: "Instant notifications at every stage — submission, review, decision, and publication. Stay in sync with your conference at all times.",
    tag: "03 / Speed",
    img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80",
    accent: "#6B9AA8",
  },
  {
    title: "Seamless Workflow",
    body: "From paper creation to final proceedings, every step is guided and automated. Spend less time on admin and more time on your research.",
    tag: "04 / Efficiency",
    img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=900&auto=format&fit=crop&q=80",
    accent: "#7F9C8E",
  },
];

const WhySlider = () => {
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState(null);
  const [dir, setDir] = useState(1);
  const timerRef = useRef(null);

  const go = (idx, direction) => {
    if (idx === active) return;
    setPrev(active);
    setDir(direction);
    setActive(idx);
  };

  const next = () => go((active + 1) % whySlides.length, 1);
  const back = () => go((active - 1 + whySlides.length) % whySlides.length, -1);

  useEffect(() => {
    timerRef.current = setInterval(() => next(), 4800);
    return () => clearInterval(timerRef.current);
  }, [active]);

  const s = whySlides[active];

  return (
    <>
      <style>{`
        .ws-wrap { display:grid; grid-template-columns:1fr 1fr; min-height:480px; max-width:1100px; margin:0 auto; overflow:hidden; border-radius:24px; box-shadow:0 20px 60px rgba(28,43,46,.12); }
        @media(max-width:760px){ .ws-wrap{grid-template-columns:1fr; min-height:auto;} }
        .ws-img-col { position:relative; overflow:hidden; min-height:340px; }
        .ws-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:opacity .7s ease,transform .7s ease; }
        .ws-img.on { opacity:1; transform:scale(1); }
        .ws-img.off { opacity:0; transform:scale(1.04); }
        .ws-img-ov { position:absolute; inset:0; background:linear-gradient(135deg,rgba(28,43,46,.55) 0%,rgba(75,112,122,.25) 100%); z-index:1; }
        .ws-img-tag { position:absolute; bottom:24px; left:24px; z-index:2; font-family:'Space Mono',monospace; font-size:.6rem; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,.75); background:rgba(28,43,46,.45); backdrop-filter:blur(10px); padding:6px 14px; border-radius:99px; border:1px solid rgba(255,255,255,.15); }
        .ws-content-col { background:#fff; display:flex; flex-direction:column; justify-content:space-between; padding:52px 48px; }
        @media(max-width:760px){ .ws-content-col{padding:32px 28px;} }
        .ws-slides-track { flex:1; display:flex; flex-direction:column; justify-content:center; }
        .ws-title { font-family:'DM Serif Display',serif; font-weight:400; font-size:clamp(1.8rem,3vw,2.6rem); color:#1C2B2E; line-height:1.15; margin-bottom:18px; letter-spacing:-.01em; }
        .ws-body { font-family:'Outfit',sans-serif; font-size:.95rem; color:#5E787C; line-height:1.82; margin-bottom:32px; }
        .ws-accent-bar { width:36px; height:3px; border-radius:99px; margin-bottom:32px; transition:background .5s ease; }
        .ws-dots { display:flex; gap:8px; align-items:center; margin-bottom:28px; }
        .ws-dot { width:8px; height:8px; border-radius:99px; border:none; cursor:pointer; padding:0; background:rgba(75,112,122,.18); transition:all .35s ease; }
        .ws-dot.on { width:28px; background:#4B707A; }
        .ws-arrows { display:flex; gap:10px; }
        .ws-arrow { width:42px; height:42px; border-radius:50%; border:1.5px solid #DDE9E6; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#4B707A; transition:background .2s,border-color .2s,transform .2s; }
        .ws-arrow:hover { background:#EEF5F4; border-color:#4B707A; transform:scale(1.08); }
        .ws-bottom { display:flex; align-items:center; justify-content:space-between; }
        .ws-counter { font-family:'Space Mono',monospace; font-size:.62rem; font-weight:700; letter-spacing:.14em; color:rgba(75,112,122,.4); }
      `}</style>
      <div className="ws-wrap">
        {/* Image side */}
        <div className="ws-img-col">
          {whySlides.map((sl, i) => (
            <img key={i} src={sl.img} alt={sl.title} className={`ws-img${i === active ? " on" : " off"}`} />
          ))}
          <div className="ws-img-ov" />
          <span className="ws-img-tag">{s.tag}</span>
        </div>

        {/* Content side */}
        <div className="ws-content-col">
          <div className="ws-slides-track">
            <div className="ws-accent-bar" style={{ background: s.accent }} />
            <h3 className="ws-title">{s.title}</h3>
            <p className="ws-body">{s.body}</p>
          </div>
          <div>
            <div className="ws-dots">
              {whySlides.map((_, i) => (
                <button key={i} className={`ws-dot${i === active ? " on" : ""}`} onClick={() => { clearInterval(timerRef.current); go(i, i > active ? 1 : -1); }} />
              ))}
            </div>
            <div className="ws-bottom">
              <span className="ws-counter">0{active + 1} / 0{whySlides.length}</span>
              <div className="ws-arrows">
                <button className="ws-arrow" onClick={() => { clearInterval(timerRef.current); back(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button className="ws-arrow" onClick={() => { clearInterval(timerRef.current); next(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const Home = () => {
  const [current, setCurrent] = useState(0);
  const [vis, setVis] = useState({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dashboardPath, setDashboardPath] = useState("/userdashboard/user-dashboard");
  const [auth, setAuth] = useState(null);
  const obsRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const roleRoutes = {
    user: "/userdashboard/user-dashboard",
    admin: "/admindashboard/admin-dashboard",
    reviewer: "/userdashboard/reviewer-dashboard",
    author: "/userdashboard/author-dashboard",
    organizer: "/userdashboard/organizer-dashboard",
  };
  useEffect(() => {
    const storedAuth = JSON.parse(localStorage.getItem("auth"));
    if (storedAuth && storedAuth.token) {
      setAuth(storedAuth);
      setIsLoggedIn(true);
      setDashboardPath(roleRoutes[storedAuth.user.role] || "/userdashboard/user-dashboard");
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  const goToDashboard = () => {
    navigate(dashboardPath);
  };

  useEffect(() => { if (location.pathname === "/" || location.pathname === "/home") window.scrollTo({ top: 0, behavior: "smooth" }); }, [location]);
  useEffect(() => { const t = setInterval(() => setCurrent(p => (p + 1) % slides.length), 4500); return () => clearInterval(t); }, []);
  useEffect(() => {
    obsRef.current = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) setVis(p => ({ ...p, [e.target.dataset.vid]: true })); }),
      { threshold: 0.08 }
    );
    const t = setTimeout(() => { document.querySelectorAll("[data-vid]").forEach(el => obsRef.current?.observe(el)); }, 200);
    return () => { clearTimeout(t); obsRef.current?.disconnect(); };
  }, []);

  const anim = (id, delay = 0) => ({ "data-vid": id, className: `va${vis[id] ? " vi" : ""}`, style: delay ? { transitionDelay: `${delay}s` } : {} });

  return (
    <Layout title="ConForum — Global Conference Management">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
        :root {
          --teal:#4B707A; --teal-d:#2D5561; --teal-m:#5E8A95; --teal-l:#6B9AA8;
          --sage:#7F9C8E; --sage-l:#A8C4B8; --lime:#C5D9A4;
          --pale:#EEF5F4; --pw:#F8FAF9; --white:#ffffff;
          --dark:#1C2B2E; --txt:#2A3E42; --soft:#5E787C; --bdr:#DDE9E6;
        }
        .va { opacity:0; transform:translateY(24px); transition:opacity .62s ease,transform .62s ease; }
        .va.vi { opacity:1; transform:translateY(0); }
        body { background: #1C2B2E !important; }
        .hero { position:relative; height:100vh; min-height:600px; display:flex; align-items:center; justify-content:center; text-align:center; overflow:hidden; margin-top:-66px; }
        .hero-slide { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity 1.4s ease; z-index:1; }
        .hero-slide.on { opacity:1; }
        .hero-ov { position:absolute; inset:0; z-index:2; background:linear-gradient(160deg, rgba(18,42,46,.52) 0%, rgba(28,56,62,.35) 55%, rgba(20,46,52,.62) 100%); }
        .hero-content { position:relative; z-index:10; max-width:880px; padding:0 32px; }
        .hero-badge { display:inline-flex; align-items:center; gap:7px; background:rgba(255,255,255,.13); border:1px solid rgba(168,196,184,.35); backdrop-filter:blur(12px); border-radius:99px; padding:7px 18px; font-family:'Outfit',sans-serif; font-size:.72rem; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:rgba(255,255,255,.92); margin-bottom:30px; opacity:0; animation:fup .6s ease .3s forwards; }
        .hero-badge-dot { width:6px; height:6px; border-radius:50%; background:#C5D9A4; }
        .h1a { display:block; font-family:'DM Serif Display',serif; font-weight:400; font-style:italic; font-size:clamp(1.6rem,3.6vw,3.1rem); color:rgba(255,255,255,.88); line-height:1.2; opacity:0; animation:fup .8s ease .5s forwards; margin-bottom:6px; }
        .h1b { display:block; font-family:'Outfit',sans-serif; font-weight:900; font-size:clamp(2.4rem,5.8vw,5.4rem); letter-spacing:-.04em; color:#fff; line-height:1; min-height:1.15em; opacity:0; animation:fup .8s ease .7s forwards; }
        .hero-sub { font-family:'Outfit',sans-serif; font-size:clamp(1rem,1.8vw,1.18rem); color:rgba(210,235,230,.78); font-weight:400; line-height:1.74; max-width:560px; margin:24px auto 34px; opacity:0; animation:fup .7s ease .95s forwards; }
        .hero-btns { display:flex; justify-content:center; gap:11px; flex-wrap:wrap; opacity:0; animation:fup .7s ease 1.1s forwards; }
        .btn-solid { padding:13px 30px; border-radius:8px; font-family:'Outfit',sans-serif; font-weight:700; font-size:.85rem; letter-spacing:.03em; color:#fff; background:var(--teal); border:none; cursor:pointer; text-decoration:none; box-shadow:0 4px 20px rgba(75,112,122,.45); transition:background .2s,box-shadow .2s; }
        .btn-solid:hover { background:var(--teal-m); box-shadow:0 6px 26px rgba(75,112,122,.55); }
        .btn-ghost-w { padding:13px 30px; border-radius:8px; font-family:'Outfit',sans-serif; font-weight:600; font-size:.85rem; letter-spacing:.03em; color:rgba(255,255,255,.9); background:rgba(255,255,255,.1); border:1.5px solid rgba(255,255,255,.24); backdrop-filter:blur(8px); cursor:pointer; text-decoration:none; transition:background .2s,border-color .2s; }
        .btn-ghost-w:hover { background:rgba(255,255,255,.17); border-color:rgba(255,255,255,.42); }
        .hero-ndots { position:absolute; bottom:26px; left:0; right:0; display:flex; justify-content:center; gap:7px; z-index:10; opacity:0; animation:fup .6s ease 1.5s forwards; }
        .hero-ndot { width:7px; height:7px; border-radius:99px; border:none; padding:0; background:rgba(255,255,255,.28); cursor:pointer; transition:all .3s; }
        .hero-ndot.on { width:22px; background:rgba(197,217,164,.85); }
        .cf-cur { color:rgba(197,217,164,.85); animation:blink .75s step-end infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fup { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .sec { padding:96px 24px; position:relative; overflow:hidden; }
        .sec-in { max-width:1060px; margin:0 auto; position:relative; z-index:1; }
        .eyebrow { font-family:'Space Mono',monospace; font-size:.61rem; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--teal); display:block; margin-bottom:12px; }
        .sec-title { font-family:'DM Serif Display',serif; font-weight:400; font-size:clamp(1.75rem,3.8vw,2.8rem); color:var(--dark); line-height:1.12; letter-spacing:-.01em; }
        .sec-title em { font-style:italic; color:var(--teal); }
        .sec-rule { width:38px; height:2px; border-radius:99px; background:linear-gradient(90deg,var(--teal),var(--sage)); margin:13px auto 0; }
        .sec-sub { font-family:'Outfit',sans-serif; font-size:.95rem; color:var(--soft); line-height:1.72; max-width:540px; margin:14px auto 0; }
        .bg-white { background:var(--white); }
        .bg-pale { background:var(--pale); }
        .svc-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; align-items:stretch; }
        @media(max-width:860px){ .svc-grid{grid-template-columns:repeat(2,1fr);} }
        @media(max-width:480px){ .svc-grid{grid-template-columns:1fr;} }
        .svc-card { background:var(--white); border:1.5px solid var(--bdr); border-radius:14px; padding:28px 24px 26px; display:flex; flex-direction:column; transition:border-color .22s,box-shadow .22s,transform .22s; height:100%; box-sizing:border-box; }
        .svc-card:hover { border-color:rgba(75,112,122,.3); box-shadow:0 8px 32px rgba(75,112,122,.12); transform:translateY(-4px); }
        .svc-card:hover .svc-icon { background:rgba(75,112,122,.12); border-color:rgba(75,112,122,.22); transform:scale(1.08); }
        .svc-icon { width:44px; height:44px; border-radius:11px; background:var(--pale); border:1px solid rgba(75,112,122,.13); display:flex; align-items:center; justify-content:center; margin-bottom:18px; transition:background .22s,border-color .22s,transform .22s; }
        .svc-num { font-family:'Space Mono',monospace; font-size:.55rem; font-weight:700; letter-spacing:.16em; color:rgba(75,112,122,.38); margin-bottom:12px; display:block; }
        .svc-ttl { font-family:'Outfit',sans-serif; font-weight:700; font-size:.98rem; color:var(--dark); margin-bottom:9px; }
        .svc-dsc { font-family:'Outfit',sans-serif; font-size:.865rem; color:var(--soft); line-height:1.72; flex:1; }
        .hiw-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:0; position:relative; }
        @media(max-width:780px){ .hiw-grid{grid-template-columns:repeat(2,1fr);} }
        @media(max-width:440px){ .hiw-grid{grid-template-columns:1fr;} }
        .hiw-grid::before { content:''; position:absolute; top:27px; left:calc(12.5% + 16px); right:calc(12.5% + 16px); height:1px; background:linear-gradient(90deg,var(--bdr),rgba(75,112,122,.3) 50%,var(--bdr)); z-index:0; }
        @media(max-width:780px){ .hiw-grid::before{display:none;} }
        .hiw-item { padding:0 20px; text-align:center; position:relative; z-index:1; }
        .hiw-circle { width:54px; height:54px; border-radius:50%; border:2px solid var(--bdr); background:var(--white); display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-family:'Space Mono',monospace; font-size:.7rem; font-weight:700; color:var(--teal); box-shadow:0 2px 14px rgba(75,112,122,.12); }
        .hiw-ttl { font-family:'Outfit',sans-serif; font-weight:700; font-size:.94rem; color:var(--dark); margin-bottom:10px; line-height:1.3; }
        .hiw-body { font-family:'Outfit',sans-serif; font-size:.845rem; color:var(--soft); line-height:1.72; }
        .mission-layout { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:start; }
        @media(max-width:780px){ .mission-layout{grid-template-columns:1fr; gap:36px;} }
        .miss-label { font-family:'Space Mono',monospace; font-size:.61rem; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--teal); display:block; margin-bottom:13px; }
        .miss-title { font-family:'DM Serif Display',serif; font-weight:400; font-size:clamp(1.65rem,3.4vw,2.5rem); color:var(--dark); line-height:1.15; margin-bottom:16px; }
        .miss-title em { font-style:italic; color:var(--teal); }
        .miss-body { font-family:'Outfit',sans-serif; font-size:.92rem; color:var(--soft); line-height:1.82; margin-bottom:26px; }
        .miss-pills { display:flex; flex-wrap:wrap; gap:7px; }
        .miss-pill { padding:5px 14px; border-radius:99px; background:rgba(75,112,122,.09); border:1px solid rgba(75,112,122,.18); font-family:'Space Mono',monospace; font-size:.57rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--teal); }
        .quote-card { background:var(--white); border:1.5px solid var(--bdr); border-radius:18px; padding:38px 36px; position:relative; }
        .quote-card::before { content:''; position:absolute; top:0; left:30px; right:30px; height:2px; background:linear-gradient(90deg,var(--teal),var(--sage)); border-radius:0 0 2px 2px; }
        .quote-mark { font-family:'DM Serif Display',serif; font-size:5rem; line-height:.75; color:rgba(75,112,122,.14); display:block; margin-bottom:10px; user-select:none; }
        .quote-text { font-family:'DM Serif Display',serif; font-style:italic; font-size:clamp(1.08rem,2vw,1.45rem); color:var(--dark); line-height:1.65; margin-bottom:22px; }
        .quote-author { font-family:'Space Mono',monospace; font-size:.56rem; letter-spacing:.16em; text-transform:uppercase; color:var(--soft); display:flex; align-items:center; gap:9px; }
        .quote-author::before { content:''; width:18px; height:1.5px; background:var(--teal); border-radius:99px; flex-shrink:0; }
        .why-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; align-items:stretch; }
        @media(max-width:720px){ .why-grid{grid-template-columns:1fr;} }
        .why-card { background:var(--white); border:1.5px solid var(--bdr); border-radius:14px; padding:32px 28px; display:flex; flex-direction:column; transition:border-color .22s,box-shadow .22s,transform .22s; height:100%; box-sizing:border-box; }
        .why-card:hover { border-color:rgba(75,112,122,.3); box-shadow:0 8px 32px rgba(75,112,122,.12); transform:translateY(-4px); }
        .why-card:hover .why-icon { background:rgba(75,112,122,.12); border-color:rgba(75,112,122,.22); transform:scale(1.08); }
        .why-icon { width:52px; height:52px; border-radius:13px; background:var(--pale); border:1px solid rgba(75,112,122,.13); display:flex; align-items:center; justify-content:center; margin-bottom:18px; flex-shrink:0; transition:background .22s,border-color .22s,transform .22s; }
        .why-ttl { font-family:'Outfit',sans-serif; font-weight:700; font-size:1.02rem; color:var(--dark); margin-bottom:10px; }
        .why-body { font-family:'Outfit',sans-serif; font-size:.875rem; color:var(--soft); line-height:1.74; flex:1; }
        .cta-sec { background:var(--teal); padding:100px 24px; position:relative; overflow:hidden; }
        .cta-sec::before { content:''; position:absolute; inset:0; background-image:radial-gradient(circle,rgba(255,255,255,.06) 1px,transparent 1px); background-size:26px 26px; pointer-events:none; }
        .cta-glow { position:absolute; width:500px; height:500px; border-radius:50%; background:radial-gradient(circle,rgba(168,196,184,.25) 0%,transparent 70%); pointer-events:none; transform:translate(-50%,-50%); transition:left .1s ease,top .1s ease; z-index:0; }
        .cta-in { position:relative; z-index:1; max-width:620px; margin:0 auto; text-align:center; }
        .cta-eyebrow { font-family:'Space Mono',monospace; font-size:.6rem; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:rgba(197,217,164,.75); display:block; margin-bottom:18px; }
        .cta-title { font-family:'DM Serif Display',serif; font-weight:400; font-style:italic; font-size:clamp(1.7rem,3.8vw,3rem); color:rgba(255,255,255,.92); line-height:1.2; margin-bottom:0; }
        .cta-title strong { display:block; font-style:normal; font-family:'Outfit',sans-serif; font-weight:800; font-size:clamp(1.8rem,4vw,3.2rem); letter-spacing:-.04em; color:#fff; margin-top:4px; }
        .cta-sub { font-family:'Outfit',sans-serif; font-size:.95rem; color:rgba(220,238,232,.68); line-height:1.74; margin:16px 0 36px; }
        .cta-btns { display:flex; gap:11px; justify-content:center; flex-wrap:wrap; }
        .btn-cta-w { padding:13px 32px; border-radius:8px; background:#fff; color:var(--teal-d); font-family:'Outfit',sans-serif; font-weight:800; font-size:.86rem; letter-spacing:.03em; text-decoration:none; box-shadow:0 4px 18px rgba(0,0,0,.14); transition:box-shadow .22s,transform .2s; display:inline-block; }
        .btn-cta-w:hover { box-shadow:0 8px 28px rgba(0,0,0,.2); transform:translateY(-2px); }
        .btn-cta-g { padding:13px 32px; border-radius:8px; background:rgba(255,255,255,.1); border:1.5px solid rgba(255,255,255,.26); color:rgba(255,255,255,.9); font-family:'Outfit',sans-serif; font-weight:600; font-size:.86rem; text-decoration:none; transition:background .22s,border-color .22s,transform .2s; display:inline-block; }
        .btn-cta-g:hover { background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.45); transform:translateY(-2px); }
        @media(max-width:600px){ .sec{padding:72px 18px;} }
      `}</style>

      {/* HERO */}
      <div className="hero">
        {slides.map((src, i) => (<img key={i} src={src} alt="" className={`hero-slide${i === current ? " on" : ""}`} />))}
        <div className="hero-ov" />
        <NetworkBg />
        <div className="hero-content">

          {/* FIX 1: replaced "redefining Excellence in" with professional academic text */}
          <span className="h1a">Advancing Research in</span>
          <span className="h1b"><TypewriterWord /></span>
          <p className="hero-sub">The all-in-one platform connecting researchers, reviewers, and organizers for world-class academic events.</p>
          <div className="hero-btns">
            {/* FIX 2: removed arrows from both buttons */}
            {isLoggedIn ? (
              <button onClick={goToDashboard} className="btn-solid">
                Go to Dashboard
              </button>
            ) : (
              <>
                <Link to="/register" className="btn-solid">
                  Get Started
                </Link>
                <Link to="/learn-more" className="btn-ghost-w">
                  Learn More
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="hero-ndots">
          {slides.map((_, i) => (<button key={i} className={`hero-ndot${i === current ? " on" : ""}`} onClick={() => setCurrent(i)} />))}
        </div>
      </div>

      {/* SERVICES */}
      <div className="sec bg-white">
        <DotField />
        <div className="sec-in">
          <div {...anim("svc-h")} style={{ ...anim("svc-h").style, textAlign: "center", marginBottom: "56px" }}>
            <span className="eyebrow">Platform Services</span>
            <h2 className="sec-title">Built for <em>every role</em></h2>
            <div className="sec-rule" />
            <p className="sec-sub">One platform, four distinct experiences — each tailored to how you interact with research.</p>
          </div>
          <div className="svc-grid">
            {services.map((s, i) => (
              <div key={s.title} {...anim(`svc-${i}`, i * .08)}>
                <div className="svc-card">
                  <span className="svc-num">{s.num}</span>
                  <div className="svc-icon"><s.Icon /></div>
                  <div className="svc-ttl">{s.title}</div>
                  <p className="svc-dsc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="sec bg-pale">
        <PaleNetBg />
        <div className="sec-in">
          <div {...anim("hiw-h")} style={{ ...anim("hiw-h").style, textAlign: "center", marginBottom: "60px" }}>
            <span className="eyebrow">The Process</span>
            <h2 className="sec-title">How <em>ConForum</em> works</h2>
            <div className="sec-rule" />
          </div>
          <div className="hiw-grid">
            {howItWorks.map((h, i) => (
              <div key={h.step} {...anim(`hiw-${i}`, i * .1)}>
                <div className="hiw-item">
                  <div className="hiw-circle">{h.step}</div>
                  <div className="hiw-ttl">{h.title}</div>
                  <p className="hiw-body">{h.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MISSION */}
      <div className="sec bg-white">
        <DotField />
        <div className="sec-in">
          <div className="mission-layout">
            <div {...anim("miss-l")}>
              <span className="miss-label">Our Mission</span>
              <h2 className="miss-title">We exist to <em>simplify</em><br />academic exchange</h2>
              <p className="miss-body">Conference management shouldn't require a PhD in logistics. We built ConForum to give organizers their time back and give researchers a frictionless path from idea to publication.</p>
              <div className="miss-pills">
                {missionPills.map(p => <span key={p} className="miss-pill">{p}</span>)}
              </div>
            </div>
            <div {...anim("miss-r", .15)}>
              <div className="quote-card">
                <span className="quote-mark">"</span>
                <p className="quote-text">The best research deserves the best platform. We built the infrastructure so ideas can travel freely.</p>
                <span className="quote-author">ConForum Founding Team</span>
              </div>
            </div>
          </div>
        </div>
      </div>


     

    </Layout>
  );
};

export default Home;