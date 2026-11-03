import { useEffect, useState } from 'react'
import { preferencesKey, readPreferences } from './preferences'

export function usePreferences() {
  const [preferences, setPreferences] = useState(readPreferences)
  useEffect(() => {
    const refresh = () => setPreferences(readPreferences())
    const onStorage = (event: StorageEvent) => {
      if (event.key === preferencesKey || event.key === null) refresh()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('calendar-preferences-changed', refresh)
    window.addEventListener('focus', refresh)
    // Subscribe first, then reconcile changes made between render and subscription.
    refresh()
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('calendar-preferences-changed', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return preferences
}
