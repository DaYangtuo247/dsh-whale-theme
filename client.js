/*! dsh-whale-theme v1.0.0 — built by build.mjs from src/lib/01-bg-assets.js, src/lib/02-bg-aurora.js, src/lib/03-bg-whale.js, src/lib/04-bg-constellation.js, src/styles/05-background.scss, src/styles/06-glass.scss, src/styles/07-theme-settings.scss, src/parts/05-background.js, src/parts/06-glass.js, src/parts/07-settings.js, src/parts/08-fonts.js. Edit src/, not this file. */
;(() => {
const BUNDLE = "dsh-whale-theme"
const parts = []
const part = (m) => { parts.push(m) }
/**
 * Shared helpers for the dsh-claude-* bundles (copied into each built client.js).
 * Every part gets one kit: React and createElement, a body portal, named style sheets, and the
 * settings controls used by every 设置 row of ours (settingsUI: Row, Select, Switch matching dsh's own rows).
 */
function makeKit(require, bundle) {
  const React = require('react')
  let ReactDOM = null
  try { ReactDOM = require('react-dom') } catch {}
  return {
    React,
    h: React.createElement,
    /** Popovers render into <body> so no transformed / contained ancestor can offset position:fixed. */
    portal: (el, target = document.body) => (ReactDOM && typeof ReactDOM.createPortal === 'function' ? ReactDOM.createPortal(el, target) : el),
    /** A lazily inserted <style data-plugin="bundle/name">; ensure() is idempotent, remove() undoes it. */
    sheet(name, css) {
      let tag = null
      return {
        ensure() {
          if (tag && document.head.contains(tag)) return
          tag = document.createElement('style')
          tag.dataset.plugin = `${bundle}/${name}`
          tag.textContent = css
          document.head.appendChild(tag)
        },
        remove() { if (tag) { tag.remove(); tag = null } },
      }
    },
    /** Settings rows and controls (made once per bundle on first use). */
    settingsUI() {
      if (!this._settingsUI) this._settingsUI = makeSettingsUI(this)
      return this._settingsUI
    },
  }
}

/** Row / Select / Switch for 设置 pages, styled like dsh's own preference rows. */
function makeSettingsUI(kit) {
    const { React, h, portal } = kit
    const { useState, useEffect, useRef, useLayoutEffect } = React
    const sheet = kit.sheet('settings-ui', `
  .dcf-row{display:flex;align-items:center;gap:8px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
  .dcf-row .txt{flex:1 1 auto;min-width:0}
  .dcf-row .lbl{font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
  .dcf-row .desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
  .dap-sel{display:inline-flex;align-items:center;gap:12px;flex:none;height:36px;max-width:260px;padding:0 14px;border:0;border-radius:var(--dsw-radius-md,12px);
    background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;cursor:pointer;white-space:nowrap}
  .dap-sel:hover,.dap-sel[aria-expanded=true]{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-module-platform))}
  .dap-sel .v{overflow:hidden;text-overflow:ellipsis}
  .dap-sel svg{flex:none;width:14px;height:14px;color:var(--dsw-alias-label-secondary)}
  .dap-menu{box-sizing:border-box;position:fixed;z-index:1100;min-width:180px;max-height:min(360px,calc(100vh - 24px));overflow:auto;padding:6px;border-radius:var(--dsw-radius-lg,14px);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));backdrop-filter:var(--dsw-menu-backdrop-filter);-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(0,0,0,.18));color:var(--dsw-alias-label-primary);font-size:13.5px;line-height:20px;animation:dap-in .14s cubic-bezier(.2,.8,.2,1) both}
  @keyframes dap-in{from{opacity:0;transform:translateY(-3px)}}
  .dap-menu button{display:flex;align-items:center;gap:10px;width:100%;min-height:32px;padding:6px 10px;border:0;border-radius:9px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;white-space:nowrap}
  .dap-menu button:hover,.dap-menu button.kbd{background:var(--dsw-alias-interactive-bg-hover)}
  .dap-menu button .l{flex:1 1 auto}
  .dap-menu button svg{flex:none;width:15px;height:15px}
  .dsu-switch{position:relative;flex:none;width:36px;height:22px;padding:0;border:0;border-radius:11px;background:var(--dsw-alias-bg-module-platform);cursor:pointer;transition:background-color .18s ease}
  .dsu-switch::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;corner-shape:round;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s cubic-bezier(.2,.8,.2,1)}
  .dsu-switch[aria-checked=true]{background:var(--dsw-alias-state-business-primary,#4d6bfe)}
  .dsu-switch[aria-checked=true]::after{transform:translateX(14px)}
  @media (prefers-reduced-motion: reduce){.dsu-switch,.dsu-switch::after{transition:none}}
  `)
    const zhUI = () => !/^en/i.test(document.documentElement.lang || '')
    const L = (o) => (zhUI() ? o.zh : o.en)
    const S = (z, e) => (zhUI() ? z : e)
    const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
    const chev = () => h('svg', { viewBox: '0 0 16 16', 'aria-hidden': true }, h('path', { d: 'M4.5 6.5 8 10l3.5-3.5', ...sw }))
    const check = () => h('svg', { viewBox: '0 0 16 16', 'aria-hidden': true }, h('path', { d: 'M3.5 8.4 6.6 11.4 12.5 4.8', ...sw, strokeWidth: 1.7 }))

    // ------------------------------------------------------------------ controls
    function Select({ value, options, onChange, box, label }) {
      const [open, setOpen] = useState(false)
      const [pos, setPos] = useState(null)
      const btn = useRef(null)
      const menu = useRef(null)
      const cur = options.find((o) => o.v === value) || options[0]
      useLayoutEffect(() => {
        if (!open) return
        const r = btn.current.getBoundingClientRect()
        const w = Math.max(r.width, 200)
        const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))
        const below = window.innerHeight - r.bottom
        setPos(below > 220 ? { left, top: r.bottom + 4, width: w } : { left, bottom: window.innerHeight - r.top + 4, width: w })
      }, [open])
      useEffect(() => {
        if (!open) return undefined
        const down = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false) }
        const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus() } }
        const scroll = (e) => { if (!menu.current?.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', down, true)
        document.addEventListener('keydown', key, true)
        document.addEventListener('scroll', scroll, true)
        return () => { document.removeEventListener('mousedown', down, true); document.removeEventListener('keydown', key, true); document.removeEventListener('scroll', scroll, true) }
      }, [open])
      return h(React.Fragment, null,
        h('button', { ref: btn, type: 'button', className: `dap-sel${box ? ' box' : ''}`, 'aria-haspopup': 'listbox', 'aria-expanded': open, 'aria-label': label, onClick: () => setOpen((v) => !v) },
          h('span', { className: 'v' }, cur.label || L(cur)), chev()),
        open && pos ? portal(h('div', { ref: menu, className: 'dap-menu', role: 'listbox', style: { left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width } },
          options.map((o) => h('button', {
            key: String(o.v), type: 'button', role: 'option', 'aria-selected': o.v === value,
            onClick: () => { setOpen(false); onChange(o.v); btn.current?.focus() },
          }, h('span', { className: 'l', style: o.font ? { fontFamily: o.font } : undefined }, o.label || L(o)), o.v === value ? check() : null)))) : null)
    }

    function Row({ label, desc, children }) {
      return h('div', { className: 'dcf-row' },
        h('div', { className: 'txt' }, h('div', { className: 'lbl' }, label), desc ? h('div', { className: 'desc' }, desc) : null),
        children)
    }
    function Switch({ checked, onChange, label }) {
      return h('button', { type: 'button', role: 'switch', className: 'dsu-switch', 'aria-checked': !!checked, 'aria-label': label, onClick: () => onChange(!checked) })
    }
    return { sheet, Row, Select, Switch, L, S }
}

/**
 * One feature registry per bundle (kit.js is copied into each client.js, so this singleton is
 * bundle-local): a bundle's settings surfaces list and flip only its own features, never another
 * plugin's. Each part declares itself with `feature:` metadata; gateFeature() below starts/stops
 * the part live. Choices persist in one localStorage key (feature ids are unique across bundles);
 * absent means on.
 */
let featureStoreInstance
function featureStore() {
  if (featureStoreInstance) return featureStoreInstance
  const KEY = 'dsh-claude-features.enabled'
  let enabled = {}
  try { enabled = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch {}
  let rev = 0
  const meta = []
  const subs = new Set()
  const store = {
    declare(bundle, id, f) { if (f && !meta.some((m) => m.id === id)) meta.push({ bundle, id, ...f }) },
    list: () => meta.slice(),
    enabled: (id) => enabled[id] !== false,
    revision: () => rev,
    set(id, on) {
      enabled = { ...enabled, [id]: !!on }
      try { localStorage.setItem(KEY, JSON.stringify(enabled)) } catch {}
      rev++
      for (const fn of subs) fn(id)
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
  }
  featureStoreInstance = store
  return store
}

/**
 * Run one feature part in its own cordis fiber so the settings tab can dispose and restart it.
 * Infrastructure parts (no `feature:`) stay on the plain synchronous path: dom-hub must be up
 * before anything subscribes to kit.dom. Fibers activate in declaration order (microtasks), so
 * parts that read each other's setup still see it.
 */
function gateFeature(ctx, store, mod) {
  let fiber = null
  let slotDisposers = []
  // slots.inject ties its effect to the slots service's own fiber, not ours, so a disposed feature
  // would leave its contribution mounted; collect the returned disposers and run them on stop.
  const slots = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'inject') return (key, cb) => { const d = ctx.slots.inject(key, cb); slotDisposers.push(d); return d }
      const v = ctx.slots[prop]
      return typeof v === 'function' ? v.bind(ctx.slots) : v
    },
  })
  const scope = ctx.extend({ slots })
  const start = () => {
    if (fiber || !store.enabled(mod.id)) return
    fiber = scope.plugin({ name: mod.id, inject: mod.inject, apply: (s) => mod.apply(s) })
  }
  const stop = () => {
    const f = fiber
    fiber = null
    for (const d of slotDisposers.splice(0)) { try { d() } catch {} }
    if (f) Promise.resolve(f.dispose()).catch(() => {})
  }
  start()
  const off = store.subscribe((id) => { if (id === mod.id) (store.enabled(mod.id) ? start() : stop()) })
  ctx.effect(() => () => { off(); stop() }, `feature: ${mod.id}`)
}

// ===== src/lib/01-bg-assets.js
"use strict";
/*!
 * Background assets (top level, shared by the background engines): the WebGL shaders, the whale
 * texture and its particle sampling, and 4x4 matrix helpers. Pure data and functions, no page state.
 * Shaders and parameters are the deepseek.com hero's, as extracted by the original
 * dsh-client-ui-deepseek-bg v1.0.0 (MIT).
 */
/* ------------------------------------------------------------------ *
 * 着色器（与 DeepSeek 打包产物逐字一致）
 * ------------------------------------------------------------------ */
var VERT = "#version 300 es\nin vec4 a_position;\nout vec2 vUv;\nvoid main() {\n  vUv = a_position.xy * 0.5 + 0.5;\n  gl_Position = a_position;\n}\n";
var FLOWMAP_FS = "#version 300 es\n" +
    "precision mediump float;\n" +
    "in vec2 vUv;\n" +
    "uniform sampler2D u_prev;\n" +
    "uniform vec2 u_mouse;\n" +
    "uniform vec2 u_velocity;\n" +
    "uniform float u_brushRadius;\n" +
    "uniform float u_brushStrength;\n" +
    "uniform float u_decay;\n" +
    "out vec4 fragColor;\n" +
    "\n" +
    "void main() {\n" +
    "  vec4 prev = texture(u_prev, vUv);\n" +
    "\n" +
    "  prev.r *= u_decay;\n" +
    "  prev.gb = mix(vec2(0.5), prev.gb, u_decay);\n" +
    "\n" +
    "  float dist = distance(vUv, u_mouse);\n" +
    "\n" +
    "  float influence = exp(-dist * dist / (u_brushRadius * u_brushRadius * 0.5));\n" +
    "  influence = max(0.0, influence - 0.01);\n" +
    "\n" +
    "  float speed = length(u_velocity);\n" +
    "  float presenceStrength = u_brushStrength * 0.3;\n" +
    "  float velBonus = min(speed * 3.0, 0.7) * u_brushStrength;\n" +
    "  float totalStrength = presenceStrength + velBonus;\n" +
    "\n" +
    "  prev.r = max(prev.r, influence * totalStrength);\n" +
    "  float blendAmt = influence * min(totalStrength, 0.4) * 0.3;\n" +
    "  prev.g = mix(prev.g, clamp(u_velocity.x * 2.0 + 0.5, 0.0, 1.0), blendAmt);\n" +
    "  prev.b = mix(prev.b, clamp(u_velocity.y * 2.0 + 0.5, 0.0, 1.0), blendAmt);\n" +
    "\n" +
    "  fragColor = prev;\n" +
    "}\n";
var FLUID_FS = "#version 300 es\n" +
    "precision mediump float;\n" +
    "in vec2 vUv;\n" +
    "uniform float u_time;\n" +
    "uniform vec2 u_resolution;\n" +
    "uniform vec3 u_c1, u_c2, u_c3, u_c4, u_c5;\n" +
    "uniform float u_scale;\n" +
    "uniform vec2 u_offset;\n" +
    "uniform float u_grain;\n" +
    "uniform float u_speed;\n" +
    "uniform sampler2D u_flowmap;\n" +
    "uniform float u_distortBoost;\n" +
    "uniform float u_swirlBoost;\n" +
    "uniform float u_glowIntensity;\n" +
    "uniform vec3 u_glowColor1;\n" +
    "uniform vec3 u_glowColor2;\n" +
    "uniform vec3 u_glowColor3;\n" +
    "uniform vec2 u_lightPos;\n" +
    "uniform float u_lightCore;\n" +
    "uniform float u_lightHalo;\n" +
    "uniform float u_vignette;\n" +
    "uniform float u_bloomThreshold;\n" +
    "uniform float u_bloomRange;\n" +
    "uniform float u_bloomStrength;\n" +
    "out vec4 fragColor;\n" +
    "\n" +
    "vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}\n" +
    "vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}\n" +
    "vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}\n" +
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}\n" +
    "\n" +
    "float snoise(vec3 v){\n" +
    "  const vec2 C=vec2(1./6.,1./3.);\n" +
    "  const vec4 D=vec4(0.,.5,1.,2.);\n" +
    "  vec3 i=floor(v+dot(v,C.yyy));\n" +
    "  vec3 x0=v-i+dot(i,C.xxx);\n" +
    "  vec3 g=step(x0.yzx,x0.xyz);\n" +
    "  vec3 l=1.-g;\n" +
    "  vec3 i1=min(g.xyz,l.zxy);\n" +
    "  vec3 i2=max(g.xyz,l.zxy);\n" +
    "  vec3 x1=x0-i1+C.xxx;\n" +
    "  vec3 x2=x0-i2+C.yyy;\n" +
    "  vec3 x3=x0-D.yyy;\n" +
    "  i=mod289v3(i);\n" +
    "  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));\n" +
    "  float n_=.142857142857;\n" +
    "  vec3 ns=n_*D.wyz-D.xzx;\n" +
    "  vec4 j=p-49.*floor(p*ns.z*ns.z);\n" +
    "  vec4 x_=floor(j*ns.z);\n" +
    "  vec4 y_=floor(j-7.*x_);\n" +
    "  vec4 x=x_*ns.x+ns.yyyy;\n" +
    "  vec4 y=y_*ns.x+ns.yyyy;\n" +
    "  vec4 h=1.-abs(x)-abs(y);\n" +
    "  vec4 b0=vec4(x.xy,y.xy);\n" +
    "  vec4 b1=vec4(x.zw,y.zw);\n" +
    "  vec4 s0=floor(b0)*2.+1.;\n" +
    "  vec4 s1=floor(b1)*2.+1.;\n" +
    "  vec4 sh=-step(h,vec4(0.));\n" +
    "  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;\n" +
    "  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;\n" +
    "  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);\n" +
    "  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);\n" +
    "  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));\n" +
    "  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;\n" +
    "  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);\n" +
    "  m=m*m;\n" +
    "  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));\n" +
    "}\n" +
    "\n" +
    "float hash(vec2 p){\n" +
    "  vec3 p3=fract(vec3(p.xyx)*.1031);\n" +
    "  p3+=dot(p3,p3.yzx+33.33);\n" +
    "  return fract((p3.x+p3.y)*p3.z);\n" +
    "}\n" +
    "\n" +
    "float fbm(vec3 p){\n" +
    "  float v=0.,amp=.6;vec3 shift=vec3(100.);\n" +
    "  for(int i=0;i<1;i++){v+=amp*snoise(p);p=p*2.+shift;amp*=.4;}\n" +
    "  return v;\n" +
    "}\n" +
    "\n" +
    "float fluidNoise(vec2 uv,float t){\n" +
    "  float n1=fbm(vec3(uv*.6,t*.06));\n" +
    "  float n2=fbm(vec3(uv*.6+5.2,t*.06+1.3));\n" +
    "  vec2 w1=vec2(n1,n2)*.6;\n" +
    "  float n3=fbm(vec3((uv+w1)*.7+1.7,t*.05+3.1));\n" +
    "  float n4=fbm(vec3((uv+w1)*.7+9.2,t*.05+5.7));\n" +
    "  vec2 w2=vec2(n3,n4)*.5;\n" +
    "  return fbm(vec3((uv+w1+w2)*.5,t*.04));\n" +
    "}\n" +
    "\n" +
    "vec2 curlish(vec2 uv,float t){\n" +
    "  float eps=.02;\n" +
    "  float n=snoise(vec3(uv*.8,t));\n" +
    "  float nx=snoise(vec3((uv+vec2(eps,0.))*.8,t));\n" +
    "  float ny=snoise(vec3((uv+vec2(0.,eps))*.8,t));\n" +
    "  return vec2(-(ny-n)/eps,(nx-n)/eps)*.003;\n" +
    "}\n" +
    "\n" +
    "void main(){\n" +
    "  float aspect=u_resolution.x/u_resolution.y;\n" +
    "  vec2 uv=gl_FragCoord.xy/u_resolution;\n" +
    "  vec2 suv=vec2(uv.x*aspect, uv.y) * u_scale + u_offset;\n" +
    "  float t=u_time;\n" +
    "\n" +
    "  // Mouse interaction via flowmap\n" +
    "  vec4 flow = texture(u_flowmap, uv);\n" +
    "  float influence = flow.r;\n" +
    "  vec2 flowDir = (flow.gb - 0.5) * 2.0;\n" +
    "\n" +
    "  // Apply mouse distortion to UV\n" +
    "  suv += flowDir * influence * u_distortBoost * 0.8;\n" +
    "  // Apply mouse swirl\n" +
    "  float swirlAngle = influence * u_swirlBoost * 2.5;\n" +
    "  float cs = cos(swirlAngle), sn = sin(swirlAngle);\n" +
    "  vec2 delta = suv - vec2(uv.x * aspect, uv.y) * u_scale;\n" +
    "  suv += (mat2(cs, sn, -sn, cs) * delta - delta) * influence;\n" +
    "\n" +
    "  vec2 curl=curlish(suv,t*.04);\n" +
    "  vec2 uvD=suv+curl*12.;\n" +
    "  float f=fluidNoise(uvD,t);\n" +
    "  float swirl=snoise(vec3(uvD*.8+f*1.5,t*.035))*.5+.5;\n" +
    "  float n=f*.5+.5;\n" +
    "  vec3 col=mix(u_c1,u_c2,smoothstep(.2,.5,n));\n" +
    "  col=mix(col,u_c3,smoothstep(.35,.65,n+swirl*.25));\n" +
    "  col=mix(col,u_c4,smoothstep(.6,.85,swirl)*.55);\n" +
    "  col=mix(col,u_c5,smoothstep(.5,.8,n*swirl)*.35);\n" +
    "\n" +
    "  // Mouse proximity color shift: 3-color glow blended by distance + noise\n" +
    "  float glow = smoothstep(0.0, 0.8, influence);\n" +
    "  float glowNoise = snoise(vec3(uvD * 1.5, t * 0.08)) * 0.5 + 0.5;\n" +
    "  float glowDist = smoothstep(0.0, 1.0, influence);\n" +
    "  vec3 glowMix = mix(u_glowColor3, u_glowColor2, glowDist);\n" +
    "  glowMix = mix(glowMix, u_glowColor1, glowDist * glowNoise);\n" +
    "  col = mix(col, glowMix, glow * u_glowIntensity);\n" +
    "\n" +
    "  if(u_grain>0.0){\n" +
    "    vec2 flowOffset = (uvD - suv) * u_resolution.y;\n" +
    "    vec2 gp = floor((gl_FragCoord.xy + flowOffset) / 5.0);\n" +
    "    float gr=hash(gp)*2.-1.;\n" +
    "    col+=gr*u_grain;\n" +
    "  }\n" +
    "\n" +
    "  // Self-luminance bloom: bright fluid regions become their own light spots,\n" +
    "  // so glow follows the flow and mouse disturbance instead of a fixed point\n" +
    "  float luma=dot(col,vec3(.299,.587,.114));\n" +
    "  float bloom=smoothstep(u_bloomThreshold-u_bloomRange,u_bloomThreshold+u_bloomRange,luma);\n" +
    "  col+=(col*.85+vec3(.15,.145,.13))*bloom*u_bloomStrength;\n" +
    "\n" +
    "  // Virtual light source: soft warm core (same side as helm lighting)\n" +
    "  float ld=length((uv-u_lightPos)*vec2(aspect,1.));\n" +
    "  float core=exp(-ld*ld*4.5);\n" +
    "  float halo=exp(-ld*1.8);\n" +
    "  col+=vec3(1.,.97,.9)*core*u_lightCore+vec3(.72,.8,1.)*halo*u_lightHalo;\n" +
    "\n" +
    "  float vig=1.-smoothstep(.35,.75,length(uv-.5));\n" +
    "  col=mix(col*(1.-u_vignette),col,vig);\n" +
    "  fragColor=vec4(col,1.);\n" +
    "}\n";
