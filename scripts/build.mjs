// Builds <bundle>/client.js from the bundle's sources, plus ../dsh-claude-shared/kit.js.
//
// Two source layouts are supported:
//   legacy:    <bundle>/src/*.js                      — each file is one part (older bundles)
//   layered:   <bundle>/src/lib/*, <bundle>/src/styles/*.scss and <bundle>/src/parts/* — lib and
//              styles are prepended to the bundle scope (plain declarations, no part()), parts files
//              each call part({…}); styles hold the CSS a part injects, kept out of its logic
//
// A layered bundle that ships a tsconfig.json is compiled with tsc into .build/ first; the emitted JS
// is what gets concatenated, so client.js stays plain ES2022 and the loader needs nothing else.
//
// CSS lives in <bundle>/src/styles/*.scss. Those are compiled with Sass into .build/styles/*.js, each
// one a single `const CSS_X = '…'` declaration that the styles prepend to the bundle scope. A file may
// carry `/* @js fnName */` to also emit `fnName(s)` — a wrapper that validates and fills every
// __DCG_KEY__ token from s.KEY, so a stylesheet and the DOM queries a part runs cannot drift apart.
// Usage (from a bundle folder): node build.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const jsFiles = (dir, label) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.js'))
        .sort()
        .map((f) => ({ path: join(dir, f), label: `${label}/${f}` }))
    : []

/** `05-typography.scss` → `CSS_TYPOGRAPHY`. */
const cssConstName = (file) =>
  `CSS_${file
    .replace(/\.scss$/, '')
    .replace(/^\d+[-_]/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toUpperCase()}`

/**
 * Compile src/styles/*.scss into .build/styles/*.js. Partials (`_*.scss`) are imports only and are
 * skipped. Sass is resolved from the bundle itself, so every bundle declares its own devDependency.
 */
function compileStyles(bundleDir, outDir) {
  const stylesDir = join(bundleDir, 'src', 'styles')
  const names = existsSync(stylesDir)
    ? readdirSync(stylesDir)
        .filter((f) => f.endsWith('.scss') && !f.startsWith('_'))
        .sort()
    : []
  if (!names.length) return []

  const require = createRequire(join(bundleDir, 'package.json'))
  let sass
  try {
    sass = require('sass')
  } catch {
    throw new Error('Sass is needed to build src/styles/*.scss — install it with `pnpm add -D sass`')
  }

  const outStyles = join(outDir, 'styles')
  mkdirSync(outStyles, { recursive: true })
  const seen = new Set()
  return names.map((name) => {
    const source = readFileSync(join(stylesDir, name), 'utf8')
    const { css } = sass.compile(join(stylesDir, name), {
      style: 'expanded',
      charset: false,
      loadPaths: [stylesDir],
      sourceMap: false,
    })
    const constName = cssConstName(name)
    if (seen.has(constName)) throw new Error(`duplicate stylesheet constant ${constName} in src/styles/${name}`)
    seen.add(constName)
    // the @js directive is build metadata, not CSS
    const text = css.replace(/\/\*\s*@js\s+[^*]*\*\//g, '').trimStart()
    let js = `/* compiled from src/styles/${name} by build.mjs — edit the .scss, not this file */\nconst ${constName} = ${JSON.stringify(text)}\n`
    const wrapper = source.match(/\/\*\s*@js\s+([A-Za-z_$][\w$]*)\s*\*\//)
    if (wrapper) {
      const keys = [...new Set([...text.matchAll(/__DCG_([A-Z0-9_]+)__/g)].map((m) => m[1]))]
      js += `const ${wrapper[1]} = (s) => {
  if (!s) throw new Error(${JSON.stringify(`${constName}: no selector map`)})
  for (const k of ${JSON.stringify(keys)}) if (s[k] == null) throw new Error(${JSON.stringify(`${constName}: missing selector `)} + k)
  return ${constName}.replace(/__DCG_([A-Z0-9_]+)__/g, (_, k) => s[k])
}
`
    }
    const path = join(outStyles, name.replace(/\.scss$/, '.js'))
    writeFileSync(path, js)
    return { path, label: `src/styles/${name}` }
  })
}

/** Ordered source files for one bundle: shared scope, compiled styles, then the parts. */
function sourceFiles(bundleDir) {
  const srcDir = join(bundleDir, 'src')
  const partsDir = join(srcDir, 'parts')
  if (!existsSync(partsDir)) return jsFiles(srcDir, 'src')

  const outDir = join(bundleDir, '.build')
  const tsconfig = join(bundleDir, 'tsconfig.json')
  if (existsSync(tsconfig)) {
    rmSync(outDir, { recursive: true, force: true })
    try {
      execFileSync(process.env.TSC || 'tsc', ['-p', bundleDir], { stdio: 'inherit' })
    } catch {
      throw new Error('tsc failed — fix the errors above, or install TypeScript with `npm i -D typescript`')
    }
    const styles = compileStyles(bundleDir, outDir)
    const styleFiles = styles.length ? styles : jsFiles(join(outDir, 'styles'), 'src/styles')
    return [...jsFiles(join(outDir, 'lib'), 'src/lib'), ...styleFiles, ...jsFiles(join(outDir, 'parts'), 'src/parts')]
  }
  const styles = compileStyles(bundleDir, outDir)
  const styleFiles = styles.length ? styles : jsFiles(join(srcDir, 'styles'), 'src/styles')
  return [...jsFiles(join(srcDir, 'lib'), 'src/lib'), ...styleFiles, ...jsFiles(partsDir, 'src/parts')]
}

export function build(bundleDir) {
  const pkg = JSON.parse(readFileSync(join(bundleDir, 'package.json'), 'utf8'))
  const kit = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'kit.js'), 'utf8')
  const files = sourceFiles(bundleDir)
  const parts = files
    .map((f) => `// ===== ${f.label}\n${readFileSync(f.path, 'utf8').trim()}\n`)
    .join('\n')
  const out = `/*! ${pkg.name} v${pkg.version} — built by build.mjs from ${files.map((f) => f.label).join(', ')}. Edit src/, not this file. */
;(() => {
const BUNDLE = ${JSON.stringify(pkg.name)}
const parts = []
const part = (m) => { parts.push(m) }
${kit.trim()}

${parts}
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
      } catch (e) { console.error(\`[\${BUNDLE}] \${p.id} failed to load\`, e) }
    }
    return {
      inject: [...new Set(mods.flatMap((m) => m.inject || []))],
      apply(ctx) {
        // one part failing must not take the others down
        for (const m of mods) {
          try {
            if (m.feature) gateFeature(ctx, store, m)
            else m.apply(ctx)
          } catch (e) { console.error(\`[\${BUNDLE}] \${m.id}\`, e) }
        }
      },
    }
  },
})
})()
`
  writeFileSync(join(bundleDir, 'client.js'), out)
  return files.map((f) => f.label)
}
