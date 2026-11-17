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
    const { React, h } = kit
    const { useState, useEffect, useSyncExternalStore } = React

    // ------------------------------------------------------------------ own prefs
    const KEY = 'dsh-claude-appearance'
    const DEFAULTS = { chatFont: '', replyFont: '' }
    let prefs = { ...DEFAULTS }
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
      prefs = { chatFont: saved.chatFont || '', replyFont: saved.replyFont || '' }
    } catch {}
    const subs = new Set<() => void>()
    const store = {
      get: () => prefs,
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
      set(patch) {
        prefs = { ...prefs, ...patch }
        try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch {}
        applyPrefs()
        for (const fn of subs) fn()
      },
    }

    // ------------------------------------------------------------------ option lists
    const SANS_TAIL = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
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
    ]
    const REPLY_FONTS = [
      { v: '', zh: '跟随界面字体', en: 'Same as interface' },
      { v: `Georgia, "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif`, zh: '衬线 · 宋体', en: 'Serif', need: ['Songti SC', 'STSong', 'Noto Serif SC', 'Source Han Serif SC'] },
      { v: `"Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", Georgia, serif`, zh: '思源宋体', en: 'Source Han Serif', need: ['Source Han Serif SC', 'Noto Serif CJK SC', 'Noto Serif SC'] },
      { v: `"LXGW WenKai", "LXGW WenKai Screen", ${SANS_TAIL}`, zh: '霞鹜文楷', en: 'LXGW WenKai', need: ['LXGW WenKai', 'LXGW WenKai Screen'] },
      { v: `"Kaiti SC", STKaiti, KaiTi, ${SANS_TAIL}`, zh: '楷体', en: 'Kaiti', need: ['Kaiti SC', 'STKaiti', 'KaiTi'] },
      { v: `"Yuanti SC", ${SANS_TAIL}`, zh: '圆体', en: 'Yuanti', need: ['Yuanti SC'] },
      { v: `"Source Han Sans SC", "Noto Sans CJK SC", ${SANS_TAIL}`, zh: '思源黑体', en: 'Source Han Sans', need: ['Source Han Sans SC', 'Noto Sans CJK SC', 'Noto Sans SC'] },
    ]
    // monospace faces for 代码字体; dsh stores the value with each name quoted
    const MONO_FONTS = [{ v: '', zh: '默认', en: 'Default' },
      ...['Menlo', 'Monaco', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', 'IBM Plex Mono', 'Maple Mono', 'Sarasa Mono SC', 'Courier New']
        .map((n) => ({ v: `"${n}"`, zh: n, en: n, need: [n] }))]

    // Is a font face installed? Text set in it must measure differently from every generic family
    // (document.fonts.check() answers true for any local name, so it can't tell).
    const fontCache = new Map()
    function hasFont(name) {
      if (fontCache.has(name)) return fontCache.get(name)
      let ok = true
      try {
        const c = document.createElement('canvas').getContext('2d')
        const t = 'mmmmmiiiiWWW@#你好世界汉字测试'
        const w = (f) => { c.font = `40px ${f}`; return c.measureText(t).width }
        const q = `"${name.replace(/"/g, '')}"`
        ok = ['monospace', 'serif', 'sans-serif'].some((g) => w(`${q},${g}`) !== w(g))
      } catch {}
      fontCache.set(name, ok)
      return ok
    }
    // the face names in a CSS font-family list
    const faceNames = (list) => String(list || '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter((x) => x && !/^(serif|sans-serif|monospace|system-ui|ui-[a-z-]+|-apple-system|BlinkMacSystemFont)$/i.test(x))
    // options for a font menu: drop the uninstalled ones, but keep (and mark) the current value
    function fontOptions(list, value, S) {
      const opts = list.filter((o) => !o.need || o.need.some(hasFont))
      if (!opts.some((o) => o.v === value)) {
        const known = list.find((o) => o.v === value)
        const name = known ? S(known.zh, known.en) : value
        opts.push({ v: value, label: faceNames(value).some(hasFont) ? name : S(`${name}（未安装）`, `${name} (not installed)`) })
      }
      return opts.map((o) => ({ ...o, font: o.v || undefined }))
    }

    // ------------------------------------------------------------------ applying own prefs
    // the conversation: every message and the input box, minus code (that keeps the code font)
    const CHAT = ':is([data-chat-flow-kind],[data-composer-seat])'
    const NOT_MONO = ':not(code,pre,kbd,samp,svg,[class*="_terminal"],[class*="_mono"],:is(code,pre,kbd,samp,[class*="_terminal"],[class*="_mono"]) *)'
    const MD = '[data-chat-flow-kind="assistant-step"]:not([data-chat-group-part="reasoning"]) [class*="_markdown"]'
    let prefTag = null
    const prefSheet = {
      css(text) {
        if (!text) { this.remove(); return }
        if (!prefTag || !document.head.contains(prefTag)) {
          prefTag = document.createElement('style')
          prefTag.dataset.plugin = 'dsh-whale-theme/fonts'
          document.head.appendChild(prefTag)
        }
        prefTag.textContent = text
      },
      remove() { if (prefTag) { prefTag.remove(); prefTag = null } },
    }
    function applyPrefs() {
      const p = prefs
      const css = []
      // after the chat rule and more specific, so replies take 回复字体 over 界面字体
      if (p.chatFont) css.push(`${CHAT},${CHAT} ${NOT_MONO}{font-family:${p.chatFont},${SANS_TAIL}!important}`)
      if (p.replyFont) css.push(`${MD},${MD} ${NOT_MONO}{font-family:${p.replyFont}!important}`)
      prefSheet.css(css.join('\n'))
    }

    // rows and dropdowns shared by all our settings rows (dsh-claude-shared/kit.js)
    const ui = kit.settingsUI()
    const { Row, Select, S } = ui
    const sheet = { ensure: ui.sheet.ensure, remove: ui.sheet.remove }

    function useCodeFont(ctx) {
      const read = () => { try { return (ctx.theme.getTheme().fontFamilies || {}).code || '' } catch { return '' } }
      const [v, setV] = useState(read)
      useEffect(() => {
        const id = setInterval(() => setV(read), 500)
        let off
        try { off = ctx.on('theme/change', () => setV(read())) } catch {}
        return () => { clearInterval(id); try { typeof off === 'function' && off() } catch {} }
      }, [])
      return [v, () => setV(read())]
    }

    function FontRows({ ctx }) {
      const p = useSyncExternalStore(store.subscribe, store.get)
      const [code, refresh] = useCodeFont(ctx)
      useEffect(() => { sheet.ensure() }, [])
      const setCode = (v) => { try { ctx.theme.setFontFamily('code', v) } catch (e) { console.error('[dsh-chat-fonts]', e) } refresh() }
      return h(React.Fragment, null,
        h(Row, { label: S('界面字体', 'Interface font'), desc: S('只作用于对话和输入框，侧边栏等其他界面不变', 'Only the conversation and the input box; the sidebar and the rest of the app stay the same') },
          h(Select, { label: S('界面字体', 'Interface font'), value: p.chatFont, options: fontOptions(UI_FONTS, p.chatFont, S), onChange: (v) => store.set({ chatFont: v }) })),
        h(Row, { label: S('回复字体', 'Response font'), desc: S('只影响模型回复的正文', 'Only the body of model replies') },
          h(Select, { label: S('回复字体', 'Response font'), value: p.replyFont, options: fontOptions(REPLY_FONTS, p.replyFont, S), onChange: (v) => store.set({ replyFont: v }) })),
        h(Row, { label: S('代码字体', 'Code font'), desc: S('代码块、行内代码与工具输出', 'Code blocks, inline code and tool output') },
          h(Select, { label: S('代码字体', 'Code font'), value: code, options: fontOptions(MONO_FONTS, code, S), onChange: setCode })))
    }

    return {
      inject: ['slots', 'theme'],
      apply(ctx) {
        ctx.effect(() => { applyPrefs(); return () => prefSheet.remove() }, 'chat-fonts: own prefs')
        ctx.effect(() => { sheet.ensure(); return sheet.remove }, 'chat-fonts: styles')
        function Rows() { return h(FontRows, { ctx }) }
        // the plugin page renders these directly: a child slot may only be declared by one owner
        kit.themeFontRows = Rows
        ctx.effect(() => () => { if (kit.themeFontRows === Rows) delete kit.themeFontRows }, 'chat-fonts: shared rows')
        // on the theme's own 主题 page, after the theme options (order 10)
        ctx.slots.inject('settings.whale-theme.item', () => ctx.slots.register({
          name: 'settings.whale-theme.item', id: 'claude-fonts', order: 20,
        }, Rows))
      },
    }
  },
})