/* ------------------------------------------------------------------ *
 * 粒子化鲸鱼引擎（官方移植：HeroDigitileR3F → 原生 WebGL2）
 * 源码取自官网 harness 页懒加载 chunk 776（未进缓存，已从官网抓取）：
 *   - 粒子位置：官方算法从 hero-whale.svg 像素亮度采样（60x60，边缘保留）
 *   - 顶点/片元 shader：官方 GLSL 逐字移植（three.js 矩阵替换为原生 uniform）
 *   - 交互：鼠标扭曲粒子（radius/strength/decay/distort）、光线跟随鼠标
 *     （lightParams.followX）、入场组装动画、松散漂移、游泳波动
 *   - 参数：DIGITILE_LIGHT_DEFAULTS / DIGITILE_MOUSE_DEFAULTS 与官方一致
 * ------------------------------------------------------------------ */
// 官方鲸鱼纹理（hero-whale.svg，抓自 https://www.deepseek.com/harness/images/hero-whale.svg）
var WHALE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18" viewBox="0 0 24 18" fill="none"><path d="M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746V14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z" fill="#FFFFFF"/></svg>';
var WHALE_SRC = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(WHALE_SVG);
// 官方参数（chunk 776 源码常量，fish 变体：shadeMin .2 / shadeMax .4*2.79）——原值，未调参
var LIGHT_DEFAULTS = { x: 4.5, y: 5.5, z: 3, range: 14, shadeMin: 0.2, shadeMax: 1.116, followX: 1.05 };
var MOUSE_DEFAULTS = { radius: 4.9, strength: 0.8, decay: 0.2, distort: 5 };
var WAVE_DEFAULTS = { speed: 1.5, amount: 0.06 };
function sampleWhalePixels(img) {
    var T = 60;
    var c = document.createElement("canvas");
    c.width = T;
    c.height = T;
    var a = c.getContext("2d");
    a.fillStyle = "#000";
    a.fillRect(0, 0, T, T);
    var r = Math.min(T / img.width, T / img.height);
    var o = img.width * r, s = img.height * r;
    a.drawImage(img, (T - o) / 2, (T - s) / 2, o, s);
    var d = a.getImageData(0, 0, T, T);
    var lum = new Float32Array(T * T);
    for (var i = 0; i < T * T; i++)
        lum[i] = (0.299 * d.data[4 * i] + 0.587 * d.data[4 * i + 1] + 0.114 * d.data[4 * i + 2]) / 255;
    var positions = [], scattered = [], opacities = [], edges = [];
    var half = T / 2;
    function isEdge(x, y) {
        for (var yy = -2; yy <= 2; yy++)
            for (var xx = -2; xx <= 2; xx++) {
                if (xx === 0 && yy === 0)
                    continue;
                var nx = x + xx, ny = y + yy;
                if (nx < 0 || ny < 0 || nx >= T || ny >= T)
                    continue;
                if (lum[ny * T + nx] > 0.2)
                    return false;
            }
        return true;
    }
    for (var y = 0; y < T; y++)
        for (var x = 0; x < T; x++) {
            var l = lum[y * T + x];
            if (l > 0.2 && !isEdge(x, y)) {
                positions.push((x - half) * 0.18, (half - y) * 0.18, 0);
                opacities.push(l);
                var ec = 0;
                for (var yy = -1; yy <= 1; yy++)
                    for (var xx = -1; xx <= 1; xx++) {
                        if (xx === 0 && yy === 0)
                            continue;
                        var nx = x + xx, ny = y + yy;
                        if (nx < 0 || ny < 0 || nx >= T || ny >= T || lum[ny * T + nx] <= 0.2)
                            ec++;
                    }
                edges.push(ec / 8);
                var phi = Math.random() * Math.PI * 2;
                var th = Math.acos(2 * Math.random() - 1);
                var rad = 3 * (0.4 + 0.6 * Math.random());
                scattered.push(Math.sin(th) * Math.cos(phi) * rad, Math.sin(th) * Math.sin(phi) * rad, Math.cos(th) * rad * 0.5);
            }
        }
    return {
        positions: new Float32Array(positions),
        scatteredPositions: new Float32Array(scattered),
        opacities: new Float32Array(opacities),
        edges: new Float32Array(edges),
        count: positions.length / 3
    };
}
// ---- 官方 shader（GLSL 逐字移植，three.js 内建矩阵换为原生 uniform） ----
var WHALE_VS = "#version 300 es\n" +
    "precision highp float;\n" +
    "in vec3 position;\n" +
    "in float aOpacity;\n" +
    "in float aIndex;\n" +
    "in float aEdge;\n" +
    "in vec3 aScattered;\n" +
    "in vec3 aCenter;\n" +
    "in float aScale;\n" +
    "uniform float uTime;\n" +
    "uniform float uWaveSpeed;\n" +
    "uniform float uWaveAmount;\n" +
    "uniform vec2 uMouse;\n" +
    "uniform float uMouseRadius;\n" +
    "uniform float uMouseStrength;\n" +
    "uniform float uMouseDistort;\n" +
    "uniform float uAssembly;\n" +
    "uniform float uLoose;\n" +
    "uniform float uScatter;\n" +
    "uniform vec3 uLightPos;\n" +
    "uniform float uLightRange;\n" +
    "uniform float uShadeMin;\n" +
    "uniform float uShadeMax;\n" +
    "uniform mat4 uModel;\n" +
    "uniform mat4 uView;\n" +
    "uniform mat4 uProj;\n" +
    "uniform float uPointScale;\n" +
    "out float vOpacity;\n" +
    "out vec3 vWorldPos;\n" +
    "out float vAssembly;\n" +
    "out float vLight;\n" +
    "void main() {\n" +
    "  vOpacity = aOpacity;\n" +
    "  vAssembly = uAssembly;\n" +
    "  vec3 targetCenter = aCenter;\n" +
    "  vec3 localOffset = position * aScale;\n" +
    "  vec3 scatteredCenter = aScattered;\n" +
    "  float assembly = smoothstep(0.0, 1.0, uAssembly);\n" +
    "  vec3 center = mix(scatteredCenter, targetCenter, assembly);\n" +
    "  vec3 pos = center + localOffset;\n" +
    "  vWorldPos = center;\n" +
    "  float loose = uLoose * mix(0.25, 1.0, aEdge) * assembly;\n" +
    "  if (loose > 0.001) {\n" +
    "    vec3 jitter = vec3(\n" +
    "      fract(sin(aIndex * 12.9898) * 43758.5453) - 0.5,\n" +
    "      fract(sin(aIndex * 78.2330) * 12543.1230) - 0.5,\n" +
    "      fract(sin(aIndex * 39.4250) * 26711.7700) - 0.5\n" +
    "    );\n" +
    "    pos += jitter * 0.05 * loose;\n" +
    "    pos.x += sin(uTime * 0.50 + aIndex * 0.53) * 0.06 * loose;\n" +
    "    pos.y += cos(uTime * 0.42 + aIndex * 0.71) * 0.06 * loose;\n" +
    "    pos.z += sin(uTime * 0.36 + aIndex * 0.91) * 0.08 * loose;\n" +
    "    float tail = smoothstep(0.5, 4.5, targetCenter.x) * uLoose * assembly;\n" +
    "    pos.y += sin(uTime * 1.1 - targetCenter.x * 0.7) * 0.1 * tail;\n" +
    "    pos.z += cos(uTime * 0.9 - targetCenter.x * 0.55) * 0.06 * tail;\n" +
    "  }\n" +
    "  if (uScatter > 0.001) {\n" +
    "    float disperse = uScatter * mix(0.5, 1.0, aEdge);\n" +
    "    pos += (scatteredCenter - center) * disperse;\n" +
    "    pos.z += sin(uTime * 0.6 + aIndex * 0.3) * disperse * 0.6;\n" +
    "  }\n" +
    "  if (assembly > 0.95) {\n" +
    "    float effectStrength = (assembly - 0.95) * 20.0;\n" +
    "    float dist = length(center.xy);\n" +
    "    float waveFade = smoothstep(0.0, 3.0, dist);\n" +
    "    float wave = sin(dist * 3.0 - uTime * uWaveSpeed) * uWaveAmount * effectStrength * waveFade;\n" +
    "    pos.z += wave;\n" +
    "  }\n" +
    "  if (assembly > 0.8) {\n" +
    "    float mouseEffect = (assembly - 0.8) * 5.0;\n" +
    "    vec2 toMouse = center.xy - uMouse;\n" +
    "    float mouseDist = length(toMouse);\n" +
    "    if (mouseDist < uMouseRadius && mouseDist > 0.001) {\n" +
    "      float t = 1.0 - mouseDist / uMouseRadius;\n" +
    "      float force = t * t * t * mouseEffect * uMouseStrength;\n" +
    "      vec2 radialDir = toMouse / mouseDist;\n" +
    "      float noiseAngle = sin(aIndex * 0.37 + uTime * 0.5) * uMouseDistort;\n" +
    "      float ca = cos(noiseAngle);\n" +
    "      float sa = sin(noiseAngle);\n" +
    "      vec2 pushDir = vec2(radialDir.x * ca - radialDir.y * sa, radialDir.x * sa + radialDir.y * ca);\n" +
    "      pos.xy += pushDir * force * 2.0;\n" +
    "      pos.z += sin(aIndex * 1.7 + uTime) * force * 0.8;\n" +
    "    }\n" +
    "  }\n" +
    "  if (assembly < 0.9) {\n" +
    "    float scatter = smoothstep(0.9, 0.0, assembly);\n" +
    "    pos.x += sin(uTime * 0.5 + aIndex * 0.1) * 0.2 * scatter;\n" +
    "    pos.y += cos(uTime * 0.4 + aIndex * 0.07) * 0.2 * scatter;\n" +
    "    pos.z += sin(uTime * 0.3 + aIndex * 0.13) * 0.15 * scatter;\n" +
    "  }\n" +
    "  vec4 worldPos = uModel * vec4(pos, 1.0);\n" +
    "  float lightDist = distance(worldPos.xyz, uLightPos);\n" +
    "  float lit = clamp(1.0 - lightDist / uLightRange, 0.0, 1.0);\n" +
    "  vLight = mix(uShadeMin, uShadeMax, lit * lit);\n" +
    "  vec4 mvPosition = uView * uModel * vec4(pos, 1.0);\n" +
    "  gl_PointSize = max(1.0, uPointScale * aScale);\n" +
    "  gl_Position = uProj * mvPosition;\n" +
    "}\n";
var WHALE_FS = "#version 300 es\n" +
    "precision highp float;\n" +
    "in float vOpacity;\n" +
    "in vec3 vWorldPos;\n" +
    "in float vAssembly;\n" +
    "in float vLight;\n" +
    "uniform float uTime;\n" +
    "uniform vec3 uColor;\n" +
    "out vec4 fragColor;\n" +
    "void main() {\n" +
    "  float dist = length(vWorldPos.xy);\n" +
    "  float glow = smoothstep(8.0, 0.0, dist) * 0.3 * vAssembly;\n" +
    "  float baseAlpha = mix(0.45, 0.75, vAssembly);\n" +
    "  float alpha = vOpacity * (baseAlpha + glow);\n" +
    "  float shimmer = sin(uTime * 1.5 + vWorldPos.x * 5.0 + vWorldPos.y * 3.0) * 0.1 + 0.9;\n" +
    "  alpha *= shimmer * min(vLight, 1.0);\n" +
    "  vec3 color = (uColor + glow * vec3(0.2, 0.3, 0.5)) * vLight;\n" +
    "  color = mix(color, color * vec3(1.07, 1.02, 0.94), clamp(vLight - 1.0, 0.0, 1.0));\n" +
    "  fragColor = vec4(color, alpha);\n" +
    "}\n";
