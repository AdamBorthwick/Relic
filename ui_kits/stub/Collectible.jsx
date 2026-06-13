// STUB — the collectible. Art + holographic effect live in a masked
// "shape" layer; TEXT items sit in a layer ABOVE the effect so they're
// always legible. Supports MANY independent text items.
//   mode: 'tilt' (pointer shine) | 'static'
//   editable: drag/select text items (step 2)
const { useRef: useColRef, useState: useColState } = React;

const HOLO_CLASS = {
  none: '', foil: 'cc--foil', 'holo-rb': 'cc--holo-rb',
  poly: 'cc--poly', glitter: 'cc--glitter', negative: 'cc--negative', gold: 'cc--gold',
};

function fitBox(aspect, maxW, maxH) {
  let w = maxW, h = w / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }
  return { width: Math.round(w), height: Math.round(h) };
}
window.fitBox = fitBox;
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Build a scannable QR as a data URL (vendored qrcode-generator, offline).
function qrDataUrl(text) {
  try {
    if (!window.qrcode || !text) return null;
    const qr = window.qrcode(0, 'M');
    qr.addData(text); qr.make();
    return qr.createDataURL(8, 2);
  } catch (e) { return null; }
}
window.qrDataUrl = qrDataUrl;

// Inline-editable text: uncontrolled DOM (set once) so the caret never jumps
// and typing is never reversed. Supports multiple lines (Enter / Tab).
function EditableText({ value, onInput, onDone }) {
  const ref = useColRef(null);
  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.textContent = value || '';
    ref.current.focus();
    const sel = window.getSelection(); const rng = document.createRange();
    rng.selectNodeContents(ref.current); rng.collapse(false);
    sel.removeAllRanges(); sel.addRange(rng);
  }, []);
  return (
    <span ref={ref} className="cc__textitem-val" contentEditable suppressContentEditableWarning
      onMouseDown={(e) => e.stopPropagation()}
      onInput={(e) => onInput(e.currentTarget.innerText)}
      onBlur={(e) => onDone(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertLineBreak'); }
      }}>
    </span>
  );
}

