import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ── Static Data ───────────────────────────────────────────────────────────────
const SERVICES = [
  {
    name: 'Multi-Camera Live Event Coverage & Livestreaming',
    desc: 'Professional multi-camera setup with real-time streaming. Includes Technical Director, Sony broadcast camcorders, HD production switcher, and hybrid speaker integration.',
  },
  {
    name: 'Events Digital Documentation',
    desc: 'Full photo and video coverage with Same-Day Edit (SDE) video. Two photographers, two videographers, plus drone footage for complete event coverage.',
  },
  {
    name: 'Wedding, Debut & Birthday Photo/Video with Livestream',
    desc: 'Comprehensive photography and videography for weddings, debuts, and birthdays — with live streaming included as standard.',
  },
  {
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
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?color=d13652&title=0&byline=0`;
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
const IconChevL  = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>;
const IconChevR  = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>;
const IconSignIn = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>;
const IconPlay   = () => <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;
const IconClose  = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>;
const IconMenu   = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>;

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap');

  .ot-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .ot-root {
    --accent:#d13652; --accent-hover:#b92c46; --accent-text:#f47a8e;
    --bg:#0e0f12; --surface:#15171b; --line:rgba(255,255,255,0.1);
    --muted:rgba(255,255,255,0.68); --faint:rgba(255,255,255,0.5);
    --gutter:max(48px, calc((100% - 1104px) / 2));
    background:var(--bg); color:#fff; font-family:'Schibsted Grotesk',system-ui,sans-serif;
    overflow-x:hidden; -webkit-font-smoothing:antialiased;
  }

  /* NAV */
  .ot-nav { position:fixed; top:0; left:0; right:0; z-index:200; display:flex; align-items:center; justify-content:space-between; padding:0 var(--gutter); height:68px; background:transparent; border-bottom:1px solid transparent; transition:background .25s, border-color .25s; }
  .ot-nav.scrolled { background:rgba(14,15,18,0.94); border-bottom-color:var(--line); backdrop-filter:blur(12px); }
  .ot-logo { font-weight:700; font-size:20px; letter-spacing:0.14em; color:#fff; text-decoration:none; }
  .ot-logo em { color:var(--accent-text); font-style:normal; }
  .ot-nav-right { display:flex; align-items:center; gap:10px; }
  .ot-nav-links { display:flex; gap:2px; margin-right:8px; }
  .ot-nav-link { background:none; border:none; color:rgba(255,255,255,0.78); font-family:inherit; font-size:14px; font-weight:500; padding:10px 14px; cursor:pointer; border-radius:6px; transition:color .2s; }
  .ot-nav-link:hover { color:#fff; }
  .ot-btn-ghost, .ot-btn-red { font-family:inherit; font-size:14px; font-weight:600; padding:10px 20px; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; transition:background .2s, border-color .2s; }
  .ot-btn-ghost { background:transparent; border:1px solid rgba(255,255,255,0.28); color:#fff; }
  .ot-btn-ghost:hover { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.5); }
  .ot-btn-red { background:var(--accent); border:1px solid var(--accent); color:#fff; }
  .ot-btn-red:hover { background:var(--accent-hover); border-color:var(--accent-hover); }
  .ot-lg { padding:14px 28px; font-size:15px; }
  .ot-burger { display:none; align-items:center; justify-content:center; width:44px; height:44px; background:transparent; border:1px solid var(--line); border-radius:6px; color:#fff; cursor:pointer; }
  .ot-drawer { position:fixed; top:68px; left:0; right:0; z-index:190; background:rgba(14,15,18,0.98); border-bottom:1px solid var(--line); padding:8px 20px 20px; display:flex; flex-direction:column; animation:fadeIn .2s ease; }
  .ot-drawer button { background:none; border:none; border-bottom:1px solid var(--line); color:rgba(255,255,255,0.88); font-family:inherit; font-size:16px; font-weight:500; text-align:left; padding:16px 4px; min-height:52px; cursor:pointer; display:flex; align-items:center; gap:10px; }
  .ot-drawer button:last-child { border-bottom:none; }

  /* HERO */
  .ot-hero { position:relative; min-height:88vh; min-height:88svh; display:flex; align-items:flex-end; padding:140px var(--gutter) 80px; overflow:hidden; background:var(--surface); }
  .ot-hero-media { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .ot-hero-shade { position:absolute; inset:0; background:linear-gradient(to top, rgba(14,15,18,0.96) 0%, rgba(14,15,18,0.72) 45%, rgba(14,15,18,0.5) 100%); }
  .ot-hero-inner { position:relative; z-index:2; width:100%; animation:fadeUp .7s ease both; }
  .ot-hero-title { font-weight:700; font-size:clamp(44px,7.5vw,92px); letter-spacing:-0.035em; line-height:1; margin-bottom:24px; }
  .ot-hero-sub { font-size:clamp(17px,1.6vw,20px); line-height:1.6; color:var(--muted); max-width:560px; margin-bottom:36px; }
  .ot-hero-btns, .ot-cta-btns { display:flex; gap:12px; flex-wrap:wrap; }

  /* STATS */
  .ot-stats-wrap { border-bottom:1px solid var(--line); }
  .ot-stats { display:grid; grid-template-columns:repeat(4,1fr); max-width:1200px; margin:0 auto; padding:0 48px; }
  .ot-stat { padding:28px 24px; border-left:1px solid var(--line); }
  .ot-stat:first-child { border-left:none; padding-left:0; }
  .ot-stat-num { font-size:40px; font-weight:600; letter-spacing:-0.02em; line-height:1; }
  .ot-stat-label { font-size:14px; color:var(--muted); margin-top:8px; }

  /* SECTIONS */
  .ot-section, .ot-portfolio-wrap, .ot-reviews-wrap { padding:96px 48px; max-width:1200px; margin:0 auto; }
  .ot-section, .ot-how, .ot-portfolio-wrap, .ot-reviews-wrap { scroll-margin-top:68px; }
  .ot-section-title { font-size:clamp(30px,3.6vw,44px); font-weight:700; letter-spacing:-0.025em; line-height:1.1; margin-bottom:14px; }
  .ot-section-body { font-size:16px; line-height:1.65; color:var(--muted); max-width:560px; }

  /* SERVICES */
  .ot-services-grid { margin-top:48px; border-bottom:1px solid var(--line); }
  .ot-svc { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,6fr); gap:40px; padding:32px 0; border-top:1px solid var(--line); }
  .ot-svc-name { font-size:20px; font-weight:600; line-height:1.3; letter-spacing:-0.01em; }
  .ot-svc-desc { font-size:15px; line-height:1.7; color:var(--muted); }

  /* HOW IT WORKS */
  .ot-how { padding:96px var(--gutter); background:var(--surface); border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
  .ot-steps { list-style:none; display:grid; grid-template-columns:repeat(5,1fr); gap:28px; margin-top:48px; }
  .ot-step { border-top:2px solid var(--line); padding-top:18px; }
  .ot-step-num { font-size:14px; font-weight:600; color:var(--accent-text); margin-bottom:14px; font-variant-numeric:tabular-nums; }
  .ot-step-title { font-size:16px; font-weight:600; margin-bottom:8px; }
  .ot-step-desc { font-size:14px; line-height:1.65; color:var(--muted); }

  /* FEATURED VIDEO */
  .ot-video-section { padding:96px var(--gutter); border-bottom:1px solid var(--line); }
  .ot-video-header { margin-bottom:32px; }
  .ot-video-header p { color:var(--muted); font-size:16px; line-height:1.6; margin-top:6px; }
  .ot-video-frame, .ot-video-thumb { position:relative; border-radius:6px; overflow:hidden; border:1px solid var(--line); background:#000; }
  .ot-video-frame iframe, .ot-video-frame video { display:block; width:100%; aspect-ratio:16/9; border:none; }
  .ot-video-thumb { cursor:pointer; aspect-ratio:16/9; }
  .ot-video-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .ot-thumb-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.25); }
  .ot-play-btn { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:72px; height:72px; border-radius:50%; background:#fff; color:#111; display:flex; align-items:center; justify-content:center; transition:transform .2s; }
  .ot-play-btn svg { margin-left:3px; }
  .ot-video-thumb:hover .ot-play-btn { transform:translate(-50%,-50%) scale(1.06); }

  /* PORTFOLIO */
  .ot-proj-hero { position:relative; border-radius:6px; overflow:hidden; margin-top:48px; cursor:pointer; min-height:480px; display:flex; align-items:flex-end; border:1px solid var(--line); background:var(--surface); }
  .ot-proj-hero-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform .6s ease; }
  .ot-proj-hero:hover .ot-proj-hero-img { transform:scale(1.02); }
  .ot-proj-hero-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.1) 100%); }
  .ot-hero-no-img { position:absolute; inset:0; background:var(--surface); }
  .ot-proj-hero-content { position:relative; z-index:2; padding:40px 44px; width:100%; }
  .ot-proj-hero-tag { font-size:14px; font-weight:500; color:rgba(255,255,255,0.75); margin-bottom:8px; }
  .ot-proj-hero-title { font-size:clamp(30px,4vw,48px); font-weight:700; letter-spacing:-0.025em; line-height:1.05; margin-bottom:16px; }
  .ot-proj-hero-tags, .ot-proj-card-tags, .ot-modal-tags { display:flex; flex-wrap:wrap; gap:6px; }
  .ot-proj-hero-tags { margin-bottom:18px; }
  .ot-proj-hero-tag-pill, .ot-proj-card-tag, .ot-modal-tag { padding:3px 10px; border:1px solid rgba(255,255,255,0.22); border-radius:4px; font-size:12px; font-weight:500; color:rgba(255,255,255,0.78); }
  .ot-proj-hero-desc { font-size:15px; line-height:1.65; color:rgba(255,255,255,0.72); max-width:580px; margin-bottom:24px; }
  .ot-view-btn { display:inline-flex; align-items:center; padding:10px 20px; background:#fff; color:#111; border-radius:6px; font-size:14px; font-weight:600; transition:background .2s; }
  .ot-proj-hero:hover .ot-view-btn { background:#e4e4e4; }
  .ot-proj-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-top:20px; }
  .ot-proj-card { border-radius:6px; overflow:hidden; border:1px solid var(--line); background:var(--surface); cursor:pointer; display:flex; flex-direction:column; transition:border-color .2s; }
  .ot-proj-card:hover { border-color:rgba(255,255,255,0.3); }
  .ot-proj-card-img { position:relative; aspect-ratio:4/3; overflow:hidden; background:#0a0a0c; }
  .ot-proj-card-img img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .4s ease; }
  .ot-proj-card:hover .ot-proj-card-img img { transform:scale(1.03); }
  .ot-proj-card-no-img { width:100%; height:100%; aspect-ratio:4/3; display:flex; align-items:center; justify-content:center; background:var(--surface); }
  .ot-proj-empty-label { font-size:40px; font-weight:700; color:rgba(255,255,255,0.1); }
  .ot-proj-card-body { padding:18px 20px 20px; flex:1; }
  .ot-proj-card-client { font-size:13px; color:var(--faint); margin-bottom:4px; }
  .ot-proj-card-title { font-size:19px; font-weight:600; letter-spacing:-0.01em; line-height:1.25; margin-bottom:12px; }

  /* REVIEWS */
  .ot-review-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-top:48px; }
  .ot-review-card { background:var(--surface); border:1px solid var(--line); border-radius:6px; padding:24px; display:flex; flex-direction:column; gap:14px; }
  .ot-review-stars { display:flex; gap:3px; }
  .ot-review-star { width:16px; height:16px; }
  .ot-review-comment { font-size:15px; line-height:1.65; color:var(--muted); flex:1; }
  .ot-review-author { display:flex; flex-direction:column; gap:2px; padding-top:14px; border-top:1px solid var(--line); }
  .ot-review-name { font-weight:600; font-size:15px; }
  .ot-review-meta { font-size:13px; color:var(--faint); }

  /* PROJECT MODAL */
  .ot-modal-backdrop { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,0.88); animation:fadeIn .2s ease; }
  .ot-modal-scroll { position:absolute; inset:0; overflow-y:auto; display:flex; align-items:flex-start; justify-content:center; padding:40px 20px; overscroll-behavior:contain; }
  .ot-modal { background:var(--surface); border:1px solid var(--line); border-radius:8px; width:100%; max-width:880px; overflow:hidden; position:relative; animation:slideUp .25s ease; }
  .ot-modal-close { position:absolute; top:16px; right:16px; z-index:20; width:44px; height:44px; background:rgba(0,0,0,0.7); border:1px solid rgba(255,255,255,0.15); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; cursor:pointer; transition:background .2s; }
  .ot-modal-close:hover { background:var(--accent); }
  .ot-modal-hero { position:relative; aspect-ratio:16/7; overflow:hidden; background:#0a0a0c; }
  .ot-modal-hero img { width:100%; height:100%; object-fit:cover; display:block; }
  .ot-modal-hero-overlay { position:absolute; inset:0; background:linear-gradient(to top, var(--surface) 0%, transparent 40%); }
  .ot-modal-body { padding:32px 40px; }
  .ot-modal-client { font-size:14px; color:var(--faint); margin-bottom:6px; }
  .ot-modal-title { font-size:clamp(28px,3.5vw,40px); font-weight:700; letter-spacing:-0.025em; line-height:1.1; margin-bottom:16px; }
  .ot-modal-tags { margin-bottom:20px; }
  .ot-modal-desc { font-size:15px; line-height:1.7; color:var(--muted); margin-bottom:32px; }
  .ot-modal-gallery-label { font-size:14px; font-weight:600; color:var(--muted); margin-bottom:14px; }
  .ot-modal-gallery { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .ot-modal-gallery-item { aspect-ratio:4/3; overflow:hidden; border-radius:4px; cursor:pointer; position:relative; background:#0a0a0c; }
  .ot-modal-gallery-item img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .3s ease; }
  .ot-modal-gallery-item:hover img { transform:scale(1.04); }
  .ot-modal-gallery-item-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.3); opacity:0; transition:opacity .2s; display:flex; align-items:center; justify-content:center; }
  .ot-modal-gallery-item:hover .ot-modal-gallery-item-overlay { opacity:1; }

  /* LIGHTBOX */
  .ot-lightbox { position:fixed; inset:0; z-index:2000; background:rgba(0,0,0,0.95); display:flex; align-items:center; justify-content:center; animation:fadeIn .2s ease; }
  .ot-lightbox-img { max-width:90vw; max-height:88vh; border-radius:4px; object-fit:contain; }
  .ot-lightbox-close, .ot-lightbox-nav { position:absolute; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.18); color:#fff; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .2s; }
  .ot-lightbox-close { top:24px; right:28px; width:44px; height:44px; }
  .ot-lightbox-nav { top:50%; transform:translateY(-50%); width:50px; height:50px; }
  .ot-lightbox-close:hover, .ot-lightbox-nav:hover { background:rgba(255,255,255,0.22); }
  .ot-lightbox-prev { left:24px; }
  .ot-lightbox-next { right:24px; }
  .ot-lightbox-counter { position:absolute; bottom:24px; left:50%; transform:translateX(-50%); font-size:13px; color:rgba(255,255,255,0.6); }

  /* CTA + FOOTER */
  .ot-cta-section { padding:96px var(--gutter); border-top:1px solid var(--line); }
  .ot-cta-title { font-size:clamp(34px,5vw,60px); font-weight:700; letter-spacing:-0.03em; line-height:1.05; margin-bottom:16px; max-width:720px; }
  .ot-cta-body { font-size:17px; line-height:1.6; color:var(--muted); max-width:520px; margin-bottom:32px; }
  .ot-footer { border-top:1px solid var(--line); padding:32px var(--gutter); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }
  .ot-footer-logo { font-weight:700; font-size:16px; letter-spacing:0.14em; }
  .ot-footer-logo em { color:var(--accent-text); font-style:normal; }
  .ot-footer-copy { font-size:13px; color:var(--faint); }
  .ot-footer-contact { font-size:13px; display:flex; flex-wrap:wrap; gap:6px 20px; }
  .ot-footer-contact a { color:var(--muted); text-decoration:none; transition:color .2s; }
  .ot-footer-contact a:hover { color:#fff; text-decoration:underline; }

  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }

  /* Focus + touch */
  .ot-root button:focus-visible, .ot-root a:focus-visible, .ot-root [role="button"]:focus-visible { outline:2px solid var(--accent-text); outline-offset:3px; }
  .ot-root button, .ot-root [role="button"] { touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
  @media (min-width:769px) { .ot-drawer { display:none; } }
  @media (prefers-reduced-motion: reduce) {
    .ot-root *, .ot-root *::before, .ot-root *::after { animation-duration:0.01ms !important; animation-iteration-count:1 !important; transition-duration:0.01ms !important; }
  }

  /* RESPONSIVE */
  @media (max-width:900px) {
    .ot-proj-grid { grid-template-columns:repeat(2,1fr); }
    .ot-steps { grid-template-columns:repeat(2,1fr); }
    .ot-svc { grid-template-columns:1fr; gap:12px; }
    .ot-proj-hero-content { padding:28px; }
  }
  @media (max-width:768px) {
    .ot-root { --gutter:20px; }
    .ot-logo { font-size:17px; }
    .ot-nav-right { gap:8px; }
    .ot-nav-links, .ot-hide-mobile { display:none; }
    .ot-burger { display:inline-flex; }
    .ot-nav .ot-btn-red { padding:9px 14px; font-size:13px; }
    .ot-hero { min-height:80svh; padding:110px var(--gutter) 56px; }
    .ot-hero-btns, .ot-cta-btns { flex-direction:column; align-items:stretch; max-width:360px; }
    .ot-stats { grid-template-columns:repeat(2,1fr); padding:0 20px; }
    .ot-stat { padding:20px 16px; }
    .ot-stat:nth-child(odd) { border-left:none; padding-left:0; }
    .ot-stat:nth-child(-n+2) { border-bottom:1px solid var(--line); }
    .ot-stat-num { font-size:32px; }
    .ot-section, .ot-portfolio-wrap, .ot-reviews-wrap { padding:64px 20px; }
    .ot-how, .ot-video-section, .ot-cta-section { padding-top:64px; padding-bottom:64px; }
    .ot-steps { grid-template-columns:1fr; gap:0; }
    .ot-step { padding:18px 0 22px; }
    .ot-proj-grid { grid-template-columns:1fr; }
    .ot-proj-hero { min-height:360px; }
    .ot-proj-hero-content { padding:24px 20px; }
    .ot-modal-scroll { padding:0; }
    .ot-modal { border-radius:0; min-height:100%; }
    .ot-modal-body { padding:24px 20px; }
    .ot-modal-gallery { grid-template-columns:repeat(2,1fr); }
    .ot-footer { flex-direction:column; align-items:flex-start; }
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
  // Hero backdrop: a cover photo from the portfolio (none = plain dark hero)
  const heroBg = [...allProjects].reverse().map(getCover).find(Boolean) || null;

  // Get YouTube thumbnail
  const getYTThumb = (url) => {
    const m = (url||'').match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg` : null;
  };

  return (
    <div className="ot-root">
      <style>{css}</style>

      {/* NAV */}
      <nav className={`ot-nav${scrolled ? ' scrolled' : ''}`} aria-label="Main">
        <a href="/" className="ot-logo" onClick={e => { e.preventDefault(); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          ONE<em>TAKE</em>
        </a>
        <div className="ot-nav-right">
          <div className="ot-nav-links">
            <button className="ot-nav-link" onClick={() => goTo(portfolioRef)}>Portfolio</button>
            <button className="ot-nav-link" onClick={() => goTo(servicesRef)}>Services</button>
            <button className="ot-nav-link" onClick={() => goTo(howRef)}>How it works</button>
          </div>
          <button className="ot-btn-ghost ot-hide-mobile" onClick={() => navigate('/login')}>
            <IconSignIn /> Sign in
          </button>
          <button className="ot-btn-red" onClick={() => navigate('/client/inquiry')}>
            Send an inquiry
          </button>
          <button className="ot-burger" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="ot-drawer">
          <button onClick={() => goTo(portfolioRef)}>Portfolio</button>
          <button onClick={() => goTo(servicesRef)}>Services</button>
          <button onClick={() => goTo(howRef)}>How it works</button>
          <button onClick={() => { setMenuOpen(false); navigate('/login'); }}><IconSignIn /> Sign in</button>
        </div>
      )}

      {/* HERO */}
      <section className="ot-hero">
        {heroBg && <img className="ot-hero-media" src={heroBg} alt="" />}
        <div className="ot-hero-shade" />
        <div className="ot-hero-inner">
          <h1 className="ot-hero-title">Livetake Productions</h1>
          <p className="ot-hero-sub">
            Multi-camera event coverage, photo and video documentation, and livestreaming. Send an inquiry and follow your booking from quotation to final delivery in one place.
          </p>
          <div className="ot-hero-btns">
            <button className="ot-btn-red ot-lg" onClick={() => navigate('/client/inquiry')}>Send an inquiry</button>
            <button className="ot-btn-ghost ot-lg" onClick={() => goTo(portfolioRef)}>See our work</button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="ot-stats-wrap">
        <div className="ot-stats">
          {STATS.map(s => (
            <div className="ot-stat" key={s.label}>
              <div className="ot-stat-num"><Counter target={s.num} /></div>
              <div className="ot-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURED VIDEO (only if admin enabled it) ── */}
      {embedUrl && (
        <div className="ot-video-section">
          <div className="ot-video-inner">
            <div className="ot-video-header">
              <h2 className="ot-section-title">{video.title || 'Behind the lens'}</h2>
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
        <h2 className="ot-section-title">Portfolio</h2>
        <p className="ot-section-body">
          Recent events we've produced, from corporate briefings to large hybrid broadcasts.
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
                View gallery
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
                    ? <img src={getCover(proj)} alt={proj.title} loading="lazy" />
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

      {/* SERVICES */}
      <div className="ot-section" id="services" ref={servicesRef}>
        <h2 className="ot-section-title">Services</h2>
        <p className="ot-section-body">
          Coverage for every kind of event, from private celebrations to corporate broadcasts.
        </p>
        <div className="ot-services-grid">
          {SERVICES.map((svc, i) => (
            <div key={i} className="ot-svc">
              <h3 className="ot-svc-name">{svc.name}</h3>
              <p className="ot-svc-desc">{svc.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="ot-how" id="how-it-works" ref={howRef}>
        <h2 className="ot-section-title">How it works</h2>
        <p className="ot-section-body">
          Five steps from your first inquiry to the finished content.
        </p>
        <ol className="ot-steps">
          {STEPS.map((step, i) => (
            <li key={i} className="ot-step">
              <div className="ot-step-num">{step.n}</div>
              <div className="ot-step-title">{step.title}</div>
              <p className="ot-step-desc">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* ── REVIEWS ── */}
      {reviews && reviews.length > 0 && (
        <div className="ot-reviews-wrap" id="reviews" ref={reviewsRef}>
          <h2 className="ot-section-title">What clients say</h2>
          <p className="ot-section-body">
            Feedback from clients whose events we've covered.
          </p>

          <div className="ot-review-grid">
            {reviews.map(r => (
              <div key={r.id} className="ot-review-card">
                <div className="ot-review-stars" aria-label={`${r.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <svg key={n} viewBox="0 0 24 24" className="ot-review-star"
                      fill={n <= r.rating ? '#e0a93b' : 'none'} stroke={n <= r.rating ? '#e0a93b' : 'rgba(255,255,255,0.2)'} strokeWidth="1.5">
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
                  <div className="ot-modal-gallery-label">Gallery ({activeProj.images.length})</div>
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
          <button className="ot-lightbox-close" aria-label="Close photo" onClick={closeLightbox}><IconClose /></button>
          {lightbox.images.length > 1 && (
            <button className="ot-lightbox-nav ot-lightbox-prev" aria-label="Previous photo" onClick={e => { e.stopPropagation(); lbPrev(); }}><IconChevL /></button>
          )}
          <img className="ot-lightbox-img" src={lightbox.images[lightbox.idx]} alt={`Photo ${lightbox.idx + 1} of ${lightbox.images.length}`} onClick={e => e.stopPropagation()} />
          {lightbox.images.length > 1 && (
            <button className="ot-lightbox-nav ot-lightbox-next" aria-label="Next photo" onClick={e => { e.stopPropagation(); lbNext(); }}><IconChevR /></button>
          )}
          <div className="ot-lightbox-counter">{lightbox.idx + 1} / {lightbox.images.length}</div>
        </div>
      )}

      {/* CTA */}
      <div className="ot-cta-section">
        <h2 className="ot-cta-title">Tell us about your event</h2>
        <p className="ot-cta-body">
          Share the date, venue, and what you need covered. We'll follow up with a custom quotation.
        </p>
        <div className="ot-cta-btns">
          <button className="ot-btn-red ot-lg" onClick={() => navigate('/client/inquiry')}>Send an inquiry</button>
          <button className="ot-btn-ghost ot-lg" onClick={() => navigate('/login')}>Sign in</button>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="ot-footer">
        <div className="ot-footer-logo">ONE<em>TAKE</em></div>
        <div className="ot-footer-copy">© 2026 Livetake Productions, Dasmariñas, Cavite</div>
        <div className="ot-footer-contact">
          <a href="tel:+639068642868">09XXXXXXXX</a>
          <a href="mailto:livetakeproductions@gmail.com">livetakeproductions@gmail.com</a>
        </div>
      </footer>
    </div>
  );
}