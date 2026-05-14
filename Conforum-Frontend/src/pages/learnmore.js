import React, { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import { Link } from "react-router-dom";

const useVisible = () => {
  const [visible, setVisible] = useState({});
  const refs = useRef({});
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) setVisible((p) => ({ ...p, [e.target.dataset.vid]: true }));
      }),
      { threshold: 0.1 }
    );
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);
  const ref = (id) => (el) => { refs.current[id] = el; };
  return { visible, ref };
};

const stats = [
  { value: "12K+", label: "Researchers" },
  { value: "340+", label: "Conferences" },
  { value: "98%",  label: "Satisfaction" },
  { value: "60+",  label: "Countries" },
];

const features = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="22" rx="2.5" />
        <path d="M18 3v4A1.5 1.5 0 0019.5 8.5H23" />
        <line x1="8" y1="13" x2="18" y2="13" /><line x1="8" y1="17" x2="15" y2="17" />
        <path d="M20 22l2 2 4-4" strokeWidth="1.8" />
      </svg>
    ),
    title: "Smart Submissions",
    desc: "Streamlined paper submission with automated formatting checks, plagiarism detection, and real-time status tracking from submission to decision.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="17" y1="17" x2="26" y2="26" strokeWidth="2.2" />
        <line x1="8" y1="11" x2="14" y2="11" /><line x1="11" y1="8" x2="11" y2="14" />
      </svg>
    ),
    title: "Intelligent Review",
    desc: "AI-assisted reviewer matching based on expertise, conflict-of-interest detection, and structured evaluation forms that elevate review quality.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="24" height="20" rx="2.5" />
        <line x1="2" y1="11" x2="26" y2="11" />
        <line x1="9" y1="2" x2="9" y2="8" /><line x1="19" y1="2" x2="19" y2="8" />
        <line x1="7" y1="17" x2="11" y2="17" /><line x1="7" y1="21" x2="10" y2="21" />
        <line x1="17" y1="17" x2="21" y2="17" /><line x1="17" y1="21" x2="21" y2="21" />
      </svg>
    ),
    title: "Event Orchestration",
    desc: "End-to-end conference management: schedule builder, track management, session assignments, and attendee registration all in one dashboard.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="14" cy="14" r="11" /><circle cx="14" cy="14" r="5" />
        <line x1="14" y1="3" x2="14" y2="1" /><line x1="14" y1="27" x2="14" y2="25" />
        <line x1="3" y1="14" x2="1" y2="14" /><line x1="27" y1="14" x2="25" y2="14" />
      </svg>
    ),
    title: "Global Reach",
    desc: "Multi-timezone scheduling, multilingual support, and a worldwide network connecting researchers across 60+ countries seamlessly.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3L3 9v10l11 6 11-6V9L14 3z" />
        <path d="M14 3v22M3 9l11 6 11-6" />
      </svg>
    ),
    title: "Secure Infrastructure",
    desc: "Enterprise-grade encryption, role-based access control, and compliance with international data protection standards including GDPR.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2,20 8,14 13,18 19,10 26,14" />
        <rect x="2" y="2" width="24" height="24" rx="2.5" />
      </svg>
    ),
    title: "Deep Analytics",
    desc: "Real-time dashboards, acceptance rate trends, reviewer performance metrics, and exportable reports to drive data-informed decisions.",
  },
];

const timeline = [
  { year: "2020", title: "Founded", desc: "Born from a shared frustration with fragmented, outdated conference tools." },
  { year: "2021", title: "First Launch", desc: "Beta launched with 12 pilot conferences across 3 continents." },
  { year: "2022", title: "Rapid Growth", desc: "Crossed 100 conferences and 5,000 registered researchers worldwide." },
  { year: "2023", title: "AI Integration", desc: "Introduced intelligent reviewer matching and automated conflict detection." },
  { year: "2024", title: "Global Scale", desc: "Now powering 340+ conferences across 60 countries with 12K+ researchers." },
];

const team = [
  { name: "Abc Def",  role: "Co-founder & CEO",   initial: "AD" },
  { name: "Ghi Jkl",  role: "Co-founder & CTO",   initial: "GJ" },
  { name: "Mno Pqr",  role: "Head of Product",     initial: "MP" },
  { name: "Stu Vwx",  role: "Head of Research",    initial: "SV" },
];

