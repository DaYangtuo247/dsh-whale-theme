/*!
 * Ambient surface of the bundle scope.
 *
 * build.mjs concatenates every src/lib/*.ts and then every src/parts/*.ts into one IIFE, so these
 * declarations describe what is already in scope at runtime: `part` comes from the bundle wrapper
 * (dsh-claude-shared/build.mjs), `makeKit`/`featureStore`/`gateFeature` from kit.js, and each part
 * receives the resulting `kit`. Nothing here is emitted; tsc uses it for checking only.
 */

/** handle returned by kit.sheet(); ensure() is idempotent, remove() undoes it. */
interface Sheet {
  ensure(): void
  remove(): void
}

/** The settings rows every dsh-claude bundle shares (kit.settingsUI()). */
interface SettingsUI {
  sheet: Sheet
  Row(props: { label: any; desc?: any; children?: any }): any
  Select(props: { value: any; options: Array<{ v: any; label?: any; zh?: string; en?: string; font?: string }>; onChange(v: any): void; box?: boolean; label?: string }): any
  Switch(props: { checked: boolean; onChange(v: boolean): void; label?: string }): any
  L(o: { zh: string; en: string }): string
  S(zh: string, en: string): string
}

/** The frame-coalesced MutationObserver hub, installed by the `dom-hub` part into kit.dom. */
interface DomHub {
  subscribe(fn: (records: MutationRecord[]) => void): () => void
  touches(records: MutationRecord[], sel: string): boolean
  mounts(records: MutationRecord[], sel: string): boolean
  poke(): void
}

/** The React surface this bundle actually uses. */
interface ReactLike {
  createElement(type: any, props?: any, ...children: any[]): any
  Fragment: any
  useState<S>(init: S | (() => S)): [S, (v: S | ((prev: S) => S)) => void]
  useRef<T = any>(init?: T | null): { current: T }
  useEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void
  useLayoutEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void
  useMemo<T>(fn: () => T, deps?: readonly unknown[]): T
  useCallback<T extends (...a: any[]) => any>(fn: T, deps?: readonly unknown[]): T
  useSyncExternalStore<T>(subscribe: (onChange: () => void) => () => void, get: () => T, getServer?: () => T): T
  useReducer(reducer: any, init: any): [any, (a: any) => void]
  Component: any
  PureComponent: any
  createRef(): { current: any }
  memo(component: any): any
  forwardRef(fn: any): any
}

/** What makeKit() hands every part. `dom` is filled in by the dom-hub part before others run. */
interface Kit {
  React: ReactLike
  /** React.createElement, kept under its old name for readability at call sites. */
  h(type: any, props?: any, ...children: any[]): any
  /** Renders into <body> so no transformed ancestor can offset a position:fixed popover. */
  portal(el: any, target?: Element): any
  sheet(name: string, css: string): Sheet
  settingsUI(): SettingsUI
  dom: DomHub
  [k: string]: any
}

/** Feature toggle metadata: one row in 设置 › 插件功能. */
interface FeatureMeta {
  /** the part id it belongs to, filled in by store.declare() */
  id?: string
  zh: string
  en: string
  /** longer one-liner shown under the label in 设置 › 插件功能 */
  desc?: string
  descEn?: string
}

/** The cordis context a part's apply() receives (only the members used here are typed). */
interface PartContext {
  locale: any
  slots: {
    inject(key: string, cb: (slots: any) => any): () => void
    register(...a: any[]): any
    [k: string]: any
  }
  remote: any
  /** cordis: with a callback, runs fn once those services are ready and ties it to this fiber. */
  inject(name: string | string[], fn?: (scope: PartContext) => void): any
  effect(fn: () => void | (() => void), label?: string): void
  extend(o: any): PartContext
  plugin(o: { name: string; inject?: string[]; apply(ctx: PartContext): void }): { dispose(): any }
  [k: string]: any
}

/** What a part's factory returns; a part without `feature` runs on the plain synchronous path. */
interface PartModule {
  inject?: string[]
  apply(ctx: PartContext): void
}

/** A part definition, as consumed by the bundle wrapper. */
interface PartDefinition {
  id: string
  feature?: FeatureMeta
  factory(require: (id: string) => any, kit: Kit): PartModule
}

/** Registers one part with the bundle wrapper. */
declare function part(def: PartDefinition): void

/** The per-bundle toggle store that build.mjs passes as `store` (dsh-claude-shared/kit.js). */
interface FeatureStore {
  declare(bundle: string, id: string, feature?: FeatureMeta): void
  list(): Array<FeatureMeta & { bundle: string }>
  enabled(id: string): boolean
  revision(): number
  set(id: string, on: boolean): void
  subscribe(fn: (id: string) => void): () => void
}
declare function featureStore(): FeatureStore
declare function gateFeature(ctx: PartContext, store: FeatureStore, mod: any): void
declare function makeKit(require: (id: string) => any, bundle: string): Kit
