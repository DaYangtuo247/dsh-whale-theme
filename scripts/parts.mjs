// Lists the part ids a built client.js declares, in build order:
//
//   node ../dsh-claude-shared/parts.mjs client.js
//
// The bundle keeps its definitions in a closure, so the same trick as render.mjs is used: the
// `part()` declaration is patched to also record every definition, then the file runs in a vm with
// just enough of a browser to survive module top level. No mount, no apply.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const file = process.argv[2]
const defs = []
const noop = () => {}
const el = () => ({
  dataset: {},
  style: {},
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  appendChild: noop,
  setAttribute: noop,
  addEventListener: noop,
  remove: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
})
const doc = {
  documentElement: { lang: 'zh-CN', dataset: {}, style: {}, ...el() },
  head: { appendChild: noop, contains: () => false },
  body: { appendChild: noop, contains: () => false, ...el() },
  createElement: () => el(),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: noop,
}
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
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  document: doc,
  window: { __parts: defs, __ModuleLoader__: { load: noop }, document: doc, localStorage: { getItem: () => null, setItem: noop }, addEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }) },
  part: (def) => defs.push(def),
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)

const src = readFileSync(file, 'utf8')
const patched = src.replace('const part = (m) => { parts.push(m) }', 'const part = (m) => { parts.push(m); window.__parts.push(m) }')
if (patched === src) throw new Error('cannot find the part() declaration in ' + file)
new vm.Script(patched, { filename: file }).runInContext(sandbox)

process.stdout.write(JSON.stringify(defs.map((d) => ({ id: d.id, feature: d.feature ?? null })), null, 2) + '\n')
