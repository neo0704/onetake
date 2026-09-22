import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ── Static Data ───────────────────────────────────────────────────────────────
const SERVICES = [
  {
    icon: '🎥',
    name: 'Multi-Camera Live Event Coverage & Livestreaming',
    desc: 'Professional multi-camera setup with real-time streaming. Includes Technical Director, Sony broadcast camcorders, HD production switcher, and hybrid speaker integration.',
  },
  {
    icon: '📸',
    name: 'Events Digital Documentation',
    desc: 'Full photo and video coverage with Same-Day Edit (SDE) video. Two photographers, two videographers, plus drone footage for complete event coverage.',
  },
  {
    icon: '💍',
    name: 'Wedding, Debut & Birthday Photo/Video with Livestream',
    desc: 'Comprehensive photography and videography for weddings, debuts, and birthdays — with live streaming included as standard.',
  },
  {
    icon: '🌐',
    name: 'Remote & Virtual Livestreaming',
    desc: 'Broadcast-quality streaming for hybrid events, virtual conferences, and online meetings — no matter where your audience is.',
  },
];

const STEPS = [
  { n: '01', title: 'Submit Inquiry',   desc: 'Tell us about your event — date, venue, service, and category.' },
  { n: '02', title: 'Needs Assessment', desc: 'We meet online or face-to-face to finalize your requirements.' },
  { n: '03', title: 'Review Quotation', desc: 'Receive a custom quotation and approve your package.' },
  { n: '04', title: 'Confirm & Pay',    desc: 'Secure your booking with a 50% downpayment. Team gets assigned.' },
  { n: '05', title: 'Event & Delivery', desc: 'We cover your event and deliver your content. Settle balance and done.' },
];

const STATS = [
  { num: '500+', label: 'Events Covered' },
  { num: '4K+',  label: 'Hours of Content' },
  { num: '98%',  label: 'Client Satisfaction' },
  { num: '10+',  label: 'Years in Production' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getEmbedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1&color=white`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?color=e94560&title=0&byline=0`;
  return url; // direct video URL
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url || '');
}