// ---- 4x4 矩阵工具（列主序，与 WebGL uniform 一致） ----
function m4Identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
function m4Mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++)
        for (var r = 0; r < 4; r++) {
            o[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] + a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
        }
    return o;
}
function m4Translation(tx, ty, tz) {
    var m = m4Identity();
    m[12] = tx;
    m[13] = ty;
    m[14] = tz;
    return m;
}
function m4RotationX(a) { var c = Math.cos(a), s = Math.sin(a); var m = m4Identity(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
function m4RotationY(a) { var c = Math.cos(a), s = Math.sin(a); var m = m4Identity(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
function m4RotationZ(a) { var c = Math.cos(a), s = Math.sin(a); var m = m4Identity(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
function m4Scale(s) { var m = m4Identity(); m[0] = s; m[5] = s; m[10] = s; return m; }
function m4Perspective(fovY, aspect, near, far) {
    var f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function m4Inverse(m) {
    var o = new Float32Array(16);
    var i = new Float32Array([m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]]);
    var d = 1 / (i[0] * i[5] * i[10] * i[15] - i[0] * i[5] * i[11] * i[14] - i[0] * i[9] * i[6] * i[15] + i[0] * i[9] * i[7] * i[14] +
        i[0] * i[13] * i[6] * i[11] - i[0] * i[13] * i[7] * i[10] - i[4] * i[1] * i[10] * i[15] + i[4] * i[1] * i[11] * i[14] +
        i[4] * i[9] * i[2] * i[15] - i[4] * i[9] * i[3] * i[14] - i[4] * i[13] * i[2] * i[11] + i[4] * i[13] * i[3] * i[10] +
        i[8] * i[1] * i[6] * i[15] - i[8] * i[1] * i[7] * i[14] - i[8] * i[5] * i[2] * i[15] + i[8] * i[5] * i[3] * i[14] +
        i[8] * i[13] * i[2] * i[7] - i[8] * i[13] * i[3] * i[6] - i[12] * i[1] * i[6] * i[11] + i[12] * i[1] * i[7] * i[10] +
        i[12] * i[5] * i[2] * i[11] - i[12] * i[5] * i[3] * i[10] - i[12] * i[9] * i[2] * i[7] + i[12] * i[9] * i[3] * i[6]);
    o[0] = (i[5] * i[10] * i[15] - i[5] * i[11] * i[14] - i[9] * i[6] * i[15] + i[9] * i[7] * i[14] + i[13] * i[6] * i[11] - i[13] * i[7] * i[10]) * d;
    o[4] = (-i[4] * i[10] * i[15] + i[4] * i[11] * i[14] + i[8] * i[6] * i[15] - i[8] * i[7] * i[14] - i[12] * i[6] * i[11] + i[12] * i[7] * i[10]) * d;
    o[8] = (i[4] * i[9] * i[15] - i[4] * i[11] * i[13] - i[8] * i[5] * i[15] + i[8] * i[7] * i[13] + i[12] * i[5] * i[11] - i[12] * i[9] * i[7]) * d;
    o[12] = (-i[4] * i[9] * i[14] + i[4] * i[10] * i[13] + i[8] * i[5] * i[14] - i[8] * i[6] * i[13] - i[12] * i[5] * i[10] + i[12] * i[9] * i[6]) * d;
    o[1] = (-i[1] * i[10] * i[15] + i[1] * i[11] * i[14] + i[9] * i[2] * i[15] - i[9] * i[3] * i[14] - i[13] * i[2] * i[11] + i[13] * i[3] * i[10]) * d;
    o[5] = (i[0] * i[10] * i[15] - i[0] * i[11] * i[14] - i[8] * i[2] * i[15] + i[8] * i[3] * i[14] + i[12] * i[2] * i[11] - i[12] * i[3] * i[10]) * d;
    o[9] = (-i[0] * i[9] * i[15] + i[0] * i[11] * i[13] + i[8] * i[1] * i[15] - i[8] * i[3] * i[13] - i[12] * i[1] * i[11] + i[12] * i[9] * i[3]) * d;
    o[13] = (i[0] * i[9] * i[14] - i[0] * i[10] * i[13] - i[8] * i[1] * i[14] + i[8] * i[2] * i[13] + i[12] * i[1] * i[10] - i[12] * i[9] * i[2]) * d;
    o[2] = (i[1] * i[6] * i[15] - i[1] * i[7] * i[14] - i[5] * i[2] * i[15] + i[5] * i[3] * i[14] + i[13] * i[2] * i[7] - i[13] * i[3] * i[6]) * d;
    o[6] = (-i[0] * i[6] * i[15] + i[0] * i[7] * i[14] + i[4] * i[2] * i[15] - i[4] * i[3] * i[14] - i[12] * i[2] * i[7] + i[12] * i[3] * i[6]) * d;
    o[10] = (i[0] * i[5] * i[15] - i[0] * i[7] * i[13] - i[4] * i[1] * i[15] + i[4] * i[3] * i[13] + i[12] * i[1] * i[7] - i[12] * i[5] * i[3]) * d;
    o[14] = (-i[0] * i[5] * i[14] + i[0] * i[6] * i[13] + i[4] * i[1] * i[14] - i[4] * i[2] * i[13] - i[12] * i[1] * i[6] + i[12] * i[5] * i[2]) * d;
    o[3] = (-i[1] * i[6] * i[11] + i[1] * i[7] * i[10] + i[5] * i[2] * i[11] - i[5] * i[3] * i[10] - i[9] * i[2] * i[7] + i[9] * i[3] * i[6]) * d;
    o[7] = (i[0] * i[6] * i[11] - i[0] * i[7] * i[10] - i[4] * i[2] * i[11] + i[4] * i[3] * i[10] + i[8] * i[2] * i[7] - i[8] * i[3] * i[6]) * d;
    o[11] = (-i[0] * i[5] * i[11] + i[0] * i[7] * i[9] + i[4] * i[1] * i[11] - i[4] * i[3] * i[9] - i[8] * i[1] * i[7] + i[8] * i[5] * i[3]) * d;
    o[15] = (i[0] * i[5] * i[10] - i[0] * i[6] * i[9] - i[4] * i[1] * i[10] + i[4] * i[2] * i[9] + i[8] * i[1] * i[6] - i[8] * i[5] * i[2]) * d;
    return o;
}

// ===== src/lib/02-bg-aurora.js
"use strict";
/* ------------------------------------------------------------------ *
 * 极光引擎（WebGL2）
 * ------------------------------------------------------------------ */
function startAurora(bg) {
    var canvas = bg.auroraCanvas;
    var reducedMotion = bg.reducedMotion, coarse = bg.coarse, isWindows = bg.isWindows;
    var gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl)
        return;
    function compile(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    function link(vs, fs) {
        var p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    }
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var progFlow = link(vs, compile(gl.FRAGMENT_SHADER, FLOWMAP_FS));
    var progFluid = link(vs, compile(gl.FRAGMENT_SHADER, FLUID_FS));
    if (!progFlow || !progFluid)
        return;
    var uFlow = {
        prev: gl.getUniformLocation(progFlow, "u_prev"),
        mouse: gl.getUniformLocation(progFlow, "u_mouse"),
        velocity: gl.getUniformLocation(progFlow, "u_velocity"),
        brushRadius: gl.getUniformLocation(progFlow, "u_brushRadius"),
        brushStrength: gl.getUniformLocation(progFlow, "u_brushStrength"),
        decay: gl.getUniformLocation(progFlow, "u_decay")
    };
    var uFluid = {
        time: gl.getUniformLocation(progFluid, "u_time"),
        resolution: gl.getUniformLocation(progFluid, "u_resolution"),
        scale: gl.getUniformLocation(progFluid, "u_scale"),
        offset: gl.getUniformLocation(progFluid, "u_offset"),
        grain: gl.getUniformLocation(progFluid, "u_grain"),
        speed: gl.getUniformLocation(progFluid, "u_speed"),
        flowmap: gl.getUniformLocation(progFluid, "u_flowmap"),
        distortBoost: gl.getUniformLocation(progFluid, "u_distortBoost"),
        swirlBoost: gl.getUniformLocation(progFluid, "u_swirlBoost"),
        glowIntensity: gl.getUniformLocation(progFluid, "u_glowIntensity"),
        glowColor1: gl.getUniformLocation(progFluid, "u_glowColor1"),
        glowColor2: gl.getUniformLocation(progFluid, "u_glowColor2"),
        glowColor3: gl.getUniformLocation(progFluid, "u_glowColor3"),
        c1: gl.getUniformLocation(progFluid, "u_c1"),
        c2: gl.getUniformLocation(progFluid, "u_c2"),
        c3: gl.getUniformLocation(progFluid, "u_c3"),
        c4: gl.getUniformLocation(progFluid, "u_c4"),
        c5: gl.getUniformLocation(progFluid, "u_c5"),
        lightPos: gl.getUniformLocation(progFluid, "u_lightPos"),
        lightCore: gl.getUniformLocation(progFluid, "u_lightCore"),
        lightHalo: gl.getUniformLocation(progFluid, "u_lightHalo"),
        vignette: gl.getUniformLocation(progFluid, "u_vignette"),
        bloomThreshold: gl.getUniformLocation(progFluid, "u_bloomThreshold"),
        bloomRange: gl.getUniformLocation(progFluid, "u_bloomRange"),
        bloomStrength: gl.getUniformLocation(progFluid, "u_bloomStrength")
    };
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    function bindAttrib(prog) {
        var loc = gl.getAttribLocation(prog, "a_position");
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    function makeTarget(w, h, data) {
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (data)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        else
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { fbo: fbo, tex: tex };
    }
    var W = 0, H = 0, wQ = 0, hQ = 0;
    var flip = false;
    var k = Math.min(window.devicePixelRatio || 1, 1.5);
    function resizeAll() {
        W = Math.round(canvas.clientWidth * k);
        H = Math.round(canvas.clientHeight * k);
        canvas.width = W;
        canvas.height = H;
        wQ = Math.round(W / 4);
        hQ = Math.round(H / 4);
        var init = new Uint8Array(wQ * hQ * 4);
        for (var i = 0; i < wQ * hQ; i++) {
            init[4 * i] = 0;
            init[4 * i + 1] = 128;
            init[4 * i + 2] = 128;
            init[4 * i + 3] = 255;
        }
        [targetA, targetB].forEach(function (t) { if (t) {
            gl.deleteTexture(t.tex);
            gl.deleteFramebuffer(t.fbo);
        } });
        targetA = makeTarget(wQ, hQ, init);
        targetB = makeTarget(wQ, hQ, init);
    }
    var targetA = null, targetB = null;
    resizeAll();
    var mouse = { x: 0.5, y: 0.5, smoothX: 0.5, smoothY: 0.5, vx: 0, vy: 0, svx: 0, svy: 0 };
    var useMouse = !reducedMotion && !coarse && !isWindows;
    function onMove(e) {
        var r = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) / r.width;
        mouse.y = 1 - (e.clientY - r.top) / r.height;
    }
    if (useMouse)
        window.addEventListener("mousemove", onMove, { passive: true });
    var start = performance.now();
    var raf = 0;
    var drawn = false; // never pause before the first frame is on screen
    var drawnAt = -1; // bg.epoch of the frame on screen
    var running = true;
    var last = 0;
    var FRAME = 1000 / 30;
    function hex2rgb(hex) {
        var h = hex.replace("#", "");
        return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
    }
    function frame(now) {
        if (bg.halted('aurora') && drawn && drawnAt === bg.epoch) {
            raf = 0;
            return;
        } // idle / still / hidden: the last frame stays on screen
        raf = requestAnimationFrame(frame);
        if (!running || now - last < FRAME)
            return;
        last = now - (now - last) % FRAME;
        var cfg = bg.aurora();
        var kk = Math.min(window.devicePixelRatio || 1, 1.5);
        var w = Math.round(canvas.clientWidth * kk);
        var h = Math.round(canvas.clientHeight * kk);
        if (w !== W || h !== H)
            resizeAll();
        mouse.smoothX += (mouse.x - mouse.smoothX) * cfg.mouseSmoothing;
        mouse.smoothY += (mouse.y - mouse.smoothY) * cfg.mouseSmoothing;
        mouse.svx += ((mouse.x - mouse.smoothX) * 0.5 - mouse.svx) * cfg.mouseVelocity;
        mouse.svy += ((mouse.y - mouse.smoothY) * 0.5 - mouse.svy) * cfg.mouseVelocity;
        // --- flowmap pass（鼠标笔刷 → 低分辨率流场，双缓冲乒乓） ---
        var src = flip ? targetA : targetB;
        var dst = flip ? targetB : targetA;
        flip = !flip;
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
        gl.viewport(0, 0, wQ, hQ);
        gl.useProgram(progFlow);
        bindAttrib(progFlow);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(uFlow.prev, 0);
        gl.uniform2f(uFlow.mouse, mouse.smoothX, mouse.smoothY);
        gl.uniform2f(uFlow.velocity, mouse.svx, mouse.svy);
        gl.uniform1f(uFlow.brushRadius, cfg.mouseRadius);
        gl.uniform1f(uFlow.brushStrength, useMouse ? cfg.mouseStrength : 0);
        gl.uniform1f(uFlow.decay, cfg.decay);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, W, H);
        // --- 渲染 ---
        var t = (performance.now() - start) * 0.001 * (cfg.speed / 100);
        gl.useProgram(progFluid);
        bindAttrib(progFluid);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dst.tex);
        gl.uniform1i(uFluid.flowmap, 0);
        gl.uniform1f(uFluid.time, t);
        gl.uniform2f(uFluid.resolution, W, H);
        gl.uniform1f(uFluid.scale, cfg.scale);
        gl.uniform2f(uFluid.offset, cfg.offsetX / 100, cfg.offsetY / 100);
        gl.uniform1f(uFluid.grain, cfg.grain);
        gl.uniform1f(uFluid.distortBoost, cfg.distortBoost);
        gl.uniform1f(uFluid.swirlBoost, cfg.swirlBoost);
        var lx = cfg.lightX != null ? cfg.lightX : 0.89;
        var lf = useMouse && cfg.lightFollow != null ? cfg.lightFollow : 0;
        gl.uniform2f(uFluid.lightPos, lx + (mouse.smoothX - lx) * lf, cfg.lightY != null ? cfg.lightY : 0.46);
        gl.uniform1f(uFluid.lightCore, coarse ? 0 : (cfg.lightCore != null ? cfg.lightCore : 0.14));
        gl.uniform1f(uFluid.lightHalo, coarse ? 0 : (cfg.lightHalo != null ? cfg.lightHalo : 0.2));
        gl.uniform1f(uFluid.vignette, cfg.vignette != null ? cfg.vignette : 0.38);
        gl.uniform1f(uFluid.bloomThreshold, cfg.bloomThreshold != null ? cfg.bloomThreshold : 0.61);
        gl.uniform1f(uFluid.bloomRange, cfg.bloomRange != null ? cfg.bloomRange : 0.18);
        gl.uniform1f(uFluid.bloomStrength, cfg.bloomStrength != null ? cfg.bloomStrength : 0.4);
        gl.uniform1f(uFluid.glowIntensity, cfg.glowIntensity);
        var gc1 = hex2rgb(cfg.glowColors[0] || "#ffffff");
        var gc2 = hex2rgb(cfg.glowColors[1] || cfg.glowColors[0] || "#ffffff");
        var gc3 = hex2rgb(cfg.glowColors[2] || cfg.glowColors[0] || "#ffffff");
        gl.uniform3f(uFluid.glowColor1, gc1[0], gc1[1], gc1[2]);
        gl.uniform3f(uFluid.glowColor2, gc2[0], gc2[1], gc2[2]);
        gl.uniform3f(uFluid.glowColor3, gc3[0], gc3[1], gc3[2]);
        var cs = cfg.colors || [];
        for (var ci = 0; ci < 5; ci++) {
            var c = hex2rgb(cs[ci] || cs[cs.length - 1] || "#000000");
            gl.uniform3f([uFluid.c1, uFluid.c2, uFluid.c3, uFluid.c4, uFluid.c5][ci], c[0], c[1], c[2]);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        drawn = true;
        drawnAt = bg.epoch;
    }
    if (reducedMotion) {
        // 单帧静态
        last = 0;
        running = true;
        frame(performance.now());
        cancelAnimationFrame(raf);
        raf = 0;
        running = false;
    }
    else {
        raf = requestAnimationFrame(frame);
        bg.onResume(function () { if (!raf && !document.hidden) {
            last = 0;
            raf = requestAnimationFrame(frame);
        } });
    }
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
            if (!raf && (!bg.halted('aurora') || drawnAt !== bg.epoch))
                raf = requestAnimationFrame(frame);
        }
        else if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
    });
    // window resize: the frame itself re-measures; 05-background.js bumps bg.epoch so a halted loop draws once more
}

// ===== src/lib/03-bg-whale.js
"use strict";
function startWhale(bg) {
    var canvas = bg.whaleCanvas;
    // premultipliedAlpha:true —— three.js WebGLRenderer 官方默认值，
    // 与官网 R3F 渲染管线一致（gl: {alpha:true, antialias:true}）
    var gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) {
        canvas.dataset.state = "no-webgl2";
        return;
    }
    var img = new Image();
    img.onload = function () {
        var data;
        try {
            data = sampleWhalePixels(img);
        }
        catch (e) {
            canvas.dataset.state = "sample-fail";
            return;
        }
        if (!data || data.count === 0) {
            canvas.dataset.state = "sample-empty";
            return;
        }
        canvas.dataset.count = data.count;
        initWhaleGL(bg, gl, canvas, data);
    };
    img.onerror = function () { canvas.dataset.state = "img-fail"; };
    img.src = WHALE_SRC;
}
function initWhaleGL(bg, gl, canvas, data) {
    var reducedMotion = bg.reducedMotion;
    function compile(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            if (typeof console !== "undefined")
                console.error("whale shader:", gl.getShaderInfoLog(s));
            return null;
        }
        return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, WHALE_VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, WHALE_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        canvas.dataset.state = "link-fail";
        return;
    }
    canvas.dataset.state = "shader-ok";
    gl.useProgram(prog);
    function buf(attr, arr, size) {
        var loc = gl.getAttribLocation(prog, attr);
        var b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    buf("aCenter", data.positions, 3);
    buf("aScattered", data.scatteredPositions, 3);
    buf("aOpacity", data.opacities, 1);
    buf("aEdge", data.edges, 1);
    var idx = new Float32Array(data.count);
    for (var i = 0; i < data.count; i++)
        idx[i] = i;
    buf("aIndex", idx, 1);
    // 官方实例缩放：s = .5 + 1*Math.random()（0.5–1.5）——粒子大小有变化，
    // 大粒子呈现小方块，是官方鲸鱼层次感的关键（chunk 776 源码原逻辑）
    var scaleArr = new Float32Array(data.count);
    for (var i2 = 0; i2 < data.count; i2++)
        scaleArr[i2] = 0.5 + 1 * Math.random();
    buf("aScale", scaleArr, 1);
    // position 属性默认 (0,0,0,1) —— 官方 BoxGeometry 的局部偏移对点精灵为 0
    var u = {};
    ["uTime", "uWaveSpeed", "uWaveAmount", "uMouse", "uMouseRadius", "uMouseStrength", "uMouseDistort",
        "uAssembly", "uLoose", "uScatter", "uLightPos", "uLightRange", "uShadeMin", "uShadeMax",
        "uModel", "uView", "uProj", "uPointScale", "uColor"].forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // three.js AdditiveBlending
    gl.disable(gl.DEPTH_TEST);
    // 鼠标状态机（官方：mouseActive / mouseHasMoved）
    // the pointer in window pixels; turned into whale space each frame, taking out bg.shift (the layer is
    // moved onto the content area) so the particles still react under the cursor
    var mouse = { cx: 0, cy: 0, active: false, hasMoved: false };
    function onMove(e) {
        mouse.active = true;
        mouse.hasMoved = true;
        mouse.cx = e.clientX;
        mouse.cy = e.clientY;
    }
    function onLeave() { mouse.active = false; }
    function onVis() { if (document.hidden)
        mouse.active = false; }
    if (!reducedMotion) {
        window.addEventListener("mousemove", onMove, { passive: true });
        window.addEventListener("mouseleave", onLeave);
        document.addEventListener("visibilitychange", onVis);
    }
    var start = performance.now();
    var raf = 0;
    var drawn = false; // never pause before the first frame is on screen
    var drawnAt = -1; // bg.epoch of the frame on screen
    var last = 0;
    var FRAME = 1000 / 30;
    var strength = 0;
    var b = { x: 0, y: 0 };
    var FOV = 50 * Math.PI / 180;
    // 相机距离：官方 18 → 15（18/15 = 1.2），鲸鱼整体等比放大 1.2 倍
    var CAM_DIST = 15;
    var HALF_H = Math.tan(FOV / 2) * CAM_DIST; // viewport（z=0 平面）半高
    var view = m4Translation(0, 0, -15);
    function resize() {
        var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    function frame(now) {
        if (bg.halted('whale') && drawn && drawnAt === bg.epoch) {
            raf = 0;
            return;
        } // idle / still / hidden: the last frame stays on screen
        raf = requestAnimationFrame(frame);
        if (now - last < FRAME)
            return;
        var dt = Math.min(0.5, (now - last) / 1000);
        last = now - (now - last) % FRAME;
        var w = canvas.clientWidth || 1;
        if (Math.round(w * Math.min(window.devicePixelRatio || 1, 1.5)) !== canvas.width)
            resize();
        if (bg.still() && now - start < 3000)
            start = now - 30000; // 静止 before the 3 s assembly is done: the assembled whale
        var elapsed = (now - start) / 1000;
        var L = Math.max(0, Math.min(1, (elapsed - 0.3) / 2.5));
        var D = 1 - Math.pow(1 - L, 3); // 官方 easeOutCubic 组装
        // 官方 group 变换（fish：spin=false）
        var rotZ = elapsed * ((1 - D) * 0.3) + 0.04 * Math.sin(0.25 * elapsed);
        var rotX = 0.05 * Math.sin(0.08 * elapsed * 0.7);
        var rotY = 0.1 * Math.sin(0.08 * elapsed);
        var posY = 0.15 * Math.sin(0.4 * elapsed);
        var scale = 0.75 + 0.25 * D;
        var model = m4Mul(m4Mul(m4Translation(0, posY, 0), m4Mul(m4RotationZ(rotZ), m4Mul(m4RotationY(rotY), m4RotationX(rotX)))), m4Scale(scale));
        var aspect = canvas.width / canvas.height;
        var proj = m4Perspective(FOV, aspect, 0.1, 100);
        gl.uniformMatrix4fv(u.uModel, false, model);
        gl.uniformMatrix4fv(u.uView, false, view);
        gl.uniformMatrix4fv(u.uProj, false, proj);
        gl.uniform1f(u.uTime, elapsed);
        gl.uniform1f(u.uWaveSpeed, WAVE_DEFAULTS.speed);
        gl.uniform1f(u.uWaveAmount, WAVE_DEFAULTS.amount);
        gl.uniform1f(u.uAssembly, D);
        gl.uniform1f(u.uLoose, 1);
        gl.uniform1f(u.uScatter, 0);
        gl.uniform1f(u.uMouseRadius, MOUSE_DEFAULTS.radius);
        gl.uniform1f(u.uMouseDistort, MOUSE_DEFAULTS.distort);
        // 鼠标强度：官方以 (1-0.05^dt) 插值
        var target = mouse.active ? MOUSE_DEFAULTS.strength : 0;
        strength += (target - strength) * (1 - Math.pow(0.05, dt));
        gl.uniform1f(u.uMouseStrength, strength);
        // 光线：官方 lightParams.followX —— light.x 跟随鼠标世界坐标
        var halfW = HALF_H * aspect;
        var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
        var mx = ((mouse.cx - bg.shift.x) / vw) * 2 - 1;
        var my = -(((mouse.cy - bg.shift.y) / vh) * 2 - 1);
        gl.uniform3f(u.uLightPos, LIGHT_DEFAULTS.x + mx * halfW * LIGHT_DEFAULTS.followX, LIGHT_DEFAULTS.y, LIGHT_DEFAULTS.z);
        gl.uniform1f(u.uLightRange, LIGHT_DEFAULTS.range);
        gl.uniform1f(u.uShadeMin, LIGHT_DEFAULTS.shadeMin);
        gl.uniform1f(u.uShadeMax, LIGHT_DEFAULTS.shadeMax);
        // uMouse：屏幕鼠标 → 世界(z=0) → 组局部空间（官方 matrixWorld 逆变换）
        if (mouse.hasMoved) {
            var wx = mx * halfW, wy = my * HALF_H;
            if (strength < 0.01) {
                b.x = wx;
                b.y = wy;
            }
            else {
                b.x += (wx - b.x) * MOUSE_DEFAULTS.decay;
                b.y += (wy - b.y) * MOUSE_DEFAULTS.decay;
            }
        }
        var inv = m4Inverse(model);
        var ux = inv[0] * b.x + inv[4] * b.y + inv[12];
        var uy = inv[1] * b.x + inv[5] * b.y + inv[13];
        gl.uniform2f(u.uMouse, ux, uy);
        // 颜色：官方 uColor = (.75P, .8P, .9P)，P = D*max(0,1-1.5E)
        // Light theme: the layer is shown as the dark whale's negative (CSS multiply through #dsh-ds-ink).
        // Additive blending puts more colour than alpha into the canvas, which a CSS filter would clamp, so
        // here alpha accumulates too and the colour is halved: a valid premultiplied image of the dark brightness.
        var light = !bg.state.dark, cs = light ? 0.5 : 1;
        gl.uniform3f(u.uColor, 0.75 * D * cs, 0.8 * D * cs, 0.9 * D * cs);
        if (light)
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
        else
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        // 点尺寸：官方 BoxGeometry 0.06 单位 × 实例缩放 × 组缩放
        gl.uniform1f(u.uPointScale, 0.06 * scale * (canvas.height / (2 * HALF_H)));
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.POINTS, 0, data.count);
        drawn = true;
        drawnAt = bg.epoch;
    }
    if (reducedMotion) {
        start = performance.now() - 30000; // 组装动画已完成的状态下绘制单帧
        last = 0;
        frame(performance.now());
        cancelAnimationFrame(raf);
        raf = 0;
    }
    else {
        raf = requestAnimationFrame(frame);
        bg.onResume(function () { if (!raf && !document.hidden) {
            last = 0;
            raf = requestAnimationFrame(frame);
        } });
    }
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
            if (!raf && (!bg.halted('whale') || drawnAt !== bg.epoch))
                raf = requestAnimationFrame(frame);
        }
        else if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
    });
}

