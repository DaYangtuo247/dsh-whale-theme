/*!
 * verify-corner-shape — every full-round radius must opt out of dsh's superellipse.
 *
 * dsh-client-ui-theme ships styles/corner-shape.css:
 *
 *   @supports (corner-shape: superellipse(1.5)) {
 *     *, *::before, *::after { corner-shape: var(--dsw-corner-shape); }
 *   }
 *
 * so every element's corners curve along a superellipse. A superellipse deforms a circle into a
 * squircle and squares off capsule ends, which is why that stylesheet's own comment requires each
 * effectively uncapped radius (50%, 100%, or a pill radius far above the box) to pair
 * `corner-shape: round` with its `border-radius` in the owning rule. Forgetting the pair is invisible
 * in the source and obvious on screen: a 15px dashed circle turns into a rounded square, a 32px
 * glass button into a squircle, a 10px progress bar gets flat ends.
 *
 * This script reads the built client.js of every bundle and fails on any rule that declares such a
 * radius without the opt-out. Run: `node verify-corner-shape.mjs [bundleDir…]`, or from a bundle:
 * `node ../dsh-claude-shared/verify-corner-shape.mjs .`. `--self-test` checks the detector itself.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Radii that the superellipse must not touch: anything that is meant to be a circle or a capsule. */
const ROUND_RADIUS = /border-radius\s*:\s*(?:50%|100%|999px|9999px|1000px|[2-9]\d{2,}px)/i

/** The opt-out the rule must also declare. */
const OPT_OUT = /corner-shape\s*:\s*round/i

/**
 * A CSS rule: from the last `{` (or `}` / start of text) before the declaration to the next `}`.
 * Built CSS is written one rule per line, so this is exact for real sheets and merely conservative
 * (over-inclusive) for anything hand-formatted.
 */
function ruleAround(text, index) {
  let start = index
  while (start > 0 && text[start - 1] !== '{' && text[start - 1] !== '}') start--
  let end = text.indexOf('}', index)
  if (end === -1) end = text.length
  return { start, end, rule: text.slice(start, end).trim() }
}

/**
 * Every full-round radius in `text` that is not paired with `corner-shape: round`.
 * @param {string} text - CSS source.
 * @returns {Array<{index:number, rule:string, radius:string}>}
 */
export function findViolations(text) {
  const out = []
  const re = new RegExp(ROUND_RADIUS.source, 'gi')
  for (let m; (m = re.exec(text));) {
    const { start, rule } = ruleAround(text, m.index)
    if (OPT_OUT.test(rule)) continue
    // a :root/token definition is not a shape; skip custom-property assignments
    if (/^\s*--/.test(rule)) continue
    out.push({ index: start, rule, radius: m[0] })
  }
  return out
}

/** The CSS a bundle ships: the concatenated client.js (styles live in template literals). */
function cssOf(dir) {
  return readFileSync(join(dir, 'client.js'), 'utf8')
}

/** Every sibling bundle directory that has a built client.js. */
function bundles(scriptPath) {
  const root = dirname(dirname(scriptPath))
  return readdirSync(root)
    .filter((n) => n.startsWith('dsh-claude-') && n !== 'dsh-claude-shared')
    .map((n) => join(root, n))
    .filter((d) => statSync(d).isDirectory() && exists(join(d, 'client.js')))
}

function exists(p) {
  try { statSync(p); return true } catch { return false }
}

/** Fixtures for the detector: the shapes that must fail and the spellings that must pass. */
const SAMPLES = [
  { css: '.a{width:15px;height:15px;border-radius:50%}', ok: false, what: 'bare circle' },
  { css: '.a{width:32px;border-radius:50%;corner-shape:round}', ok: true, what: 'opted-out circle' },
  { css: '.a{border-radius:999px;corner-shape:round;background:red}', ok: true, what: 'opted-out pill' },
  { css: '.a{border-radius:999px\ !important;background:red}', ok: false, what: 'pill with !important' },
  { css: '.a{border-radius:50%\ !important;corner-shape:round\ !important}', ok: true, what: 'both !important' },
  { css: '.card{border-radius:12px}', ok: true, what: 'ordinary radius' },
  { css: '.card{border-radius:var(--dsw-radius-lg,16px)}', ok: true, what: 'token radius' },
  { css: '@media (hover:hover){.a:hover{border-radius:50%;background:red}}', ok: false, what: 'circle in @media' },
]

function selfTest() {
  let bad = 0
  for (const s of SAMPLES) {
    const found = findViolations(s.css.replace(/\\ /g, ' '))
    const pass = (found.length === 0) === s.ok
    if (!pass) bad++
    console.log(`${pass ? 'ok  ' : 'FAIL'}  ${s.what}  → ${found.length} violation(s), expected ${s.ok ? 0 : '≥1'}`)
  }
  console.log(bad === 0 ? '\nself-test: detector behaves as expected' : `\nself-test: ${bad} fixture(s) wrong`)
  return bad === 0
}

function main(argv) {
  const here = fileURLToPath(import.meta.url)
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1)
  const targets = argv.filter((a) => !a.startsWith('-'))
  const dirs = targets.length ? targets.map((t) => join(process.cwd(), t)) : bundles(here)
  if (!dirs.length) { console.log('no bundle directories found — pass them explicitly'); process.exit(1) }
  let total = 0
  for (const dir of dirs) {
    const name = basename(dir)
    let css
    try { css = cssOf(dir) } catch { console.log(`skip  ${name}: no client.js`); continue }
    const found = findViolations(css)
    if (!found.length) { console.log(`ok    ${name}`); continue }
    total += found.length
    console.log(`FAIL  ${name}: ${found.length} full-round radius without corner-shape:round`)
    for (const f of found.slice(0, 12)) console.log(`        ${f.radius}  in  ${f.rule.slice(0, 150)}`)
    if (found.length > 12) console.log(`        … ${found.length - 12} more`)
  }
  console.log(total === 0 ? '\nall bundles pair every full-round radius with corner-shape: round' : `\n${total} violation(s)`)
  process.exit(total === 0 ? 0 : 1)
}

main(process.argv.slice(2))
