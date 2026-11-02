import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function attachPopupAnimation(target: HTMLElement): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const offset = /Macintosh|Mac OS X/.test(navigator.userAgent) ? -12 : 16
  let active = true
  let revision = 0
  let animation: Animation | null = null

  const reset = (): void => {
    ++revision
    animation?.cancel()
    animation = null
    target.style.opacity = ''
  }

  const reveal = (): void => {
    if (!active) return
    reset()
    if (reducedMotion.matches || typeof target.animate !== 'function') {
      target.style.opacity = '1'
      return
    }
    animation = target.animate(
      [
        { opacity: 0, transform: `translateY(${offset}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
    )
  }

  const onMotionChange = (): void => {
    if (reducedMotion.matches && animation) {
      animation.cancel()
      animation = null
      target.style.opacity = '1'
    }
  }
  reducedMotion.addEventListener('change', onMotionChange)

  const subscriptions = [
    listen('calendar-shown', reveal),
    listen('calendar-hidden', () => { if (active) reset() }),
  ]
  // Listener registration is asynchronous. If the first click happened before
  // registration finished, recover by checking the native window afterwards.
  void Promise.all(subscriptions).then(async () => {
    const current = revision
    const visible = await getCurrentWindow().isVisible()
    if (active && current === revision && visible) reveal()
  }).catch(() => {
    // Keep the calendar usable if the window visibility API is unavailable.
    if (active) {
      reset()
      target.style.opacity = '1'
    }
  })

  return () => {
    active = false
    reset()
    reducedMotion.removeEventListener('change', onMotionChange)
    for (const subscription of subscriptions) {
      void subscription.then((unlisten) => unlisten()).catch(() => {})
    }
  }
}