// ===== src/lib/04-bg-constellation.js
"use strict";
/* ------------------------------------------------------------------ *
 * 星座网格引擎（2D canvas）
 * ------------------------------------------------------------------ */
function startConstellation(bg) {
    var canvas = bg.constellationCanvas;
    var reducedMotion = bg.reducedMotion;
    var ctx = canvas.getContext("2d");
    if (!ctx)
        return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var dots = [], cols = 0, rows = 0;
    var mouse = { x: NaN, y: NaN };
    var raf = 0; // the pending frame id: 0 while the loop is idle (mirrors the aurora engine)
    var drawnAt = -1; // bg.epoch of the frame on screen
    var idle = false;
    var last = 0;
    var FRAME = 1000 / 30;
    var resizeTimer = null;
    function buildGrid() {
        var w = canvas.clientWidth, h = canvas.clientHeight;
        cols = Math.ceil(w / 90) + 1;
        rows = Math.ceil(h / 90) + 1;
        var ox = (w - (cols - 1) * 90) / 2;
        var oy = (h - (rows - 1) * 90) / 2;
        dots = [];
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                var rx = ox + 90 * x, ry = oy + 90 * y;
                dots.push({ restX: rx, restY: ry, x: rx, y: ry, vx: 0, vy: 0 });
            }
        }
    }
    function resize() {
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildGrid();
    }
    resize();
    function onMove(e) {
        var r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        wake();
    }
    if (!reducedMotion)
        window.addEventListener("mousemove", onMove, { passive: true });
    function draw(mx, my) {
        var opts = bg.constellation();
        var w = canvas.clientWidth, h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = opts.lineColor + " " + opts.lineOpacity + ")";
        ctx.lineWidth = 0.5;
        var i, j, a, b, dx, dy, dist, ux, uy;
        for (j = 0; j < rows; j++) {
            for (i = 0; i < cols - 1; i++) {
                a = dots[j * cols + i];
                b = dots[j * cols + i + 1];
                dx = b.x - a.x;
                dy = b.y - a.y;
                dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 20)
                    continue;
                ux = dx / dist;
                uy = dy / dist;
                ctx.beginPath();
                ctx.moveTo(a.x + 10 * ux, a.y + 10 * uy);
                ctx.lineTo(b.x - 10 * ux, b.y - 10 * uy);
                ctx.stroke();
            }
        }
        for (i = 0; i < cols; i++) {
            for (j = 0; j < rows - 1; j++) {
                a = dots[j * cols + i];
                b = dots[(j + 1) * cols + i];
                dx = b.x - a.x;
                dy = b.y - a.y;
                dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 20)
                    continue;
                ux = dx / dist;
                uy = dy / dist;
                ctx.beginPath();
                ctx.moveTo(a.x + 10 * ux, a.y + 10 * uy);
                ctx.lineTo(b.x - 10 * ux, b.y - 10 * uy);
                ctx.stroke();
            }
        }
        ctx.fillStyle = opts.dotColor + " " + opts.dotOpacity + ")";
        for (i = 0; i < dots.length; i++) {
            var p = dots[i];
            var n = 1.8, alpha = opts.dotOpacity;
            if (!isNaN(mx) && !isNaN(my)) {
                dx = p.x - mx;
                dy = p.y - my;
                dist = Math.sqrt(dx * dx + dy * dy);
                var l = Math.max(0, 1 - dist / 140);
                n = 1.8 + 2 * l;
                alpha = opts.dotOpacity + 0.4 * l;
            }
            ctx.globalAlpha = alpha;
            if (opts.round) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, n, 0, 2 * Math.PI);
                ctx.fill();
            }
            else {
                ctx.fillRect(p.x - n, p.y - n, 2 * n, 2 * n);
            }
        }
        ctx.globalAlpha = 1;
    }
    function wake() {
        if (idle) {
            idle = false;
            last = 0;
            if (!raf)
                raf = requestAnimationFrame(loop);
        }
    }
    function loop(now) {
        if (bg.halted('grid') && drawnAt === bg.epoch) {
            idle = true;
            raf = 0;
            return;
        } // still / hidden: no motion
        if (now - last < FRAME) {
            raf = requestAnimationFrame(loop);
            return;
        }
        last = now - (now - last) % FRAME;
        // 布局未就绪时补一次尺寸同步
        if (Math.round(canvas.clientWidth * dpr) !== canvas.width ||
            Math.round(canvas.clientHeight * dpr) !== canvas.height) {
            resize();
        }
        var mx = mouse.x, my = mouse.y;
        var maxSpeed = 0;
        for (var i = 0; i < dots.length; i++) {
            var p = dots[i];
            if (!isNaN(mx) && !isNaN(my)) {
                var dx = p.x - mx, dy = p.y - my;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d < 140 && d > 0.1) {
                    var e = (1 - d / 140) * 30;
                    var ux = dx / d, uy = dy / d;
                    p.vx += ux * e * 0.1;
                    p.vy += uy * e * 0.1;
                }
            }
            p.vx += 0.05 * (p.restX - p.x);
            p.vy += 0.05 * (p.restY - p.y);
            p.vx *= 0.85;
            p.vy *= 0.85;
            p.x += p.vx;
            p.y += p.vy;
            var sp = Math.abs(p.vx) + Math.abs(p.vy);
            if (sp > maxSpeed)
                maxSpeed = sp;
        }
        draw(mx, my);
        drawnAt = bg.epoch;
        if (maxSpeed < 0.01 || bg.halted('grid')) {
            idle = true;
            raf = 0;
            return;
        }
        raf = requestAnimationFrame(loop);
    }
    bg.onResume(wake); // theme / settings changed: draw again
    if (reducedMotion) {
        draw(NaN, NaN); // 静态单帧
    }
    else {
        idle = false;
        raf = requestAnimationFrame(loop);
    }
    window.addEventListener("resize", function () {
        if (resizeTimer)
            clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            resize();
            drawnAt = -1; // the canvas was cleared: draw again even while halted
            wake();
        }, 150);
    }, { passive: true });
}

// ===== src/styles/05-background.scss
/* compiled from src/styles/05-background.scss by build.mjs — edit the .scss, not this file */
const CSS_BACKGROUND = "/*!\n * Static CSS for the background part (parts/05-background.ts): theme tokens for the theme's own\n * glass, the backdrop layer and its mask, the whale layer, the see-through page / layout frame /\n * view roots, and the frosted left sidebar. Injected as the `background` sheet (CSS_BACKGROUND).\n * The BG / FRAME selectors the part used to interpolate are inlined here.\n */\n/* theme tokens for the background's own glass; 06-glass.js reuses them */\nbody[data-ds-dark-theme] {\n  --dsb-surface:rgba(13,15,19,.55);\n  --dsb-border:hsla(0,0%,100%,.08);\n}\n\nbody:not([data-ds-dark-theme]) {\n  --dsb-surface:hsla(0,0%,100%,.45);\n  --dsb-border:rgba(0,0,0,.08);\n}\n\n#dsh-ds-bg {\n  position: fixed;\n  inset: 0;\n  z-index: -1;\n  overflow: hidden;\n  pointer-events: none;\n  background: linear-gradient(180deg, #9cc1e7 0%, rgba(250, 250, 250, 0) 100%), #f9f8f8;\n  animation: dsh-ds-enter 1.8s ease-out backwards;\n}\n\n#dsh-ds-bg.dsh-ds-dark {\n  background: #0a0a0a;\n}\n\n/* dsh 的基础样式给 body 的每个非 #root 直接子元素都设了 -webkit-app-region:no-drag（portal 出来的\n   菜单/对话框因此仍可点），选择器 body>:not(#root) 带着 #root 的 id 权重。这层整屏 fixed、\n   pointer-events:none，本来不接任何点击，却因此把标题条的窗口拖动区整块挖掉了。把它摘出 no-drag 区：\n   否则 macOS 上标题条拖不动窗口，而问题只在装了本主题时出现。 */\n#dsh-ds-bg {\n  -webkit-app-region: initial !important;\n}\n\n/* the deepseek.com hero mask: full strength at the top, fading out toward the bottom */\n#dsh-ds-aurora, #dsh-ds-constellation {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  display: block;\n  -webkit-mask: linear-gradient(rgba(0, 0, 0, 0.9882352941) 0%, rgba(0, 0, 0, 0.9098039216) 8.98%, transparent 100%);\n  mask: linear-gradient(rgba(0, 0, 0, 0.9882352941) 0%, rgba(0, 0, 0, 0.9098039216) 8.98%, transparent 100%);\n}\n\n.dsh-ds-whale {\n  position: absolute;\n  inset: 0;\n  z-index: 2;\n  pointer-events: none;\n  mix-blend-mode: screen;\n  transform: translate(var(--dsb-whale-x, 0px), var(--dsb-whale-y, 0px));\n  transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);\n}\n\n.dsh-ds-whale canvas {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  display: block;\n}\n\n#dsh-ds-bg:not(.dsh-ds-dark) .dsh-ds-whale {\n  filter: url(#dsh-ds-ink);\n  mix-blend-mode: multiply;\n}\n\n@keyframes dsh-ds-enter {\n  0% {\n    opacity: 0;\n    filter: blur(20px);\n  }\n  100% {\n    opacity: 1;\n    filter: blur(0);\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  #dsh-ds-bg {\n    animation: none;\n  }\n  .dsh-ds-whale {\n    transition: none;\n  }\n}\n@media (prefers-reduced-transparency: reduce) {\n  #dsh-ds-bg:not(.dsh-ds-dark) .dsh-ds-whale {\n    opacity: 0.6;\n  }\n}\n/* the shell lets the background through: page, layout frame (and DSH NEXT's opaque centre column),\n   view roots (conversation, details column), sidebar content and the input box's seat */\nbody,\n[data-slot=root] > div,\n[data-slot=root] :is([class$=_frame], [class*=\"_frame \"]),\n[data-slot=root] :is([class$=_frame], [class*=\"_frame \"]) > :is([class$=_centerCol], [class*=\"_centerCol \"]),\n:is([data-slot=conversation], [data-slot=\"main.conversation\"]) > div,\n:is([class$=_detailsCol], [class*=\"_detailsCol \"]) > div,\n[data-slot=sidebar] > div,\n[data-composer-seat] {\n  background: transparent !important;\n}\n\n/* left sidebar: frosted. The blur sits on ::before: backdrop-filter on the column itself would make it the\n   containing block of fixed descendants (the Settings dialog mounts inside it). No z-index on the content\n   either, or that dialog would be trapped under the input box. */\n:is([class$=_sidebarCol], [class*=\"_sidebarCol \"]) {\n  position: relative;\n  background: var(--dsb-surface) !important;\n  border-right-color: var(--dsb-border) !important;\n}\n\n:is([class$=_sidebarCol], [class*=\"_sidebarCol \"])::before {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  z-index: -1;\n  pointer-events: none;\n  -webkit-backdrop-filter: blur(12px);\n  backdrop-filter: blur(12px);\n}\n\n/* sticky page headers (Plugins page …) paint an opaque strip in ::before; clear at rest (06-glass.js frosts it once scrolled) */\n[class*=_pageBar][data-natural]::before {\n  background: transparent !important;\n}"

