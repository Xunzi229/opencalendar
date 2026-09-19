import React, { useEffect, useState } from 'react'
import { desktopApi } from './api/desktop'
import { text } from './calendar'

export function SettingsApp(): React.ReactElement {
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

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
          <span>{text.apiKeyHint}</span>
        </div>
        <label className="settings-field">
          <span>{text.apiKeyLabel}</span>
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
            disabled={busy}
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
