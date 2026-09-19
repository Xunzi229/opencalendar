import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type {
  AlmanacRecord,
  AlmanacResult,
} from '../../../shared/almanac/types'
import type { ClockSnapshot } from '../../../shared/clock/types'

export interface DesktopApi {
  getAlmanac(date: string): Promise<AlmanacResult>
  getClockSnapshot(): Promise<ClockSnapshot>
  getApiKey(): Promise<string>
  setApiKey(value: string): Promise<void>
  closeCurrentWindow(): Promise<void>
  reportCalendarSize(size: { width: number; height: number }): Promise<void>
  onClockChanged(listener: (snapshot: ClockSnapshot) => void): () => void
  onAlmanacUpdated(listener: (record: AlmanacRecord | null) => void): () => void
  onCalendarShown(listener: () => void): () => void
}

const BROWSER_API_KEY = 'calendar.tianApiKey'

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const runtimeWindow = window as typeof window & {
    __TAURI_INTERNALS__?: unknown
  }

  return typeof runtimeWindow.__TAURI_INTERNALS__ !== 'undefined'
}

function createClockSnapshot(): ClockSnapshot {
  const now = new Date()

  return {
    iso: now.toISOString(),
    dateKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    timezoneOffset: now.getTimezoneOffset(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  }
}

function subscribe<T>(
  eventName: string,
  listener: (payload: T) => void,
): () => void {
  if (!isTauriRuntime()) {
    return () => {}
  }

  let active = true
  const unlisten = listen<T>(eventName, (event) => {
    if (active) {
      listener(event.payload)
    }
  })

  return () => {
    active = false
    void unlisten.then((dispose) => {
      dispose()
    })
  }
}

const browserDesktopApi: DesktopApi = {
  async getAlmanac(): Promise<AlmanacResult> {
    return {
      record: null,
      source: 'none',
    }
  },
  async getClockSnapshot(): Promise<ClockSnapshot> {
    return createClockSnapshot()
  },
  async getApiKey(): Promise<string> {
    return window.localStorage.getItem(BROWSER_API_KEY) ?? ''
  },
  async setApiKey(value: string): Promise<void> {
    const nextValue = value.trim()

    if (nextValue) {
      window.localStorage.setItem(BROWSER_API_KEY, nextValue)
    } else {
      window.localStorage.removeItem(BROWSER_API_KEY)
    }
  },
  async closeCurrentWindow(): Promise<void> {},
  async reportCalendarSize(): Promise<void> {},
  onClockChanged(): () => void {
    return () => {}
  },
  onAlmanacUpdated(): () => void {
    return () => {}
  },
  onCalendarShown(): () => void {
    return () => {}
  },
}

const tauriDesktopApi: DesktopApi = {
  getAlmanac(date) {
    return invoke<AlmanacResult>('get_almanac', { date })
  },
  getClockSnapshot() {
    return invoke<ClockSnapshot>('get_clock_snapshot')
  },
  getApiKey() {
    return invoke<string>('get_api_key')
  },
  setApiKey(value) {
    return invoke('set_api_key', { value })
  },
  closeCurrentWindow() {
    return invoke('close_current_window')
  },
  reportCalendarSize(size) {
    return invoke('report_calendar_size', size)
  },
  onClockChanged(listener) {
    return subscribe<ClockSnapshot>('clock-changed', listener)
  },
  onAlmanacUpdated(listener) {
    return subscribe<AlmanacRecord | null>('almanac-updated', listener)
  },
  onCalendarShown(listener) {
    return subscribe<void>('calendar-shown', listener)
  },
}

export const desktopApi: DesktopApi = isTauriRuntime()
  ? tauriDesktopApi
  : browserDesktopApi