function getCover(proj) {
  if (proj.coverImage) return proj.coverImage;
  if (proj.images && proj.images.length > 0) return proj.images[0].url;
  return null;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); obs.unobserve(el); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function Counter({ target }) {
  const [val, setVal] = useState(0);
  const [ref, inView] = useInView(0.5);
  const num    = parseInt(target.replace(/\D/g, ''));
  const suffix = target.replace(/\d/g, '');
  useEffect(() => {
    if (!inView) return;
    let v = 0;
    const step = Math.ceil(num / 40);
    const t = setInterval(() => {
      v += step;
      if (v >= num) { setVal(num); clearInterval(t); } else setVal(v);
    }, 35);
    return () => clearInterval(t);
  }, [inView, num]);
  return <span ref={ref}>{inView ? val + suffix : '0'}</span>;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IconArrow  = () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
const IconSignIn = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>;
const IconPlay   = () => <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;
const IconClose  = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>;
const IconMenu   = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
const IconGrid   = () => <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/></svg>;

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Serif+Display:ital@0;1&display=swap');

  .ot-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .ot-root {
    --red:    #e94560;
    --red2:   #ff6b85;
    --dark:   #0d0d1a;
    --darker: #080810;
    --card:   #12121f;
    --border: rgba(255,255,255,0.08);
    --muted:  rgba(255,255,255,0.62);
    background: var(--darker);
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    overflow-x: hidden;
  }
  .ot-noise {
    position: fixed; inset: 0; pointer-events: none; z-index: 999;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: 0.35;
  }

  /* NAV */
  .ot-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 200;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 48px; height: 68px;
    background: rgba(8,8,16,0.88); backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border); transition: background 0.3s;
  }
  .ot-nav.scrolled { background: rgba(8,8,16,0.97); }
  .ot-logo { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:6px; color:#fff; text-decoration:none; }
  .ot-logo em { color:var(--red); font-style:normal; }
  .ot-nav-right { display:flex; align-items:center; gap:10px; }
  .ot-btn-ghost {
    padding:9px 20px; background:transparent; border:1px solid var(--border);
    color:rgba(255,255,255,0.65); border-radius:8px; font-family:'DM Sans',sans-serif;
    font-size:14px; font-weight:500; cursor:pointer; transition:all 0.2s;
    display:inline-flex; align-items:center; gap:7px;
  }
  .ot-btn-ghost:hover { border-color:rgba(255,255,255,0.3); color:#fff; background:rgba(255,255,255,0.06); }
  .ot-btn-red {
    padding:9px 22px; background:var(--red); border:1px solid var(--red); color:#fff;
    border-radius:8px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600;
    cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; gap:7px;
  }
  .ot-btn-red:hover { background:#ff2d50; transform:translateY(-1px); box-shadow:0 8px 24px rgba(233,69,96,0.35); }

  /* HERO */
  .ot-hero {
    min-height:100vh; min-height:100svh; display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:140px 48px 100px; position:relative; overflow:hidden;
  }
  .ot-hero-glow {
    position:absolute; top:-10%; left:50%; transform:translateX(-50%);
    width:900px; height:700px; pointer-events:none;
    background:radial-gradient(ellipse, rgba(233,69,96,0.11) 0%, transparent 65%);
  }
  .ot-hero-grid {
    position:absolute; inset:0; pointer-events:none;
    background-image: linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px);
    background-size:64px 64px;
    -webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 100%);
    mask-image:radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 100%);
  }
  .ot-eyebrow {
    display:inline-flex; align-items:center; gap:8px; padding:6px 16px;
    background:rgba(233,69,96,0.1); border:1px solid rgba(233,69,96,0.28); border-radius:100px;
    font-size:11px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:var(--red2);
    margin-bottom:32px; position:relative; z-index:2; animation:fadeUp 0.8s ease both;
  }
  .ot-dot { width:6px; height:6px; background:var(--red); border-radius:50%; animation:blink 2s infinite; }
  @keyframes blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.65)} }
  .ot-hero-title {
    font-family:'Bebas Neue',sans-serif; font-size:clamp(80px,14vw,160px);
    letter-spacing:8px; line-height:0.9; text-align:center; position:relative; z-index:2;
    margin-bottom:8px; animation:fadeUp 0.8s ease 0.15s both;
  }
  .ot-hero-title .ghost { display:block; color:transparent; -webkit-text-stroke:1px rgba(255,255,255,0.18); }
  .ot-hero-title .red { color:var(--red); }
  .ot-hero-sub {
    font-family:'DM Serif Display',serif; font-style:italic; font-size:clamp(15px,1.8vw,19px);
    color:var(--muted); text-align:center; max-width:500px; line-height:1.7;
    margin:28px 0 52px; position:relative; z-index:2; animation:fadeUp 0.8s ease 0.3s both;
  }
  .ot-hero-btns { display:flex; align-items:center; gap:14px; flex-wrap:wrap; justify-content:center; position:relative; z-index:2; animation:fadeUp 0.8s ease 0.45s both; }
  .ot-cta-main {
    padding:16px 40px; background:var(--red); border:none; color:#fff; border-radius:10px;
    font-family:'DM Sans',sans-serif; font-size:15px; font-weight:600; cursor:pointer;
    transition:all 0.25s; display:inline-flex; align-items:center; gap:10px;
  }
  .ot-cta-main:hover { background:#ff2d50; transform:translateY(-2px); box-shadow:0 16px 40px rgba(233,69,96,0.42); }
  .ot-cta-main:hover .ot-arrow { transform:translateX(4px); }
  .ot-arrow { transition:transform 0.2s; display:inline-flex; }
  .ot-cta-out {
    padding:16px 40px; background:transparent; border:1px solid rgba(255,255,255,0.14);
    color:rgba(255,255,255,0.75); border-radius:10px; font-family:'DM Sans',sans-serif;
    font-size:15px; font-weight:500; cursor:pointer; transition:all 0.25s;
    display:inline-flex; align-items:center; gap:10px;
  }
  .ot-cta-out:hover { border-color:rgba(255,255,255,0.38); color:#fff; transform:translateY(-2px); background:rgba(255,255,255,0.04); }
  .ot-scroll-hint {
    position:absolute; bottom:36px; left:50%; transform:translateX(-50%);
    display:flex; flex-direction:column; align-items:center; gap:8px;
    color:rgba(255,255,255,0.35); font-size:10px; letter-spacing:2.5px; text-transform:uppercase; z-index:2;
    animation:fadeUp 1s ease 1s both;
  }
  .ot-scroll-line { width:1px; height:40px; background:linear-gradient(to bottom, rgba(255,255,255,0.28), transparent); animation:dropLine 2s ease-in-out infinite; }
  @keyframes dropLine {
    0%{transform:scaleY(0);transform-origin:top;opacity:0}
    45%{transform:scaleY(1);transform-origin:top;opacity:1}
    55%{transform:scaleY(1);transform-origin:bottom;opacity:1}
    100%{transform:scaleY(0);transform-origin:bottom;opacity:0}
  }

  /* STATS */
  .ot-stats { background:var(--card); border-top:1px solid var(--border); border-bottom:1px solid var(--border); display:grid; grid-template-columns:repeat(4,1fr); }
  .ot-stat { display:flex; flex-direction:column; align-items:center; gap:4px; padding:28px 16px; border-right:1px solid var(--border); }
  .ot-stat:last-child { border-right:none; }
  .ot-stat-num { font-family:'Bebas Neue',sans-serif; font-size:42px; letter-spacing:2px; color:#fff; line-height:1; }
  .ot-stat-num em { color:var(--red); font-style:normal; }
  .ot-stat-label { font-size:10px; font-weight:600; letter-spacing:1.8px; text-transform:uppercase; color:var(--muted); }

  /* SECTIONS */
  .ot-section { padding:100px 48px; max-width:1200px; margin:0 auto; }
  .ot-section-tag { display:inline-flex; align-items:center; gap:8px; font-size:10px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--red); margin-bottom:18px; }
  .ot-section-tag::before { content:''; width:20px; height:1px; background:var(--red); }
  .ot-section-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(44px,5vw,68px); letter-spacing:3px; line-height:1; margin-bottom:14px; }
  .ot-section-body { font-size:15px; line-height:1.8; color:var(--muted); max-width:520px; }

  /* SERVICES */
  .ot-services-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; margin-top:52px; }
  .ot-svc {
    background:var(--card); border:1px solid var(--border); border-radius:16px; padding:34px;
    transition:all 0.3s; position:relative; overflow:hidden;
    opacity:0; transform:translateY(28px);
  }
  .ot-svc.visible { opacity:1; transform:translateY(0); }
  .ot-svc::after { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--red),transparent); opacity:0; transition:opacity 0.3s; }
  .ot-svc:hover { border-color:rgba(233,69,96,0.22); transform:translateY(-5px) !important; box-shadow:0 20px 48px rgba(0,0,0,0.45); }
  .ot-svc:hover::after { opacity:1; }
  .ot-svc-icon { width:48px; height:48px; background:rgba(233,69,96,0.09); border:1px solid rgba(233,69,96,0.18); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:18px; }
  .ot-svc-name { font-size:16px; font-weight:600; margin-bottom:10px; }
  .ot-svc-desc { font-size:13px; line-height:1.75; color:var(--muted); }

  /* HOW IT WORKS */
  .ot-how { padding:100px 48px; background:var(--card); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
  .ot-how-inner { max-width:1200px; margin:0 auto; }
  .ot-steps { display:grid; grid-template-columns:repeat(5,1fr); gap:0; margin-top:56px; position:relative; }
  .ot-steps::before { content:''; position:absolute; top:27px; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,var(--red),rgba(233,69,96,0.25),transparent); }
  .ot-step { display:flex; flex-direction:column; align-items:center; text-align:center; padding:0 10px; opacity:0; transform:translateY(20px); transition:opacity 0.5s ease, transform 0.5s ease; }
  .ot-step.visible { opacity:1; transform:translateY(0); }
  .ot-step-num { width:54px; height:54px; background:var(--darker); border:1px solid var(--red); border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Bebas Neue',sans-serif; font-size:21px; letter-spacing:1px; color:var(--red); margin-bottom:18px; position:relative; z-index:1; transition:all 0.3s; }
  .ot-step:hover .ot-step-num { background:var(--red); color:#fff; box-shadow:0 0 24px rgba(233,69,96,0.45); }
  .ot-step-title { font-size:13px; font-weight:600; margin-bottom:8px; }
  .ot-step-desc { font-size:12px; line-height:1.65; color:var(--muted); }

  /* ── FEATURED VIDEO ── */
  .ot-video-section {
    position: relative;
    background: var(--darker);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 100px 48px;
    overflow: hidden;
  }
  .ot-video-glow {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    width: 800px; height: 500px; pointer-events: none;
    background: radial-gradient(ellipse, rgba(233,69,96,0.07) 0%, transparent 70%);
  }
  .ot-video-inner { max-width: 960px; margin: 0 auto; position: relative; z-index: 2; }
  .ot-video-header { text-align: center; margin-bottom: 48px; }
  .ot-video-header .ot-section-title { margin-bottom: 10px; }
  .ot-video-header p { font-family: 'DM Serif Display', serif; font-style: italic; font-size: 17px; color: var(--muted); }
  .ot-video-frame {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid var(--border);
    box-shadow: 0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(233,69,96,0.1);
    background: #000;
  }
  .ot-video-frame::before {
    content: '';
    position: absolute; inset: 0; z-index: 1;
    border-radius: 20px;
    box-shadow: inset 0 0 80px rgba(233,69,96,0.06);
    pointer-events: none;
  }
  .ot-video-frame iframe,
  .ot-video-frame video {
    display: block;
    width: 100%;
    aspect-ratio: 16/9;
    border: none;
  }
  /* Thumbnail play button overlay */
  .ot-video-thumb {
    position: relative; cursor: pointer;
    border-radius: 20px; overflow: hidden;
    border: 1px solid var(--border);
    box-shadow: 0 40px 100px rgba(0,0,0,0.6);
    aspect-ratio: 16/9;
    background: #0a0a14;
  }
  .ot-video-thumb img { width:100%; height:100%; object-fit:cover; transition:transform 0.5s ease; }
  .ot-video-thumb:hover img { transform:scale(1.03); }
  .ot-play-btn {
    position: absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    width: 80px; height: 80px; border-radius: 50%;
    background: rgba(233,69,96,0.9); border: 2px solid rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    color: #fff; transition: all 0.3s;
    box-shadow: 0 8px 32px rgba(233,69,96,0.5);
  }
  .ot-video-thumb:hover .ot-play-btn { background: var(--red); transform: translate(-50%,-50%) scale(1.1); box-shadow: 0 16px 48px rgba(233,69,96,0.6); }
  .ot-thumb-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.3); }

  /* ── PORTFOLIO ── */
  .ot-portfolio-wrap {
    padding: 100px 48px;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ── REVIEWS ── */
  .ot-reviews-wrap {
    padding: 100px 48px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .ot-review-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 52px;
  }
  .ot-review-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: border-color 0.3s, transform 0.3s;
  }
  .ot-review-card:hover { border-color: rgba(233,69,96,0.25); transform: translateY(-4px); }
  .ot-review-stars { display: flex; gap: 3px; }
  .ot-review-star { width: 16px; height: 16px; }
  .ot-review-comment { font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.75); flex: 1; }
  .ot-review-author { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
  .ot-review-name { font-weight: 600; font-size: 14px; color: #fff; }
  .ot-review-meta { font-size: 11px; color: rgba(255,255,255,0.4); }

  /* Featured project: big editorial hero card */
  .ot-proj-hero {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    margin-top: 52px;
    cursor: pointer;
    min-height: 500px;
    display: flex;
    align-items: flex-end;
    border: 1px solid var(--border);
  }
  .ot-proj-hero-img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    transition: transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94);
  }
  .ot-proj-hero:hover .ot-proj-hero-img { transform: scale(1.04); }
  .ot-proj-hero-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.1) 100%);
  }
  .ot-proj-hero-content {
    position: relative; z-index: 2;
    padding: 44px 48px;
    width: 100%;
  }
  .ot-proj-hero-tag {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 10px; font-weight: 700; letter-spacing: 3px;
    text-transform: uppercase; color: var(--red2); margin-bottom: 12px;
  }
  .ot-proj-hero-tag::before { content:''; width:16px; height:1px; background:var(--red); }
  .ot-proj-hero-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(38px, 5vw, 62px);
    letter-spacing: 3px; line-height: 1;
    margin-bottom: 16px;
  }
  .ot-proj-hero-tags { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
  .ot-proj-hero-tag-pill {
    padding: 4px 12px;
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
    border-radius: 100px; font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.7);
  }
  .ot-proj-hero-desc {
    font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.6);
    max-width: 580px; margin-bottom: 28px;
  }
  .ot-view-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 11px 28px; background: var(--red); border: none; color: #fff;
    border-radius: 8px; font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.2s;
  }
  .ot-view-btn:hover { background: #ff2d50; transform: translateX(4px); }
  .ot-hero-no-img {
    position: absolute; inset: 0;
    background: linear-gradient(135deg, var(--card) 0%, rgba(233,69,96,0.08) 100%);
  }

  /* Grid of remaining projects */
  .ot-proj-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-top: 20px;
  }
  .ot-proj-card {
    border-radius: 16px; overflow: hidden;
    border: 1px solid var(--border);
    background: var(--card);
    cursor: pointer;
    transition: all 0.35s;
    display: flex; flex-direction: column;
  }
  .ot-proj-card:hover { border-color: rgba(233,69,96,0.3); transform: translateY(-6px); box-shadow: 0 24px 56px rgba(0,0,0,0.5); }
  .ot-proj-card-img {
    position: relative;
    aspect-ratio: 4/3;
    overflow: hidden;
    background: #0a0a14;
  }
  .ot-proj-card-img img { width:100%; height:100%; object-fit:cover; transition:transform 0.5s ease; display:block; }
  .ot-proj-card:hover .ot-proj-card-img img { transform: scale(1.07); }
  .ot-proj-card-img-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.5) 100%);
    opacity: 0; transition: opacity 0.3s;
    display: flex; align-items: center; justify-content: center;
  }
  .ot-proj-card:hover .ot-proj-card-img-overlay { opacity: 1; }
  .ot-proj-card-hover-icon {
    width: 48px; height: 48px; background: rgba(233,69,96,0.9);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    color: #fff; transform: scale(0.7); transition: transform 0.3s;
  }
  .ot-proj-card:hover .ot-proj-card-hover-icon { transform: scale(1); }
  .ot-proj-card-no-img {
    width:100%; height:100%;
    background: linear-gradient(135deg, #12121f 0%, rgba(233,69,96,0.06) 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 48px; aspect-ratio: 4/3;
  }
  .ot-proj-card-body { padding: 20px; flex: 1; }
  .ot-proj-card-client { font-size:10px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:var(--red); margin-bottom:6px; }
  .ot-proj-card-title { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:1.5px; line-height:1.1; margin-bottom:10px; }
  .ot-proj-card-tags { display:flex; flex-wrap:wrap; gap:5px; }
  .ot-proj-card-tag { padding:3px 10px; background:rgba(233,69,96,0.08); border:1px solid rgba(233,69,96,0.2); border-radius:100px; font-size:10px; font-weight:600; color:var(--red2); }

  /* No-image card placeholder */
  .ot-proj-empty-img { width:100%; aspect-ratio:4/3; background:linear-gradient(135deg,#12121f 0%,rgba(233,69,96,0.06) 100%); display:flex; align-items:center; justify-content:center; }
  .ot-proj-empty-label { font-family:'Bebas Neue',sans-serif; font-size:36px; letter-spacing:3px; color:rgba(255,255,255,0.08); }

  /* Project Modal */
  .ot-modal-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.88);
    backdrop-filter: blur(10px);
    animation: fadeIn 0.25s ease;
  }
  .ot-modal-scroll {
    position: absolute; inset: 0; overflow-y: auto;
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 20px;
    overscroll-behavior: contain;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .ot-modal {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 24px;
    width: 100%; max-width: 880px;
    overflow: hidden;
    position: relative;
    animation: slideUp 0.3s ease;
  }
  @keyframes slideUp { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
  .ot-modal-close {
    position: absolute; top: 16px; right: 16px; z-index: 20;
    width: 44px; height: 44px; background: rgba(0,0,0,0.75);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; cursor: pointer; transition: all 0.2s;
  }
  .ot-modal-close:hover { background: var(--red); border-color: var(--red); }
  .ot-modal-hero { position: relative; aspect-ratio: 16/7; overflow: hidden; background: #0a0a14; }
  .ot-modal-hero img { width:100%; height:100%; object-fit:cover; display:block; }
  .ot-modal-hero-overlay { position:absolute; inset:0; background:linear-gradient(to top, var(--card) 0%, transparent 40%); }
  .ot-modal-body { padding: 36px 40px; }
  .ot-modal-client { font-size:10px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--red); margin-bottom:8px; display:inline-flex; align-items:center; gap:8px; }
  .ot-modal-client::before { content:''; width:16px; height:1px; background:var(--red); }
  .ot-modal-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(32px,4vw,52px); letter-spacing:2px; line-height:1; margin-bottom:16px; }
  .ot-modal-tags { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
  .ot-modal-tag { padding:5px 14px; background:rgba(233,69,96,0.08); border:1px solid rgba(233,69,96,0.22); border-radius:100px; font-size:11px; font-weight:600; color:var(--red2); }
  .ot-modal-desc { font-size:14px; line-height:1.8; color:var(--muted); margin-bottom:32px; }
  .ot-modal-gallery-label { font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.55); margin-bottom:14px; }
  .ot-modal-gallery { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .ot-modal-gallery-item { aspect-ratio:4/3; overflow:hidden; border-radius:10px; cursor:pointer; position:relative; background:#0a0a14; }
  .ot-modal-gallery-item img { width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.4s ease; }
  .ot-modal-gallery-item:hover img { transform:scale(1.08); }
  .ot-modal-gallery-item-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.3); opacity:0; transition:opacity 0.2s; display:flex; align-items:center; justify-content:center; }
  .ot-modal-gallery-item:hover .ot-modal-gallery-item-overlay { opacity:1; }

  /* Lightbox */
  .ot-lightbox { position:fixed; inset:0; z-index:2000; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); animation:fadeIn 0.2s ease; }
  .ot-lightbox-img { max-width:90vw; max-height:88vh; border-radius:12px; object-fit:contain; box-shadow:0 32px 80px rgba(0,0,0,0.7); }
  .ot-lightbox-close { position:absolute; top:24px; right:28px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15); color:#fff; width:44px; height:44px; border-radius:50%; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }
  .ot-lightbox-close:hover { background:rgba(233,69,96,0.4); }
  .ot-lightbox-nav { position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#fff; width:50px; height:50px; border-radius:50%; font-size:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s; }
  .ot-lightbox-nav:hover { background:rgba(233,69,96,0.35); border-color:var(--red); }
  .ot-lightbox-prev { left:24px; }
  .ot-lightbox-next { right:24px; }
  .ot-lightbox-counter { position:absolute; bottom:24px; left:50%; transform:translateX(-50%); font-size:12px; letter-spacing:2px; color:rgba(255,255,255,0.45); }

  /* BIG CTA */
  .ot-cta-section { padding:120px 48px; text-align:center; position:relative; overflow:hidden; }
  .ot-cta-glow { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:700px; height:500px; pointer-events:none; background:radial-gradient(ellipse, rgba(233,69,96,0.07) 0%, transparent 70%); }
  .ot-cta-inner { max-width:660px; margin:0 auto; position:relative; z-index:2; }
  .ot-cta-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(48px,7vw,84px); letter-spacing:4px; line-height:1; margin-bottom:18px; }
  .ot-cta-title em { color:var(--red); font-style:normal; display:block; }
  .ot-cta-body { font-family:'DM Serif Display',serif; font-style:italic; font-size:17px; color:var(--muted); line-height:1.7; margin-bottom:48px; }
  .ot-cta-btns { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
  .ot-cta-main-lg { padding:18px 48px; background:var(--red); border:none; color:#fff; border-radius:10px; font-family:'DM Sans',sans-serif; font-size:16px; font-weight:600; cursor:pointer; transition:all 0.25s; display:inline-flex; align-items:center; gap:10px; }
  .ot-cta-main-lg:hover { background:#ff2d50; transform:translateY(-2px); box-shadow:0 16px 40px rgba(233,69,96,0.42); }
  .ot-cta-main-lg:hover .ot-arrow { transform:translateX(4px); }
  .ot-cta-out-lg { padding:18px 48px; background:transparent; border:1px solid rgba(255,255,255,0.14); color:rgba(255,255,255,0.75); border-radius:10px; font-family:'DM Sans',sans-serif; font-size:16px; font-weight:500; cursor:pointer; transition:all 0.25s; display:inline-flex; align-items:center; gap:10px; }
  .ot-cta-out-lg:hover { border-color:rgba(255,255,255,0.38); color:#fff; transform:translateY(-2px); background:rgba(255,255,255,0.04); }

  /* FOOTER */
  .ot-footer { background:var(--darker); border-top:1px solid var(--border); padding:40px 48px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:20px; }
  .ot-footer-logo { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:5px; color:#fff; }
  .ot-footer-logo em { color:var(--red); font-style:normal; }
  .ot-footer-copy { font-size:13px; color:rgba(255,255,255,0.5); }
  .ot-footer-contact { font-size:13px; color:rgba(255,255,255,0.5); display:flex; flex-wrap:wrap; gap:6px 16px; justify-content:center; }
  .ot-footer-contact a { color:rgba(255,255,255,0.7); text-decoration:none; transition:color 0.2s; }
  .ot-footer-contact a:hover { color:var(--red2); text-decoration:underline; }

  @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }

  /* NAV LINKS + MOBILE MENU */
  .ot-nav-links { display:flex; gap:2px; margin-right:8px; }
  .ot-nav-link { background:none; border:none; color:rgba(255,255,255,0.7); font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; padding:10px 14px; cursor:pointer; border-radius:8px; transition:color 0.2s, background 0.2s; }
  .ot-nav-link:hover { color:#fff; background:rgba(255,255,255,0.06); }
  .ot-burger { display:none; align-items:center; justify-content:center; width:44px; height:44px; background:transparent; border:1px solid var(--border); border-radius:8px; color:#fff; cursor:pointer; }
  .ot-drawer { position:fixed; top:68px; left:0; right:0; z-index:190; background:rgba(8,8,16,0.98); backdrop-filter:blur(20px); border-bottom:1px solid var(--border); padding:8px 20px 20px; display:flex; flex-direction:column; animation:fadeIn 0.2s ease; }
  .ot-drawer button { background:none; border:none; border-bottom:1px solid var(--border); color:rgba(255,255,255,0.85); font-family:'DM Sans',sans-serif; font-size:16px; font-weight:500; text-align:left; padding:16px 4px; min-height:52px; cursor:pointer; display:flex; align-items:center; gap:10px; }
  .ot-drawer button:last-child { border-bottom:none; }

  /* Anchored sections stop below the fixed nav */
  .ot-section, .ot-how, .ot-portfolio-wrap, .ot-reviews-wrap { scroll-margin-top:68px; }

  /* Keyboard focus + touch */
  .ot-root button:focus-visible,
  .ot-root a:focus-visible,
  .ot-root [role="button"]:focus-visible { outline:2px solid var(--red2); outline-offset:3px; }
  .ot-root button, .ot-root [role="button"] { touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
  .ot-svc-icon, .ot-proj-card, .ot-proj-hero { -webkit-tap-highlight-color:transparent; }

  @media (min-width:769px) { .ot-drawer { display:none; } }

  @media (prefers-reduced-motion: reduce) {
    .ot-root *, .ot-root *::before, .ot-root *::after { animation-duration:0.01ms !important; animation-iteration-count:1 !important; transition-duration:0.01ms !important; }
    .ot-svc, .ot-step { opacity:1; transform:none; }
  }

  /* RESPONSIVE */
  @media (max-width:900px) {
    .ot-proj-grid { grid-template-columns: repeat(2,1fr); }
    .ot-proj-hero-content { padding: 28px 28px; }
  }
  @media (max-width:768px) {
    .ot-nav { padding:0 20px; }
    .ot-hero { padding:120px 20px 100px; }
    .ot-stats { grid-template-columns:repeat(2,1fr); }
    .ot-stat:nth-child(2) { border-right:none; }
    .ot-section { padding:72px 20px; }
    .ot-services-grid { grid-template-columns:1fr; }
    .ot-how { padding:72px 20px; }
    .ot-steps { grid-template-columns:1fr; gap:28px; }
    .ot-steps::before { display:none; }
    .ot-cta-section { padding:80px 20px; }
    .ot-footer { padding:32px 20px; flex-direction:column; text-align:center; }
    .ot-portfolio-wrap { padding:72px 20px; }
    .ot-proj-grid { grid-template-columns:1fr; }
    .ot-proj-hero { min-height:360px; }
    .ot-proj-hero-title { font-size:36px; }
    .ot-modal-body { padding:24px 20px; }
    .ot-modal-gallery { grid-template-columns:repeat(2,1fr); }
    .ot-video-section { padding:72px 20px; }

    /* Nav: compact logo + one primary button + menu */
    .ot-logo { font-size:22px; letter-spacing:4px; }
    .ot-nav-right { gap:8px; }
    .ot-nav-links, .ot-hide-mobile { display:none; }
    .ot-burger { display:inline-flex; }
    .ot-btn-red { padding:9px 14px; font-size:13px; }

    /* Hero: title must fit a 360px screen, buttons full-width */
    .ot-hero-title { font-size:clamp(44px,15vw,100px); letter-spacing:3px; }
    .ot-hero-sub { margin:20px 0 36px; }
    .ot-hero-btns { flex-direction:column; align-items:stretch; width:100%; max-width:360px; }
    .ot-cta-main, .ot-cta-out { width:100%; justify-content:center; padding:16px 24px; }
    .ot-cta-btns { flex-direction:column; align-items:stretch; max-width:360px; margin:0 auto; }
    .ot-cta-main-lg, .ot-cta-out-lg { width:100%; justify-content:center; padding:16px 24px; }
    .ot-scroll-hint { display:none; }

    /* Stats */
    .ot-stat:nth-child(-n+2) { border-bottom:1px solid var(--border); }
    .ot-stat-num { font-size:36px; }
    .ot-stat-label { font-size:11px; }

    /* Content */
    .ot-svc { padding:24px; }
    .ot-svc-desc { font-size:14px; }
    .ot-step { flex-direction:row; align-items:flex-start; text-align:left; gap:16px; padding:0; }
    .ot-step-num { margin-bottom:0; flex-shrink:0; }
    .ot-step-title { font-size:15px; margin-bottom:4px; }
    .ot-step-desc { font-size:13px; }
    .ot-proj-hero-content { padding:24px 20px; }
    .ot-proj-card-tag, .ot-proj-hero-tag-pill { font-size:11px; }

    /* Project window fills the phone screen */
    .ot-modal-scroll { padding:0; }
    .ot-modal { border-radius:0; min-height:100%; }
    .ot-modal-desc { font-size:15px; }
    .ot-lightbox-nav { width:42px; height:42px; }
    .ot-lightbox-prev { left:10px; }
    .ot-lightbox-next { right:10px; }
    .ot-lightbox-close { top:14px; right:14px; }
    .ot-lightbox-img { max-width:100vw; border-radius:0; }
  }
`;

export default function HomePage() {
  const navigate      = useNavigate();
  const [scrolled,    setScrolled]    = useState(false);
  const [content,     setContent]     = useState(null);   // homepage content from API
  const [activeProj,  setActiveProj]  = useState(null);   // project modal
  const [lightbox,    setLightbox]    = useState({ open: false, images: [], idx: 0 });
  const [videoPlaying,setVideoPlaying]= useState(false);  // play embed on click
  const [menuOpen,    setMenuOpen]    = useState(false);  // mobile menu

  const svcRefs  = useRef([]);
  const stepRefs = useRef([]);
  const portfolioRef = useRef(null);
  const servicesRef  = useRef(null);
  const howRef       = useRef(null);
  const touchX       = useRef(null);
  const reviewsRef   = useRef(null);

  // Fetch dynamic content
  useEffect(() => {
    api.get('/homepage')
      .then(r => setContent(r.data.content))
      .catch(() => setContent({ portfolio: [], featuredVideo: { isActive: false } }));
  }, []);

  // Reviews the admin has chosen to feature — a separate, lightweight fetch
  // so a slow/failed reviews call never blocks the rest of the homepage.
  const [reviews, setReviews] = useState(null); // null = loading, [] = loaded-but-empty
  useEffect(() => {
    api.get('/homepage/reviews')
      .then(r => setReviews(r.data.reviews || []))
      .catch(() => setReviews([]));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    svcRefs.current.forEach(el => el && obs.observe(el));
    stepRefs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Keyboard: Esc closes lightbox / project / menu, arrows flip photos
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') {
        if (lightbox.open) { setLightbox(l => ({ ...l, open: false })); return; }
        if (activeProj)    { setActiveProj(null); return; }
        setMenuOpen(false);
      }
      if (lightbox.open && e.key === 'ArrowLeft')  setLightbox(l => ({ ...l, idx: (l.idx - 1 + l.images.length) % l.images.length }));
      if (lightbox.open && e.key === 'ArrowRight') setLightbox(l => ({ ...l, idx: (l.idx + 1) % l.images.length }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox.open, activeProj]);

  // Stop the page behind a project window / lightbox from scrolling
  useEffect(() => {
    document.body.style.overflow = (activeProj || lightbox.open) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [activeProj, lightbox.open]);

  // Close the mobile menu if the screen becomes wide
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const openLightbox  = (images, idx) => setLightbox({ open: true, images, idx });
  const closeLightbox = () => setLightbox(l => ({ ...l, open: false }));
  const lbPrev = () => setLightbox(l => ({ ...l, idx: (l.idx - 1 + l.images.length) % l.images.length }));
  const lbNext = () => setLightbox(l => ({ ...l, idx: (l.idx + 1) % l.images.length }));

  // Don't jump the page to the top when opening a project — the window sits on top of the page
  const openProject = (proj) => { setActiveProj(proj); setVideoPlaying(false); };

  const goTo = (ref) => { setMenuOpen(false); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // Makes a clickable div work with keyboard (Enter / Space) and screen readers
  const press = (fn) => ({
    role: 'button',
    tabIndex: 0,
    onClick: fn,
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } },
  });

  const onLbTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onLbTouchEnd   = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 50) { dx > 0 ? lbPrev() : lbNext(); }
  };

  // Sort + split portfolio
  const allProjects = (content?.portfolio || [])
    .filter(p => p.isActive)
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.order ?? 99) - (b.order ?? 99));
  const heroProject = allProjects[0] || null;
  const gridProjects = allProjects.slice(1);

  const video = content?.featuredVideo;
  const embedUrl = video?.isActive ? getEmbedUrl(video.url) : null;

  // Get YouTube thumbnail
  const getYTThumb = (url) => {
    const m = (url||'').match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg` : null;
  };

  return (
    <div className="ot-root">
      <style>{css}</style>
      <div className="ot-noise" />

      {/* NAV */}
      <nav className={`ot-nav${scrolled ? ' scrolled' : ''}`} aria-label="Main">
        <a href="/" className="ot-logo" onClick={e => { e.preventDefault(); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          ONE<em>TAKE</em>
        </a>
        <div className="ot-nav-right">
          <div className="ot-nav-links">
            <button className="ot-nav-link" onClick={() => goTo(servicesRef)}>Services</button>
            <button className="ot-nav-link" onClick={() => goTo(howRef)}>How it works</button>
            <button className="ot-nav-link" onClick={() => goTo(portfolioRef)}>Portfolio</button>
          </div>
          <button className="ot-btn-ghost ot-hide-mobile" onClick={() => navigate('/login')}>
            <IconSignIn /> Sign In
          </button>
          <button className="ot-btn-red" onClick={() => navigate('/client/inquiry')}>
            Get Started <IconArrow />
          </button>
          <button className="ot-burger" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="ot-drawer">
          <button onClick={() => goTo(servicesRef)}>Services</button>
          <button onClick={() => goTo(howRef)}>How it works</button>
          <button onClick={() => goTo(portfolioRef)}>Portfolio</button>
          <button onClick={() => { setMenuOpen(false); navigate('/login'); }}><IconSignIn /> Sign In</button>
        </div>
      )}

      {/* HERO */}
      <section className="ot-hero" style={{ maxWidth: '100%' }}>
        <div className="ot-hero-glow" />
        <div className="ot-hero-grid" />
        <div className="ot-eyebrow">
          <div className="ot-dot" /> OneTake — Client Portal
        </div>
        <h1 className="ot-hero-title">
          LIVE<span className="red">TAKE</span>
          <span className="ghost">PRODUCTIONS</span>
        </h1>
        <p className="ot-hero-sub">
          Your events, captured flawlessly. From inquiry to final delivery — every step managed in one place.
        </p>
        <div className="ot-hero-btns">
          <button className="ot-cta-main" onClick={() => navigate('/client/inquiry')}>
            Inquire About Your Event
            <span className="ot-arrow"><IconArrow /></span>
          </button>
          <button className="ot-cta-out" onClick={() => navigate('/login')}>
            <IconSignIn /> Sign In to Dashboard
          </button>
        </div>
        <div className="ot-scroll-hint">
          <div className="ot-scroll-line" /> Scroll
        </div>
      </section>

      {/* STATS */}
      <div className="ot-stats">
        {STATS.map(s => (
          <div className="ot-stat" key={s.label}>
            <div className="ot-stat-num"><Counter target={s.num} /></div>
            <div className="ot-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* SERVICES */}
      <div className="ot-section" id="services" ref={servicesRef}>
        <div className="ot-section-tag">What We Offer</div>
        <h2 className="ot-section-title">OUR SERVICES</h2>
        <p className="ot-section-body">
          Professional production services tailored for every type of event — from intimate celebrations to large-scale corporate broadcasts.
        </p>
        <div className="ot-services-grid">
          {SERVICES.map((svc, i) => (
            <div key={i} className="ot-svc" ref={el => svcRefs.current[i] = el} style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="ot-svc-icon">{svc.icon}</div>
              <div className="ot-svc-name">{svc.name}</div>
              <p className="ot-svc-desc">{svc.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="ot-how" id="how-it-works" ref={howRef}>
        <div className="ot-how-inner">
          <div className="ot-section-tag">The Process</div>
          <h2 className="ot-section-title">HOW IT WORKS</h2>
          <p className="ot-section-body">
            From your first inquiry to the final deliverable, Onetake manages every step of your project seamlessly.
          </p>
          <div className="ot-steps">
            {STEPS.map((step, i) => (
              <div key={i} className="ot-step" ref={el => stepRefs.current[i] = el} style={{ transitionDelay: `${i * 0.12}s` }}>
                <div className="ot-step-num">{step.n}</div>
                <div className="ot-step-text">
                  <div className="ot-step-title">{step.title}</div>
                  <p className="ot-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURED VIDEO (only if admin enabled it) ── */}
      {embedUrl && (
        <div className="ot-video-section">
          <div className="ot-video-glow" />
          <div className="ot-video-inner">
            <div className="ot-video-header">
              <div className="ot-section-tag" style={{ justifyContent: 'center', marginBottom: 16 }}>Featured</div>
              <h2 className="ot-section-title" style={{ textAlign: 'center' }}>{video.title || 'BEHIND THE LENS'}</h2>
              {video.subtitle && <p>{video.subtitle}</p>}
            </div>

            {/* If direct video (.mp4), use <video>. Otherwise embed iframe with thumbnail click. */}
            {isDirectVideo(video.url) ? (
              <div className="ot-video-frame">
                <video controls preload="metadata" style={{ width: '100%', aspectRatio: '16/9', display: 'block' }}>
                  <source src={video.url} />
                </video>
              </div>
            ) : videoPlaying ? (
              <div className="ot-video-frame">
                <iframe
                  src={`${embedUrl}&autoplay=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Featured Video"
                />
              </div>
            ) : (
              /* Thumbnail with play button — avoids auto-loading iframe */
              <div className="ot-video-thumb" aria-label="Play featured video" {...press(() => setVideoPlaying(true))}>
                {getYTThumb(video.url)
                  ? <img src={getYTThumb(video.url)} alt="Video thumbnail" />
                  : <div style={{ width:'100%', height:'100%', background:'#0a0a14' }} />}
                <div className="ot-thumb-overlay" />
                <div className="ot-play-btn"><IconPlay /></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PORTFOLIO ── */}
      <div className="ot-portfolio-wrap" id="portfolio" ref={portfolioRef}>
        <div className="ot-section-tag">Our Work</div>
        <h2 className="ot-section-title">PORTFOLIO</h2>
        <p className="ot-section-body">
          A showcase of events we've proudly produced — from corporate briefings to large-scale hybrid broadcasts.
        </p>

        {allProjects.length === 0 && (
          <div style={{ marginTop: 52, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '60px 0' }} aria-live="polite">
            {content === null ? 'Loading portfolio…' : 'Portfolio coming soon.'}
          </div>
        )}

        {/* ── Hero (first / featured) project ── */}
        {heroProject && (
          <div className="ot-proj-hero" aria-label={`View ${heroProject.title} gallery`} {...press(() => openProject(heroProject))}>
            {getCover(heroProject)
              ? <img className="ot-proj-hero-img" src={getCover(heroProject)} alt={heroProject.title} />
              : <div className="ot-hero-no-img" />}
            <div className="ot-proj-hero-overlay" />
            <div className="ot-proj-hero-content">
              <div className="ot-proj-hero-tag">{heroProject.client}</div>
              <h3 className="ot-proj-hero-title">{heroProject.title}</h3>
              {heroProject.tags?.length > 0 && (
                <div className="ot-proj-hero-tags">
                  {heroProject.tags.map((t, i) => <span key={i} className="ot-proj-hero-tag-pill">{t}</span>)}
                </div>
              )}
              {heroProject.description && (
                <p className="ot-proj-hero-desc">{heroProject.description}</p>
              )}
              <span className="ot-view-btn">
                View Gallery <IconArrow />
              </span>
            </div>
          </div>
        )}

        {/* ── Grid of remaining projects ── */}
        {gridProjects.length > 0 && (
          <div className="ot-proj-grid" style={{ marginTop: heroProject ? 20 : 52 }}>
            {gridProjects.map(proj => (
              <div key={proj._id} className="ot-proj-card" aria-label={`View ${proj.title} gallery`} {...press(() => openProject(proj))}>
                <div className="ot-proj-card-img">
                  {getCover(proj)
                    ? <>
                        <img src={getCover(proj)} alt={proj.title} loading="lazy" />
                        <div className="ot-proj-card-img-overlay">
                          <div className="ot-proj-card-hover-icon"><IconGrid /></div>
                        </div>
                      </>
                    : <div className="ot-proj-card-no-img">
                        <div className="ot-proj-empty-label">{proj.client?.[0] || '?'}</div>
                      </div>}
                </div>
                <div className="ot-proj-card-body">
                  <div className="ot-proj-card-client">{proj.client}</div>
                  <div className="ot-proj-card-title">{proj.title}</div>
                  {proj.tags?.length > 0 && (
                    <div className="ot-proj-card-tags">
                      {proj.tags.slice(0, 3).map((t, i) => <span key={i} className="ot-proj-card-tag">{t}</span>)}
                      {proj.tags.length > 3 && <span className="ot-proj-card-tag">+{proj.tags.length - 3}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── REVIEWS ── */}
      {reviews && reviews.length > 0 && (
        <div className="ot-reviews-wrap" id="reviews" ref={reviewsRef}>
          <div className="ot-section-tag">Client Feedback</div>
          <h2 className="ot-section-title">WHAT CLIENTS SAY</h2>
          <p className="ot-section-body">
            Real feedback from clients whose events we've had the privilege of covering.
          </p>

          <div className="ot-review-grid">
            {reviews.map(r => (
              <div key={r.id} className="ot-review-card">
                <div className="ot-review-stars" aria-label={`${r.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <svg key={n} viewBox="0 0 24 24" className="ot-review-star"
                      fill={n <= r.rating ? '#facc15' : 'none'} stroke={n <= r.rating ? '#facc15' : 'rgba(255,255,255,0.2)'} strokeWidth="1.5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                {r.comment && <p className="ot-review-comment">"{r.comment}"</p>}
                <div className="ot-review-author">
                  <span className="ot-review-name">{r.clientName}</span>
                  <span className="ot-review-meta">{r.eventCategory || r.eventName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROJECT MODAL ── */}
      {activeProj && (
        <div className="ot-modal-backdrop" role="dialog" aria-modal="true" aria-label={activeProj.title}>
          <button className="ot-modal-close" aria-label="Close" autoFocus onClick={() => setActiveProj(null)}><IconClose /></button>
          <div className="ot-modal-scroll" onClick={() => setActiveProj(null)}>
          <div className="ot-modal" onClick={e => e.stopPropagation()}>

            {/* Hero image */}
            {getCover(activeProj) && (
              <div className="ot-modal-hero">
                <img src={getCover(activeProj)} alt={activeProj.title} />
                <div className="ot-modal-hero-overlay" />
              </div>
            )}

            <div className="ot-modal-body">
              <div className="ot-modal-client">{activeProj.client}</div>
              <h2 className="ot-modal-title">{activeProj.title}</h2>
              {activeProj.tags?.length > 0 && (
                <div className="ot-modal-tags">
                  {activeProj.tags.map((t, i) => <span key={i} className="ot-modal-tag">{t}</span>)}
                </div>
              )}
              {activeProj.description && (
                <p className="ot-modal-desc">{activeProj.description}</p>
              )}

              {/* Gallery */}
              {activeProj.images?.length > 0 && (
                <>
                  <div className="ot-modal-gallery-label">Gallery · {activeProj.images.length} photo{activeProj.images.length !== 1 ? 's' : ''}</div>
                  <div className="ot-modal-gallery">
                    {activeProj.images.map((img, i) => (
                      <div key={i} className="ot-modal-gallery-item" aria-label={`Open photo ${i + 1}`}
                        {...press(() => openLightbox(activeProj.images.map(im => im.url), i))}>
                        <img src={img.url} alt={img.caption || `Photo ${i + 1}`} loading="lazy" />
                        <div className="ot-modal-gallery-item-overlay">
                          <svg width="20" height="20" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(!activeProj.images || activeProj.images.length === 0) && (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign:'center', padding:'24px 0' }}>
                  No gallery images for this project.
                </p>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox.open && (
        <div className="ot-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer"
          onClick={closeLightbox} onTouchStart={onLbTouchStart} onTouchEnd={onLbTouchEnd}>
          <button className="ot-lightbox-close" aria-label="Close photo" onClick={closeLightbox}>✕</button>
          {lightbox.images.length > 1 && (
            <button className="ot-lightbox-nav ot-lightbox-prev" aria-label="Previous photo" onClick={e => { e.stopPropagation(); lbPrev(); }}>‹</button>
          )}
          <img className="ot-lightbox-img" src={lightbox.images[lightbox.idx]} alt={`Photo ${lightbox.idx + 1} of ${lightbox.images.length}`} onClick={e => e.stopPropagation()} />
          {lightbox.images.length > 1 && (
            <button className="ot-lightbox-nav ot-lightbox-next" aria-label="Next photo" onClick={e => { e.stopPropagation(); lbNext(); }}>›</button>
          )}
          <div className="ot-lightbox-counter">{lightbox.idx + 1} / {lightbox.images.length}</div>
        </div>
      )}

      {/* BIG CTA */}
      <div className="ot-cta-section">
        <div className="ot-cta-glow" />
        <div className="ot-cta-inner">
          <div className="ot-section-tag" style={{ justifyContent:'center', marginBottom: 20 }}>Ready to Book?</div>
          <h2 className="ot-cta-title">LET'S MAKE YOUR<em>EVENT UNFORGETTABLE</em></h2>
          <p className="ot-cta-body">
            Join hundreds of clients who trust Livetake Productions to capture their most important moments.
            Your story deserves to be told right — in one take.
          </p>
          <div className="ot-cta-btns">
            <button className="ot-cta-main-lg" onClick={() => navigate('/client/inquiry')}>
              Submit an Inquiry <span className="ot-arrow"><IconArrow /></span>
            </button>
            <button className="ot-cta-out-lg" onClick={() => navigate('/login')}>
              Existing Client? Sign In
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="ot-footer">
        <div className="ot-footer-logo">ONE<em>TAKE</em></div>
        <div className="ot-footer-copy">© 2026 Livetake Productions · Dasmariñas, Cavite</div>
        <div className="ot-footer-contact">
          <a href="tel:+639068642868">09XXXXXXXX</a>
          <a href="mailto:livetakeproductions@gmail.com">livetakeproductions@gmail.com</a>
        </div>
      </footer>
    </div>
  );
}