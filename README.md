# dsh-whale-theme

Everything theme-related for DeepSeek Harness (web and DSH NEXT) in one plugin: the DeepSeek-website background (whale centred on the main area, idle pause), see-through shell panels, and one liquid-glass material for every raised surface. Fonts, sizes and text / command colours are in dsh-conversation-enhancer. Turning it off leaves the Claude-style layout from dsh-composer-display / dsh-conversation-enhancer / dsh-claude-shell on dsh's default solid look.

| File | Part | What it does |
| --- | --- | --- |
| `src/lib/01-bg-assets.ts` | — | Shared data: the deepseek.com fluid and whale shaders, the whale texture and its particle sampling, matrix helpers |
| `src/lib/02-bg-aurora.ts` | — | Aurora engine: WebGL2 fluid with a mouse-driven flowmap, 30 fps |
| `src/lib/03-bg-whale.ts` | — | Whale engine: WebGL2 particle whale, mouse distortion and a light that follows the cursor, 30 fps |
| `src/lib/04-bg-constellation.ts` | — | Constellation grid (2D canvas), pushed by the pointer; idles when still |
| `src/lib/styles.d.ts` | — | Ambient `declare const CSS_*: string` declarations for the CSS the build generates from `src/styles/` |
| `src/styles/05-background.scss` | — | Static CSS behind `kit.sheet('background')`; compiled to `CSS_BACKGROUND` |
| `src/styles/06-glass.scss` | — | Static CSS behind `kit.sheet('glass')`; compiled to `CSS_GLASS` |
| `src/styles/07-theme-settings.scss` | — | Static CSS behind `kit.sheet('theme-settings')`; compiled to `CSS_THEME_SETTINGS` |
| `src/parts/05-background.ts` | `dsh-background` | The background layer, theme switching, transparent shell and frosted left sidebar, whale placement, idle pause |
| `src/parts/06-glass.ts` | `dsh-glass` | One liquid-glass material across menus, bubbles, search, Settings, dialogs, tool rows, code blocks and cards; selection colour |
| `src/parts/07-settings.ts` | `dsh-theme-settings` | The theme's own settings, on the Settings › 主题 tab and on the bundle's plugin page: background / whale / grid / idle pause / glass strength (`themePrefs()`) |
| `src/parts/08-fonts.ts` | `dsh-chat-fonts` | 界面字体, 回复字体 and 代码字体 rows on the 主题 page (slot `settings.whale-theme.item`); its CSS is generated at runtime, so it stays in TS |

Renamed from dsh-claude-glass on 2026-11-11 and from dsh-claude-theme on 2026-11-16 (the saved options keep the `dsh-claude-theme.settings` key, so existing preferences carry over). The background was the third-party plugin **dsh-client-ui-deepseek-bg** v1.0.0 (MIT), merged in on 2026-11-11 and rewritten around this bundle. The original zip and its local-change notes are kept in the author's private archive, not in this repo.