// ===== src/styles/06-glass.scss
/* compiled from src/styles/06-glass.scss by build.mjs — edit the .scss, not this file */
const CSS_GLASS = "/*!\n * Static CSS for the glass part (parts/06-glass.ts): one liquid-glass material — per-theme tint\n * tokens, dsh's menu and surface tokens, bubbles, menus, the ⌘K palette, the Settings dialog,\n * tool rows, code blocks, the input box and its fade, the width handle, and other plugins'\n * surfaces. Injected as the `glass` sheet (CSS_GLASS). The DARK / LIGHT selectors the part used\n * to interpolate are inlined here.\n */\nbody[data-ds-dark-theme] {\n  --dg-tint:rgba(44,45,50,.56);\n  --dg-tint-strong:rgba(36,37,42,.7);\n  --dg-tint-soft:rgba(255,255,255,.06);\n  --dg-ring:0 0 0 .5px rgba(255,255,255,.1),inset 0 .5px 0 rgba(255,255,255,.08);\n  --dg-shadow:0 10px 32px rgba(0,0,0,.32),0 0 20px rgba(0,0,0,.06);\n  --dg-shadow-input:0 2px 6px rgba(0,0,0,.12),0 8px 24px rgba(0,0,0,.16);\n  --dg-hover:rgba(255,255,255,.07);\n  --dg-line:rgba(255,255,255,.08);\n  --dg-chip:rgba(255,255,255,.08);\n  --dg-mask:rgba(0,0,0,.28);\n  --dg-code:rgba(6,7,10,.42);\n  --dg-code-head:rgba(255,255,255,.03);\n  --dg-select:rgba(64,140,255,.42);\n}\n\nbody:not([data-ds-dark-theme]) {\n  --dg-tint:rgba(255,255,255,.6);\n  --dg-tint-strong:rgba(255,255,255,.74);\n  --dg-tint-soft:rgba(255,255,255,.5);\n  --dg-ring:0 0 0 .5px rgba(0,0,0,.08),inset 0 .5px 0 rgba(255,255,255,.7);\n  --dg-shadow:0 10px 32px rgba(15,23,42,.1),0 0 20px rgba(15,23,42,.04);\n  --dg-shadow-input:0 1px 3px rgba(15,23,42,.05),0 6px 20px rgba(15,23,42,.06);\n  --dg-hover:rgba(0,0,0,.05);\n  --dg-line:rgba(0,0,0,.07);\n  --dg-chip:rgba(0,0,0,.05);\n  --dg-mask:rgba(15,23,42,.12);\n  --dg-code:rgba(15,23,42,.05);\n  --dg-code-head:rgba(15,23,42,.03);\n  --dg-select:rgba(40,110,250,.22);\n}\n\nbody {\n  --dg-blur:blur(40px) saturate(1.5);\n  --dg-blur-soft:blur(24px) saturate(1.4);\n  --dg-blur-card:blur(20px);\n}\n\n/* dsh menus already read these tokens: same tint and filter everywhere */\nbody[data-ds-dark-theme] {\n  --dsw-specific-menu:rgba(44,45,50,.6)!important;\n  --dsw-menu-backdrop-filter:blur(40px) saturate(150%)!important;\n}\n\nbody:not([data-ds-dark-theme]) {\n  --dsw-specific-menu:rgba(255,255,255,.66)!important;\n  --dsw-menu-backdrop-filter:blur(40px) saturate(150%)!important;\n}\n\n/* token layer: dsh's surface tokens (cards, panels, inputs) become translucent tints, so everything built on\n   them — dsh's own pages and any plugin that uses the tokens — sits on the glass without its own rule.\n   bg-base stays opaque: it is what covers content scrolling underneath (sticky bars, fades); the few big\n   panels that use it get their own rule below. Tokens carry no blur, so tints stay modest. */\nhtml body[data-ds-dark-theme] {\n  --dg-solid-layer-1:var(--dsw-static-neutral-bluish-875);\n  --dg-solid-layer-3:var(--dsw-static-neutral-bluish-800);\n  --dsw-alias-bg-layer-1:rgba(40,41,46,.55);\n  --dsw-alias-bg-layer-2:rgba(50,51,56,.55);\n  --dsw-alias-bg-layer-3:rgba(62,63,68,.6);\n  --dsw-alias-bg-module-platform:rgba(255,255,255,.08);\n}\n\nhtml body:not([data-ds-dark-theme]) {\n  --dg-solid-layer-1:var(--dsw-static-neutral-bluish-00);\n  --dg-solid-layer-3:var(--dsw-static-neutral-bluish-00);\n  --dsw-alias-bg-layer-1:rgba(255,255,255,.55);\n  --dsw-alias-bg-layer-2:rgba(255,255,255,.62);\n  --dsw-alias-bg-layer-3:rgba(255,255,255,.72);\n  --dsw-alias-bg-module-platform:rgba(15,23,42,.05);\n}\n\n/* bg-base is also the fill of whole panels (files, browser, document preview, the 自动化任务 page …).\n   Inside the right sidebar and the main area of the global pages it means \"panel\", so there it is the\n   glass underneath; everywhere else (scrims, overlays, the boot screen, fades) it stays opaque. */\nhtml body :is([class*=_rightbarCol], [data-global-panel=true]) {\n  --dsw-alias-bg-base:transparent;\n}\n\n/* …but a sticky header there covered the content scrolling under it with that base: frosted instead, and only\n   once the page is scrolled (dsh sets data-scrolled) — at rest nothing is under it, so it stays clear (no band) */\nbody[data-ds-dark-theme] [data-global-panel=true] [class*=_pageBar][data-natural][data-scrolled]::before {\n  background: rgba(21, 21, 23, 0.5) !important;\n}\n\nbody:not([data-ds-dark-theme]) [data-global-panel=true] [class*=_pageBar][data-natural][data-scrolled]::before {\n  background: rgba(255, 255, 255, 0.55) !important;\n}\n\nhtml body [data-global-panel=true] [class*=_pageBar][data-natural][data-scrolled]::before {\n  -webkit-backdrop-filter: blur(20px) saturate(1.4);\n  backdrop-filter: blur(20px) saturate(1.4);\n}\n\n/* places that use a layer token as a text / icon colour (white-on-colour badges, halos) keep it solid */\n:is([class*=_tag_][data-tone=solid], [class*=_save_], [class*=_brokenBadge], [class*=_brokenTip], [class*=_iconButton], .text-surface, .lc-dur-halo, .lc-pulse-event-dot) {\n  --dsw-alias-bg-layer-1:var(--dg-solid-layer-1);\n  --dsw-alias-bg-layer-3:var(--dg-solid-layer-3);\n}\n\n/* user message bubble, and the bubble that records answers to the agent's questions (same primitive, no data-message-bubble) */\n/* (exact _bubble class: [class*=\"_bubble\"] also hit the square _bubbleWidth wrapper, a second slab behind the bubble) */\nhtml body :is([data-message-bubble], [data-question-reply] :is([class$=_bubble], [class*=\"_bubble \"])) {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur-soft) !important;\n  backdrop-filter: var(--dg-blur-soft) !important;\n  box-shadow: var(--dg-ring), 0 2px 10px rgba(0, 0, 0, 0.06) !important;\n  border: 0 !important;\n}\n\n/* turn-outline hover card */\nhtml body [class*=_preview]:has(> [class*=_previewPrompt]) {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur) !important;\n  backdrop-filter: var(--dg-blur) !important;\n  box-shadow: var(--dg-ring), var(--dg-shadow) !important;\n  border: 0 !important;\n  border-radius: 16px !important;\n}\n\n/* ⌘K search palette (@hyzyn/dsh-search) */\nhtml body .gs_backdrop {\n  background: var(--dg-mask) !important;\n  -webkit-backdrop-filter: blur(2px) !important;\n  backdrop-filter: blur(2px) !important;\n}\n\nhtml body .gs_palette {\n  background: var(--dg-tint-strong) !important;\n  -webkit-backdrop-filter: var(--dg-blur) !important;\n  backdrop-filter: var(--dg-blur) !important;\n  box-shadow: var(--dg-ring), var(--dg-shadow) !important;\n  border-radius: 18px !important;\n}\n\nhtml body .gs_palette .gs_inputRow {\n  background: transparent !important;\n  border-bottom: 1px solid var(--dg-line) !important;\n}\n\nhtml body .gs_palette .gs_input {\n  background: transparent !important;\n}\n\nhtml body .gs_palette .gs_list {\n  background: transparent !important;\n}\n\nhtml body .gs_palette .gs_row {\n  background: transparent !important;\n}\n\nhtml body .gs_palette .gs_row:hover, html body .gs_palette .gs_row[aria-selected=true], html body .gs_palette .gs_row[data-active], html body .gs_palette .gs_row.gs_active {\n  background: var(--dg-hover) !important;\n}\n\nhtml body .gs_palette .gs_footer {\n  background: transparent !important;\n  border-top: 1px solid var(--dg-line) !important;\n}\n\nhtml body .gs_palette .gs_key, html body .gs_palette .gs_badge, html body .gs_palette .gs_rowChip {\n  background: var(--dg-chip) !important;\n  border-color: transparent !important;\n  box-shadow: none !important;\n}\n\n/* Settings dialog */\nhtml body [class*=_overlay] > [class*=_panel]:has([class*=_navList]) {\n  background: var(--dg-tint-strong) !important;\n  -webkit-backdrop-filter: var(--dg-blur) !important;\n  backdrop-filter: var(--dg-blur) !important;\n  box-shadow: var(--dg-ring), var(--dg-shadow) !important;\n  border: 0 !important;\n}\n\nhtml body [class*=_overlay] > [class*=_panel]:has([class*=_navList]) :is([class$=_nav], [class*=\"_nav \"], [class$=_options], [class*=\"_options \"], [class$=_header], [class*=\"_header \"]) {\n  background: transparent !important;\n}\n\n/* …inside it the panel is already frosted: dsh's cards (账号, 余额 …) were a second grey slab with a bright 0.2 border, and the\n   current nav row a solid grey block. Cards become a faint fill with the glass hairline, nav rows the same hover tint as menus. */\nbody[data-ds-dark-theme] [class*=_overlay] > [class*=_panel]:has([class*=_navList]) {\n  --dg-panel-card:rgba(255,255,255,.04);\n}\n\nbody:not([data-ds-dark-theme]) [class*=_overlay] > [class*=_panel]:has([class*=_navList]) {\n  --dg-panel-card:rgba(255,255,255,.55);\n}\n\nhtml body [class*=_overlay] > [class*=_panel]:has([class*=_navList]) :is([class$=_card], [class*=\"_card \"], [class$=Card], [class*=\"Card \"]) {\n  background: var(--dg-panel-card) !important;\n  border-color: var(--dg-line) !important;\n  box-shadow: none !important;\n}\n\nhtml body [class*=_overlay] > [class*=_panel]:has([class*=_navList]) [class*=_navCell] {\n  background: transparent !important;\n  transition: background-color 0.12s ease;\n}\n\nhtml body [class*=_overlay] > [class*=_panel]:has([class*=_navList]) [class*=_navCell]:hover {\n  background: var(--dg-hover) !important;\n}\n\nhtml body [class*=_overlay] > [class*=_panel]:has([class*=_navList]) [class*=_navCell][class*=_active] {\n  background: var(--dg-chip) !important;\n  box-shadow: var(--dg-ring) !important;\n}\n\n/* ---- surfaces found by a full sweep of every page and panel (2026-11-11), both themes ---- */\n/* inline code outside replies (thinking blocks, tool summaries): dsh paints it solid #292929 / #fafafa */\nhtml body [class*=_markdown] :not(pre) > code {\n  background: var(--dg-chip) !important;\n}\n\n/* 轨迹 view: root, split pane and table each laid a 55% layer, stacked to an almost opaque slab; the view reads over the\n   background like the conversation itself, with only its header strip tinted */\nhtml body [data-slot=\"conversation.view\"] :is([class$=_split], [class$=_tablePane], [class$=_table], [class$=_ledger]) {\n  background: transparent !important;\n}\n\nhtml body [data-slot=\"conversation.view\"] [class$=_root]:has(> [class*=_ledger]) {\n  background: transparent !important;\n}\n\nhtml body [data-slot=\"conversation.view\"] [class$=_plot] {\n  background: var(--dg-chip) !important;\n}\n\n/* dsh-context (上下文 tab, 上下文洞察 page): its canvas and stat buttons are solid in the light theme, its cards unblurred */\nhtml body, html body:not([data-ds-dark-theme]) {\n  --lc-canvas:transparent;\n  --lc-control-track:var(--dg-chip);\n}\n\n/* :has() rules here only look a fixed depth down (> / >*>): a conversation has ~900 *_root elements, and a\n   :has() that searches a whole subtree is re-run on every DOM change inside it, which made typing and streaming lag.\n   轨迹 toolbar and its 加载更早的历史 bar: layer-1 (half-white in light) with nothing blurred behind */\nhtml body [data-slot=\"conversation.view\"] [class$=_root]:has(> [class*=_inner] > [class*=_actions] > [class*=_control]), html body [class*=_historyLoadButton] {\n  background: var(--dg-tint-strong) !important;\n  -webkit-backdrop-filter: var(--dg-blur-soft);\n  backdrop-filter: var(--dg-blur-soft);\n}\n\nhtml body [class*=_historyLoadButton]:hover {\n  background: var(--dg-hover) !important;\n}\n\nhtml body :is(.dps-panel, .dps-kpi) {\n  position: relative;\n  isolation: isolate;\n  border-color: var(--dg-line) !important;\n}\n\nhtml body :is(.dps-panel, .dps-kpi)::before {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  z-index: -1;\n  border-radius: inherit;\n  pointer-events: none;\n  -webkit-backdrop-filter: var(--dg-blur-card);\n  backdrop-filter: var(--dg-blur-card);\n}\n\nhtml body .lc-card, html body .lc-ov-session {\n  position: relative;\n  isolation: isolate;\n  border-color: var(--dg-line) !important;\n  box-shadow: var(--dg-ring) !important;\n}\n\nhtml body .lc-card::before, html body .lc-ov-session::before {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  z-index: -1;\n  border-radius: inherit;\n  pointer-events: none;\n  -webkit-backdrop-filter: var(--dg-blur-card);\n  backdrop-filter: var(--dg-blur-card);\n}\n\n/* 插件市场: current category pill was a solid block, the sticky filter bar an opaque strip, the search box unblurred */\nhtml body [class*=_pill][class*=_interactive][class*=_active] {\n  background: var(--dg-chip) !important;\n  box-shadow: var(--dg-ring) !important;\n  color: var(--dsw-alias-label-primary) !important;\n}\n\nhtml body [class*=_stickyHead] {\n  background: var(--dg-tint-strong) !important;\n  -webkit-backdrop-filter: var(--dg-blur-soft);\n  backdrop-filter: var(--dg-blur-soft);\n}\n\nhtml body [class*=_searchInput] {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur-card);\n  backdrop-filter: var(--dg-blur-card);\n  border-color: var(--dg-line) !important;\n}\n\n/* 改动 panel: the checkout bar was an opaque strip across the pane */\nhtml body [class*=_checkout] {\n  background: var(--dg-chip) !important;\n  border-color: var(--dg-line) !important;\n}\n\n/* Settings: dsh's 50% black mask made the frosted dialog read as a dark slab; the same light scrim as the ⌘K palette */\nhtml body [class*=_overlay] > [class*=_mask]:has(+ [class*=_panel]) {\n  background: var(--dg-mask) !important;\n}\n\n/* chat width handle. dsh's own: a 2px scrollbar-grey line, shown on hover at --dsh-width-handle-pointer-y, which dsh\n   only updates while dragging, so hover lit a fixed spot; and the line sat right on the input box's edge.\n   Here: the line is moved ~8px outside the input box (content edge + 40px); on hover a short soft line follows the\n   pointer (the listener in apply() feeds the pointer position and --dct-wh-stop, the input box's top); while dragging\n   it runs the full height down to the input box. Level with the input box it stays hidden. */\nhtml body [data-width-handle]::after {\n  width: 1.5px !important;\n  border-radius: 1px;\n  bottom: var(--dct-wh-bottom, 0px) !important;\n  background: linear-gradient(to bottom, transparent calc(var(--dsh-width-handle-pointer-y, 50%) - 56px), var(--dct-grip) var(--dsh-width-handle-pointer-y, 50%), transparent calc(var(--dsh-width-handle-pointer-y, 50%) + 56px)) !important;\n  transition: opacity 0.18s ease;\n}\n\nhtml body [data-width-handle=left]::after {\n  right: auto !important;\n  left: -6px !important;\n}\n\nhtml body [data-width-handle=right]::after {\n  left: 16px !important;\n  right: auto !important;\n}\n\nhtml body [data-width-handle][data-dct-wh-off]:not([data-dragging])::after {\n  opacity: 0 !important;\n}\n\nhtml body [data-width-handle][data-dragging]::after {\n  width: 2px !important;\n  background: linear-gradient(to bottom, transparent, var(--dct-grip-on) 64px, var(--dct-grip-on) calc(100% - 64px), transparent) !important;\n}\n\nbody[data-ds-dark-theme] {\n  --dct-grip:rgba(255,255,255,.5);\n  --dct-grip-on:rgba(255,255,255,.4);\n}\n\nbody:not([data-ds-dark-theme]) {\n  --dct-grip:rgba(15,23,42,.34);\n  --dct-grip-on:rgba(15,23,42,.26);\n}\n\n/* tab strips (right sidebar 开始 / 文件 / README …): the current tab was a solid grey block on glass, and the quiet 开始 tab\n   had no fill at all when current. One glass pill for the current tab, the hover tint for the others. */\nhtml body [class*=_tabStrip] [role=tab] {\n  background: transparent !important;\n  box-shadow: none !important;\n  transition: background-color 0.12s ease, box-shadow 0.12s ease;\n}\n\nhtml body [class*=_tabStrip] [role=tab]:hover {\n  background: var(--dg-hover) !important;\n}\n\nhtml body [class*=_tabStrip] [role=tab]:is([aria-selected=true], [class*=_tabActive]) {\n  background: var(--dg-chip) !important;\n  box-shadow: var(--dg-ring) !important;\n}\n\n/* cards on the global pages (插件市场 tiles and cards, 插件全景): the layer tokens are see-through but carry no blur, so over the\n   whale and the grid they read as clear slabs. Frosted like the rest; the blur sits on ::before (a backdrop-filter on the card\n   would trap its fixed ⋯ menus), and dsh's bright 0.2 border becomes the glass hairline. No saturate here: on wide rows\n   (已安装 list) it pushed the aurora's bright patches into loud blue slabs; plain blur keeps every row the same grey. */\nhtml body [data-global-panel=true] :is([class$=_card], [class*=\"_card \"], [class$=_recentTile], [class*=\"_recentTile \"], .bg-surface.rounded-2xl) {\n  position: relative;\n  isolation: isolate;\n  border-color: var(--dg-line) !important;\n  box-shadow: var(--dg-ring), 0 2px 12px rgba(0, 0, 0, 0.08) !important;\n}\n\nhtml body [data-global-panel=true] :is([class$=_card], [class*=\"_card \"], [class$=_recentTile], [class*=\"_recentTile \"], .bg-surface.rounded-2xl)::before {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  z-index: -1;\n  border-radius: inherit;\n  pointer-events: none;\n  -webkit-backdrop-filter: var(--dg-blur-card);\n  backdrop-filter: var(--dg-blur-card);\n}\n\n/* Modal dialogs (插件安装确认, confirmations …): their fill is one of the see-through bg-layer tokens above, and with\n   nothing blurring what is behind them the page text showed through the dialog. Same glass as the settings dialog. */\nhtml body [role=dialog][aria-modal=true] {\n  background: var(--dg-tint-strong) !important;\n  -webkit-backdrop-filter: var(--dg-blur) !important;\n  backdrop-filter: var(--dg-blur) !important;\n  box-shadow: var(--dg-ring), var(--dg-shadow) !important;\n}\n\n/* tool-call rows (运行了 N 条命令) and the task card: glass instead of see-through. claude-flow (08)\n   renders its rows inside .dcf-card without data-dcg-member, so cover both or those stay transparent */\nhtml body :is([data-dcg-member], .dcf-card) [class*=_callRow] {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur-soft) !important;\n  backdrop-filter: var(--dg-blur-soft) !important;\n  border-color: var(--dg-line) !important;\n}\n\n/* inside a 提问 tool row: the answers card sits on dsh's solid base; a darker glass well instead. Only that card\n   (it holds the question list): a bash row's own header is also a _card, and painting it made those rows dark slabs */\nhtml body [class*=_callRow] :is([class$=_card], [class*=\"_card \"]):has([class*=_question]) {\n  background: var(--dg-code) !important;\n}\n\nhtml body [class*=_callRow] [class*=_inspectButton] {\n  background: var(--dg-chip) !important;\n}\n\nhtml body [class*=_callRow] [class*=_inspectButton]:hover {\n  background: var(--dg-hover) !important;\n}\n\n/* the agent's live question and plan-review cards above the input box: the input box's glass instead of its solid fill */\nhtml body :is([data-question-key], [data-plan-review-key]) > section {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur) !important;\n  backdrop-filter: var(--dg-blur) !important;\n  box-shadow: var(--dg-ring), var(--dg-shadow) !important;\n  border-color: transparent !important;\n}\n\n/* task card: the outer section stays see-through (it has no edge, so a tint reads as a slab); only the bordered list is glass */\nhtml body .dpc-card {\n  background: transparent !important;\n  -webkit-backdrop-filter: none !important;\n  backdrop-filter: none !important;\n}\n\nhtml body .dpc-card .dpc-list {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur-soft) !important;\n  backdrop-filter: var(--dg-blur-soft) !important;\n  border-color: var(--dg-line) !important;\n  box-shadow: var(--dg-ring) !important;\n}\n\n/* 加载更早 pill */\nhtml body [class*=_older] > button {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur) !important;\n  backdrop-filter: var(--dg-blur) !important;\n  box-shadow: var(--dg-ring), 0 4px 14px rgba(0, 0, 0, 0.18) !important;\n  border: 0 !important;\n  color: var(--dsw-alias-label-secondary) !important;\n}\n\nhtml body [class*=_older] > button:hover {\n  background: var(--dg-tint-strong) !important;\n  color: var(--dsw-alias-label-primary) !important;\n}\n\n/* deliverable file cards (README.md · 03_daily_factor.sql …) and the per-turn changes card: glass, not neutral-850 slabs */\nhtml body [class*=_root]:has(> [class*=_file], > * > [class*=_file]) {\n  --deliverable-fill:var(--dg-tint);\n  --deliverable-hover:var(--dg-tint-strong);\n}\n\nhtml body [class*=_file]:has(> [class*=_cardPreview], > * > [class*=_cardPreview]) {\n  -webkit-backdrop-filter: var(--dg-blur-soft) !important;\n  backdrop-filter: var(--dg-blur-soft) !important;\n  border-color: var(--dg-line) !important;\n  box-shadow: var(--dg-ring) !important;\n}\n\nhtml body [class*=_file]:has(> [class*=_cardPreview], > * > [class*=_cardPreview]) [class*=_actions] :is(button, [class*=_split]) {\n  background: var(--dg-chip) !important;\n  border-color: transparent !important;\n  box-shadow: none !important;\n}\n\nhtml body [class*=_file]:has(> [class*=_cardPreview], > * > [class*=_cardPreview]) [class*=_actions] button:hover {\n  background: var(--dg-hover) !important;\n}\n\nhtml body [class*=_card]:has(> [class*=_header]) {\n  --changes-fill:var(--dg-tint);\n  --changes-hover:var(--dg-tint-strong);\n}\n\n/* the well inside a tool row (command, output, results) uses the same code surface as code blocks */\nhtml body, html body[data-ds-dark-theme] {\n  --dtg-band:var(--dg-code);\n}\n\n/* code blocks: one translucent well; dsh's opaque banner strip on top goes, the banner keeps a faint tint */\nhtml body .md-code-block {\n  background: var(--dg-code) !important;\n  -webkit-backdrop-filter: blur(16px) saturate(1.3) !important;\n  backdrop-filter: blur(16px) saturate(1.3) !important;\n  box-shadow: 0 0 0 0.5px var(--dg-line) !important;\n  border-color: transparent !important;\n}\n\nhtml body .md-code-block [class*=_bannerWrap] {\n  background: var(--dg-code-head) !important;\n}\n\nhtml body .md-code-block [data-code-block-banner] {\n  background: transparent !important;\n}\n\n/* the code itself (plain <pre> or shiki's) sits on the well, not on its own opaque fill */\nhtml body .md-code-block pre, html body .md-code-block [data-code-block-content], html body .md-code-block [data-code-block-content] :is(pre, code, .shiki) {\n  background: transparent !important;\n}\n\n/* text selection: a clear macOS-style blue, tuned per theme (dsh's pale accent turns grey on glass);\n   translucent, so selected text keeps its own colour; inline code and inputs take the same fill */\n::selection {\n  background: var(--dg-select) !important;\n}\n\n:is(code, kbd, input, textarea, [contenteditable])::selection, :is(code, kbd, [contenteditable]) *::selection {\n  background: var(--dg-select) !important;\n}\n\n/* sidebar list: dsh's bottom fade paints an opaque gradient over the last row; fade the list itself instead */\nhtml body [class*=_sidebarCol] [class*=_treeBody] > [class*=_fade] {\n  display: none !important;\n}\n\nhtml body [class*=_sidebarCol] [class*=_treeBody] > [class*=_list] {\n  -webkit-mask-image: linear-gradient(#000 calc(100% - 24px), transparent);\n  mask-image: linear-gradient(#000 calc(100% - 24px), transparent);\n}\n\n/* the transcript scrolls under the composer, and dsh's own fade is made transparent by the background, so text runs into\n   the status row below the input box. A blur only below the input box: it hangs off the box itself (its width plus a fade outside each side),\n   starts behind it so its top edge is hidden, has no tint and fades out at the sides, so there is no visible shape:\n   over the smooth background it shows nothing, it only softens text passing under the status row. Conversation page only:\n   on the new-session page nothing scrolls under the box, and the band smeared its lower edge like a second shadow. */\nhtml body :is([data-phase=active], [data-content-phase=active]) [data-composer-seat]::before {\n  content: none !important;\n}\n\nhtml body :is([data-phase=active], [data-content-phase=active]) [data-composer-seat] [class*=_root]:has(> [data-composer-card])::after {\n  content: \"\";\n  position: absolute;\n  inset: 24px -64px 0;\n  z-index: -2;\n  pointer-events: none;\n  -webkit-backdrop-filter: blur(14px);\n  backdrop-filter: blur(14px);\n  -webkit-mask-image: linear-gradient(90deg, transparent, #000 64px, #000 calc(100% - 64px), transparent);\n  mask-image: linear-gradient(90deg, transparent, #000 64px, #000 calc(100% - 64px), transparent);\n}\n\n/* the scroll-to-bottom button: the same glass as the input box */\nhtml body button[class*=_toBottom] {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur) !important;\n  backdrop-filter: var(--dg-blur) !important;\n  box-shadow: var(--dg-ring), var(--dg-shadow) !important;\n  border-color: transparent !important;\n}\n\nhtml body button[class*=_toBottom]:hover {\n  background: var(--dg-hover) !important;\n}\n\n/* input box: the same glass as the settings dialog and the message bubble, with or without dsh-claude-composer.\n   On its own (dsh's layout) the card itself is the box, so it gets the glass. dsh-claude-composer turns the card into\n   display:contents (which paints no background) and draws the box as the root's ::before instead, which gets the\n   same glass, so there is always exactly one. A transparent card with no layer behind it let the transcript show\n   through the input box. */\n/* the blur sits on ::before: a backdrop-filter on the card itself made it the backdrop root of the + / slash menus that open\n   inside it, so those menus could not blur the conversation above the box (their tint alone let the text show through).\n   Only for dsh's own card: with dsh-claude-composer on, the card is display:contents, the glass is the root's ::before\n   below, and a ::before here would cover the whole root, status row included, as a second outline. dsh-claude-composer\n   marks its root with --dco-on:1 (on every page, the new-session hero included); a style query reads it. */\n@container not style(--dco-on: 1) {\n  html body [data-composer-seat] [data-composer-card] {\n    background: var(--dg-tint) !important;\n    -webkit-backdrop-filter: none !important;\n    backdrop-filter: none !important;\n    isolation: isolate;\n    box-shadow: var(--dg-ring), var(--dg-shadow-input) !important;\n    border-color: transparent !important;\n  }\n  html body [data-composer-seat] [data-composer-card]::before {\n    content: \"\";\n    position: absolute;\n    inset: 0;\n    z-index: -1;\n    border-radius: inherit;\n    pointer-events: none;\n    -webkit-backdrop-filter: var(--dg-blur);\n    backdrop-filter: var(--dg-blur);\n  }\n}\n/* the blur under the status row (::after above) hangs off this root; dsh-claude-composer sets the same */\nhtml body [data-composer-seat] [class*=_root]:has(> [data-composer-card]) {\n  position: relative;\n  isolation: isolate;\n}\n\n/* the input box rests on the page: a lighter shadow than menus and popovers (--dg-shadow) */\nhtml body [data-composer-seat] [class*=_root]:has(> [data-composer-card])::before {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur) !important;\n  backdrop-filter: var(--dg-blur) !important;\n  box-shadow: var(--dg-ring), var(--dg-shadow-input) !important;\n}\n\n/* the new-session usage card (dsh-claude-shell): the same glass as the input box */\nhtml body .dhs {\n  background: var(--dsb-surface);\n  -webkit-backdrop-filter: blur(12px);\n  backdrop-filter: blur(12px);\n  border-color: var(--dsb-border);\n}\n\nbody:not([data-ds-dark-theme]) .dhs {\n  --dhs-bg:rgb(246,248,251);\n}\n\nbody[data-ds-dark-theme] .dhs {\n  --dhs-bg:rgb(24,27,33);\n}\n\n/* …inside it everything mixed from that solid base (empty heatmap cells, the current range, level colours) was an opaque slab,\n   and the 14% rules round tiles and boxes were brighter than the glass hairline: translucent fills and the hairline instead */\nbody[data-ds-dark-theme] .dhs {\n  --dhs-empty:rgba(255,255,255,.055);\n  --dhs-line:var(--dg-line);\n  --dhs-seg-on:rgba(255,255,255,.13);\n}\n\nbody:not([data-ds-dark-theme]) .dhs {\n  --dhs-empty:rgba(15,23,42,.06);\n  --dhs-line:var(--dg-line);\n  --dhs-seg-on:rgba(255,255,255,.92);\n}\n\nhtml body .dhs .dhs-tile {\n  background: var(--dg-tint-soft);\n  border-color: var(--dg-line);\n}\n\nbody[data-ds-dark-theme] .dhs .dhs-tile {\n  background: rgba(255, 255, 255, 0.035);\n}\n\nhtml body .dhs .dhs-heat i[data-l=\"1\"], html body .dhs .dhs-legend i[data-l=\"1\"] {\n  background: color-mix(in srgb, var(--dhs-accent) 34%, transparent);\n}\n\nhtml body .dhs .dhs-heat i[data-l=\"2\"], html body .dhs .dhs-legend i[data-l=\"2\"] {\n  background: color-mix(in srgb, var(--dhs-accent) 55%, transparent);\n}\n\nhtml body .dhs .dhs-heat i[data-l=\"3\"], html body .dhs .dhs-legend i[data-l=\"3\"] {\n  background: color-mix(in srgb, var(--dhs-accent) 78%, transparent);\n}\n\n/* range picker: one soft track with the current range as a raised pill (as the 已安装 / 插件市场 switch), no cell borders */\nhtml body .dhs .dhs-seg {\n  border: 0;\n  border-radius: 9px;\n  padding: 2px;\n  gap: 2px;\n  background: var(--dhs-empty);\n}\n\nhtml body .dhs .dhs-seg button {\n  height: 22px;\n  border: 0 !important;\n  border-radius: 7px;\n  transition: background-color 0.12s ease, color 0.12s ease;\n}\n\nhtml body .dhs .dhs-seg button:hover {\n  background: var(--dg-hover);\n}\n\nhtml body .dhs .dhs-seg button[aria-pressed=true] {\n  background: var(--dhs-seg-on);\n  box-shadow: var(--dg-ring), 0 1px 3px rgba(0, 0, 0, 0.12);\n}\n\n/* sidebar: no opaque strip behind the account row */\nhtml body [class*=_sidebarCol] [class*=_footArea], html body [class*=_sidebarCol] [class*=_footArea] > * {\n  background: transparent !important;\n  box-shadow: none !important;\n}\n\n/* right sidebar: the same frosted column as the left one, instead of an opaque pane; its start-page entries are soft glass */\nhtml body [class*=_rightbarCol] [data-dockkit-pane] {\n  background: var(--dsb-surface) !important;\n  -webkit-backdrop-filter: blur(12px);\n  backdrop-filter: blur(12px);\n}\n\nhtml body [data-slot^=\"sidebar.right.tab.guide\"] button[class*=_entry] {\n  background: var(--dg-tint-soft) !important;\n  box-shadow: var(--dg-ring) !important;\n  border-color: transparent !important;\n}\n\nhtml body [data-slot^=\"sidebar.right.tab.guide\"] button[class*=_entry]:hover {\n  background: var(--dg-hover) !important;\n}\n\n/* session hover card in the sidebar (dsh's hover portal): dsh keeps it dark with white text in both themes\n   (an inverted tooltip), so it becomes dark glass in both */\nhtml body [class*=_portal_] > [class*=_card_]:has([class*=_hoverContent]) {\n  background: rgba(36, 37, 42, 0.74) !important;\n  -webkit-backdrop-filter: var(--dg-blur) !important;\n  backdrop-filter: var(--dg-blur) !important;\n  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.1), inset 0 0.5px 0 rgba(255, 255, 255, 0.08), 0 10px 32px rgba(0, 0, 0, 0.28) !important;\n  border: 0 !important;\n}\n\n/* 上下文透视 (dsh-claude-context): glass cards and a frosted sticky toolbar instead of opaque layers */\nhtml body .clx-toolbar {\n  background: color-mix(in srgb, var(--dsw-alias-bg-base, #fff) 35%, transparent) !important;\n  -webkit-backdrop-filter: blur(16px) saturate(1.4);\n  backdrop-filter: blur(16px) saturate(1.4);\n}\n\nhtml body .clx-card {\n  background: var(--dg-tint) !important;\n  -webkit-backdrop-filter: var(--dg-blur-soft);\n  backdrop-filter: var(--dg-blur-soft);\n  border-color: var(--dg-line) !important;\n}\n\nhtml body .clx-ft-st:not(.loaded) {\n  background: var(--dg-chip) !important;\n}"

