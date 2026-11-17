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
const THEME_PREFS_KEY = 'dsh-claude-theme.settings'
const THEME_PREFS_DEFAULTS = { bg: 'live', whale: true, grid: true, idle: true, glass: 'standard' }

/** One store per page: read by the background engines and this page's rows. */
/** one store per page; created on first read and then kept in themePrefsStore */
let themePrefsStore: any = null
function themePrefs(): any {
  if (themePrefsStore) return themePrefsStore
  let prefs = { ...THEME_PREFS_DEFAULTS }
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(THEME_PREFS_KEY) || '{}') } } catch {}
  const subs = new Set<() => void>()
  const reflect = () => {
    const d = document.documentElement.dataset
    d.dctBg = prefs.bg
    d.dctGlass = prefs.glass
    if (prefs.whale) delete d.dctNoWhale; else d.dctNoWhale = ''
    if (prefs.grid) delete d.dctNoGrid; else d.dctNoGrid = ''
  }
  reflect()
  themePrefsStore = {
    get: () => prefs,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
    set(patch) {
      prefs = { ...prefs, ...patch }
      try { localStorage.setItem(THEME_PREFS_KEY, JSON.stringify(prefs)) } catch {}
      reflect()
      for (const fn of subs) fn()
    },
  }
  return themePrefsStore
}

part({
  id: 'dsh-theme-settings',
  factory(require, kit) {
    const { React, h } = kit
    const { useSyncExternalStore, useEffect } = React

    const sheet = kit.sheet('theme-settings', CSS_THEME_SETTINGS)
    const ui = kit.settingsUI()
    const { Row, Select, Switch, S } = ui
    const features = featureStore()

    const BG = [
      { v: 'live', zh: '动态', en: 'Animated' },
      { v: 'still', zh: '静止', en: 'Still' },
      { v: 'off', zh: '关闭', en: 'Off' },
    ]
    const GLASS = [
      { v: 'clear', zh: '通透', en: 'Clear' },
      { v: 'standard', zh: '标准', en: 'Standard' },
      { v: 'frosted', zh: '磨砂', en: 'Frosted' },
    ]

    function ThemeSection({ renderSlot, fonts }) {
      const store = themePrefs()
      const p = useSyncExternalStore<any>(store.subscribe, store.get)
      useSyncExternalStore(features.subscribe, features.revision)
      useEffect(() => { ui.sheet.ensure() }, [])
      const on = p.bg !== 'off'
      return h('div', { className: 'dct-page' },
        h('div', { className: 'dct-head' }, S('功能开关', 'Features')),
        features.list().map((f) => h(Row, { key: f.id, label: S(f.zh, f.en), desc: S(f.desc, f.descEn) },
          h(Switch, { label: S(f.zh, f.en), checked: features.enabled(f.id), onChange: (v) => features.set(f.id, v) }))),
        h('div', { className: 'dct-head' }, S('背景', 'Background')),
        h(Row, { label: S('动态背景', 'Background'), desc: S('静止只画一帧，关闭只留底色', 'Still draws a single frame; Off leaves the plain backdrop') },
          h(Select, { label: S('动态背景', 'Background'), value: p.bg, options: BG, onChange: (v) => store.set({ bg: v }) })),
        on ? h(Row, { label: S('鲸鱼', 'Whale'), desc: S('内容区中央的粒子鲸鱼', 'The particle whale in the middle of the content area') },
          h(Switch, { label: S('鲸鱼', 'Whale'), checked: p.whale, onChange: (v) => store.set({ whale: v }) })) : null,
        on ? h(Row, { label: S('星座网格', 'Constellation grid'), desc: S('随指针推开的点阵', 'The dot grid the pointer pushes around') },
          h(Switch, { label: S('星座网格', 'Constellation grid'), checked: p.grid, onChange: (v) => store.set({ grid: v }) })) : null,
        p.bg === 'live' ? h(Row, { label: S('空闲暂停', 'Pause when idle'), desc: S('20 秒无操作或窗口失焦时停下动画，省电', 'Stop the animation after 20 s without input or while the window is unfocused') },
          h(Switch, { label: S('空闲暂停', 'Pause when idle'), checked: p.idle, onChange: (v) => store.set({ idle: v }) })) : null,
        h(Row, { label: S('毛玻璃', 'Glass'), desc: S('输入框、气泡、菜单等玻璃表面的模糊与遮盖程度', 'How much blur and tint the input box, bubbles, menus and other glass surfaces get') },
          h(Select, { label: S('毛玻璃', 'Glass'), value: p.glass, options: GLASS, onChange: (v) => store.set({ glass: v }) })),
        h('div', { className: 'dct-head' }, S('字体', 'Fonts')),
        fonts ? h(fonts) : renderSlot ? renderSlot('settings.whale-theme.item', {}) : null)
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        themePrefs()
        sheet.ensure()
        ctx.effect(() => () => sheet.remove(), 'theme-settings: styles')
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'whale-theme',
          order: 5,
          label: () => S('主题', 'Theme'),
          children: { 'settings.whale-theme.item': { kind: 'list', scope: 'root' } },
        }, ThemeSection))
        // the same page on the bundle's own plugin page; the settings tab stays
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config', key: 'dsh-whale-theme',
        }, () => h(ThemeSection, { fonts: kit.themeFontRows })))
      },
    }
  },
})
