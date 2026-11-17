// Renders every CSS sheet a built client.js declares, without a browser:
//
//   node ../dsh-claude-shared/render.mjs client.js > out.css
//
// Shared by every dsh-claude bundle; the copy in dsh-claude-composer/.verify/ re-exports this one.
//
// The bundle runs against a stub `part` (which just records each definition) plus a stub react and
// DOM, and then every factory is called with a stub kit whose sheet(name, css) records the text the
// moment it is declared — no mount needed. apply() runs with a permissive ctx; a part that touches
// real DOM throws halfway, which is fine because its styles are already recorded.
// Refactor proof: diff the output for the old and the new build; it must be byte-identical.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const file = process.argv[2]
const defs = []
const css = []

const noop = () => {}
class Component {
  constructor(props) {
    this.props = props
  }
  setState() {}
  forceUpdate() {}
  render() {
    return null
  }
}
const react = {
  Component,
  PureComponent: Component,
  createRef: () => ({ current: null }),
  memo: (f) => f,
  forwardRef: (f) => f,
  useDebugValue: noop,
  useId: () => ':r0:',
  useTransition: () => [false, noop],
  useDeferredValue: (v) => v,
  createElement: () => ({}),
  Fragment: {},
  useState: (v) => [typeof v === 'function' ? v() : v, noop],
  useReducer: (_r, init) => [init, noop],
  useRef: (v) => ({ current: v ?? null }),
  useEffect: noop,
  useLayoutEffect: noop,
  useMemo: (f) => f(),
  useCallback: (f) => f,
  useSyncExternalStore: (_sub, get) => {
    try {
      return get()
    } catch {
      return undefined
    }
  },
}

const el = () => ({
  dataset: {},
  style: {},
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  remove: noop,
  appendChild: noop,
  setAttribute: noop,
  addEventListener: noop,
  getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  getClientRects: () => [],
  contains: () => false,
  closest: () => null,
  matches: () => false,
  querySelector: () => null,
  querySelectorAll: () => [],
})
const styleTags = []
const doc = {
  documentElement: { lang: 'zh-CN', dataset: {}, style: {}, ...el() },
  head: {
    appendChild: (node) => {
      if (node && typeof node.textContent === 'string' && node.textContent !== '') styleTags.push(node.textContent)
    },
    contains: () => false,
  },
  body: { appendChild: noop, contains: () => false, ...el() },
  createElement: (tag) => ({ ...el(), tagName: String(tag).toUpperCase(), textContent: '' }),
  createRange: () => ({ setStart: noop, setEnd: noop, getClientRects: () => [] }),
  createTreeWalker: () => ({ nextNode: () => null }),
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: noop,
  removeEventListener: noop,
  getSelection: () => null,
}

/** function-shaped anything; .t/.text/.string calls return their first argument as text. */
const stub = (name = 'stub') =>
  new Proxy(noop, {
    get(_t, prop) {
      if (prop === 'then') return undefined
      if (prop === Symbol.toPrimitive) return () => name
      if (prop === Symbol.iterator) return function* () {}
      if (prop === 'length') return 0
      return stub(`${name}.${String(prop)}`)
    },
    apply: (_t, _this, args) => (name.endsWith('.t') || name.endsWith('.text') || name.endsWith('.string') ? (args[0] ?? '') : stub(`${name}()`)),
  })

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { language: 'zh-CN', platform: 'MacIntel', userAgent: '' },
  location: { href: 'http://localhost/' },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  Highlight: class {},
  CSS: { highlights: new Map() },
  document: doc,
  window: {
    __ModuleLoader__: { load: noop },
    document: doc,
    localStorage: { getItem: () => null, setItem: noop },
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    innerHeight: 900,
    innerWidth: 1400,
    getSelection: () => null,
    requestAnimationFrame: () => 0,
  },
  part: (def) => defs.push(def),
}
sandbox.window.__parts = defs
sandbox.globalThis = sandbox
vm.createContext(sandbox)
new vm.Script(patch(readFileSync(file, 'utf8')), { filename: file }).runInContext(sandbox)

/** The bundle keeps its parts in a closure; expose them without touching the shipped file. */
function patch(src) {
  const out = src.replace('const part = (m) => { parts.push(m) }', 'const part = (m) => { parts.push(m); window.__parts.push(m) }')
  if (out === src) throw new Error('cannot find the part() declaration in ' + file)
  return out
}

const require = (id) => (id === 'react' ? react : id === 'react-dom' ? { createPortal: (x) => x } : {})

for (const def of defs) {
  const kit = {
    React: react,
    h: react.createElement,
    portal: (x) => x,
    sheet(name, text) {
      css.push(`/* ===== ${def.id} · ${name} */\n${text}`)
      return { ensure: noop, remove: noop }
    },
    settingsUI: () => ({ sheet: (n, c) => ({ ensure: noop, remove: noop, css: c }), Row: noop, Select: noop, Switch: noop, L: (o) => o.zh, S: (z) => z }),
    dom: { subscribe: () => noop, touches: () => false, mounts: () => false, poke: noop },
  }
  let mod
  try {
    mod = def.factory(require, kit)
  } catch (e) {
    console.error(`[render] ${def.id} factory failed: ${e.message}`)
    continue
  }
  const scope = new Proxy(
    {
      locale: stub('locale'),
      slots: { inject: (_k, cb) => (typeof cb === 'function' && (safe(cb, scope), noop), noop), register: () => noop },
      remote: stub('remote'),
      inject: (_n, cb) => safe(cb, scope),
      effect: (fn) => safe(fn, scope),
      extend: (o) => Object.assign(scope, o),
      plugin: (o) => {
        try {
          o.apply(scope)
        } catch (e) {
          console.error(`[render] ${def.id} apply failed: ${e.message}`)
        }
        return { dispose: noop }
      },
    },
    {
      get: (t, p) => (p in t ? t[p] : stub(`ctx.${String(p)}`)),
    },
  )
  try {
    mod.apply(scope)
  } catch (e) {
    console.error(`[render] ${def.id} apply threw: ${e.message}`)
  }
}

function safe(fn, self) {
  if (typeof fn !== 'function') return
  try {
    fn(self)
  } catch {}
}

for (const text of styleTags) css.push(`/* ===== injected <style> */\n${text}`)
process.stdout.write(css.join('\n\n') + '\n')