// ===== src/styles/07-theme-settings.scss
/* compiled from src/styles/07-theme-settings.scss by build.mjs — edit the .scss, not this file */
const CSS_THEME_SETTINGS = "/*!\n * Static CSS for the theme settings part (parts/07-settings.ts): the 动态背景 / 鲸鱼 / 星座网格\n * fade-out states, the 毛玻璃 (clear / standard / frosted) blur and tint overrides, and the\n * settings page's .dct-page / .dct-head rows. Injected as the `theme-settings` sheet\n * (CSS_THEME_SETTINGS).\n */\n/* 动态背景 off: only the backdrop colour; whale / grid off: their layer. Faded rather than display:none, so the\n   canvases keep their size (no reset, nothing drawn into a 0×0 canvas) and switching back fades the last frame in. */\n#dsh-ds-bg :is(#dsh-ds-aurora, #dsh-ds-constellation) {\n  transition: opacity 0.45s ease, visibility 0s;\n}\n\n#dsh-ds-bg .dsh-ds-whale {\n  transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.45s ease, visibility 0s;\n}\n\nhtml[data-dct-bg=off] #dsh-ds-bg :is(#dsh-ds-aurora, .dsh-ds-whale, #dsh-ds-constellation),\nhtml[data-dct-no-whale] #dsh-ds-bg .dsh-ds-whale,\nhtml[data-dct-no-grid] #dsh-ds-bg #dsh-ds-constellation {\n  opacity: 0;\n  visibility: hidden;\n  transition-delay: 0s, 0.45s;\n}\n\nhtml[data-dct-bg=off] #dsh-ds-bg .dsh-ds-whale, html[data-dct-no-whale] #dsh-ds-bg .dsh-ds-whale {\n  transition-delay: 0s, 0s, 0.45s;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  #dsh-ds-bg :is(#dsh-ds-aurora, .dsh-ds-whale, #dsh-ds-constellation) {\n    transition: none !important;\n  }\n}\n/* 毛玻璃 strength: blur and how much of the surface colour covers the background */\nhtml[data-dct-glass=clear] body {\n  --dg-blur:blur(14px) saturate(1.3);\n  --dg-blur-soft:blur(8px) saturate(1.2);\n  --dg-blur-card:blur(12px);\n}\n\nhtml[data-dct-glass=clear] body[data-ds-dark-theme] {\n  --dg-tint:rgba(44,45,50,.34);\n  --dg-tint-strong:rgba(36,37,42,.5);\n}\n\nhtml[data-dct-glass=clear] body:not([data-ds-dark-theme]) {\n  --dg-tint:rgba(255,255,255,.36);\n  --dg-tint-strong:rgba(255,255,255,.52);\n}\n\nhtml[data-dct-glass=frosted] body {\n  --dg-blur:blur(64px) saturate(1.6);\n  --dg-blur-soft:blur(40px) saturate(1.5);\n  --dg-blur-card:blur(32px);\n}\n\nhtml[data-dct-glass=frosted] body[data-ds-dark-theme] {\n  --dg-tint:rgba(44,45,50,.74);\n  --dg-tint-strong:rgba(36,37,42,.84);\n}\n\nhtml[data-dct-glass=frosted] body:not([data-ds-dark-theme]) {\n  --dg-tint:rgba(255,255,255,.76);\n  --dg-tint-strong:rgba(255,255,255,.86);\n}\n\n.dct-page {\n  display: flex;\n  flex-direction: column;\n}\n\n.dct-head {\n  padding: 20px 0 4px;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dct-head:first-child {\n  padding-top: 0;\n}"

