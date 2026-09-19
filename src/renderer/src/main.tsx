import { createRoot } from 'react-dom/client'
import { isTauriRuntime } from './api/desktop'
import { CalendarApp } from './CalendarApp'
import { SettingsApp } from './SettingsApp'
import './styles.css'

document.documentElement.dataset.runtime = isTauriRuntime()
  ? 'desktop'
  : 'browser'

const isSettingsView =
  new URLSearchParams(window.location.search).get('view') === 'settings'

createRoot(document.getElementById('root')!).render(
  isSettingsView ? <SettingsApp /> : <CalendarApp />,
)
