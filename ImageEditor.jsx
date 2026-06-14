// STUB — Image editor: choose a crop ratio, pan/zoom, rotate 90°, then
// bakes a cropped image (PNG, preserves alpha) for the collectible.
const { useState: useIE, useRef: useIERef, useEffect: useIEeffect } = React;

// Shared floating panel components — defined here (ImageEditor loads first)
// and reused by Creator.jsx for the Add Elements screen.
function FloatCard({ children }) {
  return <div className="edit-float__card">{children}</div>;
}
function FloatSection({ label, column, wrap, groupRef, onScroll, children }) {
  return (
    <div className="edit-float__sec">
      <span className="edit-float__label">{label}</span>
      <div ref={groupRef} onScroll={onScroll} className={'edit-float__group' + (column ? ' edit-float__group--col' : '') + (wrap ? ' edit-float__group--wrap' : '')}>{children}</div>
    </div>
  );
}

// horizontal drag-scroll rail (mirrors Creator's HScroll) so the control bar
// pans like the panels on the other pages.
function IEHScroll({ className, children }) {
  const ref = useIERef(null);
  const st = useIERef({ down: false, moved: false, x: 0, sl: 0 });
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
    const up = () => { st.current.down = false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  const onClickCapture = (e) => { if (st.current.moved) { e.preventDefault(); e.stopPropagation(); st.current.moved = false; } };
  return <div className={className} ref={ref} onMouseDown={onDown} onClickCapture={onClickCapture}>{children}</div>;
}

const IE_RATIOS = [
  { id: 'original', label: 'Original', r: null },
  { id: 'card',     label: 'Card 5:7', r: 5 / 7 },
  { id: 'tall',     label: 'Tall 4:5', r: 4 / 5 },
  { id: 'square',   label: 'Square 1:1', r: 1 },
  { id: 'wide',     label: 'Wide 3:2', r: 3 / 2 },
  { id: 'story',    label: 'Story 9:16', r: 9 / 16 },
];

function ImageEditor({ src, initialCutout = true, title = 'Adjust photo', doneLabel = 'Done', step = 0, maxW = 290, maxH = 404, onReplaceFile, onCancel, onDone }) {
  const [nat, setNat] = useIE({ w: 1, h: 1 });
  const [ratioId, setRatioId] = useIE('card');
  const [rot, setRot] = useIE(0);
  const [zoom, setZoom] = useIE(1);
  const [pan, setPan] = useIE({ x: 0, y: 0 });
  const cut = true;   // silhouette cut-to-shape is always on
  const imgElRef = useIERef(null);
  const drag = useIERef(null);

  useIEeffect(() => {
    if (window.CarbonIcons) window.CarbonIcons.run();
    const im = new Image();
    im.onload = () => { imgElRef.current = im; setNat({ w: im.naturalWidth, h: im.naturalHeight }); };
    im.src = src;
  }, [src]);
  useIEeffect(() => { setPan({ x: 0, y: 0 }); setZoom(1); }, [ratioId, rot]);

  const ratioObj = IE_RATIOS.find(x => x.id === ratioId);
  const swapped = rot % 180 !== 0;
  const natR = swapped ? nat.h / nat.w : nat.w / nat.h;
  const ratio = ratioObj.r || natR;            // frame aspect (w/h)
  // fit the frame within the SAME box the collectible preview uses (no size jump)
  const fb = (window.fitBox ? window.fitBox(ratio, maxW, maxH) : { width: maxW, height: Math.round(maxW / ratio) });
  const FW = fb.width, FH = fb.height;

  // cover scale for the (possibly rotated) image
  const s = swapped ? Math.max(FW / nat.h, FH / nat.w) : Math.max(FW / nat.w, FH / nat.h);
  const baseW = nat.w * s, baseH = nat.h * s;
  const onW = (swapped ? baseH : baseW) * zoom, onH = (swapped ? baseW : baseH) * zoom;
  const maxX = Math.max(0, (onW - FW) / 2), maxY = Math.max(0, (onH - FH) / 2);
  const clamp = (p) => ({ x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) });

  const pt = (e) => (e.touches ? e.touches[0] : e);
  const onDown = (e) => { const p = pt(e); drag.current = { x: p.clientX, y: p.clientY, px: pan.x, py: pan.y }; };
  const onMove = (e) => { if (!drag.current) return; const p = pt(e); setPan(clamp({ x: drag.current.px + (p.clientX - drag.current.x), y: drag.current.py + (p.clientY - drag.current.y) })); };
  const onUp = () => { drag.current = null; };

  const bake = () => {
    const im = imgElRef.current; if (!im) return;
    const Q = 2.4, cw = Math.round(FW * Q), ch = Math.round(FH * Q);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.translate(pan.x * Q, pan.y * Q);
    ctx.scale(zoom, zoom);
    ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(im, -baseW * Q / 2, -baseH * Q / 2, baseW * Q, baseH * Q);
    ctx.restore();
    if (cut) {                                  // soften the silhouette's bounding corners
      const rad = Math.min(cw, ch) * 0.06;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0, 0, cw, ch, rad); else ctx.rect(0, 0, cw, ch);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    onDone(cv.toDataURL('image/png'), FW / FH, cut);
  };

  return (
    <div className="imed">
      <div className="wiz__bar">
        <div className="wiz__slot wiz__slot--l">
          <button className="topbar__back" onClick={onCancel} aria-label="Back"><Icon name="arrow--left" /></button>
        </div>
        <div className="wiz__head">
          <span className="wiz__title">{title}</span>
          {step ? <div className="wiz__dots">{[1, 2, 3].map(n => <span key={n} className={'dot3' + (n === step ? ' is-on' : '')}></span>)}</div> : null}
        </div>
        <div className="wiz__slot wiz__slot--r">
          <button className="wiz__next" onClick={bake}>{doneLabel}</button>
        </div>
      </div>

      <div className="imed__stage-wrap">
        <div className="imed__stage" style={{ width: FW, height: FH }}
             onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
             onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}>
          <img className="imed__img" src={src} draggable="false" style={{
            width: baseW, height: baseH, marginLeft: -baseW / 2, marginTop: -baseH / 2,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rot}deg)`,
          }} />
          <div className="imed__grid"></div>
        </div>
        <p className="imed__hint"><Icon name="move" /> Drag to position</p>
      </div>

      {/* Desktop: size float (top-left) */}
      <div className="edit-float edit-float--left">
        <FloatCard>
          <FloatSection label="Size" wrap>
            {IE_RATIOS.map(r => {
              const rr = r.r || (nat.w / nat.h) || 1;
              const bw = 16, bh = 16;
              let w = bw, h = Math.round(bw / rr);
              if (h > bh) { h = bh; w = Math.round(bh * rr); }
              const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
              const tooltip = r.r !== null
                ? r.label.replace(/^\S+\s*/, '')
                : (() => { const g = gcd(nat.w, nat.h); const sw = nat.w / g, sh = nat.h / g; return (sw > 20 || sh > 20) ? `${(nat.w / nat.h).toFixed(1)}:1` : `${sw}:${sh}`; })();
              return (
                <button key={r.id} className={'fx-chip' + (ratioId === r.id ? ' is-on' : '')} onClick={() => setRatioId(r.id)} data-tooltip={tooltip}>
                  <span className="fx-chip__sw fx-chip__sw--size">
                    <span className="size-rect" style={{ width: w, height: h }}><Icon name="star--filled" /></span>
                  </span>
                  <span className="fx-chip__name">{r.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </FloatSection>
        </FloatCard>
      </div>


      <div className="imed__tools">
        <div className="imed__row imed__row--mobile" style={{ gap: "10px" }}>
          <button className="imed__rotbtn" onClick={() => setRot((rot + 270) % 360)} aria-label="Rotate 90° left">
            <Icon name="rotate" />
          </button>
          <button className="imed__rotbtn" onClick={() => setRot((rot + 90) % 360)} aria-label="Rotate 90° right">
            <Icon name="rotate" className="flip-h" />
          </button>
          <div className="crop-ctl" style={{ flex: 1, gap: "8px" }}>
            <Icon name="zoom--out" />
            <input className="range" type="range" min="1" max="3" step="0.01" value={zoom}
                   style={{ '--zoom-pct': ((zoom - 1) / 2 * 100).toFixed(1) + '%' }}
                   onChange={(e) => setZoom(parseFloat(e.target.value))} />
            <Icon name="zoom--in" />
          </div>
        </div>

        <IEHScroll className="fx-rail imed__rail imed__rail--mobile">
          <div className="fx-sec">
            <span className="fx-sec__label">Card size</span>
            <div className="fx-sec__chips">
              {IE_RATIOS.map(r => {
                const rr = r.r || (nat.w / nat.h) || 1;
                const bw = 30, bh = 40;
                let w = bw, h = Math.round(bw / rr);
                if (h > bh) { h = bh; w = Math.round(bh * rr); }
                return (
                  <button key={r.id} className={'fx-chip' + (ratioId === r.id ? ' is-on' : '')} onClick={() => setRatioId(r.id)}>
                    <span className="fx-chip__sw fx-chip__sw--size"><span className="size-rect" style={{ width: w, height: h }}><Icon name="star--filled" /></span></span>
                    <span className="fx-chip__name">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </IEHScroll>

        <div className="imed__row imed__row--desktop">
          <button className="tool-btn" onClick={() => setRot((rot + 270) % 360)} aria-label="Rotate 90° left">
            <Icon name="rotate" />
          </button>
          <button className="tool-btn" onClick={() => setRot((rot + 90) % 360)} aria-label="Rotate 90° right">
            <Icon name="rotate" style={{ transform: 'scaleX(-1)' }} />
          </button>
          <div className="crop-ctl" style={{ flex: 1, gap: "8px" }}>
            <Icon name="zoom--out" />
            <input className="range" type="range" min="1" max="3" step="0.01" value={zoom}
                   style={{ '--zoom-pct': ((zoom - 1) / 2 * 100).toFixed(1) + '%' }}
                   onChange={(e) => setZoom(parseFloat(e.target.value))} />
            <Icon name="zoom--in" />
          </div>
        </div>

        <div className="imed__row">
          {onReplaceFile && (
            <label className="imed__btn imed__btn--replace" style={{position:'relative',overflow:'hidden'}}>
              <Icon name="image" /> Replace image
              <input type="file" accept="image/*" onChange={onReplaceFile} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',fontSize:'16px'}} />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

window.ImageEditor = ImageEditor;
window.FloatCard = FloatCard;
window.FloatSection = FloatSection;