// ===== src/parts/05-background.js
"use strict";
/*!
 * dsh-background — browser half.
 *
 * The deepseek.com hero as dsh's page background, behind every panel, in both themes:
 *   · aurora: the deepseek.com/harness WebGL fluid with its mouse-driven flowmap (02-bg-aurora.js).
 *     Light uses the same fluid on a light palette; neither theme has the glow under the cursor.
 *   · whale: the particle whale (03-bg-whale.js), held at a fixed spot in the content area rather
 *     than the window centre, drawn as its own negative (navy ink) in the light theme.
 *   · constellation grid (04-bg-constellation.js), pushed by the pointer; skipped on touch screens.
 *   · the app shell made transparent so it shows through, and the left sidebar as frosted glass.
 * Surfaces over it (menus, bubbles, code blocks, the input box …) are 06-glass.js.
 *
 * Performance: both WebGL loops are capped at 30 fps and stop while the tab is hidden, and also after
 * IDLE_MS without input or while the window is unfocused (the last frame stays; any input resumes).
 * Settings › 主题 (07-settings.js) can make it still or off, hide the whale or grid and turn the idle pause off.
 *
 * Originally the third-party plugin dsh-client-ui-deepseek-bg v1.0.0 (MIT), merged here 2026-11-11;
 * the original zip and its local-changes notes are in ../_archive/plugin-cleanup-2026-11-11/.
 */
part({
    id: 'dsh-background',
    feature: { zh: "动态背景", en: "Background", desc: "极光流体 / 鲸鱼 / 星座网格背景（主题页可细调）", descEn: "Aurora fluid / whale / constellation backdrop (tunable on the Theme page)" },
    factory(require, kit) {
        const IDLE_MS = 20000;
        const sheet = kit.sheet('background', CSS_BACKGROUND);
        // deepseek.com/harness hero parameters (fluid renderer). glowIntensity 0: the original tints the area
        // around the cursor, which on glass reads as a light blob following the pointer.
        const DARK_AURORA = {
            mouseRadius: 0.09, mouseStrength: 1.8, mouseSmoothing: 0.1, mouseVelocity: 0.2, decay: 0.925,
            distortBoost: 2.2, swirlBoost: 0.8, glowIntensity: 0, glowColors: ['#fff7d1', '#538dca', '#2d448b'],
            speed: 28, scale: 1.77, offsetX: -124, offsetY: -48,
            colors: ['#000000', '#1A3870', '#204a7e', '#eed8aa', '#000000'],
            lightX: 0.89, lightY: 0.46, lightCore: 0.14, lightHalo: 0.2, vignette: 0.38, lightFollow: 0.63,
            bloomThreshold: 0.61, bloomRange: 0.18, bloomStrength: 0.4, grain: 0.005,
        };
        // the same fluid, shape and motion on a light palette: black → paper, deep navy currents → soft blues,
        // the cream highlight stays warm; no light spot, vignette or bloom on white
        const LIGHT_AURORA = Object.assign({}, DARK_AURORA, {
            colors: ['#f7f8fb', '#c4d4ee', '#a7c0e6', '#f2e2c2', '#f7f8fb'],
            grain: 0.004, lightCore: 0, lightHalo: 0, vignette: 0, lightFollow: 0, bloomStrength: 0,
        });
        const DARK_GRID = { lineColor: 'rgba(255, 255, 255,', dotColor: 'rgba(255, 255, 255,', lineOpacity: 0.08, dotOpacity: 0.16, round: false };
        const LIGHT_GRID = { lineColor: 'rgba(60, 100, 160,', dotColor: 'rgba(60, 100, 160,', lineOpacity: 0.1, dotOpacity: 0.2, round: true };
        // Light-theme whale ink: in dark each particle brightens the page by its intensity (screen); here it
        // darkens it by the same intensity (multiply), weighted per channel toward navy. INK is the darkening
        // per unit of dark brightness (the canvas carries half of it, see 03-bg-whale.js).
        const INK = [1.9, 1.55, 0.7];
        const LUM = [0.3, 0.59, 0.11];
        const inkRow = (k) => LUM.map((l) => (-k * l).toFixed(4)).join(' ') + ' 0 1';
        const INK_MATRIX = `${inkRow(INK[0])}  ${inkRow(INK[1])}  ${inkRow(INK[2])}  0 0 0 1 0`;
        // Where the whale sits: a fixed spot in the content area (its middle, a little above centre where the
        // new-session title rests), never following the content. BOX is the whale's drawn centre relative to the
        // canvas centre as a share of its height (the whale scales with the height, so this holds).
        const RISE = 0.41;
        const BOX = { x: -0.0121, y: -0.0185 };
        function detectDark(darkQuery) {
            const b = document.body, d = document.documentElement;
            if (b.hasAttribute('data-ds-dark-theme') || d.hasAttribute('data-ds-dark-theme'))
                return true;
            if (b.hasAttribute('data-ds-light-theme') || d.hasAttribute('data-ds-light-theme'))
                return false;
            // dsh marks dark with data-ds-dark-theme and light with nothing; data-ds-theme-source says it has applied a theme,
            // so without the dark mark it is light (the system query below only covers the moment before dsh starts)
            if (d.hasAttribute('data-ds-theme-source'))
                return false;
            if (d.dataset.theme === 'dark')
                return true;
            if (d.dataset.theme === 'light')
                return false;
            return !!(darkQuery && darkQuery.matches);
        }
        function start() {
            sheet.ensure();
            const mq = (q) => window.matchMedia && window.matchMedia(q);
            const darkQuery = mq('(prefers-color-scheme: dark)');
            const resumers = [];
            const bg = {
                state: { dark: detectDark(darkQuery) },
                reducedMotion: !!(mq('(prefers-reduced-motion: reduce)') || {}).matches,
                coarse: !!(mq('(hover: none), (pointer: coarse)') || {}).matches,
                // dsh's own background is also mouse-free on Windows (the flowmap brush stutters there)
                isWindows: (navigator.userAgentData?.platform === 'Windows') || navigator.userAgent.includes('Windows'),
                paused: false,
                // bumped when something the last frame shows changed (theme, settings): a halted loop draws once more
                epoch: 0,
                // 主题 settings (07-settings.js): a loop stops at its next frame while halted
                still: () => themePrefs().get().bg !== 'live',
                halted(name) {
                    const p = themePrefs().get();
                    if (bg.paused || p.bg !== 'live')
                        return true;
                    return (name === 'whale' && !p.whale) || (name === 'grid' && !p.grid);
                },
                shift: { x: 0, y: 0 }, // px the whale layer is moved by
                aurora: () => (bg.state.dark ? DARK_AURORA : LIGHT_AURORA),
                constellation: () => (bg.state.dark ? DARK_GRID : LIGHT_GRID),
                onResume: (fn) => { resumers.push(fn); },
            };
            // DOM
            const el = (tag, props) => Object.assign(document.createElement(tag), props);
            const container = el('div', { id: 'dsh-ds-bg' });
            bg.auroraCanvas = el('canvas', { id: 'dsh-ds-aurora' });
            bg.constellationCanvas = el('canvas', { id: 'dsh-ds-constellation' });
            const whaleLayer = el('div', { className: 'dsh-ds-whale' });
            whaleLayer.setAttribute('aria-hidden', 'true');
            bg.whaleCanvas = el('canvas', { className: 'dsh-ds-whale-canvas' });
            whaleLayer.appendChild(bg.whaleCanvas);
            const ink = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            ink.setAttribute('width', '0');
            ink.setAttribute('height', '0');
            ink.setAttribute('aria-hidden', 'true');
            ink.style.cssText = 'position:absolute;width:0;height:0';
            ink.innerHTML = `<filter id="dsh-ds-ink" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${INK_MATRIX}"/></filter>`;
            container.append(bg.auroraCanvas, whaleLayer, bg.constellationCanvas, ink);
            // theme
            const applyTheme = () => {
                const d = detectDark(darkQuery);
                if (d === bg.state.dark && container.isConnected)
                    return;
                bg.state.dark = d;
                container.classList.toggle('dsh-ds-dark', d);
                redraw();
            };
            const redraw = () => { bg.epoch++; for (const fn of resumers)
                fn(); };
            themePrefs().subscribe(redraw);
            // a resized canvas is blank until drawn: halted loops (静止, idle) draw once more after the resize settles
            let resizeT = 0;
            window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(redraw, 200); }, { passive: true });
            container.classList.toggle('dsh-ds-dark', bg.state.dark);
            const moTheme = new MutationObserver(applyTheme);
            const THEME_ATTRS = { attributes: true, attributeFilter: ['data-ds-dark-theme', 'data-ds-light-theme', 'data-ds-theme-source', 'data-theme', 'class'] };
            moTheme.observe(document.documentElement, THEME_ATTRS);
            moTheme.observe(document.body, THEME_ATTRS);
            if (darkQuery && darkQuery.addEventListener)
                darkQuery.addEventListener('change', applyTheme);
            document.body.appendChild(container);
            startAurora(bg);
            startWhale(bg);
            if (!bg.coarse || bg.reducedMotion)
                startConstellation(bg);
            startPlacement(bg);
            startIdle(bg, resumers);
        }
        // The whale layer follows the content area: re-measured only when that area is resized or replaced
        // (page changes), so a streaming reply, which mutates deep inside the page, never forces layout reads.
        function startPlacement(bg) {
            function place() {
                const main = document.querySelector('[class*="_mainPanel"]');
                if (!main)
                    return;
                const r = main.getBoundingClientRect();
                const W = window.innerWidth, H = window.innerHeight;
                const x = Math.round(r.left + r.width / 2 - (W / 2 + BOX.x * H));
                const y = Math.round(r.top + r.height * RISE - (H / 2 + BOX.y * H));
                if (x === bg.shift.x && y === bg.shift.y)
                    return;
                bg.shift.x = x;
                bg.shift.y = y;
                const root = document.documentElement.style;
                root.setProperty('--dsb-whale-x', x + 'px');
                root.setProperty('--dsb-whale-y', y + 'px');
            }
            let t = 0;
            const later = () => { if (!t)
                t = setTimeout(() => { t = 0; place(); }, 120); };
            const ro = new ResizeObserver(later);
            let mainEl = null;
            const observeMain = () => {
                const m = document.querySelector('[class*="_mainPanel"]');
                if (m === mainEl)
                    return false;
                if (mainEl)
                    ro.unobserve(mainEl);
                mainEl = m;
                if (m)
                    ro.observe(m);
                return true;
            };
            new MutationObserver(() => { if (observeMain())
                later(); })
                .observe(document.querySelector('[data-slot="main"]') || document.body, { childList: true });
            window.addEventListener('resize', later);
            observeMain();
            place();
        }
        // Idle pause: after IDLE_MS without pointer / key / wheel / touch input, or while the window is
        // unfocused, the WebGL loops stop at their next frame (bg.paused) and are restarted on input or focus.
        function startIdle(bg, resumers) {
            const html = document.documentElement;
            function pause() {
                if (bg.paused)
                    return;
                bg.paused = true;
                html.dataset.dshBgPaused = '';
            }
            function resume() {
                if (!bg.paused)
                    return;
                bg.paused = false;
                delete html.dataset.dshBgPaused;
                for (const fn of resumers)
                    fn();
            }
            let timer = 0;
            const arm = () => { clearTimeout(timer); timer = setTimeout(pause, IDLE_MS); };
            const idleOn = () => themePrefs().get().idle;
            const onInput = () => { if (!document.hasFocus())
                return; resume(); if (idleOn())
                arm(); };
            for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'])
                window.addEventListener(e, onInput, { passive: true, capture: true });
            window.addEventListener('blur', () => { clearTimeout(timer); if (idleOn())
                pause(); });
            window.addEventListener('focus', () => { resume(); if (idleOn())
                arm(); });
            // 空闲暂停 turned off: run again now; turned on: start counting
            themePrefs().subscribe(() => { clearTimeout(timer); if (idleOn())
                arm();
            else
                resume(); });
            // a page that opens unfocused still gets the whale's 3 s assembly before it pauses
            if (document.hasFocus())
                arm();
            else
                timer = setTimeout(pause, 3000);
        }
        return {
            inject: [],
            apply() {
                // once per page: the engines own their canvases and listeners for the page's lifetime
                if (window.__dshBackground)
                    return;
                window.__dshBackground = true;
                if (document.body)
                    start();
                else
                    document.addEventListener('DOMContentLoaded', start, { once: true });
            },
        };
    },
});

// ===== src/parts/06-glass.js
"use strict";
/*!
 * dsh-glass — browser half (the dsh-whale-theme plugin).
 *
 * One "liquid glass" material for floating and raised surfaces, matched to dsh's own
 * status-bar popovers (Token 用量 …): a translucent tint, blur(40px) saturate(1.5),
 * a 0.5px light ring with a faint top highlight, and a soft shadow. Applied to
 *   · dsh menus (through dsh's own menu tokens) and the user message bubble
 *   · the turn-outline hover card (the ☰ marks at the right of a conversation)
 *   · the @hyzyn/dsh-search ⌘K palette (CSS only, the plugin itself is untouched)
 *   · the Settings dialog
 *   · tool-call rows (运行了 N 条命令; what opens inside a row is dsh-tool-groups'), the plan
 *     card's list and the 加载更早 pill
 *   · deliverable file cards and the per-turn changes card
 *   · code blocks (a darker glass well), the command / output band in tool rows, and the
 *     text-selection colour
 *   · the frosted fade behind the input box and the new-session usage card
 * and removes the opaque strip behind the sidebar's account row and the opaque fade over
 * the session list's last row. Theme only: no layout or behaviour changes. Dark and light
 * each get their own tint.
 *
 * The background under these surfaces is 05-background.js. All theme handling lives in this bundle,
 * so dsh-claude-composer / dsh-claude-display / dsh-claude-shell work the same without it. How the
 * conversation's text reads (fonts, sizes, text colours, command colours) is dsh-claude-display's.
 */
part({
    id: 'dsh-glass',
    feature: { zh: "毛玻璃", en: "Glass", desc: "浮层、菜单与气泡的统一半透明玻璃材质", descEn: "One translucent glass material for popovers, menus and bubbles" },
    factory(require, kit) {
        const sheet = kit.sheet('glass', CSS_GLASS);
        return {
            inject: [],
            apply(ctx) {
                ctx.effect(() => { sheet.ensure(); return sheet.remove; }, 'glass: styles');
                // width handles: dsh moves --dsh-width-handle-pointer-y only while dragging; keep it on the pointer while
                // hovering too, stop the line at the input box, and hide it level with the input box
                ctx.effect(() => {
                    let cur = null;
                    const seatTop = (h) => {
                        const seat = h.parentElement && h.parentElement.querySelector('[data-composer-seat]');
                        return seat ? seat.getBoundingClientRect().top : Infinity;
                    };
                    const move = (e) => {
                        const h = e.target && e.target.closest ? e.target.closest('[data-width-handle]') : null;
                        if (cur && cur !== h) {
                            cur.removeAttribute('data-dct-wh-off');
                            cur = null;
                        }
                        if (!h || h.hasAttribute('data-dragging'))
                            return;
                        cur = h;
                        const box = h.getBoundingClientRect();
                        const stop = Math.min(seatTop(h), box.bottom);
                        h.style.setProperty('--dct-wh-bottom', Math.max(0, box.bottom - stop + 12) + 'px');
                        h.style.setProperty('--dsh-width-handle-pointer-y', (e.clientY - box.top) + 'px');
                        h.toggleAttribute('data-dct-wh-off', e.clientY > stop - 16);
                    };
                    document.addEventListener('pointermove', move, { passive: true });
                    return () => {
                        document.removeEventListener('pointermove', move);
                        for (const h of document.querySelectorAll('[data-width-handle]')) {
                            h.removeAttribute('data-dct-wh-off');
                            h.style.removeProperty('--dct-wh-bottom');
                        }
                    };
                }, 'glass: width handle');
            },
        };
    },
});

// ===== src/parts/07-settings.js
"use strict";
/*!
 * dsh-theme-settings — browser half.
 *
 * The theme's own settings (主题 / Theme tab right after 通用设置, and the same page on the bundle's
 * plugin page), so its options stay out of dsh's general page:
 *   动态背景   live (animated) · still (one frame, never animates) · off (plain backdrop)
 *   鲸鱼       the particle whale on / off
 *   星座网格   the pointer-pushed dot grid on / off
 *   空闲暂停   pause the animation after 20 s without input or while the window is unfocused
 *   毛玻璃     clear · standard · frosted, for every glass surface (06-glass.js)
 *   功能开关   the bundle's own feature parts (background / glass / font rows); each bundle's
 *              switchboard lists only its own features
 * Under them, the font rows (08-fonts.js) through the page's own item slot, settings.whale-theme.item.
 *
 * The choices live in localStorage (themePrefs(), shared with 05-background.js) and show up as
 * html[data-dct-*] attributes, which the CSS below keys on.
 */
