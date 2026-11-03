import React, { useCallback, useEffect, useRef, useState } from 'react'
import { desktopApi, isTauriRuntime } from './api/desktop'
import { text } from './calendar'
import { savePreferences, type CalendarPreferences } from './preferences'
import { usePreferences } from './usePreferences'
import { version } from '../../../package.json'

type SettingsPage = 'appearance' | 'almanac' | 'startup' | 'about'
const settingsPages: { id: SettingsPage; label: string; icon: string }[] = [
  { id: 'appearance', label: '个性化', icon: 'appearance' },
  { id: 'almanac', label: '黄历服务', icon: 'calendar' },
  { id: 'startup', label: '启动项', icon: 'power' },
  { id: 'about', label: '关于', icon: 'info' },
]

function SettingsIcon({ name }: { name: string }): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'appearance' ? (
        <>
          <path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.2-2.5H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" />
          <path d="M7 10h.01M10 6h.01M15 6h.01M18 10h.01" />
        </>
      ) : name === 'power' ? (
        <>
          <path d="M12 3v8" />
          <path d="M6.4 5.8a9 9 0 1 0 11.2 0" />
        </>
      ) : name === 'info' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </>
      ) : (
        <>
          <rect x="4" y="5" width="16" height="16" rx="3" />
          <path d="M8 3v4m8-4v4M4 10h16M8 14h2m4 0h2m-8 3h2" />
        </>
      )}
    </svg>
  )
}