Part of a set of independent DeepSeek Harness UI bundles: [dsh-composer-display](https://github.com/DaYangtuo247/dsh-composer-display) (the input box and what sits on it), [dsh-conversation-enhancer](https://github.com/DaYangtuo247/dsh-conversation-enhancer) (the conversation view), [dsh-whale-theme](https://github.com/DaYangtuo247/dsh-whale-theme) (background, glass, fonts and its own Settings › 主题 page) and [dsh-context-monitor](https://github.com/DaYangtuo247/dsh-context-monitor) (context usage in the composer and in a 上下文透视 tab). Each one works on its own; they share one build script, vendored here as `scripts/`.

## Background (`src/parts/05-background.ts` + the engines in `src/lib/`)

- **Both themes.** Dark is the deepseek.com/harness hero. Light uses the same fluid, shape and motion on a light palette (paper white, soft blues, a warm cream highlight) with no light spot, vignette or bloom. Neither theme tints the area under the cursor (the original's glow reads as a blob on glass).
- **Whale on the content, not the window.** The layer is moved (`--dsb-whale-x` / `--dsb-whale-y`) to a fixed spot in the content area: its middle, a little above centre where the new-session title rests. It follows the window and sidebar size, never the content. The whale engine subtracts the same shift from the pointer, so particles still react under the cursor.
- **Whale in light.** Drawn as the dark whale's negative: in dark a particle brightens the page (`screen`), in light it darkens it by the same amount in navy (`multiply` through the `#dsh-ds-ink` colour matrix). In light the engine accumulates alpha and halves the colour so the canvas is a valid premultiplied image the filter does not clamp.
- **Shell.** The page, layout frame (and DSH NEXT's opaque centre column), view roots and the input box's seat are transparent; the left sidebar is frosted (`--dsb-surface` / `--dsb-border`, also used by the glass part). All of it is one stylesheet — no inline styles, no DOM polling.

## Performance

- Both WebGL loops are capped at 30 fps (device pixel ratio ≤ 1.5) and stop while the tab is hidden.
- **Idle pause.** After 20 s without pointer, key, wheel or touch input, or while the window is unfocused, each loop stops at its next frame and the last frame stays on screen; any input or focus restarts them. A page that opens unfocused still draws the whale's 3 s assembly first. Tune `IDLE_MS` in `src/parts/05-background.ts`; Settings › 主题 › 空闲暂停 turns it off.
- **Whale placement** re-measures only when the content area is resized or replaced, so a streaming reply never forces layout reads.
- The constellation grid stops by itself once it is still, and is skipped on touch screens.

## Glass (`src/parts/06-glass.ts`)

One "liquid glass" material for floating and raised surfaces, matched to dsh's own
status-bar popovers (Token 用量 …): a translucent tint, blur(40px) saturate(1.5),
a 0.5px light ring with a faint top highlight, and a soft shadow. Applied to:

- dsh menus (through dsh's own menu tokens) and the user message bubble
- the turn-outline hover card (the ☰ marks at the right of a conversation)
- the @hyzyn/dsh-search ⌘K palette (CSS only, the plugin itself is untouched)
- the Settings dialog and modal dialogs (插件安装确认 …)
- tool-call rows (运行了 N 条命令; what opens inside a row is dsh-tool-groups'), the plan
    card's list and the 加载更早 pill
- deliverable file cards and the per-turn changes card
- code blocks (a darker glass well), the command / output band in tool rows, and the text-selection colour
- the input box, the scroll-to-bottom button and the new-session usage card; a frosted layer below the input box only, so the transcript doesn't run into the status row
- other plugins' pages, CSS only: the 轨迹 tab (toolbar, 加载更早的历史, ledger and plot), dsh-context's 上下文 tab and
    上下文洞察 page (canvas, stat buttons, cards), 个人主页 panels and KPI tiles, the plugin market's sticky head,
    search box and active pill, the 改动 panel's checkout bar, inline code in thinking blocks, and the Settings mask
- card blur sits on `::before` (with `isolation:isolate` on the host), never on the card itself, so menus and
    nested glass inside it keep working; the input box does the same
and removes the opaque strip behind the sidebar's account row and the opaque fade over
the session list's last row. Theme only: no layout or behaviour changes. Dark and light
each get their own tint.

## Install

`client.js` is committed, so a checkout runs as-is — no build step is needed to use it.

- **GUI:** 插件 → 添加插件 → 安装第三方插件, enter `github:DaYangtuo247/dsh-whale-theme` (or the absolute path of a local checkout), then enable the bundle in **设置 › 插件**.
- **CLI:** `dsh plugin --profile <profile> add github:DaYangtuo247/dsh-whale-theme`, then enable it in **设置 › 插件**.

Built and tested against DeepSeek Harness `0.2.2-rc.3` (DSH NEXT 2.0.23).

## Develop

The sources live under `src/`: TypeScript in `src/lib/` + `src/parts/`, static CSS in `src/styles/*.scss`. Edit those, then rebuild `client.js`:

```bash
pnpm install            # once: sass + typescript, resolved from this package
pnpm run build          # tsc -p . → .build/{lib,styles,parts} → client.js
pnpm run typecheck      # types only
pnpm run check          # build + CSS gate: a full-round radius must pair corner-shape: round
node scripts/render.mjs client.js | diff .baseline/rendered.css -   # the stylesheet must not drift
node scripts/parts.mjs client.js | diff .baseline/parts.json -      # same parts, same order
```

`.baseline/rendered.pre-scss.css` keeps the pre-extraction render for reference; `rendered.css` records the Sass-expanded output the build now emits.

`src/styles/` holds the static CSS, one `NN-<sheet>.scss` per `kit.sheet()` name: `05-background.scss` → `CSS_BACKGROUND`, `06-glass.scss` → `CSS_GLASS`, `07-theme-settings.scss` → `CSS_THEME_SETTINGS`. The shared build compiles every `src/styles/*.scss` (sorted, `_*.scss` partials skipped) with dart-sass — `style: 'expanded'`, `charset: false` — into `.build/styles/*.js` as `const CSS_<NAME> = "…"`, concatenated into the bundle scope before the parts. A part then injects it with the same `kit.sheet('glass', CSS_GLASS)` call; reload the page after a rebuild. Edit the `.scss`, never the generated `.build/styles/*.js`. `src/lib/styles.d.ts` declares those `CSS_*` constants for `tsc`. `src/parts/08-fonts.ts` is the exception: its CSS is generated at runtime from the font settings, so it stays in TS.

`src/lib/` holds what the parts share (no `part()` call in there): `01-bg-assets`, `02-bg-aurora`, `03-bg-whale`, `04-bg-constellation` — the background engines, keyed by the parts below. `src/parts/` holds one file per part, each calling `part({ id, factory(require, kit) { … return { inject, apply } } })`. TypeScript runs in **script mode** — no `import`/`export` anywhere: build.mjs concatenates every `src/lib/*.ts`, then every `src/styles/*.scss`, then every `src/parts/*.ts` into one IIFE, so all files share one global scope and `src/types.d.ts` describes what is already in scope (`part`, the `kit` surface, `Kit` / `PartContext` / `PartModule`). The shared `kit` (from `scripts/kit.js`) provides `React`, `h`, `portal` and `sheet(name, css)` for named `<style>` tags. The bundle injects the union of every part's services; one part failing to load or apply is logged and does not stop the others. Linked install: after a rebuild, reload the page.

## Settings › 主题 / plugin page (`src/parts/07-settings.ts`, `08-fonts.ts`)

The theme keeps its options on its own Settings page (`settings.section` id `whale-theme`, order 5, right after 通用设置) instead of dsh's 通用设置; the same page also renders on the bundle's plugin page (`plugins.bundle.config`), sharing one store:

- **动态背景** 动态 / 静止 / 关闭. 静止 draws one frame (the assembled whale) and never animates; 关闭 hides aurora, whale and grid and leaves the plain backdrop. The engines stop at their next frame while halted (`bg.halted(name)`); a theme or setting change bumps `bg.epoch` so a halted loop draws once more.
- **鲸鱼**, **星座网格** on / off (hidden while 动态背景 is 关闭). A hidden layer's loop stops too.
- Layers fade out / in (0.45 s) instead of display:none, so the canvases keep their size; a window resize bumps `bg.epoch` so a halted loop (静止, idle) redraws instead of staying blank. 静止 only skips an unfinished whale assembly, so a running whale freezes where it is.
- **空闲暂停** (only under 动态): off keeps the animation running when idle or unfocused.
- **毛玻璃** 通透 / 标准 / 磨砂: overrides `--dg-blur`, `--dg-blur-soft`, `--dg-tint` and `--dg-tint-strong` for every glass surface.
- **字体** (`src/parts/08-fonts.ts`): 界面字体 (the conversation and input box only), 回复字体 (model replies) and 代码字体 (dsh's own code font, saved in dsh's config). Each menu lists only fonts installed on this machine, shown in their own face; 界面字体 / 回复字体 are kept in localStorage `dsh-claude-appearance`.

The options are kept in localStorage `dsh-claude-theme.settings` (historical key, kept so the rename keeps a user's choices) and reflected as `html[data-dct-bg|data-dct-glass|data-dct-no-whale|data-dct-no-grid]`. Rows and dropdowns come from `kit.settingsUI()`.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 DaYangtuo247. DeepSeek Harness and the DeepSeek name belong to their owners; this bundle is an independent add-on and ships no DeepSeek code.