// Historical key (the plugin was dsh-claude-theme until 2026-11-16): kept so the options a user
// already chose carry over after the rename.
const THEME_PREFS_KEY = 'dsh-claude-theme.settings';
const THEME_PREFS_DEFAULTS = { bg: 'live', whale: true, grid: true, idle: true, glass: 'standard' };
/** One store per page: read by the background engines and this page's rows. */
/** one store per page; created on first read and then kept in themePrefsStore */
let themePrefsStore = null;
function themePrefs() {
    if (themePrefsStore)
        return themePrefsStore;
    let prefs = { ...THEME_PREFS_DEFAULTS };
    try {
        prefs = { ...prefs, ...JSON.parse(localStorage.getItem(THEME_PREFS_KEY) || '{}') };
    }
    catch { }
    const subs = new Set();
    const reflect = () => {
        const d = document.documentElement.dataset;
        d.dctBg = prefs.bg;
        d.dctGlass = prefs.glass;
        if (prefs.whale)
            delete d.dctNoWhale;
        else
            d.dctNoWhale = '';
        if (prefs.grid)
            delete d.dctNoGrid;
        else
            d.dctNoGrid = '';
    };
    reflect();
    themePrefsStore = {
        get: () => prefs,
        subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
        set(patch) {
            prefs = { ...prefs, ...patch };
            try {
                localStorage.setItem(THEME_PREFS_KEY, JSON.stringify(prefs));
            }
            catch { }
            reflect();
            for (const fn of subs)
                fn();
        },
    };
    return themePrefsStore;
}
part({
    id: 'dsh-theme-settings',
    factory(require, kit) {
        const { React, h } = kit;
        const { useSyncExternalStore, useEffect } = React;
        const sheet = kit.sheet('theme-settings', CSS_THEME_SETTINGS);
        const ui = kit.settingsUI();
        const { Row, Select, Switch, S } = ui;
        const features = featureStore();
        const BG = [
            { v: 'live', zh: '动态', en: 'Animated' },
            { v: 'still', zh: '静止', en: 'Still' },
            { v: 'off', zh: '关闭', en: 'Off' },
        ];
        const GLASS = [
            { v: 'clear', zh: '通透', en: 'Clear' },
            { v: 'standard', zh: '标准', en: 'Standard' },
            { v: 'frosted', zh: '磨砂', en: 'Frosted' },
        ];
        function ThemeSection({ renderSlot, fonts }) {
            const store = themePrefs();
            const p = useSyncExternalStore(store.subscribe, store.get);
            useSyncExternalStore(features.subscribe, features.revision);
            useEffect(() => { ui.sheet.ensure(); }, []);
            const on = p.bg !== 'off';
            return h('div', { className: 'dct-page' }, h('div', { className: 'dct-head' }, S('功能开关', 'Features')), features.list().map((f) => h(Row, { key: f.id, label: S(f.zh, f.en), desc: S(f.desc, f.descEn) }, h(Switch, { label: S(f.zh, f.en), checked: features.enabled(f.id), onChange: (v) => features.set(f.id, v) }))), h('div', { className: 'dct-head' }, S('背景', 'Background')), h(Row, { label: S('动态背景', 'Background'), desc: S('静止只画一帧，关闭只留底色', 'Still draws a single frame; Off leaves the plain backdrop') }, h(Select, { label: S('动态背景', 'Background'), value: p.bg, options: BG, onChange: (v) => store.set({ bg: v }) })), on ? h(Row, { label: S('鲸鱼', 'Whale'), desc: S('内容区中央的粒子鲸鱼', 'The particle whale in the middle of the content area') }, h(Switch, { label: S('鲸鱼', 'Whale'), checked: p.whale, onChange: (v) => store.set({ whale: v }) })) : null, on ? h(Row, { label: S('星座网格', 'Constellation grid'), desc: S('随指针推开的点阵', 'The dot grid the pointer pushes around') }, h(Switch, { label: S('星座网格', 'Constellation grid'), checked: p.grid, onChange: (v) => store.set({ grid: v }) })) : null, p.bg === 'live' ? h(Row, { label: S('空闲暂停', 'Pause when idle'), desc: S('20 秒无操作或窗口失焦时停下动画，省电', 'Stop the animation after 20 s without input or while the window is unfocused') }, h(Switch, { label: S('空闲暂停', 'Pause when idle'), checked: p.idle, onChange: (v) => store.set({ idle: v }) })) : null, h(Row, { label: S('毛玻璃', 'Glass'), desc: S('输入框、气泡、菜单等玻璃表面的模糊与遮盖程度', 'How much blur and tint the input box, bubbles, menus and other glass surfaces get') }, h(Select, { label: S('毛玻璃', 'Glass'), value: p.glass, options: GLASS, onChange: (v) => store.set({ glass: v }) })), h('div', { className: 'dct-head' }, S('字体', 'Fonts')), fonts ? h(fonts) : renderSlot ? renderSlot('settings.whale-theme.item', {}) : null);
        }
        return {
            inject: ['slots'],
            apply(ctx) {
                themePrefs();
                sheet.ensure();
                ctx.effect(() => () => sheet.remove(), 'theme-settings: styles');
                ctx.slots.inject('settings.section', () => ctx.slots.register({
                    name: 'settings.section',
                    id: 'whale-theme',
                    order: 5,
                    label: () => S('主题', 'Theme'),
                    children: { 'settings.whale-theme.item': { kind: 'list', scope: 'root' } },
                }, ThemeSection));
                // the same page on the bundle's own plugin page; the settings tab stays
                ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
                    name: 'plugins.bundle.config', key: 'dsh-whale-theme',
                }, () => h(ThemeSection, { fonts: kit.themeFontRows })));
            },
        };
    },
});

// ===== src/parts/08-fonts.js
"use strict";
/*!
 * dsh-chat-fonts — browser half.
 *
 * Three font rows on this theme's own Settings › 主题 page (07-settings.js), under the theme options:
 *   界面字体  the conversation only: messages and the input box (the sidebar, menus and the rest
 *             of the app keep the system font)
 *   回复字体  the body of model replies, over 界面字体
 *   代码字体  dsh's own code font (the same setting as 更多字体设置 › 代码字体)
 * Each menu lists only fonts installed on this machine, shown in their own face.
 * 界面字体 and 回复字体 are this plugin's own (localStorage, one stylesheet); 代码字体 goes
 * through dsh's theme service, so it is saved in dsh's config.
 */
part({
    id: 'dsh-chat-fonts',
    feature: { zh: "字体设置行", en: "Font rows", desc: "主题页的界面 / 代码 / 等宽字体三行设置", descEn: "The three font rows on the Theme settings page" },
    factory(require, kit) {
        const { React, h } = kit;
        const { useState, useEffect, useSyncExternalStore } = React;
        // ------------------------------------------------------------------ own prefs
        const KEY = 'dsh-claude-appearance';
        const DEFAULTS = { chatFont: '', replyFont: '' };
        let prefs = { ...DEFAULTS };
        try {
            const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
            prefs = { chatFont: saved.chatFont || '', replyFont: saved.replyFont || '' };
        }
        catch { }
        const subs = new Set();
        const store = {
            get: () => prefs,
            subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
            set(patch) {
                prefs = { ...prefs, ...patch };
                try {
                    localStorage.setItem(KEY, JSON.stringify(prefs));
                }
                catch { }
                applyPrefs();
                for (const fn of subs)
                    fn();
            },
        };
        // ------------------------------------------------------------------ option lists
        const SANS_TAIL = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
        // `need`: the faces that have to be installed for the option to look different; options whose
        // faces are all missing are left out of the menu (an uninstalled font silently falls back to the
        // default, so picking it looked like the setting did nothing)
        const UI_FONTS = [
            { v: '', zh: '默认 · 系统', en: 'Default · System' },
            { v: '"PingFang SC"', zh: '苹方', en: 'PingFang SC', need: ['PingFang SC'] },
            { v: '"Source Han Sans SC", "Noto Sans CJK SC", "Noto Sans SC"', zh: '思源黑体', en: 'Source Han Sans', need: ['Source Han Sans SC', 'Noto Sans CJK SC', 'Noto Sans SC'] },
            { v: '"Hiragino Sans GB"', zh: '冬青黑体', en: 'Hiragino Sans GB', need: ['Hiragino Sans GB'] },
            { v: '"Lantinghei SC"', zh: '兰亭黑', en: 'Lantinghei SC', need: ['Lantinghei SC'] },
            { v: '"Avenir Next", "PingFang SC"', zh: 'Avenir Next', en: 'Avenir Next', need: ['Avenir Next'] },
            { v: '"HarmonyOS Sans SC"', zh: 'HarmonyOS Sans', en: 'HarmonyOS Sans', need: ['HarmonyOS Sans SC'] },
            { v: 'Inter', zh: 'Inter', en: 'Inter', need: ['Inter'] },
            { v: '"Microsoft YaHei"', zh: '微软雅黑', en: 'Microsoft YaHei', need: ['Microsoft YaHei'] },
        ];
        const REPLY_FONTS = [
            { v: '', zh: '跟随界面字体', en: 'Same as interface' },
            { v: `Georgia, "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif`, zh: '衬线 · 宋体', en: 'Serif', need: ['Songti SC', 'STSong', 'Noto Serif SC', 'Source Han Serif SC'] },
            { v: `"Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", Georgia, serif`, zh: '思源宋体', en: 'Source Han Serif', need: ['Source Han Serif SC', 'Noto Serif CJK SC', 'Noto Serif SC'] },
            { v: `"LXGW WenKai", "LXGW WenKai Screen", ${SANS_TAIL}`, zh: '霞鹜文楷', en: 'LXGW WenKai', need: ['LXGW WenKai', 'LXGW WenKai Screen'] },
            { v: `"Kaiti SC", STKaiti, KaiTi, ${SANS_TAIL}`, zh: '楷体', en: 'Kaiti', need: ['Kaiti SC', 'STKaiti', 'KaiTi'] },
            { v: `"Yuanti SC", ${SANS_TAIL}`, zh: '圆体', en: 'Yuanti', need: ['Yuanti SC'] },
            { v: `"Source Han Sans SC", "Noto Sans CJK SC", ${SANS_TAIL}`, zh: '思源黑体', en: 'Source Han Sans', need: ['Source Han Sans SC', 'Noto Sans CJK SC', 'Noto Sans SC'] },
        ];
        // monospace faces for 代码字体; dsh stores the value with each name quoted
        const MONO_FONTS = [{ v: '', zh: '默认', en: 'Default' },
            ...['Menlo', 'Monaco', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', 'IBM Plex Mono', 'Maple Mono', 'Sarasa Mono SC', 'Courier New']
                .map((n) => ({ v: `"${n}"`, zh: n, en: n, need: [n] }))];
        // Is a font face installed? Text set in it must measure differently from every generic family
        // (document.fonts.check() answers true for any local name, so it can't tell).
        const fontCache = new Map();
        function hasFont(name) {
            if (fontCache.has(name))
                return fontCache.get(name);
            let ok = true;
            try {
                const c = document.createElement('canvas').getContext('2d');
                const t = 'mmmmmiiiiWWW@#你好世界汉字测试';
                const w = (f) => { c.font = `40px ${f}`; return c.measureText(t).width; };
                const q = `"${name.replace(/"/g, '')}"`;
                ok = ['monospace', 'serif', 'sans-serif'].some((g) => w(`${q},${g}`) !== w(g));
            }
            catch { }
            fontCache.set(name, ok);
            return ok;
        }
        // the face names in a CSS font-family list
        const faceNames = (list) => String(list || '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter((x) => x && !/^(serif|sans-serif|monospace|system-ui|ui-[a-z-]+|-apple-system|BlinkMacSystemFont)$/i.test(x));
        // options for a font menu: drop the uninstalled ones, but keep (and mark) the current value
        function fontOptions(list, value, S) {
            const opts = list.filter((o) => !o.need || o.need.some(hasFont));
            if (!opts.some((o) => o.v === value)) {
                const known = list.find((o) => o.v === value);
                const name = known ? S(known.zh, known.en) : value;
                opts.push({ v: value, label: faceNames(value).some(hasFont) ? name : S(`${name}（未安装）`, `${name} (not installed)`) });
            }
            return opts.map((o) => ({ ...o, font: o.v || undefined }));
        }
        // ------------------------------------------------------------------ applying own prefs
        // the conversation: every message and the input box, minus code (that keeps the code font)
        const CHAT = ':is([data-chat-flow-kind],[data-composer-seat])';
        const NOT_MONO = ':not(code,pre,kbd,samp,svg,[class*="_terminal"],[class*="_mono"],:is(code,pre,kbd,samp,[class*="_terminal"],[class*="_mono"]) *)';
        const MD = '[data-chat-flow-kind="assistant-step"]:not([data-chat-group-part="reasoning"]) [class*="_markdown"]';
        let prefTag = null;
        const prefSheet = {
            css(text) {
                if (!text) {
                    this.remove();
                    return;
                }
                if (!prefTag || !document.head.contains(prefTag)) {
                    prefTag = document.createElement('style');
                    prefTag.dataset.plugin = 'dsh-whale-theme/fonts';
                    document.head.appendChild(prefTag);
                }
                prefTag.textContent = text;
            },
            remove() { if (prefTag) {
                prefTag.remove();
                prefTag = null;
            } },
        };
        function applyPrefs() {
            const p = prefs;
            const css = [];
            // after the chat rule and more specific, so replies take 回复字体 over 界面字体
            if (p.chatFont)
                css.push(`${CHAT},${CHAT} ${NOT_MONO}{font-family:${p.chatFont},${SANS_TAIL}!important}`);
            if (p.replyFont)
                css.push(`${MD},${MD} ${NOT_MONO}{font-family:${p.replyFont}!important}`);
            prefSheet.css(css.join('\n'));
        }
        // rows and dropdowns shared by all our settings rows (dsh-claude-shared/kit.js)
        const ui = kit.settingsUI();
        const { Row, Select, S } = ui;
        const sheet = { ensure: ui.sheet.ensure, remove: ui.sheet.remove };
        function useCodeFont(ctx) {
            const read = () => { try {
                return (ctx.theme.getTheme().fontFamilies || {}).code || '';
            }
            catch {
                return '';
            } };
            const [v, setV] = useState(read);
            useEffect(() => {
                const id = setInterval(() => setV(read), 500);
                let off;
                try {
                    off = ctx.on('theme/change', () => setV(read()));
                }
                catch { }
                return () => { clearInterval(id); try {
                    typeof off === 'function' && off();
                }
                catch { } };
            }, []);
            return [v, () => setV(read())];
        }
        function FontRows({ ctx }) {
            const p = useSyncExternalStore(store.subscribe, store.get);
            const [code, refresh] = useCodeFont(ctx);
            useEffect(() => { sheet.ensure(); }, []);
            const setCode = (v) => { try {
                ctx.theme.setFontFamily('code', v);
            }
            catch (e) {
                console.error('[dsh-chat-fonts]', e);
            } refresh(); };
            return h(React.Fragment, null, h(Row, { label: S('界面字体', 'Interface font'), desc: S('只作用于对话和输入框，侧边栏等其他界面不变', 'Only the conversation and the input box; the sidebar and the rest of the app stay the same') }, h(Select, { label: S('界面字体', 'Interface font'), value: p.chatFont, options: fontOptions(UI_FONTS, p.chatFont, S), onChange: (v) => store.set({ chatFont: v }) })), h(Row, { label: S('回复字体', 'Response font'), desc: S('只影响模型回复的正文', 'Only the body of model replies') }, h(Select, { label: S('回复字体', 'Response font'), value: p.replyFont, options: fontOptions(REPLY_FONTS, p.replyFont, S), onChange: (v) => store.set({ replyFont: v }) })), h(Row, { label: S('代码字体', 'Code font'), desc: S('代码块、行内代码与工具输出', 'Code blocks, inline code and tool output') }, h(Select, { label: S('代码字体', 'Code font'), value: code, options: fontOptions(MONO_FONTS, code, S), onChange: setCode })));
        }
        return {
            inject: ['slots', 'theme'],
            apply(ctx) {
                ctx.effect(() => { applyPrefs(); return () => prefSheet.remove(); }, 'chat-fonts: own prefs');
                ctx.effect(() => { sheet.ensure(); return sheet.remove; }, 'chat-fonts: styles');
                function Rows() { return h(FontRows, { ctx }); }
                // the plugin page renders these directly: a child slot may only be declared by one owner
                kit.themeFontRows = Rows;
                ctx.effect(() => () => { if (kit.themeFontRows === Rows)
                    delete kit.themeFontRows; }, 'chat-fonts: shared rows');
                // on the theme's own 主题 page, after the theme options (order 10)
                ctx.slots.inject('settings.whale-theme.item', () => ctx.slots.register({
                    name: 'settings.whale-theme.item', id: 'claude-fonts', order: 20,
                }, Rows));
            },
        };
    },
});

window.__ModuleLoader__.load({
  id: BUNDLE,
  factory(require) {
    const kit = makeKit(require, BUNDLE)
    const store = featureStore()
    const mods = []
    for (const p of parts) {
      try {
        store.declare(BUNDLE, p.id, p.feature)
        mods.push({ id: p.id, feature: p.feature, ...p.factory(require, kit) })
      } catch (e) { console.error(`[${BUNDLE}] ${p.id} failed to load`, e) }
    }
    return {
      inject: [...new Set(mods.flatMap((m) => m.inject || []))],
      apply(ctx) {
        // one part failing must not take the others down
        for (const m of mods) {
          try {
            if (m.feature) gateFeature(ctx, store, m)
            else m.apply(ctx)
          } catch (e) { console.error(`[${BUNDLE}] ${m.id}`, e) }
        }
      },
    }
  },
})
})()
