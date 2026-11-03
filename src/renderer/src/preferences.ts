export interface CalendarPreferences {
  showLunar: boolean
  showBadges: boolean
}

export const preferencesKey = 'calendar.appearance.v1'
export const defaultPreferences: CalendarPreferences = {
  showLunar: true,
  showBadges: true,
}

export function parsePreferences(raw: string | null): CalendarPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object') return { ...defaultPreferences }
    const record = value as Record<string, unknown>
    return {
      showLunar:
        typeof record.showLunar === 'boolean' ? record.showLunar : true,
      showBadges:
        typeof record.showBadges === 'boolean' ? record.showBadges : true,
    }
  } catch {
    return { ...defaultPreferences }
  }
}

export function readPreferences(): CalendarPreferences {
  try {
    return parsePreferences(window.localStorage.getItem(preferencesKey))
  } catch {
    return { ...defaultPreferences }
  }
}

export function savePreferences(patch: Partial<CalendarPreferences>): void {
  const next = { ...readPreferences(), ...patch }
  // Only notify views after the write succeeds, so a failed save never looks successful.
  window.localStorage.setItem(preferencesKey, JSON.stringify(next))
  window.dispatchEvent(new Event('calendar-preferences-changed'))
}