export function SettingsApp(): React.ReactElement {
  const [page, setPage] = useState<SettingsPage>('appearance')
  const preferences = usePreferences()
  const [preferenceMessage, setPreferenceMessage] = useState('')
  const [keyLoading, setKeyLoading] = useState(true)
  const [keyLoadFailed, setKeyLoadFailed] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)
  const [keyStatus, setKeyStatus] = useState<'success' | 'error'>('success')
  const [closeError, setCloseError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [autostartEnabled, setAutostartEnabled] = useState<boolean | null>(null)
  const [autostartLoading, setAutostartLoading] = useState(isTauriRuntime)
  const [autostartSaving, setAutostartSaving] = useState(false)
  const [autostartError, setAutostartError] = useState('')
  const autostartRequest = useRef(0)
  const savingAutostart = useRef(false)
  const desktopRuntime = isTauriRuntime()

  const refreshAutostart = useCallback(async (): Promise<void> => {
    if (!isTauriRuntime() || savingAutostart.current) return
    const request = ++autostartRequest.current
    setAutostartLoading(true)
    setAutostartError('')
    try {
      const enabled = await desktopApi.isAutostartEnabled()
      if (request === autostartRequest.current) setAutostartEnabled(enabled)
    } catch {
      if (request === autostartRequest.current) {
        setAutostartEnabled(null)
        setAutostartError('无法读取系统启动项，请重试')
      }
    } finally {
      if (request === autostartRequest.current) setAutostartLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAutostart()
    const onFocus = (): void => {
      void refreshAutostart()
    }
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void refreshAutostart()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      ++autostartRequest.current
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshAutostart])

  async function toggleAutostart(): Promise<void> {
    if (
      savingAutostart.current ||
      autostartLoading ||
      autostartEnabled === null
    )
      return
    savingAutostart.current = true
    const request = ++autostartRequest.current
    setAutostartSaving(true)
    setAutostartError('')
    try {
      const enabled = await desktopApi.setAutostartEnabled(!autostartEnabled)
      if (request === autostartRequest.current) setAutostartEnabled(enabled)
    } catch {
      // 写入失败后重新读取，避免把系统未接受的状态显示为已开启。
      let enabled: boolean | null = null
      try {
        enabled = await desktopApi.isAutostartEnabled()
      } catch {
        /* 保持未知状态 */
      }
      if (request === autostartRequest.current) {
        setAutostartEnabled(enabled)
        setAutostartError('更新开机自动启动失败，请重试')
      }
    } finally {
      savingAutostart.current = false
      if (request === autostartRequest.current) setAutostartSaving(false)
    }
  }

  const keyRequest = useRef(0)
  const loadApiKey = useCallback(async (): Promise<void> => {
    const request = ++keyRequest.current
    setKeyLoading(true)
    setKeyLoadFailed(false)
    setMessage('')
    try {
      const value = await desktopApi.getApiKey()
      if (request === keyRequest.current) setApiKey(value)
    } catch {
      if (request === keyRequest.current) {
        setKeyLoadFailed(true)
        setKeyStatus('error')
        setMessage('读取配置失败，请重新读取后再编辑')
      }
    } finally {
      if (request === keyRequest.current) setKeyLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadApiKey()
    return () => {
      ++keyRequest.current
    }
  }, [loadApiKey])

  function updatePreference(
    key: keyof CalendarPreferences,
    enabled: boolean,
  ): void {
    try {
      savePreferences({ [key]: enabled })
      setPreferenceMessage('已保存，日历显示已同步更新')
    } catch {
      setPreferenceMessage('保存失败，请检查本地存储后重试')
    }
  }

  async function closeSettings(): Promise<void> {
    try {
      if (desktopRuntime) await desktopApi.closeCurrentWindow()
      else window.location.assign('./')
    } catch {
      setCloseError('关闭失败，请重试')
    }
  }

  async function saveApiKey(): Promise<void> {
    if (busy || keyLoading || keyLoadFailed) return
    setBusy(true)
    setMessage('')

    try {
      await desktopApi.setApiKey(apiKey.trim())
      setApiKey(apiKey.trim())
      setKeyVisible(false)
      setKeyStatus('success')
      setMessage(apiKey.trim() ? text.apiKeySaved : text.apiKeyCleared)
    } catch {
      setKeyStatus('error')
      setMessage('操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  async function clearApiKey(): Promise<void> {
    if (busy || keyLoading || keyLoadFailed) return
    setBusy(true)
    setMessage('')

    try {
      await desktopApi.setApiKey('')
      setApiKey('')
      setKeyVisible(false)
      setKeyStatus('success')
      setMessage(text.apiKeyCleared)
    } catch {
      setKeyStatus('error')
      setMessage('操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="settings-shell">
      <section className="settings-window">
        <aside className="settings-sidebar">
          <div className="settings-brand">
            <img src="./date-icons/1.svg" alt="" />
            <span>
              OpenCalendar<small>偏好设置</small>
            </span>
          </div>
          <nav
            aria-label="设置分类"
            onKeyDown={(event) => {
              const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
              if (!keys.includes(event.key)) return
              const index = settingsPages.findIndex((item) => item.id === page)
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? settingsPages.length - 1
                    : (index +
                        (event.key === 'ArrowDown' ? 1 : -1) +
                        settingsPages.length) %
                      settingsPages.length
              event.preventDefault()
              setPage(settingsPages[next].id)
              setKeyVisible(false)
              event.currentTarget
                .querySelectorAll<HTMLButtonElement>('button')
                [next]?.focus()
            }}
          >
            {settingsPages.map((item) => (
              <button
                key={item.id}
                type="button"
                className="settings-nav-item"
                aria-current={page === item.id ? 'page' : undefined}
                aria-controls={`settings-${item.id}`}
                onClick={() => {
                  setPage(item.id)
                  setKeyVisible(false)
                }}
              >
                <SettingsIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <span className="settings-sidebar-caption">简单一点，从容每一天</span>
        </aside>
        <div className="settings-content">
          <header className="settings-page-header" data-tauri-drag-region>
            <h1 data-tauri-drag-region>
              {settingsPages.find((item) => item.id === page)?.label}
            </h1>
            <button
              type="button"
              className="settings-close-button"
              aria-label="关闭设置"
              title="关闭设置"
              disabled={busy || autostartSaving}
              onClick={() => void closeSettings()}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          </header>
          <div
            className="settings-page"
            id="settings-appearance"
            hidden={page !== 'appearance'}
          >
            <div className="settings-intro">
              <h2>让日历，更合你的习惯</h2>
              <p>调整月历信息，保留你想看到的细节。</p>
            </div>
            <section
              className="settings-group settings-appearance-group"
              aria-label="日历显示"
            >
              {(
                [
                  ['showLunar', '显示农历', '在日期下方显示农历、节日与节气'],
                  [
                    'showBadges',
                    '显示休班标记',
                    '以「休」「班」区分放假和调休补班',
                  ],
                ] as const
              ).map(([key, title, description]) => (
                <div className="settings-toggle-row" key={key}>
                  <div>
                    <strong id={`preference-${key}`}>{title}</strong>
                    <p className="settings-hint" id={`preference-${key}-hint`}>
                      {description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    className="settings-switch"
                    aria-labelledby={`preference-${key}`}
                    aria-describedby={`preference-${key}-hint`}
                    aria-checked={preferences[key]}
                    onClick={() => updatePreference(key, !preferences[key])}
                  >
                    <span />
                  </button>
                </div>
              ))}
            </section>
            <p className="settings-footnote">
              设置自动保存，并同步到日历窗口。
            </p>
            <p className="settings-feedback" role="status">
              {preferenceMessage}
            </p>
          </div>
          <div
            className="settings-page"
            id="settings-startup"
            hidden={page !== 'startup'}
          >
            <div className="settings-intro">
              <h2>随时，轻松查看日期</h2>
              <p>让日历在登录后准备就绪。</p>
            </div>
            <section
              className="settings-startup"
              aria-labelledby="autostart-label"
            >
              <div className="settings-toggle-row">
                <div>
                  <strong id="autostart-label">开机自动启动</strong>
                  <p className="settings-hint">
                    登录电脑后自动运行，驻留系统托盘。
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  className="settings-switch"
                  aria-labelledby="autostart-label"
                  aria-describedby="autostart-status"
                  aria-checked={autostartEnabled === true}
                  aria-busy={autostartLoading || autostartSaving}
                  disabled={
                    !desktopRuntime ||
                    autostartLoading ||
                    autostartSaving ||
                    autostartEnabled === null
                  }
                  onClick={() => void toggleAutostart()}
                >
                  <span />
                </button>
              </div>
              <p
                className="settings-startup-status"
                id="autostart-status"
                role="status"
              >
                {!desktopRuntime
                  ? '浏览器预览不可用，请在桌面应用中设置'
                  : autostartSaving
                    ? '正在更新系统启动项…'
                    : autostartLoading
                      ? '正在检测系统启动项…'
                      : autostartEnabled === null
                        ? '启动状态未知'
                        : autostartEnabled
                          ? '已开启，下次登录时自动启动'
                          : '未开启'}
              </p>
              {autostartError && (
                <div className="settings-startup-error" role="alert">
                  <span>{autostartError}</span>
                  <button type="button" onClick={() => void refreshAutostart()}>
                    重新检测
                  </button>
                </div>
              )}
            </section>
          </div>
          <div
            className="settings-page"
            id="settings-almanac"
            hidden={page !== 'almanac'}
          >
            <div className="settings-intro">
              <h2>为日历添一份传统</h2>
              <p>连接黄历服务，查看每日宜忌与干支信息。</p>
            </div>
            <form
              className="settings-group"
              aria-busy={busy || keyLoading}
              onSubmit={(event) => {
                event.preventDefault()
                void saveApiKey()
              }}
            >
              <label className="settings-field">
                <span>{text.apiKeyLabel}</span>
                <span className="settings-hint">{text.apiKeyHint}</span>
                <input
                  type={keyVisible ? 'text' : 'password'}
                  autoComplete="off"
                  disabled={busy || keyLoading || keyLoadFailed}
                  className="settings-input"
                  value={apiKey}
                  placeholder={
                    keyLoading ? '正在读取配置…' : '请输入 TianAPI Key'
                  }
                  spellCheck={false}
                  onChange={(event) => {
                    setApiKey(event.target.value)
                    setMessage('')
                  }}
                />
              </label>
              <button
                type="button"
                className="settings-text-button"
                disabled={keyLoading || keyLoadFailed}
                aria-pressed={keyVisible}
                onClick={() => setKeyVisible((value) => !value)}
              >
                {keyVisible ? '隐藏密钥' : '显示密钥'}
              </button>
              {keyLoadFailed && (
                <button
                  type="button"
                  className="settings-text-button"
                  onClick={() => void loadApiKey()}
                >
                  重新读取配置
                </button>
              )}
              <div className="settings-actions">
                <button
                  type="button"
                  className="settings-button"
                  disabled={busy || keyLoading || keyLoadFailed}
                  onClick={() => void clearApiKey()}
                >
                  {text.clear}
                </button>
                <button
                  type="submit"
                  className="settings-button primary"
                  disabled={busy || keyLoading || keyLoadFailed}
                >
                  {busy ? '保存中…' : text.save}
                </button>
              </div>
              {message && (
                <p
                  className="settings-feedback"
                  data-status={keyStatus}
                  role="status"
                >
                  {message}
                </p>
              )}
            </form>
            <p className="settings-footnote">
              农历与节假日显示无需配置 Key。黄历服务不可用时，日历仍可正常使用。
            </p>
          </div>
          <div
            className="settings-page settings-about"
            id="settings-about"
            hidden={page !== 'about'}
          >
            <img
              className="settings-about-icon"
              src="./date-icons/1.svg"
              alt="OpenCalendar 图标"
            />
            <h2>OpenCalendar</h2>
            <p className="settings-about-description">
              轻巧的中文桌面日历，让每一天清晰有序。
            </p>
            <span className="settings-version">版本 {version}</span>
            <div className="settings-feature-grid">
              {[
                ['calendar', '农历月历', '公历与农历，一眼可见'],
                ['calendar', '中国节假日', '放假、补班清晰标记'],
                ['info', '黄历宜忌', '按需连接黄历服务'],
                ['power', '托盘常驻', '需要时，随手打开'],
              ].map(([icon, title, description]) => (
                <div className="settings-feature" key={title}>
                  <span>
                    <SettingsIcon name={icon} />
                  </span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </div>
              ))}
            </div>
            <p className="settings-about-repo">
              github.com/Xunzi229/opencalendar
            </p>
          </div>
          <footer className="settings-bottom-bar">
            <span role="status">
              {closeError || `OpenCalendar · ${version}`}
            </span>
            <button
              type="button"
              className="settings-button"
              disabled={busy || autostartSaving}
              onClick={() => void closeSettings()}
            >
              {desktopRuntime ? '完成' : '返回日历'}
            </button>
          </footer>
        </div>
      </section>
    </main>
  )
}
