import React, { useCallback, useEffect, useRef, useState } from 'react'
import { desktopApi, isTauriRuntime } from './api/desktop'
import { text } from './calendar'

export function SettingsApp(): React.ReactElement {
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
    const onFocus = (): void => { void refreshAutostart() }
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
    if (savingAutostart.current || autostartLoading || autostartEnabled === null) return
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
      try { enabled = await desktopApi.isAutostartEnabled() } catch { /* 保持未知状态 */ }
      if (request === autostartRequest.current) {
        setAutostartEnabled(enabled)
        setAutostartError('更新开机自动启动失败，请重试')
      }
    } finally {
      savingAutostart.current = false
      if (request === autostartRequest.current) setAutostartSaving(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    void desktopApi
      .getApiKey()
      .then((value) => {
        if (!cancelled) {
          setApiKey(value)
        }
      })
      .catch(() => {
        if (!cancelled) setMessage('读取配置失败，请重试')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function saveApiKey(): Promise<void> {
    setBusy(true)
    setMessage('')

    try {
      await desktopApi.setApiKey(apiKey)
      setMessage(apiKey.trim() ? text.apiKeySaved : text.apiKeyCleared)
    } catch {
      setMessage('操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  async function clearApiKey(): Promise<void> {
    setBusy(true)
    setMessage('')

    try {
      await desktopApi.setApiKey('')
      setApiKey('')
      setMessage(text.apiKeyCleared)
    } catch {
      setMessage('操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="settings-shell">
      <section className="settings-window">
        <div className="settings-panel__header">
          <strong>{text.settingsTitle}</strong>
        </div>
        <section className="settings-startup" aria-labelledby="autostart-label">
          <div className="settings-toggle-row">
            <div>
              <strong id="autostart-label">开机自动启动</strong>
              <p className="settings-hint">登录电脑后自动运行，驻留系统托盘。</p>
            </div>
            <button
              type="button"
              role="switch"
              className="settings-switch"
              aria-labelledby="autostart-label"
              aria-describedby="autostart-status"
              aria-checked={autostartEnabled === true}
              aria-busy={autostartLoading || autostartSaving}
              disabled={!desktopRuntime || autostartLoading || autostartSaving || autostartEnabled === null}
              onClick={() => void toggleAutostart()}
            >
              <span />
            </button>
          </div>
          <p className="settings-startup-status" id="autostart-status" role="status">
            {!desktopRuntime
              ? '浏览器预览不可用，请在桌面应用中设置'
              : autostartSaving ? '正在更新系统启动项…'
              : autostartLoading ? '正在检测系统启动项…'
              : autostartEnabled === null ? '启动状态未知'
              : autostartEnabled ? '已开启，下次登录时自动启动' : '未开启'}
          </p>
          {autostartError && (
            <div className="settings-startup-error" role="alert">
              <span>{autostartError}</span>
              <button type="button" onClick={() => void refreshAutostart()}>重新检测</button>
            </div>
          )}
        </section>
        <label className="settings-field">
          <span>{text.apiKeyLabel}</span>
          <span className="settings-hint">{text.apiKeyHint}</span>
          <input
            type="password"
            autoComplete="off"
            className="settings-input"
            value={apiKey}
            placeholder="请输入 TianAPI Key"
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <div className="settings-actions">
          <button
            className="settings-button"
            disabled={busy}
            onClick={() => void clearApiKey()}
          >
            {text.clear}
          </button>
          <button
            className="settings-button primary"
            disabled={busy}
            onClick={() => void saveApiKey()}
          >
            {text.save}
          </button>
          <button
            className="settings-button"
            disabled={busy || autostartSaving}
            onClick={() => void desktopApi.closeCurrentWindow()}
          >
            {text.close}
          </button>
        </div>
        {message && (
          <p className="settings-feedback" role="status">
            {message}
          </p>
        )}
      </section>
    </main>
  )
}
