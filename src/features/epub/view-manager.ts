interface EngineManager {
  settings: { fullsize?: boolean }
  container: HTMLElement
  stage?: {
    orientationChangeFunc?: EventListener
    resizeFunc?: EventListener & { cancel?(): void }
  }
  _onScroll?: EventListener
  afterScrolled?: ReturnType<typeof setTimeout>
  emit(type: string, ...args: unknown[]): unknown
  onScroll(event: Event): void
  addEventListeners(): void
  removeEventListeners(): void
  destroy(): void
}

export type EpubManagerConstructor = new (...args: unknown[]) => EngineManager

/** epub.js 0.3.93 leaves its anonymous bound unload handler on window and
 * removes its stage orientation listener with the wrong event-name casing.
 * Supply an isolated manager through Rendition's supported manager option;
 * keep the engine's scroll/unload behavior with removable callback identities.
 */
export function managedEpubViewManager(Base: EpubManagerConstructor): EpubManagerConstructor {
  return class ManagedEpubViewManager extends Base {
    private scrollTarget?: EventTarget
    private unload?: EventListener
    private disposed = false
    private locationReport?: ReturnType<typeof setTimeout>

    private cancelLocationReport() {
      clearTimeout(this.locationReport)
      this.locationReport = undefined
    }

    override onScroll(event: Event) {
      if (this.disposed || !this.unload) return
      this.cancelLocationReport()
      super.onScroll(event)
    }

    override emit(type: string, ...args: unknown[]) {
      if (type !== 'scrolled') return super.emit(type, ...args)
      if (this.disposed || !this.unload) return
      this.cancelLocationReport()
      // Engine location mapping walks the visible chapter. Keep live SCROLL
      // delivery, but defer its trailing notification until input has settled.
      // Application reading locations retain their independent frame capture/flush.
      this.locationReport = setTimeout(() => {
        this.locationReport = undefined
        if (!this.disposed && this.unload) super.emit(type, ...args)
      }, 120)
    }

    override addEventListeners() {
      if (this.disposed || this.unload) return
      this.unload = () => this.destroy()
      this.scrollTarget = this.settings.fullsize ? window : this.container
      this._onScroll = this.onScroll.bind(this)
      window.addEventListener('unload', this.unload)
      this.scrollTarget.addEventListener('scroll', this._onScroll)
    }

    override removeEventListeners() {
      this.cancelLocationReport()
      clearTimeout(this.afterScrolled)
      if (this.unload) window.removeEventListener('unload', this.unload)
      if (this._onScroll) this.scrollTarget?.removeEventListener('scroll', this._onScroll)
      this.unload = undefined
      this.scrollTarget = undefined
      this._onScroll = undefined
    }

    override destroy() {
      if (this.disposed) return
      this.disposed = true
      // Remove the strong window root even if downstream engine teardown fails.
      this.removeEventListeners()
      const stage = this.stage
      if (stage?.orientationChangeFunc)
        window.removeEventListener('orientationchange', stage.orientationChangeFunc)
      if (stage?.resizeFunc) {
        window.removeEventListener('resize', stage.resizeFunc)
        stage.resizeFunc.cancel?.()
      }
      super.destroy()
    }
  }
}