function Collectible({
  image, aspect = 0.72, cutout = false, holo = 'none', fxLevel = 50,
  texts = [], qr = null, selectedId = null, editable = false, mode = 'static',
  onSelectText, onMoveText, onResizeText, onEditText, onBlankClick,
  maxW = 300, maxH = 430,
}) {
  const tiltRef = useColRef(null);
  // continuous finish-effect intensity. The slider midpoint (50, "Balanced") is
  // a moderate look; the bottom is subtle and the top pushes to a vivid finish.
  const fxFilter = (() => {
    const t = Math.max(0, Math.min(100, fxLevel)) / 100;
    const lerp = (a, b, u) => a + (b - a) * u;
    let sat, con, bri, op;
    if (t <= 0.5) {            // 0 (subtle) → 0.5 (balanced = moderate)
      const u = t / 0.5;
      sat = lerp(.55, 1.0, u); bri = lerp(.8, .97, u); op = lerp(.28, .68, u); con = lerp(1, 1.03, u);
    } else {                   // 0.5 (moderate) → 1 (vivid)
      const u = (t - 0.5) / 0.5;
      sat = lerp(1.0, 1.55, u); con = lerp(1.03, 1.22, u); bri = lerp(.97, 1.1, u); op = lerp(.68, .82, u);
    }
    return `saturate(${sat.toFixed(3)}) contrast(${con.toFixed(3)}) brightness(${bri.toFixed(3)}) opacity(${op.toFixed(3)})`;
  })();
  const [editingId, setEditingId] = useColState(null);
  // live alignment guides shown while dragging (null = hidden)
  const [guides, setGuides] = useColState({ x: null, y: null });

  // Luminance→alpha mask of the artwork. Holographic finishes use this so the
  // colour & glitter "catch" the bright/white areas of the photo (raster luminance
  // masking doesn't render reliably, so we bake an alpha-keyed copy ourselves).
  const [lumMask, setLumMask] = useColState(null);
  React.useEffect(() => {
    if (!image) { setLumMask(null); return; }
    let cancelled = false;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const scale = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
      try {
        const d = g.getImageData(0, 0, w, h), p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
          // lift contrast so only genuine highlights catch the finish
          let a = (lum - 38) * 1.7; a = a < 0 ? 0 : a > 255 ? 255 : a;
          p[i] = 255; p[i + 1] = 255; p[i + 2] = 255; p[i + 3] = a * (p[i + 3] / 255);
        }
        g.putImageData(d, 0, 0);
        setLumMask(c.toDataURL('image/png'));
      } catch (e) { setLumMask(null); }
    };
    img.onerror = () => setLumMask(null);
    img.src = image;
    return () => { cancelled = true; };
  }, [image]);

  // soft-snap: magnet a dragged value to key card lines when within threshold
  const SNAP_PX = 12;             // pixel inset for corner snap guides
  const SNAP_T  = 2.4;            // snap radius in % of card dimension
  const softSnap = (v, targets) => {
    let best = null, bestD = SNAP_T;
    for (const t of targets) {
      const d = Math.abs(v - t);
      if (d <= bestD) { best = t; bestD = d; }
    }
    return best; // null = no snap
  };
  // box-aware snap (used for the QR): checks all three edges against all targets,
  // same approach as text — whichever edge is nearest any guide line wins.
  const snapBox = (center, half, targets) => {
    let best = null, bestD = SNAP_T;
    for (const ref of [center - half, center, center + half]) {
      for (const t of targets) {
        const d = Math.abs(ref - t);
        if (d < bestD) { bestD = d; best = { ref, t }; }
      }
    }
    if (!best) return null;
    return { v: center + (best.t - best.ref), line: best.t };
  };

  const sz = image ? fitBox(aspect, maxW, maxH) : { width: fitBox(aspect, maxW, maxH).width, height: fitBox(aspect, maxW, maxH).height };

  // pointer shine + 3D tilt
  const restTimer   = useColRef(null);
  const cardBounds  = useColRef(null); // cached on mouseenter — avoids getBoundingClientRect every move
  const bgElsCache  = useColRef(null); // cached querySelectorAll — avoids DOM query every move
  const bgParallaxSel = '.wiz--fx > .cc-bg .cc-bg__field, .wiz--fx > .cc-bg .cc-bg__swirl, .wiz__preview .cc-bg__field, .wiz__preview .cc-bg__swirl, .confirm .cc-bg__field, .confirm .cc-bg__swirl';
  const setBgParallax = (v) => {
    if (!bgElsCache.current) bgElsCache.current = document.querySelectorAll(bgParallaxSel);
    bgElsCache.current.forEach((el) => { el.style.translate = v; });
  };
  const tilt = (px, py) => {
    const el = tiltRef.current; if (!el) return;
    if (restTimer.current) { clearTimeout(restTimer.current); restTimer.current = null; }
    if (!el.classList.contains('is-active')) {
      el.classList.remove('is-resting');
      el.classList.add('is-active');
    }
    el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    el.style.setProperty('--ang', (px * 130).toFixed(0) + 'deg');
    el.style.setProperty('--rx', ((px - 0.5) * 26).toFixed(1) + 'deg');
    el.style.setProperty('--ry', (-(py - 0.5) * 26).toFixed(1) + 'deg');
    setBgParallax(((px - 0.5) * -20).toFixed(1) + 'px ' + ((py - 0.5) * -20).toFixed(1) + 'px');
  };
  const pt = (e) => (e.touches ? e.touches[0] : e);

  // Gyroscope tilt (mobile): request permission on first tap, then driven by
  // device orientation — physically tilting the phone tilts the card.
  // Touch-drag stays as the fallback for desktop / no-orientation devices.
  const gyroActiveRef = useColRef(false);
  const gyroCleanupRef = useColRef(null);
  const startGyro = React.useCallback(async () => {
    if (gyroActiveRef.current || mode !== 'tilt') return;
    if (!window.DeviceOrientationEvent) return;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return;
      }
    } catch { return; }
    gyroActiveRef.current = true;
    const handler = (e) => {
      if (!tiltRef.current) return;
      // gamma: left-right tilt −45..45°; beta: front-back 15..75° (natural hold range)
      const px = Math.max(0, Math.min(1, ((e.gamma || 0) + 45) / 90));
      const py = Math.max(0, Math.min(1, ((e.beta  || 45) - 15) / 60));
      tilt(px, py);
    };
    window.addEventListener('deviceorientation', handler);
    gyroCleanupRef.current = () => window.removeEventListener('deviceorientation', handler);
  }, [mode]);
  React.useEffect(() => () => { if (gyroCleanupRef.current) gyroCleanupRef.current(); }, []);

  const onTiltEnter = () => {
    const el = tiltRef.current; if (!el) return;
    cardBounds.current = el.getBoundingClientRect();
    bgElsCache.current = document.querySelectorAll(bgParallaxSel);
  };
  const onTiltMove = (e) => {
    if (mode !== 'tilt') return;
    if (e.touches && gyroActiveRef.current) return; // gyro drives it on mobile
    if (e.cancelable) e.preventDefault();
    const el = tiltRef.current; if (!el) return; const p = pt(e);
    const r = cardBounds.current || el.getBoundingClientRect();
    tilt(Math.min(1, Math.max(0, (p.clientX - r.left) / r.width)),
         Math.min(1, Math.max(0, (p.clientY - r.top) / r.height)));
  };
  const onTiltLeave = () => {
    if (gyroActiveRef.current) return; // gyro keeps driving; don't snap to rest
    cardBounds.current = null; // invalidate so next enter re-measures
    const el = tiltRef.current; if (!el) return;
    el.classList.remove('is-active');
    el.classList.add('is-resting');
    el.style.setProperty('--gx', '50%'); el.style.setProperty('--gy', '50%');
    el.style.setProperty('--mx', '50%'); el.style.setProperty('--my', '50%');
    el.style.setProperty('--ang', '0deg');
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    setBgParallax('0px 0px');
    if (restTimer.current) clearTimeout(restTimer.current);
    restTimer.current = setTimeout(() => {
      const e2 = tiltRef.current; if (!e2) return;
      e2.classList.remove('is-resting');
      e2.style.removeProperty('--gx'); e2.style.removeProperty('--gy');
      e2.style.removeProperty('--mx'); e2.style.removeProperty('--my');
      e2.style.removeProperty('--ang');
    }, 900);
  };

  // per-item: select; the green handle MOVES, the box body RESIZES (width)
  const cardRect = () => tiltRef.current && tiltRef.current.getBoundingClientRect();
  const startMove = (item) => (e) => {
    if (!editable) return;
    e.preventDefault(); e.stopPropagation();
    onSelectText && onSelectText(item.id);
    // compute snap targets and text height from card size at drag-start
    const r0 = cardRect();
    const snapX = r0 ? [SNAP_PX/r0.width*100, 50, (r0.width-SNAP_PX)/r0.width*100] : [5, 50, 95];
    const snapY = r0 ? [SNAP_PX/r0.height*100, 50, (r0.height-SNAP_PX)/r0.height*100] : [5, 50, 95];
    const elemH = (item.id !== 'qr' && r0) ? e.currentTarget.getBoundingClientRect().height : 0;
    const halfH_pct = r0 ? (elemH / r0.height * 100) / 2 : 0;
    const move = (ev) => {
      if (ev.cancelable) ev.preventDefault();
      const p = pt(ev); const r = cardRect(); if (!r) return;
      let x = Math.max(6, Math.min(94, ((p.clientX - r.left) / r.width) * 100));
      let y = Math.max(6, Math.min(94, ((p.clientY - r.top) / r.height) * 100));
      let gx = null, gy = null;
      if (item.id === 'qr') {
        // square box: snap each edge/center; vertical half is scaled to card ratio
        const halfW = (item.w || 30) / 2;
        const halfH = halfW * (r.width / r.height);
        const ax = snapBox(x, halfW, snapX);
        const ay = snapBox(y, halfH, snapY);
        if (ax) { x = ax.v; gx = ax.line; }
        if (ay) { y = ay.v; gy = ay.line; }
      } else {
        // text: snap whichever edge (left/center/right) is nearest on X,
        // and whichever edge (top/center/bottom) is nearest on Y
        const halfW = (item.w || 64) / 2;
        let bestX = null, bestXDist = SNAP_T;
        for (const ref of [x - halfW, x, x + halfW]) {
          for (const t of snapX) {
            const d = Math.abs(ref - t);
            if (d < bestXDist) { bestXDist = d; bestX = { ref, t }; }
          }
        }
        if (bestX) { x = Math.max(6, Math.min(94, x + bestX.t - bestX.ref)); gx = bestX.t; }
        let bestY = null, bestYDist = SNAP_T;
        for (const ref of [y - halfH_pct, y, y + halfH_pct]) {
          for (const t of snapY) {
            const d = Math.abs(ref - t);
            if (d < bestYDist) { bestYDist = d; bestY = { ref, t }; }
          }
        }
        if (bestY) { y = Math.max(6, Math.min(94, y + bestY.t - bestY.ref)); gy = bestY.t; }
      }
      setGuides({ x: gx, y: gy });
      onMoveText && onMoveText(item.id, { x, y });
    };
    const up = () => {
      setGuides({ x: null, y: null });
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up);
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
  };
  // resize via edge handles: 'wl'/'wr' change the box WIDTH only (font stays;
  // text re-wraps and the box grows taller to fit — never hidden).
  const startHandle = (item, kind) => (e) => {
    if (!editable) return;
    e.preventDefault(); e.stopPropagation();
    onSelectText && onSelectText(item.id);
    const r = cardRect(); if (!r) return;
    const p0 = pt(e); const sx = p0.clientX;
    const startW = item.w || 64;
    const move = (ev) => {
      ev.preventDefault();
      const p = pt(ev);
      const dir = kind === 'wl' ? -1 : 1;
      const dw = (((p.clientX - sx) * dir) / r.width) * 100 * 2; // symmetric from center
      onResizeText && onResizeText(item.id, { w: clampN(startW + dw, 16, 98) });
    };
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up);
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
  };
  const shapeStyle = cutout && image
    ? { WebkitMaskImage: `url(${image})`, maskImage: `url(${image})` } : null;

  return (
    <div className={'cc ' + (cutout ? 'cc--cutout' : 'cc--framed') + ' ' + (HOLO_CLASS[holo] || '')}
         style={{ '--neg': (0.25 + 0.75 * Math.max(0, Math.min(100, fxLevel)) / 100).toFixed(3),
                  '--artmask': lumMask ? `url("${lumMask}")` : 'linear-gradient(#fff,#fff)',
                  '--art-fit': cutout ? 'contain' : 'cover' }}>
      <div className="cc__tilt" ref={tiltRef} style={{ width: sz.width, height: sz.height }}
           onMouseEnter={onTiltEnter} onMouseMove={onTiltMove} onMouseLeave={onTiltLeave}
           onTouchStart={() => { if (mode === 'tilt') startGyro(); }}
           onTouchMove={onTiltMove} onTouchEnd={onTiltLeave}
           onContextMenu={(e) => e.preventDefault()}>
        <div className="cc__shape" style={shapeStyle}>
          {image
            ? <div className="cc__art" style={{ backgroundImage: `url(${image})`, backgroundSize: cutout ? 'contain' : 'cover' }}></div>
            : <div className="cc__art cc__art--empty"><span className="cds-icon cds-icon--32" data-icon="image"></span><span>Your art</span></div>}
          <div className="cc__fx" style={{ filter: fxFilter }}>
            <div className="cc__art-holo"></div>
            <div className="cc__holo"></div>
            <div className="cc__grain2"></div>
            <div className="cc__sheen"></div>
            <div className="cc__glare"></div>
          </div>
          {!cutout && <div className="cc__frame"></div>}
        </div>

        {/* text layer — always above the effect */}
        <div className={'cc__textlayer' + (editable ? ' is-editable' : '')}
             onMouseDown={(e) => { if (editable && e.target === e.currentTarget) { onBlankClick && onBlankClick(); setEditingId(null); } }}
             onTouchStart={(e) => { if (editable && e.target === e.currentTarget) { onBlankClick && onBlankClick(); setEditingId(null); } }}>
          {editable && guides.x != null && <span className="cc__guide cc__guide--v" style={{ left: guides.x + '%' }}></span>}
          {editable && guides.y != null && <span className="cc__guide cc__guide--h" style={{ top: guides.y + '%' }}></span>}
          {texts.map(t => {
            const isSel = editable && selectedId === t.id;
            const isEditing = editingId === t.id;
            return (
              <div key={t.id}
                   className={'cc__textitem' + (editable ? ' is-editable' : '') + (isSel ? ' is-selected' : '') + (isEditing ? ' is-editing' : '')}
                   style={{ left: t.x + '%', top: t.y + '%', width: (t.w || 64) + '%', color: t.color, textAlign: t.align, fontSize: t.size + 'px', fontWeight: t.style === 'bold' ? 800 : 400, fontStyle: t.style === 'italic' ? 'italic' : 'normal' }}
                   onMouseDown={(e) => { if (editable && !isEditing) startMove(t)(e); }}
                   onTouchStart={(e) => { if (editable && !isEditing) startMove(t)(e); }}
                   onDoubleClick={() => { if (editable) { onSelectText && onSelectText(t.id); setEditingId(t.id); } }}>
                {isEditing
                  ? <EditableText value={t.value}
                      onInput={(v) => onEditText && onEditText(t.id, v)}
                      onDone={(v) => { onEditText && onEditText(t.id, v); setEditingId(null); }} />
                  : <span className="cc__textitem-val">{t.value || 'Text'}</span>}
                {isSel && !isEditing && (
                  <React.Fragment>
                    <span className="cc__h cc__h--l" onMouseDown={startHandle(t, 'wl')} onTouchStart={startHandle(t, 'wl')} title="Drag to resize box"></span>
                    <span className="cc__h cc__h--r" onMouseDown={startHandle(t, 'wr')} onTouchStart={startHandle(t, 'wr')} title="Drag to resize box"></span>
                  </React.Fragment>
                )}
              </div>
            );
          })}

          {/* QR element — draggable/resizable, kept on a white quiet-zone so it scans */}
          {qr && (() => {
            const isSel = editable && selectedId === 'qr';
            const src = qrDataUrl(qr.value || 'https://stub.party');
            return (
              <div className={'cc__qritem' + (editable ? ' is-editable' : '') + (isSel ? ' is-selected' : '')}
                   style={{ left: qr.x + '%', top: qr.y + '%', width: (qr.w || 30) + '%' }}
                   onMouseDown={(e) => { if (editable) startMove(qr)(e); }}
                   onTouchStart={(e) => { if (editable) startMove(qr)(e); }}>
                <div className="cc__qrbox">
                  {src ? <img src={src} alt="QR" draggable="false" /> : <span className="cds-icon cds-icon--24" data-icon="qr-code"></span>}
                </div>
                {isSel && (
                  <React.Fragment>
                    <span className="cc__h cc__h--l" onMouseDown={startHandle(qr, 'wl')} onTouchStart={startHandle(qr, 'wl')} title="Drag to resize"></span>
                    <span className="cc__h cc__h--r" onMouseDown={startHandle(qr, 'wr')} onTouchStart={startHandle(qr, 'wr')} title="Drag to resize"></span>
                  </React.Fragment>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

window.Collectible = Collectible;

// Scene IDs that get a real-time animated WEBGL canvas in the main preview
const LIVE_SCENE_IDS = { chicot: 1, canio: 1, loop: 1, loopbw: 1, aurora: 1, solar: 1 };

// SceneBg renders either a live p5 WEBGL canvas (live=true, animated scenes)
// or the static field/swirl structure with thumbnail textures (chips, swirl, CSS scenes).
function SceneBg({ id, live }) {
  const containerRef = useColRef(null);
  const p5Ref = useColRef(null);
  const [tex, setTex] = useColState(window.STUB.SCENE_TEX || null);

  // Subscribe to static thumbnail event (used by chip selectors)
  React.useEffect(() => {
    if (window.STUB.SCENE_TEX) { setTex(window.STUB.SCENE_TEX); return; }
    const onReady = () => setTex(window.STUB.SCENE_TEX);
    window.addEventListener('stubtex:ready', onReady);
    return () => window.removeEventListener('stubtex:ready', onReady);
  }, []);

  const isLive = live && LIVE_SCENE_IDS[id];

  // Mount / unmount p5 WEBGL animation for live scenes
  React.useEffect(() => {
    if (!isLive) return;
    const shaders = window.STUB && window.STUB.SCENE_SHADERS;
    if (!shaders || !shaders[id] || !window.p5) return;
    const parent = containerRef.current;
    if (!parent) return;

    const def = shaders[id];
    let canvasEl = null;

    const inst = new p5(function (p) {
      let shad, W, H;
      p.setup = function () {
        W = Math.max(parent.offsetWidth || 0, 200);
        H = Math.max(parent.offsetHeight || 0, 300);
        const cv = p.createCanvas(W, H, p.WEBGL);
        cv.parent(parent);
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
        shad = p.createShader(window.STUB.SCENE_VERT, def.frag);
        p.noStroke();
        canvasEl = cv.elt;
        canvasEl.style.opacity = '0';
        canvasEl.style.transition = 'opacity .35s';
      };
      p.draw = function () {
        p.shader(shad);
        def.setUniforms(shad, p);
        p.rectMode(p.CENTER);
        p.rect(0, 0, W, H);
        if (p.frameCount === 1 && canvasEl) canvasEl.style.opacity = '1';
      };
      p.windowResized = function () {
        const nW = Math.max(parent.offsetWidth || 0, 200);
        const nH = Math.max(parent.offsetHeight || 0, 300);
        if (nW !== W || nH !== H) { W = nW; H = nH; p.resizeCanvas(W, H); }
      };
    });

    p5Ref.current = inst;
    return () => { if (p5Ref.current) { p5Ref.current.remove(); p5Ref.current = null; } };
  }, [id, isLive]);

  // Live animated scenes: bare container — p5 appends its canvas inside
  if (isLive) {
    return <div className={'cc-bg cc-bg--' + id + ' cc-bg--live'} ref={containerRef} />;
  }

  // Static: inline background-image overrides PNG references while preserving CSS animations
  const t = tex && tex[id];
  const isLoop = id === 'loop' || id === 'loopbw';
  return (
    <div className={'cc-bg cc-bg--' + id}>
      <div className="cc-bg__field"
           style={t && !isLoop ? { backgroundImage: 'url(' + t + ')' } : undefined}></div>
      <div className="cc-bg__swirl"
           style={t ? { backgroundImage: 'url(' + t + ')' } : undefined}></div>
    </div>
  );
}
window.SceneBg = SceneBg;
