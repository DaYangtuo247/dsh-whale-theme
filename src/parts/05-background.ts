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
    const IDLE_MS = 20000

    const sheet = kit.sheet('background', CSS_BACKGROUND)

    // deepseek.com/harness hero parameters (fluid renderer). glowIntensity 0: the original tints the area
    // around the cursor, which on glass reads as a light blob following the pointer.
    const DARK_AURORA = {
      mouseRadius: 0.09, mouseStrength: 1.8, mouseSmoothing: 0.1, mouseVelocity: 0.2, decay: 0.925,
      distortBoost: 2.2, swirlBoost: 0.8, glowIntensity: 0, glowColors: ['#fff7d1', '#538dca', '#2d448b'],
      speed: 28, scale: 1.77, offsetX: -124, offsetY: -48,
      colors: ['#000000', '#1A3870', '#204a7e', '#eed8aa', '#000000'],
      lightX: 0.89, lightY: 0.46, lightCore: 0.14, lightHalo: 0.2, vignette: 0.38, lightFollow: 0.63,
      bloomThreshold: 0.61, bloomRange: 0.18, bloomStrength: 0.4, grain: 0.005,
    }
    // the same fluid, shape and motion on a light palette: black → paper, deep navy currents → soft blues,
    // the cream highlight stays warm; no light spot, vignette or bloom on white
    const LIGHT_AURORA = Object.assign({}, DARK_AURORA, {
      colors: ['#f7f8fb', '#c4d4ee', '#a7c0e6', '#f2e2c2', '#f7f8fb'],
      grain: 0.004, lightCore: 0, lightHalo: 0, vignette: 0, lightFollow: 0, bloomStrength: 0,
    })
    const DARK_GRID = { lineColor: 'rgba(255, 255, 255,', dotColor: 'rgba(255, 255, 255,', lineOpacity: 0.08, dotOpacity: 0.16, round: false }
    const LIGHT_GRID = { lineColor: 'rgba(60, 100, 160,', dotColor: 'rgba(60, 100, 160,', lineOpacity: 0.1, dotOpacity: 0.2, round: true }

    // Light-theme whale ink: in dark each particle brightens the page by its intensity (screen); here it
    // darkens it by the same intensity (multiply), weighted per channel toward navy. INK is the darkening
    // per unit of dark brightness (the canvas carries half of it, see 03-bg-whale.js).
    const INK = [1.9, 1.55, 0.7]
    const LUM = [0.3, 0.59, 0.11]
    const inkRow = (k) => LUM.map((l) => (-k * l).toFixed(4)).join(' ') + ' 0 1'
    const INK_MATRIX = `${inkRow(INK[0])}  ${inkRow(INK[1])}  ${inkRow(INK[2])}  0 0 0 1 0`

    // Where the whale sits: a fixed spot in the content area (its middle, a little above centre where the
    // new-session title rests), never following the content. BOX is the whale's drawn centre relative to the
    // canvas centre as a share of its height (the whale scales with the height, so this holds).
    const RISE = 0.41
    const BOX = { x: -0.0121, y: -0.0185 }

    function detectDark(darkQuery) {
      const b = document.body, d = document.documentElement
      if (b.hasAttribute('data-ds-dark-theme') || d.hasAttribute('data-ds-dark-theme')) return true
      if (b.hasAttribute('data-ds-light-theme') || d.hasAttribute('data-ds-light-theme')) return false
      // dsh marks dark with data-ds-dark-theme and light with nothing; data-ds-theme-source says it has applied a theme,
      // so without the dark mark it is light (the system query below only covers the moment before dsh starts)
      if (d.hasAttribute('data-ds-theme-source')) return false
      if (d.dataset.theme === 'dark') return true
      if (d.dataset.theme === 'light') return false
      return !!(darkQuery && darkQuery.matches)
    }

    function start() {
      sheet.ensure()
      const mq = (q) => window.matchMedia && window.matchMedia(q)
      const darkQuery = mq('(prefers-color-scheme: dark)')
      const resumers = []
      const bg: any = {
        state: { dark: detectDark(darkQuery) },
        reducedMotion: !!(mq('(prefers-reduced-motion: reduce)') || {}).matches,
        coarse: !!(mq('(hover: none), (pointer: coarse)') || {}).matches,
        // dsh's own background is also mouse-free on Windows (the flowmap brush stutters there)
        isWindows: ((navigator as any).userAgentData?.platform === 'Windows') || navigator.userAgent.includes('Windows'),
        paused: false,
        // bumped when something the last frame shows changed (theme, settings): a halted loop draws once more
        epoch: 0,
        // 主题 settings (07-settings.js): a loop stops at its next frame while halted
        still: () => themePrefs().get().bg !== 'live',
        halted(name) {
          const p = themePrefs().get()
          if (bg.paused || p.bg !== 'live') return true
          return (name === 'whale' && !p.whale) || (name === 'grid' && !p.grid)
        },
        shift: { x: 0, y: 0 }, // px the whale layer is moved by
        aurora: () => (bg.state.dark ? DARK_AURORA : LIGHT_AURORA),
        constellation: () => (bg.state.dark ? DARK_GRID : LIGHT_GRID),
        onResume: (fn) => { resumers.push(fn) },
      }

      // DOM
      const el = (tag, props) => Object.assign(document.createElement(tag), props)
      const container = el('div', { id: 'dsh-ds-bg' })
      bg.auroraCanvas = el('canvas', { id: 'dsh-ds-aurora' })
      bg.constellationCanvas = el('canvas', { id: 'dsh-ds-constellation' })
      const whaleLayer = el('div', { className: 'dsh-ds-whale' })
      whaleLayer.setAttribute('aria-hidden', 'true')
      bg.whaleCanvas = el('canvas', { className: 'dsh-ds-whale-canvas' })
      whaleLayer.appendChild(bg.whaleCanvas)
      const ink = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      ink.setAttribute('width', '0'); ink.setAttribute('height', '0'); ink.setAttribute('aria-hidden', 'true')
      ink.style.cssText = 'position:absolute;width:0;height:0'
      ink.innerHTML = `<filter id="dsh-ds-ink" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${INK_MATRIX}"/></filter>`
      container.append(bg.auroraCanvas, whaleLayer, bg.constellationCanvas, ink)

      // theme
      const applyTheme = () => {
        const d = detectDark(darkQuery)
        if (d === bg.state.dark && container.isConnected) return
        bg.state.dark = d
        container.classList.toggle('dsh-ds-dark', d)
        redraw()
      }
      const redraw = () => { bg.epoch++; for (const fn of resumers) fn() }
      themePrefs().subscribe(redraw)
      // a resized canvas is blank until drawn: halted loops (静止, idle) draw once more after the resize settles
      let resizeT = 0
      window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(redraw, 200) }, { passive: true })
      container.classList.toggle('dsh-ds-dark', bg.state.dark)
      const moTheme = new MutationObserver(applyTheme)
      const THEME_ATTRS = { attributes: true, attributeFilter: ['data-ds-dark-theme', 'data-ds-light-theme', 'data-ds-theme-source', 'data-theme', 'class'] }
      moTheme.observe(document.documentElement, THEME_ATTRS)
      moTheme.observe(document.body, THEME_ATTRS)
      if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', applyTheme)

      document.body.appendChild(container)
      startAurora(bg)
      startWhale(bg)
      if (!bg.coarse || bg.reducedMotion) startConstellation(bg)
      startPlacement(bg)
      startIdle(bg, resumers)
    }

    // The whale layer follows the content area: re-measured only when that area is resized or replaced
    // (page changes), so a streaming reply, which mutates deep inside the page, never forces layout reads.
    function startPlacement(bg) {
      function place() {
        const main = document.querySelector('[class*="_mainPanel"]')
        if (!main) return
        const r = main.getBoundingClientRect()
        const W = window.innerWidth, H = window.innerHeight
        const x = Math.round(r.left + r.width / 2 - (W / 2 + BOX.x * H))
        const y = Math.round(r.top + r.height * RISE - (H / 2 + BOX.y * H))
        if (x === bg.shift.x && y === bg.shift.y) return
        bg.shift.x = x; bg.shift.y = y
        const root = document.documentElement.style
        root.setProperty('--dsb-whale-x', x + 'px')
        root.setProperty('--dsb-whale-y', y + 'px')
      }
      let t = 0
      const later = () => { if (!t) t = setTimeout(() => { t = 0; place() }, 120) }
      const ro = new ResizeObserver(later)
      let mainEl = null
      const observeMain = () => {
        const m = document.querySelector('[class*="_mainPanel"]')
        if (m === mainEl) return false
        if (mainEl) ro.unobserve(mainEl)
        mainEl = m
        if (m) ro.observe(m)
        return true
      }
      new MutationObserver(() => { if (observeMain()) later() })
        .observe(document.querySelector('[data-slot="main"]') || document.body, { childList: true })
      window.addEventListener('resize', later)
      observeMain()
      place()
    }

    // Idle pause: after IDLE_MS without pointer / key / wheel / touch input, or while the window is
    // unfocused, the WebGL loops stop at their next frame (bg.paused) and are restarted on input or focus.
    function startIdle(bg, resumers) {
      const html = document.documentElement
      function pause() {
        if (bg.paused) return
        bg.paused = true
        html.dataset.dshBgPaused = ''
      }
      function resume() {
        if (!bg.paused) return
        bg.paused = false
        delete html.dataset.dshBgPaused
        for (const fn of resumers) fn()
      }
      let timer = 0
      const arm = () => { clearTimeout(timer); timer = setTimeout(pause, IDLE_MS) }
      const idleOn = () => themePrefs().get().idle
      const onInput = () => { if (!document.hasFocus()) return; resume(); if (idleOn()) arm() }
      for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(e, onInput, { passive: true, capture: true })
      window.addEventListener('blur', () => { clearTimeout(timer); if (idleOn()) pause() })
      window.addEventListener('focus', () => { resume(); if (idleOn()) arm() })
      // 空闲暂停 turned off: run again now; turned on: start counting
      themePrefs().subscribe(() => { clearTimeout(timer); if (idleOn()) arm(); else resume() })
      // a page that opens unfocused still gets the whale's 3 s assembly before it pauses
      if (document.hasFocus()) arm(); else timer = setTimeout(pause, 3000)
    }

    return {
      inject: [],
      apply() {
        // once per page: the engines own their canvases and listeners for the page's lifetime
        if ((window as any).__dshBackground) return
        (window as any).__dshBackground = true
        if (document.body) start()
        else document.addEventListener('DOMContentLoaded', start, { once: true })
      },
    }
  },
})
