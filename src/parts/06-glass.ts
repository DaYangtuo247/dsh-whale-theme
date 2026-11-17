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
    const sheet = kit.sheet('glass', CSS_GLASS)

    return {
      inject: [],
      apply(ctx) {
        ctx.effect(() => { sheet.ensure(); return sheet.remove }, 'glass: styles')
        // width handles: dsh moves --dsh-width-handle-pointer-y only while dragging; keep it on the pointer while
        // hovering too, stop the line at the input box, and hide it level with the input box
        ctx.effect(() => {
          let cur = null
          const seatTop = (h) => {
            const seat = h.parentElement && h.parentElement.querySelector('[data-composer-seat]')
            return seat ? seat.getBoundingClientRect().top : Infinity
          }
          const move = (e) => {
            const h = e.target && e.target.closest ? e.target.closest('[data-width-handle]') : null
            if (cur && cur !== h) { cur.removeAttribute('data-dct-wh-off'); cur = null }
            if (!h || h.hasAttribute('data-dragging')) return
            cur = h
            const box = h.getBoundingClientRect()
            const stop = Math.min(seatTop(h), box.bottom)
            h.style.setProperty('--dct-wh-bottom', Math.max(0, box.bottom - stop + 12) + 'px')
            h.style.setProperty('--dsh-width-handle-pointer-y', (e.clientY - box.top) + 'px')
            h.toggleAttribute('data-dct-wh-off', e.clientY > stop - 16)
          }
          document.addEventListener('pointermove', move, { passive: true })
          return () => {
            document.removeEventListener('pointermove', move)
            for (const h of document.querySelectorAll<HTMLElement>('[data-width-handle]')) { h.removeAttribute('data-dct-wh-off'); h.style.removeProperty('--dct-wh-bottom') }
          }
        }, 'glass: width handle')
      },
    }
  },
})