const LearnMore = () => {
  const { visible, ref } = useVisible();

  return (
    <Layout title="ConForum - Learn More">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');

        :root {
          --teal:      #4B707A;
          --teal-dark: #2D5561;
          --teal-mid:  #5E8A95;
          --teal-light:#6B9AA8;
          --sage:      #7F9C8E;
          --lime:      #C5D9A4;
          --pale-teal: #EEF5F4;
          --navy:      #0a1a3a;
          --sky-bg:    #cfe8f7;
          --dark:      #1C2B2E;
          --txt:       #2A3E42;
          --soft:      #5E787C;
          --bdr:       #DDE9E6;
          --white:     #ffffff;
        }

        .lm-page { font-family: 'Outfit', sans-serif; color: var(--dark); overflow-x: hidden; }

        .lm-fade       { opacity:0; transform:translateY(36px);  transition:opacity .72s cubic-bezier(.4,0,.2,1),transform .72s cubic-bezier(.4,0,.2,1); }
        .lm-fade.in    { opacity:1; transform:translateY(0); }
        .lm-fade-left  { opacity:0; transform:translateX(-36px); transition:opacity .72s cubic-bezier(.4,0,.2,1),transform .72s cubic-bezier(.4,0,.2,1); }
        .lm-fade-left.in  { opacity:1; transform:translateX(0); }
        .lm-fade-right { opacity:0; transform:translateX(36px);  transition:opacity .72s cubic-bezier(.4,0,.2,1),transform .72s cubic-bezier(.4,0,.2,1); }
        .lm-fade-right.in { opacity:1; transform:translateX(0); }
        .lm-d1{transition-delay:.05s;} .lm-d2{transition-delay:.12s;} .lm-d3{transition-delay:.19s;}
        .lm-d4{transition-delay:.26s;} .lm-d5{transition-delay:.33s;} .lm-d6{transition-delay:.40s;}

        /* ══ HERO ══ */
        .lm-hero {
          position: relative; min-height: 90vh;
          display: flex; align-items: center; overflow: hidden;
          background: var(--navy);
          margin-top: -66px;
        }
        .lm-hero-right-panel {
          position: absolute; top: 0; right: 0; width: 44%; height: 100%;
          background: linear-gradient(155deg, #1a3a5c 0%, var(--teal-dark) 55%, var(--teal) 100%);
          clip-path: polygon(20% 0%, 100% 0%, 100% 100%, 0% 100%);
          z-index: 0; opacity: 0.9;
        }
        .lm-hero-grid {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background-image:
            linear-gradient(rgba(107,154,168,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(107,154,168,.06) 1px, transparent 1px);
          background-size: 56px 56px;
        }
        .lm-orb { position:absolute; border-radius:50%; pointer-events:none; }
        .lm-orb-1 { width:520px; height:520px; top:-140px; left:-80px; background:radial-gradient(circle,rgba(75,112,122,.2) 0%,transparent 65%); }
        .lm-orb-2 { width:320px; height:320px; bottom:-80px; left:28%; background:radial-gradient(circle,rgba(107,154,168,.14) 0%,transparent 65%); }

        .lm-hero-inner {
          position: relative; z-index: 10;
          max-width: 1160px; margin: 0 auto;
          padding: 130px 48px 100px;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 72px; align-items: center;
        }
        @media(max-width:900px){
          .lm-hero-inner { grid-template-columns:1fr; gap:44px; padding:110px 28px 80px; }
          .lm-hero-right-panel { width:100%; clip-path:none; opacity:.12; }
        }

        .lm-hero-tag {
          font-family: 'Space Mono', monospace; font-size: .62rem; font-weight: 700;
          letter-spacing: .28em; text-transform: uppercase;
          color: rgba(197,217,164,.8); margin-bottom: 18px; display: block;
          opacity: 0; animation: lmUp .6s ease .2s forwards;
        }
        @keyframes lmUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

        .lm-hero-h1 {
          font-family: 'DM Serif Display', serif; font-weight: 400; font-style: italic;
          font-size: clamp(2.2rem, 5vw, 4.6rem); line-height: 1.1;
          color: rgba(255,255,255,.9); margin-bottom: 8px;
          opacity: 0; animation: lmUp .8s cubic-bezier(.4,0,.2,1) .35s forwards;
        }
        .lm-hero-h1 strong {
          font-style: normal; font-weight: 400; color: #fff; display: block;
          font-family: 'Outfit', sans-serif; font-weight: 900;
          font-size: clamp(2.4rem, 5.5vw, 5rem); letter-spacing: -.04em; line-height: .95;
        }

        .lm-hero-desc {
          font-size: 1rem; color: rgba(200,225,238,.72); line-height: 1.74;
          max-width: 460px; margin-bottom: 34px;
          opacity: 0; animation: lmUp .7s ease .7s forwards;
        }
        .lm-hero-btns { display:flex; gap:12px; flex-wrap:wrap; opacity:0; animation:lmUp .7s ease .9s forwards; }

        .lm-btn-primary {
          padding: 13px 28px; border-radius: 9px;
          background: var(--teal); color: #fff;
          font-weight: 700; font-size: .84rem; letter-spacing: .04em;
          text-decoration: none; display: inline-block;
          box-shadow: 0 6px 22px rgba(75,112,122,.45);
          transition: background .22s, box-shadow .22s, transform .2s;
        }
        .lm-btn-primary:hover { background: var(--teal-mid); box-shadow: 0 10px 30px rgba(75,112,122,.55); transform: translateY(-2px); }
        .lm-btn-outline {
          padding: 13px 28px; border-radius: 9px;
          background: rgba(255,255,255,.08); border: 1.5px solid rgba(255,255,255,.2);
          color: rgba(255,255,255,.88); font-weight: 600; font-size: .84rem;
          text-decoration: none; display: inline-block; backdrop-filter: blur(10px);
          transition: background .22s, border-color .22s, transform .2s;
        }
        .lm-btn-outline:hover { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.38); transform: translateY(-2px); }

        .lm-hero-card {
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
          border-radius: 22px; padding: 34px; backdrop-filter: blur(20px);
          opacity: 0; animation: lmUp .9s cubic-bezier(.4,0,.2,1) .6s forwards;
        }
        .lm-hero-card-label {
          font-family: 'Space Mono', monospace; font-size: .58rem;
          letter-spacing: .2em; text-transform: uppercase;
          color: rgba(197,217,164,.6); margin-bottom: 20px; display: block;
        }
        .lm-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .lm-stat-item {
          text-align: center; padding: 20px 12px;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
          border-radius: 13px;
        }
        .lm-stat-val {
          font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 2rem;
          letter-spacing: -.04em; color: #fff; line-height: 1; margin-bottom: 6px;
        }
        .lm-stat-item:nth-child(odd) .lm-stat-val { color: #a8dede; }
        .lm-stat-lbl { font-size: .7rem; color: rgba(255,255,255,.38); font-weight:500; letter-spacing:.08em; text-transform:uppercase; }

        /* ══ SECTIONS ══ */
        .lm-section { padding: 110px 48px; position: relative; }
        .lm-section-inner { max-width: 1160px; margin: 0 auto; }
        @media(max-width:768px){ .lm-section{ padding:80px 22px; } }

        .lm-section-tag {
          font-family: 'Space Mono', monospace; font-size: .62rem; font-weight: 700;
          letter-spacing: .22em; text-transform: uppercase;
          color: var(--teal); display: block; margin-bottom: 11px;
        }
        .lm-section-title {
          font-family: 'DM Serif Display', serif; font-weight: 400;
          font-size: clamp(1.8rem, 3.8vw, 2.9rem); color: var(--dark);
          letter-spacing: -.01em; line-height: 1.12;
        }
        .lm-section-title em { font-style: italic; color: var(--teal); }
        .lm-section-rule { width: 38px; height: 2px; border-radius:99px; background: linear-gradient(90deg,var(--teal),var(--sage)); margin: 13px 0 0; }
        .lm-section-rule-c { margin: 13px auto 0; }
        .lm-section-sub { font-size: .96rem; color: var(--soft); line-height: 1.74; max-width: 540px; margin-top: 14px; }

        /* ══ FEATURES ══ */
        .lm-features { background: var(--white); }
        .lm-features-head { text-align: center; margin-bottom: 60px; }
        .lm-features-head .lm-section-sub { margin: 14px auto 0; }
        .lm-features-head .lm-section-rule { margin: 13px auto 0; }

        .lm-feat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
        @media(max-width:900px){ .lm-feat-grid{grid-template-columns:repeat(2,1fr);} }
        @media(max-width:560px){ .lm-feat-grid{grid-template-columns:1fr;} }

        .lm-feat-card {
          background: var(--white); border: 1.5px solid var(--bdr);
          border-radius: 16px; padding: 34px 28px;
          position: relative; overflow: hidden;
          transition: transform .3s cubic-bezier(.34,1.2,.64,1), box-shadow .3s, border-color .3s;
        }
        .lm-feat-card::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(180deg, var(--teal), var(--teal-light));
          transform: scaleY(0); transform-origin: bottom;
          transition: transform .4s cubic-bezier(.4,0,.2,1); border-radius: 0 2px 2px 0;
        }
        .lm-feat-card:hover { transform: translateY(-7px); box-shadow: 0 18px 44px rgba(75,112,122,.13); border-color: rgba(75,112,122,.3); }
        .lm-feat-card:hover::before { transform: scaleY(1); }
        .lm-feat-icon {
          width: 52px; height: 52px; border-radius: 14px;
          background: var(--pale-teal); border: 1px solid rgba(75,112,122,.15);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 20px; color: var(--teal);
          transition: transform .35s cubic-bezier(.34,1.56,.64,1);
        }
        .lm-feat-card:hover .lm-feat-icon { transform: scale(1.1) rotate(4deg); }
        .lm-feat-title { font-weight: 800; font-size: .98rem; color: var(--dark); letter-spacing: -.01em; margin-bottom: 10px; }
        .lm-feat-desc { font-size: .865rem; color: var(--soft); line-height: 1.74; }

        /* ══ TIMELINE ══ */
        .lm-timeline { background: var(--pale-teal); }
        .lm-timeline-head { text-align: center; margin-bottom: 68px; }
        .lm-timeline-head .lm-section-sub { margin: 14px auto 0; }

        .lm-tl-track { position: relative; max-width: 740px; margin: 0 auto; padding-left: 48px; }
        .lm-tl-track::before {
          content: ''; position: absolute; left: 16px; top: 8px; bottom: 8px;
          width: 2px; background: linear-gradient(180deg, var(--teal), rgba(75,112,122,.15));
          border-radius: 99px;
        }
        .lm-tl-item {
          position: relative; margin-bottom: 44px;
          padding: 26px 30px; background: var(--white);
          border: 1.5px solid var(--bdr); border-radius: 16px;
          transition: transform .3s ease, box-shadow .3s ease, border-color .3s;
        }
        .lm-tl-item:hover { transform: translateX(6px); box-shadow: 0 10px 28px rgba(75,112,122,.12); border-color: rgba(75,112,122,.3); }
        .lm-tl-item:last-child { margin-bottom: 0; }
        .lm-tl-item::before {
          content: ''; position: absolute; left: -40px; top: 32px;
          width: 12px; height: 12px; border-radius: 50%;
          background: var(--teal); box-shadow: 0 0 0 4px rgba(75,112,122,.18);
        }
        .lm-tl-year {
          font-family: 'Space Mono', monospace; font-size: .6rem; font-weight: 700;
          letter-spacing: .18em; text-transform: uppercase; color: var(--teal); margin-bottom: 7px;
        }
        .lm-tl-title { font-weight: 800; font-size: 1rem; color: var(--dark); margin-bottom: 5px; }
        .lm-tl-desc { font-size: .87rem; color: var(--soft); line-height: 1.68; }

        /* ══ TEAM ══ */
        .lm-team { background: var(--white); }
        .lm-team-head { text-align: center; margin-bottom: 56px; }
        .lm-team-head .lm-section-sub { margin: 14px auto 0; }

        .lm-team-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:22px; }
        @media(max-width:900px){ .lm-team-grid{grid-template-columns:repeat(2,1fr);} }
        @media(max-width:480px){ .lm-team-grid{grid-template-columns:1fr;} }

        .lm-team-card {
          text-align: center; padding: 34px 20px 28px;
          background: var(--white); border: 1.5px solid var(--bdr);
          border-radius: 16px;
          transition: transform .3s cubic-bezier(.34,1.2,.64,1), box-shadow .3s, border-color .3s;
        }
        .lm-team-card:hover { transform: translateY(-7px); box-shadow: 0 18px 40px rgba(75,112,122,.13); border-color: rgba(75,112,122,.3); }
        .lm-team-avatar {
          width: 68px; height: 68px; border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 1.15rem; color: #fff;
          margin: 0 auto 16px;
          background: linear-gradient(135deg, var(--teal-dark), var(--teal-light));
          box-shadow: 0 6px 18px rgba(75,112,122,.3);
        }
        .lm-team-name { font-weight: 800; font-size: .94rem; color: var(--dark); margin-bottom: 5px; }
        .lm-team-role {
          font-family: 'Space Mono', monospace; font-size: .58rem;
          letter-spacing: .14em; text-transform: uppercase; color: var(--teal);
        }

        /* ══ CTA — fixed to match home page teal theme ══ */
        .lm-cta {
          background: var(--teal);
          padding: 100px 48px;
          position: relative;
          overflow: hidden;
        }
        .lm-cta::before {
          content: ''; position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 26px 26px; pointer-events: none;
        }
        .lm-cta-glow {
          position: absolute; width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(168,196,184,.25) 0%, transparent 70%);
          pointer-events: none; top: 50%; left: 50%; transform: translate(-50%, -50%);
        }
        .lm-cta-inner {
          position: relative; z-index: 1;
          max-width: 580px; margin: 0 auto; text-align: center;
        }
        .lm-cta-eyebrow {
          font-family: 'Space Mono', monospace; font-size: .6rem; font-weight: 700;
          letter-spacing: .22em; text-transform: uppercase;
          color: rgba(197,217,164,.75); display: block; margin-bottom: 18px;
        }
        .lm-cta-title {
          font-family: 'DM Serif Display', serif; font-weight: 400; font-style: italic;
          font-size: clamp(1.7rem, 3.8vw, 3rem); color: rgba(255,255,255,.92);
          line-height: 1.2; margin-bottom: 0;
        }
        .lm-cta-title strong {
          display: block; font-style: normal;
          font-family: 'Outfit', sans-serif; font-weight: 900;
          font-size: clamp(1.8rem, 4vw, 3.2rem); letter-spacing: -.04em;
          color: #fff; margin-top: 4px;
        }
        .lm-cta-sub {
          font-size: .94rem; color: rgba(220,238,232,.68);
          line-height: 1.74; margin: 16px 0 36px;
        }
        .lm-cta-btns { display: flex; gap: 11px; justify-content: center; flex-wrap: wrap; }
        /* FIX: white primary button matching home CTA, no arrow */
        .lm-cta-btn-primary {
          padding: 13px 32px; border-radius: 8px;
          background: #fff; color: var(--teal-dark);
          font-family: 'Outfit', sans-serif; font-weight: 800; font-size: .86rem;
          letter-spacing: .03em; text-decoration: none;
          box-shadow: 0 4px 18px rgba(0,0,0,.14);
          transition: box-shadow .22s, transform .2s; display: inline-block;
        }
        .lm-cta-btn-primary:hover { box-shadow: 0 8px 28px rgba(0,0,0,.2); transform: translateY(-2px); }
        /* FIX: ghost secondary button matching home CTA */
        .lm-cta-btn-ghost {
          padding: 13px 32px; border-radius: 8px;
          background: rgba(255,255,255,.1); border: 1.5px solid rgba(255,255,255,.26);
          color: rgba(255,255,255,.9); font-family: 'Outfit', sans-serif;
          font-weight: 600; font-size: .86rem; text-decoration: none;
          transition: background .22s, border-color .22s, transform .2s; display: inline-block;
        }
        .lm-cta-btn-ghost:hover { background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.45); transform: translateY(-2px); }
      `}</style>

      <div className="lm-page">

        {/* ══ HERO ══ */}
        <section className="lm-hero">
          <div className="lm-hero-right-panel" />
          <div className="lm-hero-grid" />
          <div className="lm-orb lm-orb-1" />
          <div className="lm-orb lm-orb-2" />
          <div className="lm-hero-inner">
            <div>
              <span className="lm-hero-tag">Academic Conference Platform</span>
              <h1 className="lm-hero-h1">
                Built for the world's
                <strong>research community</strong>
              </h1>
              <p className="lm-hero-desc">
                We're on a mission to eliminate the friction in academic conference management — so researchers spend less time on logistics and more time on discovery.
              </p>
              <div className="lm-hero-btns">
                <Link to="/register" className="lm-btn-primary">Get Started Free</Link>
                <Link to="/login" className="lm-btn-outline">Sign In</Link>
              </div>
            </div>
            <div className="lm-hero-card">
              <span className="lm-hero-card-label">Platform at a glance</span>
              <div className="lm-stat-grid">
                {stats.map((s) => (
                  <div key={s.label} className="lm-stat-item">
                    <div className="lm-stat-val">{s.value}</div>
                    <div className="lm-stat-lbl">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ FEATURES ══ */}
        <section className="lm-section lm-features">
          <div className="lm-section-inner">
            <div className={`lm-fade lm-features-head${visible["feat-head"] ? " in" : ""}`} data-vid="feat-head" ref={ref("feat-head")}>
              <span className="lm-section-tag">What We Offer</span>
              <h2 className="lm-section-title">Everything you need, <em>nothing you don't</em></h2>
              <div className="lm-section-rule lm-section-rule-c" />
              <p className="lm-section-sub">A complete toolkit purpose-built for academic conferences — from first submission to final proceedings.</p>
            </div>
            <div className="lm-feat-grid">
              {features.map((f, i) => (
                <div key={f.title} className={`lm-feat-card lm-fade lm-d${(i % 3) + 1}${visible[`feat-${i}`] ? " in" : ""}`} data-vid={`feat-${i}`} ref={ref(`feat-${i}`)}>
                  <div className="lm-feat-icon">{f.icon}</div>
                  <div className="lm-feat-title">{f.title}</div>
                  <p className="lm-feat-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

       

      

      </div>
    </Layout>
  );
};

export default LearnMore;