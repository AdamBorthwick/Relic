/* STUB — Procedural scene textures + animated WEBGL shaders (p5.js)
   - window.STUB.SCENE_VERT  : shared vertex shader string
   - window.STUB.SCENE_SHADERS : { id → { frag, setUniforms(shad,p) } } for live main-view animation
   - window.STUB.SCENE_TEX  : { id → dataURL } static thumbnails for chip selectors
   Fires 'stubtex:ready' when static thumbnails are ready. */
(function () {
  'use strict';

  var VERT = [
    'precision highp float;',
    'attribute vec3 aPosition;',
    'attribute vec2 aTexCoord;',
    'uniform mat4 uModelViewMatrix;',
    'uniform mat4 uProjectionMatrix;',
    'varying vec2 vTexCoord;',
    'void main(){',
    '  vTexCoord=aTexCoord;',
    '  gl_Position=uProjectionMatrix*uModelViewMatrix*vec4(aPosition,1.0);',
    '}',
  ].join('\n');

  // Shared noise helpers (value noise + 6-octave fbm)
  var NOISE_GLSL = [
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noiseVal(vec2 p){',        // renamed to avoid GLSL ES built-in conflict
    '  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),',
    '             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){',
    '  float v=0.,a=.5;',
    '  for(int i=0;i<4;i++){v+=a*noiseVal(p);p*=2.01;a*=.52;}',
    '  return v;}',
  ].join('\n');

  // Paint vortex: outer color slowly spirals inward through black into inner color at center.
  // Uses polar-coord rotation so the UV never drifts unboundedly — no degradation over time.
  // uPaintOuter = outer color (red/blue), uPaintInner = center color (blue/green).
  // The noise threshold — not a radial gradient — determines which color each pixel shows,
  // biased by radius so center tends inner and edges tend outer. Where the two colors
  // meet, the noise gradient crosses zero and creates the black paint-mixing convergence.
  var FRAG_PAINT = [
    'precision highp float;',
    'varying vec2 vTexCoord;',
    'uniform float uTime;',
    'uniform float uAspect;',  // canvas W/H — keeps spiral circular at any resolution
    'uniform vec2  uCenter;',  // card center in canvas UV [0-1]
    'uniform vec3 uPaintOuter;',
    'uniform vec3 uPaintInner;',
    NOISE_GLSL,
    'void main(){',
    '  vec2 raw=vTexCoord-uCenter;',
    '  vec2 uv=vec2(raw.x*uAspect,raw.y);',
    '  float r=length(uv);',
    //  swiDifferentialrl: inner pixels rotate much more, stretching noise into long paint strokes
    '  float ang=uTime*.03;',
    '  float extra=(1.-clamp(r/.90,0.,1.))*2.2;',
    '  float sca=cos(ang+extra),ssa=sin(ang+extra);',
    '  vec2 sw=vec2(uv.x*sca-uv.y*ssa,uv.x*ssa+uv.y*sca);',
    // Organic oscillation -- keeps the mass alive without long-term drift
    '  vec2 tw=vec2(sin(uTime*.10+sw.x*2.8)*.07,cos(uTime*.092+sw.y*2.8)*.07);',
    '  vec2 baseUV=(sw+tw)*7.2;',
    // Two-pass domain warp -- stronger pull for thick paint tendrils
    '  vec2 q=vec2(fbm(baseUV),fbm(baseUV+vec2(5.2,1.3)));',
    '  float f=fbm(baseUV+4.0*q);',
    // Weak radial bias -- noise governs color placement, bias only gently tips probability
    '  float rn=clamp(r/.76,0.,1.);',
    '  float bias=(rn-.46)*.90;',
    '  float fine=fbm(sw*2.0+vec2(3.3,9.1));',
    '  float nf=(f-.5)*1.1+(fine-.5)*0.6;',
    '  float paintVal=nf+bias;',
    // Narrower blend zone -- distinct paint chunks of both colors across the whole canvas
    '  float bW=.80;',
    '  float outerAmt=smoothstep(-bW,bW,paintVal);',
    // Elevation noise: separate field so dark/light variation is independent of which color
    '  float sf=fbm((baseUV+vec2(11.3,4.7))*1.6);',
    // Dark shadows in recesses -- creates darker shades within each color and more black patches
    '  float shadow=1.-smoothstep(0.,.55,sf);',
    // White gloss only at the very top of raised ridges -- smaller spots
    '  float hi=smoothstep(.53,.90,sf);',
    // center darkness — pulls the middle toward black, fades toward edges.
    '  float centerDark=1.-smoothstep(0.,.45,r);',
    '  vec3 col=mix(uPaintInner,uPaintOuter,outerAmt);',
    // .90 = shadow strength  |  .50 = how dark the center gets (0=none, 1=black)
    '  col*=(1.-shadow*.90-centerDark*.60);',
    // ADD after it:
'  float seam=1.-abs(outerAmt-.5)*2.;',        // 1 at color boundary, 0 in solid zones
'  col*=1.-seam*seam*.65;',                     // squared = soft falloff, .65 = darkness strength
    '  float clump=smoothstep(.30,.60,abs(outerAmt-.5)*2.);',
    '  col=mix(col,vec3(.90,.88,.88),hi*clump);',
    '  gl_FragColor=vec4(col,1.);',
    '}',
  ].join('\n');
  // Loop rings: thick concentric rings drifting toward center.
  // uAspect = canvas W/H — corrects for aspect ratio so rings are truly circular.
  // uCenter = card center in canvas UV [0-1] — rings are centered on the card, not the canvas.
  var FRAG_LOOP = [
    'precision highp float;',
    'varying vec2 vTexCoord;',
    'uniform float uTime;',
    'uniform float uAspect;',  // canvas W/H
    'uniform vec2  uCenter;',  // card center in canvas UV [0-1]
    'uniform vec3  uBgInner;',
    'uniform vec3  uBgOuter;',
    'uniform vec3  uRingColor;',
    NOISE_GLSL,
    'void main(){',
    // Raw UV relative to card center (used for isotropic noise sampling)
    '  vec2 raw=vTexCoord-uCenter;',
    // Aspect-corrected UV: uv.x *= W/H so that length(uv) is proportional to physical pixels
    '  vec2 uv=vec2(raw.x*uAspect,raw.y);',
    '  float dist=length(uv);',
    // Very subtle noise warp on ring radius — keeps the organic feel without blurring
    '  float n=noiseVal(raw*3.5+uTime*.14)*.005;',
    '  float d=dist+n;',
    // Rings drift inward
    '  float freq=20.,speed=.81;',
    '  float ring=fract(d*freq+uTime*speed);',
    // Thick rings (50% fill) with crisp edges (e ≪ ring width)
    '  float w=.50,e=.014;',
    '  float mask=smoothstep(0.,e,ring)*smoothstep(w,w-e,ring);',
    // Fade rings in from center outward (hides convergence artifact at origin)
    '  mask*=smoothstep(.08,.22,dist);',
    // Warm radial background gradient
    '  float bgT=smoothstep(0.,.65,dist);',
    '  vec3 bg=mix(uBgInner,uBgOuter,bgT);',
    '  gl_FragColor=vec4(mix(bg,uRingColor,mask*.92),1.0);',
    '}',
  ].join('\n');

  // Aurora borealis: luminous curtains rippling across a dark sky.
  // Three overlapping sine-wave bands warped by fbm -- organic curtain edges.
  // uColorA = lower aurora (teal), uColorB = upper aurora (violet), uSky = background.
  var FRAG_AURORA = [
    'precision highp float;',
    'varying vec2 vTexCoord;',
    'uniform float uTime;',
    'uniform float uAspect;',    // canvas W/H
    'uniform vec2  uResolution;',// [width, height] in CSS pixels -- drives feature scale
    'uniform vec3  uColorA;',    // lower aurora color (teal)
    'uniform vec3  uColorB;',    // upper aurora color (violet)
    'uniform vec3  uSky;',       // background sky (near-black)
    NOISE_GLSL,
    'void main(){',
    '  vec2 uv=vTexCoord;',
    '  vec2 st=vec2(uv.x*uAspect,uv.y);',
    // sc: scale noise features so they stay consistent physical size across canvas heights.
    // At 600px reference height, sc=1. Double the height -> double the noise blob size (scale up).
    // Clamped so thumbnails (small) stay visible and extreme 4K sizes don't overwhelm.
    '  float sc=clamp(uResolution.y/600.,0.4,2.5);',
    '  vec2 ns=st/sc;',          // size-normalised coordinate for noise sampling
    // Two fbm warps evolve the curtain shape over time -- no horizontal translation = no seam
    '  float wA=fbm(vec2(ns.x*2.0,uTime*.09));',
    '  float wB=fbm(vec2(ns.x*1.2,uTime*.06+3.7));',
    '  float wx=uv.x+(wA-.5)*.30+(wB-.5)*.15;',
    // Per-position intensity pulses -- brightness at each column evolves, no scrolling
    '  float nwx=wx*uAspect/sc;',
    '  float p1=fbm(vec2(nwx*4.0,uTime*.12));',
    '  float p2=fbm(vec2(nwx*3.0,uTime*.09+2.1));',
    '  float p3=fbm(vec2(nwx*5.0,uTime*.16+4.3));',
    // Band Gaussian widths adapt to aspect: on wide/landscape screens bands are taller so they fill
    // the shorter height dimension; on portrait they stay proportional to canvas height.
    // bw = uAspect clamped keeps physical band height ≈ 0.18 * canvas_width on any orientation.
    '  float bw=clamp(uAspect,0.6,2.5);',
    // Sine sets static band x-positions -- no uTime inside sin = no translating seam
    '  float s1=sin(wx*7.5)*.5+.5;',
    '  float dy1=(uv.y-.50)/(bw*.18); float b1=exp(-dy1*dy1);',
    '  float s2=sin(wx*5.0+1.5)*.5+.5;',
    '  float dy2=(uv.y-.65)/(bw*.15); float b2=exp(-dy2*dy2);',
    '  float s3=sin(wx*10.5+3.1)*.5+.5;',
    '  float dy3=(uv.y-.35)/(bw*.12); float b3=exp(-dy3*dy3);',
    '  float aurora=s1*b1*(p1*.9+.1)*.95+s2*b2*(p2*.8+.2)*.75+s3*b3*(p3*.7+.3)*.55;',
    '  float colorT=clamp(uv.y*1.8-.4,0.,1.);',
    '  vec3 auroraCol=mix(uColorA,uColorB,colorT);',
    '  float nebula=fbm(ns*.7+vec2(0.,uTime*.03))*.15;',
    '  vec3 col=uSky*(1.+nebula)+auroraCol*aurora*1.3;',
    '  gl_FragColor=vec4(clamp(col,0.,1.),1.);',
    '}',
  ].join('\n');

  function generate() {
    new p5(function (p) {

      function n(col) { return col.map(function (v) { return v / 255; }); }

      // Render a WEBGL shader to a graphics buffer → JPEG data URL
      function renderJPEG(fragSrc, size, setUniforms) {
        var g = p.createGraphics(size, size, p.WEBGL);
        g.pixelDensity(1);
        var shad = g.createShader(VERT, fragSrc);
        g.shader(shad);
        setUniforms(shad);
        g.noStroke();
        g.rectMode(p.CENTER);
        g.rect(0, 0, size, size);
        var img = g.get(0, 0, size, size);
        var url = img.canvas.toDataURL('image/jpeg', 0.92);
        g.remove();
        return url;
      }

      p.setup = function () {
        p.noCanvas();

        // Expose vertex shader so Collectible.jsx live canvas can use it
        window.STUB.SCENE_VERT = VERT;

        // Animated shader definitions used by SceneBg live canvas mounts
        window.STUB.SCENE_SHADERS = {
          chicot: {
            frag: FRAG_PAINT,
            setUniforms: function (shad, p2) {
              shad.setUniform('uTime',   p2.millis() / 1000.0);
              shad.setUniform('uAspect', p2.width / p2.height);
              var center = [0.5, 0.5];
              var cardEl = document.querySelector('.wiz--fx .cc-stage');
              if (cardEl && p2.canvas) {
                var cr = cardEl.getBoundingClientRect();
                var cvr = p2.canvas.getBoundingClientRect();
                if (cvr.width > 0 && cvr.height > 0) {
                  center = [
                    (cr.left + cr.width  * 0.5 - cvr.left) / cvr.width,
                    (cr.top  + cr.height * 0.5 - cvr.top)  / cvr.height,
                  ];
                }
              }
              shad.setUniform('uCenter',     center);
              shad.setUniform('uPaintOuter', [0.90, 0.10, 0.20]);
              shad.setUniform('uPaintInner', [0.12, 0.18, 0.92]);
            },
          },
          canio: {
            frag: FRAG_PAINT,
            setUniforms: function (shad, p2) {
              shad.setUniform('uTime',   p2.millis() / 1000.0);
              shad.setUniform('uAspect', p2.width / p2.height);
              var center = [0.5, 0.5];
              var cardEl = document.querySelector('.wiz--fx .cc-stage');
              if (cardEl && p2.canvas) {
                var cr = cardEl.getBoundingClientRect();
                var cvr = p2.canvas.getBoundingClientRect();
                if (cvr.width > 0 && cvr.height > 0) {
                  center = [
                    (cr.left + cr.width  * 0.5 - cvr.left) / cvr.width,
                    (cr.top  + cr.height * 0.5 - cvr.top)  / cvr.height,
                  ];
                }
              }
              shad.setUniform('uCenter',     center);
              shad.setUniform('uPaintOuter', [0.10, 0.20, 0.92]);
              shad.setUniform('uPaintInner', [0.05, 0.72, 0.18]);
            },
          },
          loop: {
            frag: FRAG_LOOP,
            setUniforms: function (shad, p2) {
              shad.setUniform('uTime',   p2.millis() / 1000.0);
              shad.setUniform('uAspect', p2.width / p2.height);
              // Card center in canvas UV — tracked live so rings always stay on the card
              var center = [0.5, 0.5];
              var cardEl = document.querySelector('.wiz--fx .cc-stage');
              if (cardEl && p2.canvas) {
                var cr = cardEl.getBoundingClientRect();
                var cvr = p2.canvas.getBoundingClientRect();
                if (cvr.width > 0 && cvr.height > 0) {
                  center = [
                    (cr.left + cr.width  * 0.5 - cvr.left) / cvr.width,
                    (cr.top  + cr.height * 0.5 - cvr.top)  / cvr.height,
                  ];
                }
              }
              shad.setUniform('uCenter',    center);
              shad.setUniform('uBgInner',   [0.94, 0.51, 0.29]);
              shad.setUniform('uBgOuter',   [0.80, 0.34, 0.18]);
              shad.setUniform('uRingColor', [1.00, 0.94, 0.82]);
            },
          },
          loopbw: {
            frag: FRAG_LOOP,
            setUniforms: function (shad, p2) {
              shad.setUniform('uTime',   p2.millis() / 1000.0);
              shad.setUniform('uAspect', p2.width / p2.height);
              var center = [0.5, 0.5];
              var cardEl = document.querySelector('.wiz--fx .cc-stage');
              if (cardEl && p2.canvas) {
                var cr = cardEl.getBoundingClientRect();
                var cvr = p2.canvas.getBoundingClientRect();
                if (cvr.width > 0 && cvr.height > 0) {
                  center = [
                    (cr.left + cr.width  * 0.5 - cvr.left) / cvr.width,
                    (cr.top  + cr.height * 0.5 - cvr.top)  / cvr.height,
                  ];
                }
              }
              shad.setUniform('uCenter',    center);
              shad.setUniform('uBgInner',   [0.98, 0.98, 0.99]);
              shad.setUniform('uBgOuter',   [0.89, 0.89, 0.92]);
              shad.setUniform('uRingColor', [0.11, 0.10, 0.18]);
            },
          },
          aurora: {
            frag: FRAG_AURORA,
            setUniforms: function(shad, p2) {
              shad.setUniform('uTime',       p2.millis() / 1000.0);
              shad.setUniform('uAspect',     p2.width / p2.height);
              shad.setUniform('uResolution', [p2.width, p2.height]);
              shad.setUniform('uColorA',     [0.05, 0.85, 0.55]);  // teal-green lower aurora
              shad.setUniform('uColorB',     [0.55, 0.15, 0.90]);  // violet upper aurora
              shad.setUniform('uSky',        [0.02, 0.03, 0.12]);  // near-black sky
            },
          },
          solar: {
            frag: FRAG_AURORA,
            setUniforms: function(shad, p2) {
              shad.setUniform('uTime',       p2.millis() / 1000.0);
              shad.setUniform('uAspect',     p2.width / p2.height);
              shad.setUniform('uResolution', [p2.width, p2.height]);
              shad.setUniform('uColorA',     [0.95, 0.25, 0.05]);  // vivid red-orange lower
              shad.setUniform('uColorB',     [0.75, 0.05, 0.55]);  // deep crimson-magenta upper
              shad.setUniform('uSky',        [0.05, 0.01, 0.02]);  // near-black with red tint
            },
          },
        };

        // Defer static thumbnail generation past first render
        setTimeout(function () {
          var S = 512;

          window.STUB.SCENE_TEX = {

            // Chicot chip thumbnail: red outer → blue center, square so aspect=1
            chicot: renderJPEG(FRAG_PAINT, S, function (shad) {
              shad.setUniform('uTime',       0.0);
              shad.setUniform('uAspect',     1.0);
              shad.setUniform('uCenter',     [0.5, 0.5]);
              shad.setUniform('uPaintOuter', [0.90, 0.08, 0.03]);
              shad.setUniform('uPaintInner', [0.12, 0.18, 0.92]);
            }),

            // Canio chip thumbnail: blue outer → green center, square so aspect=1
            canio: renderJPEG(FRAG_PAINT, S, function (shad) {
              shad.setUniform('uTime',       0.0);
              shad.setUniform('uAspect',     1.0);
              shad.setUniform('uCenter',     [0.5, 0.5]);
              shad.setUniform('uPaintOuter', [0.10, 0.20, 0.92]);
              shad.setUniform('uPaintInner', [0.05, 0.72, 0.18]);
            }),

            // Loop chip thumbnail: rings at t=0, square canvas so aspect=1, center=0.5
            loop: renderJPEG(FRAG_LOOP, S, function (shad) {
              shad.setUniform('uTime',      0.0);
              shad.setUniform('uAspect',    1.0);
              shad.setUniform('uCenter',    [0.5, 0.5]);
              shad.setUniform('uBgInner',   [0.94, 0.51, 0.29]);
              shad.setUniform('uBgOuter',   [0.80, 0.34, 0.18]);
              shad.setUniform('uRingColor', [1.00, 0.94, 0.82]);
            }),

            // LoopBW chip thumbnail
            loopbw: renderJPEG(FRAG_LOOP, S, function (shad) {
              shad.setUniform('uTime',      0.0);
              shad.setUniform('uAspect',    1.0);
              shad.setUniform('uCenter',    [0.5, 0.5]);
              shad.setUniform('uBgInner',   [0.98, 0.98, 0.99]);
              shad.setUniform('uBgOuter',   [0.89, 0.89, 0.92]);
              shad.setUniform('uRingColor', [0.11, 0.10, 0.18]);
            }),
            // Aurora: t=0 freezes band positions for chip thumbnail; pass real resolution for scale
            aurora: renderJPEG(FRAG_AURORA, S, function(shad) {
              shad.setUniform('uTime',       0.0);
              shad.setUniform('uAspect',     1.0);
              shad.setUniform('uResolution', [S, S]);
              shad.setUniform('uColorA',     [0.05, 0.85, 0.55]);
              shad.setUniform('uColorB',     [0.55, 0.15, 0.90]);
              shad.setUniform('uSky',        [0.02, 0.03, 0.12]);
            }),
            // Solar: warm crimson-amber variant of the aurora shader
            solar: renderJPEG(FRAG_AURORA, S, function(shad) {
              shad.setUniform('uTime',       0.0);
              shad.setUniform('uAspect',     1.0);
              shad.setUniform('uResolution', [S, S]);
              shad.setUniform('uColorA',     [0.95, 0.25, 0.05]);
              shad.setUniform('uColorB',     [0.75, 0.05, 0.55]);
              shad.setUniform('uSky',        [0.05, 0.01, 0.02]);
            }),
          };

          window.dispatchEvent(new CustomEvent('stubtex:ready'));
        }, 0);
      };
    });
  }

  if (typeof p5 !== 'undefined') {
    generate();
  } else {
    window.addEventListener('load', generate);
  }
})();
