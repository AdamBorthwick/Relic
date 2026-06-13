// STUB — Collectible Creator: a 3-step wizard.
//   1) Photo & shape   2) Text (multiple, draggable)   3) Finish & background
const { useState: useCr, useRef: useCrRef } = React;

const TEXT_COLORS = ['#ffffff', '#161616', '#c6f24e', '#ff6f61', '#b18cff', '#f6c945', '#57d7e6'];
const ALIGNS = [['left', 'text--align--left'], ['center', 'text--align--center'], ['right', 'text--align--right']];
const SIZES = [['XS', 10], ['S', 16], ['M', 28], ['L', 44]];
const STYLES = [['regular', 'Aa'], ['bold', 'Aa'], ['italic', 'Aa']];
let TID = 1;

const SB_URL = 'https://fskmmrthlhjvzbwglifs.supabase.co';
const SB_KEY = 'sb_publishable_23ideF1MrI-o02YRYyjSCA_T-GOxPZe';
const SB_H   = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

async function compressPhoto(src, preserveAlpha = false) {
  if (!src || !src.startsWith('data:')) return src;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      const sc = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(preserveAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
async function saveCard(state) {
  const r = await fetch(SB_URL + '/rest/v1/cards', {
    method: 'POST', headers: { ...SB_H, Prefer: 'return=representation' },
    body: JSON.stringify({ data: state }),
  });
  if (!r.ok) throw new Error('save failed');
  const [row] = await r.json();
  return row.code;
}
async function loadCard(code) {
  const r = await fetch(SB_URL + '/rest/v1/cards?code=eq.' + encodeURIComponent(code) + '&select=data&limit=1', { headers: SB_H });
  if (!r.ok) throw new Error('load failed');
  const rows = await r.json();
  if (!rows.length) throw new Error('not found');
  return rows[0].data;
}
async function uploadPreview(blob, code) {
  const jpegBlob = await new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(blob);
    img.onerror = reject;
    img.onload = () => {
      const W = 630, H = Math.round(img.height * W / img.width);
      const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
      cv.getContext('2d').drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(src);
      cv.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/jpeg', 0.88);
    };
    img.src = src;
  });
  const buf = await jpegBlob.arrayBuffer();
  const res = await fetch(`${SB_URL}/storage/v1/object/previews/${code}.jpg`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload ${res.status}: ${text}`);
  }
}

// Dynamic card dimensions — scale down on short/narrow viewports so nothing scrolls.
// Reserves chrome height: header (66px) + controls (140px) + padding (60px).
function useCardSize(reserve) {
  const calc = () => calcSize(reserve);
  const [size, setSize] = useCr(calc);
  React.useEffect(() => {
    const h = () => setSize(calc());
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return size;
}
function calcSize(reserve) {
  // On mobile reserve more for the compact panel (header ~62 + panel ~160 + padding ~30)
  const r = reserve != null ? reserve : (window.innerWidth < 600 ? 290 : 266);
  const maxH = Math.max(200, Math.min(404, window.innerHeight - r));
  const maxW = Math.max(144, Math.min(290, Math.round(maxH * 0.725)));
  return { maxW, maxH };
}

function RelicTitle() {
  const [active, setActive] = React.useState({});
  const [starActive, setStarActive] = React.useState(false);
  const letters = ['R', 'e', 'l', 'i', 'c'];
  const on  = (i) => setActive(a => ({ ...a, [i]: true }));
  const off = (i) => setActive(a => ({ ...a, [i]: false }));
  const anyLetterActive = Object.values(active).some(Boolean);
  const starLit = starActive || anyLetterActive;
  return (
    <span className="landing__title" aria-label="Relic">
      <span className="landing__title-star" aria-hidden="true"
        onMouseEnter={() => setStarActive(true)}
        onMouseLeave={() => setStarActive(false)}
        onTouchStart={(e) => { e.preventDefault(); setStarActive(true); }}
        onTouchEnd={() => setStarActive(false)}
      >
        <svg viewBox="0 0 24 32" fill="currentColor" style={{
          color: starLit ? 'var(--accent)' : 'var(--text)',
          transform: starLit ? 'rotate(22deg) scale(1.15)' : 'rotate(0deg) scale(1)',
          transition: starLit ? 'color .1s ease, transform .1s ease' : 'color .8s ease, transform .55s ease',
        }}>
          <path d="M12 0 L14.8 12.4 L24 16 L14.8 19.6 L12 32 L9.2 19.6 L0 16 L9.2 12.4 Z"/>
        </svg>
      </span>
      {letters.map((ch, i) => (
        <span key={i} className="landing__title-letter"
          onMouseEnter={() => on(i)}
          onMouseLeave={() => off(i)}
          onMouseDown={() => on(i)}
          onMouseUp={() => off(i)}
          onTouchStart={(e) => { e.preventDefault(); on(i); }}
          onTouchEnd={() => off(i)}
        >
          <span className="landing__title-letter__sizer" aria-hidden="true">{ch}</span>
          <span className="landing__title-letter__text" style={{
            fontVariationSettings: `'wght' ${(active[i] || starActive) ? 800 : 400}`,
            color: (active[i] || starActive) ? 'var(--accent)' : 'var(--text)',
            transition: (active[i] || starActive)
              ? 'font-variation-settings .1s ease, color .1s ease'
              : 'font-variation-settings .55s ease, color .8s ease',
          }}>{ch}</span>
        </span>
      ))}
    </span>
  );
}

function StepDots({ step }) {
  return <div className="wiz__dots">{[1, 2, 3].map(n => <span key={n} className={'dot3' + (n === step ? ' is-on' : '')}></span>)}</div>;
}

// Horizontal drag-to-pan scroller (works with mouse + touch; still allows button taps)
// Pan the WHOLE bar: it's wider than the screen and translates left/right as
// one unit (its ends slide off-screen). Drag works anywhere, incl. on buttons.
function PanBar({ children }) {
  const wrapRef = useCrRef(null);
  const railRef = useCrRef(null);
  const tx = useCrRef(0);
  const st = useCrRef({ down: false, moved: false, x: 0, tx: 0 });
  const pt = (e) => (e.touches ? e.touches[0] : e);

  const clampTx = (v) => {
    const wrap = wrapRef.current, rail = railRef.current;
    if (!wrap || !rail) return v;
    const preview = wrap.closest('.wiz__preview');
    const trackW = (preview ? preview.clientWidth : window.innerWidth) - 14 - 14; // left + right margins
    const min = Math.min(0, trackW - rail.offsetWidth);
    return Math.max(min, Math.min(0, v));
  };
  const apply = () => { if (railRef.current) railRef.current.style.transform = `translateX(${tx.current}px)`; };

  const onDown = (e) => {
    st.current = { down: true, moved: false, x: pt(e).clientX, tx: tx.current };
    const move = (ev) => {
      if (!st.current.down) return;
      const dx = pt(ev).clientX - st.current.x;
      if (Math.abs(dx) > 3) st.current.moved = true;
      tx.current = clampTx(st.current.tx + dx);
      apply();
      if (ev.cancelable && st.current.moved) ev.preventDefault();
    };
    const up = () => {
      st.current.down = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  };
  const onClickCapture = (e) => { if (st.current.moved) { e.preventDefault(); e.stopPropagation(); st.current.moved = false; } };

  return (
    <div className="tool-bar" ref={wrapRef}>
      <div className="tool-bar__rail" ref={railRef} onMouseDown={onDown} onTouchStart={onDown} onClickCapture={onClickCapture}>
        {children}
      </div>
    </div>
  );
}

// Consistent wizard nav: equal side slots so the title is truly centered
function WizBar({ title, step, onBack, action }) {
  return (
    <div className="wiz__bar">
      <div className="wiz__slot wiz__slot--l">
        {onBack && <button className="topbar__back" onClick={onBack} aria-label="Back"><Icon name="arrow--left" /></button>}
      </div>
      <div className="wiz__head">
        <span className="wiz__title">{title}</span>
        {step ? <StepDots step={step} /> : null}
      </div>
      <div className="wiz__slot wiz__slot--r">{action}</div>
    </div>
  );
}

// Horizontal drag-to-pan scroller (mouse drag + native touch scroll). Swallows
// the click that ends a drag so chips underneath don't fire on a pan.
function HScroll({ className, children }) {
  const ref = useCrRef(null);
  const st = useCrRef({ down: false, moved: false, x: 0, sl: 0 });
  const onDown = (e) => {
    const el = ref.current; if (!el) return;
    const p = e.touches ? e.touches[0] : e;
    st.current = { down: true, moved: false, x: p.clientX, sl: el.scrollLeft };
    const move = (ev) => {
      if (!st.current.down) return;
      const q = ev.touches ? ev.touches[0] : ev;
      const dx = q.clientX - st.current.x;
      if (Math.abs(dx) > 3) st.current.moved = true;
      el.scrollLeft = st.current.sl - dx;
      if (!ev.touches && ev.cancelable && st.current.moved) ev.preventDefault();
    };
    const up = () => {
      st.current.down = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  const onClickCapture = (e) => {
    if (st.current.moved) { e.preventDefault(); e.stopPropagation(); st.current.moved = false; }
  };
  return (
    <div className={className} ref={ref} onMouseDown={onDown} onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "vibe": ["#c6f24e", "#14210a"],
  "shape": "rounded"
}/*EDITMODE-END*/;

const SHAPE_RADII = {
  sharp:   { sm: '3px', md: '5px', lg: '7px', card: '8px', cc: '8px' },
  rounded: { sm: '10px', md: '16px', lg: '22px', card: '26px', cc: '20px' },
  playful: { sm: '16px', md: '22px', lg: '30px', card: '40px', cc: '34px' },
};

function Creator() {
  const { maxW: PREVIEW_W, maxH: PREVIEW_H } = useCardSize();
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [step, setStep] = useCr(1);
  const [originalSrc, setOriginalSrc] = useCr(null);
  const [image, setImage] = useCr('paint-marble.png');
  const [aspect, setAspect] = useCr(0.72);
  const [cutout, setCutout] = useCr(false);
  const [editorCut, setEditorCut] = useCr(true);
  // text items (start empty — no placeholder)
  const [texts, setTexts] = useCr([]);
  const [qr, setQr] = useCr(null);
  const [selId, setSelId] = useCr(null);
  // style
  const [holo, setHolo] = useCr('none');
  const [scene, setScene] = useCr('calm');
  const [fxLevel, setFxLevel] = useCr(50); // finish-effect intensity 0–100 (50 = balanced)
  const [fxPanel, setFxPanel] = useCr(true); // step-3 controls panel open/collapsed (mobile)
  const [hideUI, setHideUI] = useCr(false); // step-3 desktop hide-all-UI toggle
  const fxPanelRef = useCrRef(null);
  const [fxPanelH, setFxPanelH] = useCr(250); // measured panel height (centers card above panel)
  React.useLayoutEffect(() => {
    if (step === 3 && fxPanel && fxPanelRef.current) setFxPanelH(fxPanelRef.current.offsetHeight);
  }, [step, fxPanel]);
  const [fxTip, setFxTip] = useCr(null); // step-3 desktop float chip tooltip
  const sceneGroupRef = useCrRef(null);
  const [sceneTip, setSceneTip] = useCr(null); // step-3 custom scroll indicator
  const updateSceneIndicator = () => {
    const el = sceneGroupRef.current;
    if (!el || !el.offsetParent) { setSceneTip(null); return; }
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) { setSceneTip(null); return; }
    const thumbH = Math.max(20, (clientHeight / scrollHeight) * clientHeight);
    const thumbTop = (scrollTop / maxScroll) * (clientHeight - thumbH);
    const screenEl = el.closest('.wiz--fx');
    if (!screenEl) return;
    const gr = el.getBoundingClientRect(), sr = screenEl.getBoundingClientRect();
    setSceneTip({
      top: gr.top - sr.top + thumbTop, h: thumbH,
      fadeTop: scrollTop > 2, fadeBottom: scrollTop < maxScroll - 2,
      groupTop: gr.top - sr.top, groupBottom: gr.bottom - sr.top,
      groupLeft: gr.left - sr.left, groupW: gr.width,
    });
  };
  React.useEffect(() => { if (step === 3) setTimeout(updateSceneIndicator, 0); }, [step]);
  const [styleOpen, setStyleOpen] = useCr(false);
  const [shareOpen, setShareOpen] = useCr(false);
  const [shareCopied, setShareCopied] = useCr(false);
  const [shareCopiedLeaving, setShareCopiedLeaving] = useCr(false);
  const shareCopiedTimer = React.useRef(null);
  const shareCopiedLeaveTimer = React.useRef(null);
  const [shareSaving, setShareSaving] = useCr(false);
  const [shareErr, setShareErr] = useCr(null);
  const [shareUrl, setShareUrl] = useCr('');
  const [linkOpen, setLinkOpen]       = useCr(false);
  const [linkVal, setLinkVal]         = useCr('');
  const [linkLoading, setLinkLoading] = useCr(false);
  const [linkErr, setLinkErr]         = useCr(null);
  const fileRef = useCrRef(null);
  const textInputRef = useCrRef(null);

  React.useEffect(() => { if (window.CarbonIcons) window.CarbonIcons.run(); });


  // apply expressive tweaks (vibe accent + shape language) to the whole app
  React.useEffect(() => {
    const root = document.documentElement;
    const vibe = Array.isArray(tw.vibe) ? tw.vibe : [tw.vibe, '#14210a'];
    root.style.setProperty('--accent', vibe[0]);
    root.style.setProperty('--accent-ink', vibe[1] || '#14210a');
    const r = SHAPE_RADII[tw.shape] || SHAPE_RADII.rounded;
    root.style.setProperty('--r-sm', r.sm);
    root.style.setProperty('--r-md', r.md);
    root.style.setProperty('--r-lg', r.lg);
    root.style.setProperty('--r-card', r.card);
    root.style.setProperty('--cc-radius', r.cc);
  }, [tw.vibe, tw.shape]);

  // Reset saved link whenever the design changes so users can re-share the updated version
  React.useEffect(() => {
    if (shareUrl) { setShareUrl(''); setShareCopied(false); }
  }, [image, aspect, cutout, holo, scene, fxLevel, texts, qr, tw.vibe, tw.shape]);

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { setEditorCut(true); setOriginalSrc(rd.result); };
    rd.readAsDataURL(f);
    e.target.value = '';
  };

  const applyImage = (url, cut) => {
    const img = new Image();
    img.onload = () => { setImage(url); setAspect(img.naturalWidth / img.naturalHeight); setCutout(!!cut); setStep(2); };
    img.src = url;
  };

  // ---- text item ops ----
  const sel = texts.find(t => t.id === selId) || null;
  const qrSel = selId === 'qr';
  const anySel = sel || qrSel;
  const tweaksUI = (
    <TweaksPanel>
      <TweakSection label="Make it yours" />
      <TweakColor label="Vibe" value={tw.vibe}
        options={[["#c6f24e", "#14210a"], ["#ff6f61", "#2a0d0a"], ["#7a5cff", "#f3eeff"], ["#37d6c4", "#04211d"], ["#f6c945", "#241a02"]]}
        onChange={(v) => setTweak('vibe', v)} />
      <TweakRadio label="Shape" value={tw.shape} options={['sharp', 'rounded', 'playful']}
        onChange={(v) => setTweak('shape', v)} />
    </TweaksPanel>
  );
  const addText = () => {
    const id = TID++;
    const used = texts.length;
    setTexts([...texts, { id, value: '', color: '#ffffff', align: 'center', size: 28, style: 'regular', w: 64, x: 50, y: 30 + Math.min(used, 4) * 14 }]);
    setSelId(id);
    setStyleOpen(false);
    setTimeout(() => textInputRef.current && textInputRef.current.focus(), 30);
  };
  const addQr = () => {
    if (!qr) setQr({ id: 'qr', value: 'https://www.adamborthwick.com', w: 30, x: 50, y: 66 });
    setSelId('qr');
  };
  const updSel = (patch) => setTexts(ts => ts.map(t => t.id === selId ? { ...t, ...patch } : t));
  const moveEl = (id, p) => { if (id === 'qr') setQr(q => q && { ...q, ...p }); else setTexts(ts => ts.map(t => t.id === id ? { ...t, ...p } : t)); };
  const resizeEl = (id, p) => { if (id === 'qr') setQr(q => q && { ...q, ...p }); else setTexts(ts => ts.map(t => t.id === id ? { ...t, ...p } : t)); };
  const editText = (id, value) => setTexts(ts => ts.map(t => t.id === id ? { ...t, value } : t));
  const delSel = () => { if (selId === 'qr') { setQr(null); } else { setTexts(texts.filter(t => t.id !== selId)); } setSelId(null); };

  // Rasterize the collectible on a 1080×1920 canvas with scene background.
  const makeCardBlob = async () => {
    const OW = 1080, OH = 1920;
    const cv = document.createElement('canvas'); cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d');

    // Scene background — grab the live WebGL canvas if present, else solid dark.
    const sceneCv = document.querySelector('.cc-bg--live canvas');
    if (sceneCv && sceneCv.width > 0) {
      // Cover: scale uniformly so the canvas fills OW×OH without stretching.
      const sw = sceneCv.width, sh = sceneCv.height;
      const sc = Math.max(OW / sw, OH / sh);
      const dw = sw * sc, dh = sh * sc;
      ctx.drawImage(sceneCv, (OW - dw) / 2, (OH - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#14141a'; ctx.fillRect(0, 0, OW, OH);
    }

    // Vignette darkens edges so the card pops.
    const vg = ctx.createRadialGradient(OW / 2, OH / 2, OH * 0.18, OW / 2, OH / 2, OH * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, OW, OH);

    // Card bounds — centred with 80px side padding.
    const ar = aspect || 0.72;
    const pad = 80;
    const CW = OW - pad * 2, CH = Math.round(CW / ar);
    const cx = pad, cy = Math.round((OH - CH) / 2);
    const rad = Math.min(CW, CH) * 0.055;

    // Clip to rounded card and draw artwork.
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx, cy, CW, CH, rad); else ctx.rect(cx, cy, CW, CH);
    ctx.clip();
    ctx.fillStyle = '#14141a'; ctx.fillRect(cx, cy, CW, CH);
    if (image) {
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.onerror = res; img.src = image; });
      if (img.naturalWidth) {
        const s = cutout ? Math.min(CW / img.naturalWidth, CH / img.naturalHeight)
                         : Math.max(CW / img.naturalWidth, CH / img.naturalHeight);
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        ctx.drawImage(img, cx + (CW - dw) / 2, cy + (CH - dh) / 2, dw, dh);
      }
    }

    // Text layers inside the card clip.
    const fam = (getComputedStyle(document.documentElement).getPropertyValue('--font') || 'sans-serif').trim() || 'sans-serif';
    texts.forEach(t => {
      if (!t.value) return;
      ctx.save();
      ctx.fillStyle = t.color || '#fff';
      ctx.textAlign = t.align || 'center';
      ctx.textBaseline = 'middle';
      const fs = (t.size || 28) * (CW / 312);
      ctx.font = (t.style === 'bold' ? '800 ' : t.style === 'italic' ? 'italic 400 ' : '400 ') + fs + 'px ' + fam;
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2;
      const x = cx + (t.x / 100) * CW, y = cy + (t.y / 100) * CH;
      String(t.value).split('\n').forEach((line, i, arr) => {
        ctx.fillText(line, x, y + (i - (arr.length - 1) / 2) * fs * 1.1);
      });
      ctx.restore();
    });
    ctx.restore();

    return new Promise(res => cv.toBlob(res, 'image/png'));
  };
  const downloadBlob = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const loadFromLink = async () => {
    const code = (linkVal.match(/[#&]card=([^&\s]+)/) || [])[1] || linkVal.trim();
    if (!code) return;
    setLinkLoading(true); setLinkErr(null);
    try {
      const s = await loadCard(code);
      if (!s) throw new Error();
      if (s.photo) { const img = new Image(); img.onload = () => { setImage(s.photo); setAspect(s.aspect || img.naturalWidth / img.naturalHeight); setCutout(!!s.cutout); }; img.src = s.photo; }
      if (s.holo)            setHolo(s.holo);
      if (s.scene)           setScene(s.scene);
      if (s.fxLevel != null) setFxLevel(s.fxLevel);
      if (s.texts)           setTexts(s.texts.map(t => ({ ...t, id: TID++ })));
      if ('qr' in s)         setQr(s.qr);
      if (s.tw) { if (s.tw.vibe) setTweak('vibe', s.tw.vibe); if (s.tw.shape) setTweak('shape', s.tw.shape); }
      history.replaceState(null, '', '#card=' + code);
      setStep(3);
    } catch (e) { setLinkErr('Link not found — check and try again'); }
    setLinkLoading(false);
  };

  const saveImage = async () => { try { downloadBlob(await makeCardBlob(), 'collectible.png'); setShareOpen(false); } catch (e) {} };
  const copyLink = async () => {
    if (shareSaving) return;
    setShareSaving(true); setShareErr(null);
    try {
      const photo = await compressPhoto(image, cutout);
      const code  = await saveCard({ v: 1, photo, aspect, cutout, holo, scene, fxLevel, texts, qr, tw });
      const url   = location.origin + location.pathname + '#card=' + code;
      history.replaceState(null, '', '#card=' + code);
      setShareUrl(url);
      makeCardBlob().then(blob => uploadPreview(blob, code)).catch(e => console.error('[Relic] preview upload failed:', e));
    } catch (e) { setShareErr('Save failed — try again'); }
    setShareSaving(false);
  };
  const closeSheet = () => { setShareOpen(false); setShareCopied(false); };
  const copyUrlOnly = () => {
    if (!shareUrl) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    } else {
      const ta = Object.assign(document.createElement('textarea'), { value: shareUrl });
      Object.assign(ta.style, { position: 'fixed', left: '-9999px', top: '-9999px', opacity: '0' });
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
    clearTimeout(shareCopiedTimer.current);
    clearTimeout(shareCopiedLeaveTimer.current);
    setShareCopiedLeaving(false);
    setShareCopied(true);
    shareCopiedTimer.current = setTimeout(() => {
      setShareCopiedLeaving(true);
      shareCopiedLeaveTimer.current = setTimeout(() => { setShareCopied(false); setShareCopiedLeaving(false); }, 350);
    }, 3000);
  };
  const shareSheet = shareOpen ? (
    <div className="share-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) closeSheet(); }}>
      <div className="share-sheet__panel">
        <span className="share-sheet__grip"></span>
        <div className="share-sheet__head">
          <span className="share-sheet__title">Share collectible</span>
          <button className="share-sheet__close" onClick={closeSheet} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="share-apps">
          <button className="share-app" onClick={saveImage}><Icon name="download" /> Download image</button>
          <button className={'share-app' + (shareUrl ? ' share-app--done' : '')} onClick={copyLink} disabled={shareSaving || !!shareUrl}>
            <Icon name={shareUrl ? 'checkmark' : shareSaving ? 'time' : 'link'} />
            {shareUrl ? 'Link created' : shareSaving ? 'Saving…' : 'Share with link'}
          </button>
          {shareUrl && (
            <div className="share-link-row">
              <button className="share-link-copy" onClick={copyUrlOnly} aria-label="Copy link"><Icon name="copy" /></button>
              <input className="share-link-field" value={shareUrl} readOnly onClick={e => e.target.select()} />
            </div>
          )}
        </div>
        {shareErr && (
          <div className="share-error-toast">
            <Icon name="close" /> {shareErr}
          </div>
        )}
        {shareCopied && (
          <div className={'share-copied-toast' + (shareCopiedLeaving ? ' is-leaving' : '')}>
            <Icon name="copy" /> Link copied to clipboard
          </div>
        )}
      </div>
    </div>
  ) : null;

  // ---------- STEP 1: photo & shape ----------
  if (step === 1) {
    if (!originalSrc) {
      return (
        <div className="screen wiz wiz--landing">
          <div className="landing__brand">
            <RelicTitle />
            <span className="landing__sub">Design and share custom collectibles</span>
          </div>
          <div className="wiz__preview wiz__preview--flat">
            <button className="upload-hero" onClick={() => fileRef.current.click()}>
              <Icon name="upload" />
              <span className="upload-hero__title">Upload a photo</span>
              <small>Pick the art for your collectible</small>
            </button>
            <div className="upload-link-row">
            {!linkOpen ? (
              <button className="upload-link-btn" onClick={() => setLinkOpen(true)}>
                <Icon name="link" /> View a collectible
              </button>
            ) : (
              <div className="upload-link-input-row">
                <input
                  className="upload-link-input"
                  placeholder="Paste a collectible link…"
                  value={linkVal}
                  autoFocus
                  onChange={e => { setLinkVal(e.target.value); setLinkErr(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') loadFromLink(); if (e.key === 'Escape') { setLinkOpen(false); setLinkVal(''); setLinkErr(null); } }}
                />
                <button className="upload-link-go" onClick={loadFromLink} disabled={linkLoading}>
                  {linkLoading ? <Icon name="time" /> : <Icon name="arrow--right" />}
                </button>
              </div>
            )}
              {linkErr && <span className="upload-link-err">{linkErr}</span>}
            </div>
          </div>
          <div className="landing__credit">
            Created by <a href="https://www.adamborthwick.com" target="_blank" rel="noopener noreferrer" className="landing__credit-link">Adam Borthwick</a>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
          {tweaksUI}
        </div>
      );
    }
    return (
      <React.Fragment>
        <ImageEditor src={originalSrc} initialCutout={editorCut} title="Photo & shape" doneLabel="Next" step={1}
          maxW={PREVIEW_W} maxH={PREVIEW_H}
          onReplace={() => fileRef.current.click()}
          onCancel={() => { setOriginalSrc(null); setImage(null); }}
          onDone={(url, _r, cut) => { setEditorCut(cut); applyImage(url, cut); }} />
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        {tweaksUI}
      </React.Fragment>
    );
  }

  // ---------- shared preview ----------
  const preview = (opts) => (
    <div className={'wiz__preview' + (opts.confirm ? ' confirm' : '')}>
      <SceneBg id={opts.scene} live={true} /><div className="cc-bg__vig"></div>
      <div className="cc-stage">
        <Collectible image={image} aspect={aspect} cutout={cutout} holo={opts.holo} fxLevel={fxLevel}
          texts={texts} qr={qr} selectedId={selId} editable={opts.editable} mode={opts.mode}
          onSelectText={setSelId} onMoveText={moveEl} onResizeText={resizeEl} onEditText={editText}
          onBlankClick={() => setSelId(null)}
          maxW={opts.maxW || PREVIEW_W} maxH={opts.maxH || PREVIEW_H} />
      </div>
      {opts.addBtns && !anySel && (
        <div className="add-row">
          <button className="addtext-fab" onClick={addText}><Icon name="add" /> Add text</button>
          <button className="addtext-fab addtext-fab--qr" onClick={addQr}><Icon name="qr-code" /> Add QR</button>
        </div>
      )}
    </div>
  );

  // ---------- STEP 2: text ----------
  if (step === 2) {
    const deselectIfBlank = (e) => {
      if (e.target.closest('.cc__textitem, .cc__qritem, .cc__h, .wiz__panel')) return;
      setSelId(null);
    };
    return (
      <div className={"screen wiz" + (anySel ? ' is-editing' : '')}>
        <WizBar title="Add elements" step={2} onBack={() => setStep(1)}
          action={<button className="wiz__next" onClick={() => { setSelId(null); setStep(3); }}>Next</button>} />
        <div className={'wiz__preview wiz__preview--edit wiz__preview--flat' + (anySel ? ' is-editing' : '')} onMouseDown={deselectIfBlank} onTouchStart={deselectIfBlank}>
          <div className="cc-stage">
            <Collectible image={image} aspect={aspect} cutout={cutout} holo="none"
              texts={texts} qr={qr} selectedId={selId} editable={true} mode="static"
              onSelectText={setSelId} onMoveText={moveEl} onResizeText={resizeEl} onEditText={editText}
              onBlankClick={() => setSelId(null)} maxW={PREVIEW_W} maxH={PREVIEW_H} />
          </div>
        </div>

        {/* Desktop: floating panels — always in DOM so CSS transitions can animate in/out */}
        <div className="edit-float edit-float--left">
          {sel && (
            <window.FloatCard>
              <window.FloatSection label="Size">
                {SIZES.map(([lab, px]) => (
                  <button key={lab} className={'tool-btn tool-btn--txt' + (sel.size === px ? ' is-on' : '')} onClick={() => updSel({ size: px })}>{lab}</button>
                ))}
              </window.FloatSection>
              <window.FloatSection label="Font">
                {STYLES.map(([s, lab]) => (
                  <button key={s} className={'tool-btn tool-btn--txt' + ((sel.style || 'regular') === s ? ' is-on' : '')} onClick={() => updSel({ style: s })}
                    style={{ fontWeight: s === 'bold' ? 800 : 400, fontStyle: s === 'italic' ? 'italic' : 'normal' }}>{lab}</button>
                ))}
              </window.FloatSection>
              <window.FloatSection label="Align">
                {ALIGNS.map(([a, ic]) => (
                  <button key={a} className={'tool-btn' + (sel.align === a ? ' is-on' : '')} onClick={() => updSel({ align: a })} aria-label={a + ' align'}><Icon name={ic} /></button>
                ))}
              </window.FloatSection>
            </window.FloatCard>
          )}
        </div>
        <div className="edit-float edit-float--right">
          {sel && (
            <window.FloatCard>
              <window.FloatSection label="Color" column>
                {TEXT_COLORS.map(c => (
                  <button key={c} className={'tool-swatch' + (sel.color === c ? ' is-on' : '')} style={{ background: c }} onClick={() => updSel({ color: c })} aria-label="color"></button>
                ))}
              </window.FloatSection>
            </window.FloatCard>
          )}
        </div>

        <div className="wiz__panel wiz__panel--edit">
          {/* add-row first in DOM — column-reverse keeps it pinned at the visual bottom */}
          <div className="add-row add-row--inline">
            <button className={'addtext-fab' + (sel ? ' is-on' : '')} onClick={addText}><Icon name="add" /> Add text</button>
            <button className={'addtext-fab addtext-fab--qr' + (qrSel ? ' is-on' : '')} onClick={addQr}><Icon name="qr-code" /> Add QR</button>
          </div>

          {/* TEXT selected: text input then mobile toolbar (column-reverse flips visual order) */}
          {sel && (
            <React.Fragment>
              <div className="edit-bar">
                <input ref={textInputRef} className="input txted__input" value={sel.value} maxLength={120}
                  placeholder="Type your text" onChange={(e) => updSel({ value: e.target.value })} />
                <button className="txted__del" onClick={delSel} aria-label="Delete text"><Icon name="trash-can" /></button>
              </div>
              <HScroll className="tool-bar tool-bar--scroll tool-bar--mobile">
                <div className="tool-sec">
                  <span className="tool-sec__label">Size</span>
                  <div className="tool-group">
                    {SIZES.map(([lab, px]) => (
                      <button key={lab} className={'tool-btn tool-btn--txt' + (sel.size === px ? ' is-on' : '')} onClick={() => updSel({ size: px })}>{lab}</button>
                    ))}
                  </div>
                </div>
                <div className="tool-sec">
                  <span className="tool-sec__label">Font</span>
                  <div className="tool-group">
                    {STYLES.map(([s, lab]) => (
                      <button key={s} className={'tool-btn tool-btn--txt' + ((sel.style || 'regular') === s ? ' is-on' : '')} onClick={() => updSel({ style: s })}
                        style={{ fontWeight: s === 'bold' ? 800 : 400, fontStyle: s === 'italic' ? 'italic' : 'normal' }}>{lab}</button>
                    ))}
                  </div>
                </div>
                <div className="tool-sec">
                  <span className="tool-sec__label">Align</span>
                  <div className="tool-group">
                    {ALIGNS.map(([a, ic]) => (
                      <button key={a} className={'tool-btn' + (sel.align === a ? ' is-on' : '')} onClick={() => updSel({ align: a })} aria-label={a + ' align'}><Icon name={ic} /></button>
                    ))}
                  </div>
                </div>
                <div className="tool-sec">
                  <span className="tool-sec__label">Color</span>
                  <div className="tool-group">
                    {TEXT_COLORS.map(c => <button key={c} className={'tool-swatch' + (sel.color === c ? ' is-on' : '')} style={{ background: c }} onClick={() => updSel({ color: c })} aria-label="color"></button>)}
                  </div>
                </div>
              </HScroll>
            </React.Fragment>
          )}

          {/* QR selected: link input + delete */}
          {qrSel && qr && (
            <div className="edit-bar">
              <div className="qr-field">
                <Icon name="link" />
                <input className="input qr-input" value={qr.value} maxLength={160}
                  placeholder="Link or text to encode" onChange={(e) => setQr({ ...qr, value: e.target.value })} />
              </div>
              <button className="txted__del" onClick={delSel} aria-label="Delete QR"><Icon name="trash-can" /></button>
            </div>
          )}
        </div>
        {tweaksUI}
      </div>
    );
  }

  // ---------- STEP 3: effect & background ----------
  if (step === 3) {
    const fxName = fxLevel < 28 ? 'Subtle' : fxLevel > 72 ? 'Vivid' : 'Balanced';
    const sceneShift = (62 - (fxPanel ? fxPanelH : 48)) / 2;
    return (
      <div className={'screen wiz wiz--fx' + (hideUI ? ' is-hide-ui' : '')}
           style={{ '--scene-y': sceneShift.toFixed(1) + 'px' }}
           onClick={hideUI ? () => setHideUI(false) : undefined}>
        <SceneBg id={scene} live={true} />
        <div className="cc-bg__vig"></div>
        <WizBar title="Finish & background" step={3} onBack={() => setStep(2)}
          action={<button className="wiz__next" onClick={() => setShareOpen(true)}>Share</button>} />
        <div className="wiz__preview wiz__preview--bare" style={{ paddingBottom: hideUI ? '0px' : (fxPanel ? fxPanelH : 48) + 'px' }}>
          <div className="cc-stage">
            <Collectible image={image} aspect={aspect} cutout={cutout} holo={holo} fxLevel={fxLevel}
              texts={texts} qr={qr} editable={false} mode="tilt" maxW={PREVIEW_W} maxH={PREVIEW_H} />
          </div>
        </div>

        {shareCopied && (
          <div className={'share-copied-toast' + (shareCopiedLeaving ? ' is-leaving' : '')}>
            <Icon name="copy" /> Link copied to clipboard
          </div>
        )}

        {/* Mobile: collapsible bottom sheet */}
        <div ref={fxPanelRef} className={'wiz__panel wiz__panel--glass' + (fxPanel ? '' : ' is-collapsed')}>
          <button className="fx-panel__handle" onClick={() => setFxPanel(o => !o)}
            aria-label={fxPanel ? 'Hide controls' : 'Show controls'}>
            <span className="fx-panel__grip"></span>
            <span className="fx-panel__handle-label">{fxPanel ? 'Hide' : 'Customize'}</span>
            <Icon name="chevron--down" style={{ transform: fxPanel ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform .32s cubic-bezier(.2,0,.2,1)' }} />
          </button>
          <div className="fx-slider">
            <div className="fx-slider__head">
              <span className="panel-label">Finish intensity</span>
              <span className="fx-slider__val">{fxName}</span>
            </div>
            <input type="range" min="0" max="100" value={fxLevel}
              onChange={(e) => setFxLevel(+e.target.value)}
              style={{ '--fx-pct': fxLevel + '%' }} />
          </div>
          <HScroll className="fx-rail">
            <div className="fx-sec">
              <span className="fx-sec__label">Holographic finish</span>
              <div className="fx-sec__chips">
                {window.STUB.HOLO.map(h => (
                  <button key={h} className={'fx-chip' + (holo === h ? ' is-on' : '')} onClick={() => setHolo(h)}>
                    <span className="fx-chip__sw"><span className={'s-fill s-' + h}></span></span>
                    <span className="fx-chip__name">{window.STUB.HOLO_LABEL[h]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="fx-sec">
              <span className="fx-sec__label">Scene</span>
              <div className="fx-sec__chips">
                {window.STUB.SCENES.map(s => (
                  <button key={s.id} className={'fx-chip' + (scene === s.id ? ' is-on' : '')} onClick={() => setScene(s.id)}>
                    <span className="fx-chip__sw fx-chip__sw--scene"><SceneBg id={s.id} /></span>
                    <span className="fx-chip__name">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </HScroll>
        </div>

        {/* Desktop: left float — Finish */}
        <div className="edit-float edit-float--left">
          <window.FloatCard>
            <window.FloatSection label="Finish">
              {window.STUB.HOLO.map(h => (
                <button key={h} className={'fx-chip' + (holo === h ? ' is-on' : '')} onClick={() => setHolo(h)}
                  onMouseEnter={(e) => { const b = e.currentTarget.getBoundingClientRect(), s = e.currentTarget.closest('.wiz--fx').getBoundingClientRect(); setFxTip({ text: window.STUB.HOLO_LABEL[h], side: 'right', x: b.right - s.left, y: b.top - s.top + b.height / 2 }); }}
                  onMouseLeave={() => setFxTip(null)}>
                  <span className="fx-chip__sw"><span className={'s-fill s-' + h}></span></span>
                </button>
              ))}
            </window.FloatSection>
          </window.FloatCard>
        </div>

        {/* Desktop: right float — Scene */}
        <div className="edit-float edit-float--right">
          <window.FloatCard>
            <window.FloatSection label="Scene" groupRef={sceneGroupRef} onScroll={updateSceneIndicator}>
              {window.STUB.SCENES.map(s => (
                <button key={s.id} className={'fx-chip' + (scene === s.id ? ' is-on' : '')} onClick={() => setScene(s.id)}
                  onMouseEnter={(e) => { const b = e.currentTarget.getBoundingClientRect(), sc = e.currentTarget.closest('.wiz--fx').getBoundingClientRect(); setFxTip({ text: s.label, side: 'left', x: b.left - sc.left, y: b.top - sc.top + b.height / 2 }); }}
                  onMouseLeave={() => setFxTip(null)}>
                  <span className="fx-chip__sw fx-chip__sw--scene"><SceneBg id={s.id} /></span>
                </button>
              ))}
            </window.FloatSection>
          </window.FloatCard>
        </div>

        {/* Tooltip for step-3 desktop float chips (React-rendered to escape scroll overflow clipping) */}
        {fxTip && (
          <div className="fx-float-tip" style={{
            left: fxTip.side === 'right' ? fxTip.x + 20 : fxTip.x - 20,
            top: fxTip.y,
            transform: fxTip.side === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)',
          }}>{fxTip.text}</div>
        )}

        {/* Custom scroll indicator + edge fades — outside panel, on wiz--fx screen */}
        {sceneTip && (
          <>
            <div className="scene-indicator" style={{ top: sceneTip.top, height: sceneTip.h }} />
            <div className={'scene-fade scene-fade--top' + (sceneTip.fadeTop ? ' is-on' : '')}
                 style={{ top: sceneTip.groupTop, left: sceneTip.groupLeft, width: sceneTip.groupW }} />
            <div className={'scene-fade scene-fade--bottom' + (sceneTip.fadeBottom ? ' is-on' : '')}
                 style={{ top: sceneTip.groupBottom - 44, left: sceneTip.groupLeft, width: sceneTip.groupW }} />
          </>
        )}

        {/* Desktop: hide UI button — centered above intensity panel */}
        <button className="fx-hide-btn" onClick={(e) => { e.stopPropagation(); setHideUI(o => !o); }}>
          <Icon name={hideUI ? 'view' : 'view--off'} />
          {hideUI ? 'Show UI' : 'Hide UI'}
        </button>

        {/* Desktop: intensity panel — compact card at bottom center */}
        <div className="fx-desktop-bar">
          <div className="fx-slider">
            <div className="fx-slider__head">
              <span className="panel-label">Finish intensity</span>
              <span className="fx-slider__val">{fxName}</span>
            </div>
            <input type="range" min="0" max="100" value={fxLevel}
              onChange={(e) => setFxLevel(+e.target.value)}
              style={{ '--fx-pct': fxLevel + '%' }} />
          </div>
        </div>

        {shareSheet}
        {tweaksUI}
      </div>
    );
  }

  // ---------- STEP 4: confirm (full page) ----------
  return (
    <div className="screen wiz">
      <WizBar title="Your collectible" step={3} onBack={() => setStep(3)} />
      <div className="wiz__preview confirm">
        <SceneBg id={scene} live={true} /><div className="cc-bg__vig"></div>
        <div className="confirm__inner">
          <div className="cc-stage">
            <Collectible image={image} aspect={aspect} cutout={cutout} holo={holo} fxLevel={fxLevel}
              texts={texts} qr={qr} editable={false} mode="tilt" maxW={PREVIEW_W} maxH={PREVIEW_H} />
          </div>
          <p className="confirm__hint"><Icon name="rotate" /> Tilt it to catch the light</p>
        </div>
      </div>
      {tweaksUI}
    </div>
  );
}

function CardView({ code }) {
  const [state, setState] = useCr(null);
  const [err, setErr]     = useCr(false);
  const { maxW, maxH }    = useCardSize(48);
  const hasGyro = navigator.maxTouchPoints > 0;
  const [gyroOn, setGyroOn] = useCr(false);
  const [qrUrl, setQrUrl] = useCr(null);
  const [qrLeaving, setQrLeaving] = useCr(false);
  const qrTimer = React.useRef(null);
  const qrLeaveTimer = React.useRef(null);
  const dismissQr = React.useCallback(() => {
    clearTimeout(qrTimer.current);
    setQrLeaving(true);
    qrLeaveTimer.current = setTimeout(() => { setQrUrl(null); setQrLeaving(false); }, 350);
  }, []);
  const onQrDoubleTap = React.useCallback((url) => {
    clearTimeout(qrTimer.current);
    clearTimeout(qrLeaveTimer.current);
    if (qrUrl) { dismissQr(); return; }
    setQrLeaving(false);
    setQrUrl(url);
    qrTimer.current = setTimeout(dismissQr, 3000);
  }, [qrUrl, dismissQr]);
  const toggleGyro = async () => {
    if (gyroOn) { setGyroOn(false); return; }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return;
      }
    } catch { return; }
    setGyroOn(true);
  };

  React.useEffect(() => {
    loadCard(code)
      .then(s => {
        if (!s) { setErr(true); return; }
        // apply tweaks (accent colour, shape radius) to the document
        if (s.tw) {
          const root = document.documentElement;
          const vibe = Array.isArray(s.tw.vibe) ? s.tw.vibe : [s.tw.vibe, '#14210a'];
          root.style.setProperty('--accent', vibe[0]);
          root.style.setProperty('--accent-ink', vibe[1] || '#14210a');
          const r = SHAPE_RADII[s.tw.shape] || SHAPE_RADII.rounded;
          root.style.setProperty('--r-sm', r.sm); root.style.setProperty('--r-md', r.md);
          root.style.setProperty('--r-lg', r.lg); root.style.setProperty('--cc-radius', r.cc);
        }
        setState(s);
        const previewUrl = `${SB_URL}/storage/v1/object/public/previews/${code}.jpg`;
        const ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg) ogImg.setAttribute('content', previewUrl);
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', (s.texts && s.texts[0]?.text) ? s.texts[0].text + ' — Relic' : 'Relic — Holographic Collectibles');
      })
      .catch(() => setErr(true));
  }, [code]);

  if (err) return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <span style={{ color: 'var(--text-2)', fontSize: 15 }}>Card not found.</span>
      <a href={location.pathname} className="btn btn--accent" style={{ width: 'auto', padding: '0 28px' }}>Create your own</a>
    </div>
  );

  if (!state) return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-2)', fontSize: 15 }}>Loading…</span>
    </div>
  );

  return (
    <div className="screen card-view">
      <SceneBg id={state.scene || 'chicot'} live={true} />
      <div className="cc-bg__vig"></div>
      <div className="card-view__stage">
        <Collectible
          image={state.photo} aspect={state.aspect || 0.72} cutout={!!state.cutout}
          holo={state.holo || 'none'} fxLevel={state.fxLevel ?? 50}
          texts={state.texts || []} qr={state.qr || null}
          editable={false} mode="tilt" gyro={gyroOn} maxW={maxW} maxH={maxH}
          onQrDoubleTap={state.qr ? onQrDoubleTap : null}
        />
      </div>
      {qrUrl && (
        <a href={qrUrl} target="_blank" rel="noopener noreferrer" className={'card-view__qr-link' + (qrLeaving ? ' is-leaving' : '')}>
          {qrUrl}
        </a>
      )}
      {hasGyro && (
        <button className={'card-view__gyro-btn' + (gyroOn ? ' is-on' : '')} onClick={toggleGyro}>
          <Icon name={gyroOn ? 'move' : 'mobile'} /> {gyroOn ? 'Touch controls' : 'Tilt controls'}
        </button>
      )}
      <a href={location.pathname} className="card-view__cta">
        Create your own<Icon name="add" />
      </a>
    </div>
  );
}

const _shareCode = (location.hash.match(/[#&]card=([^&]+)/) || [])[1];
ReactDOM.createRoot(document.getElementById('root')).render(
  _shareCode ? <CardView code={_shareCode} /> : <Creator />
);
