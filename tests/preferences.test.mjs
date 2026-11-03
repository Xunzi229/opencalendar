import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/renderer/src/preferences.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const { parsePreferences, readPreferences, savePreferences, preferencesKey } =
  await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  )

test('显示设置兼容旧数据、损坏缓存和无效字段', () => {
  for (const raw of [null, 'broken', 'null', '42', '[]', '{}']) {
    assert.deepEqual(parsePreferences(raw), {
      showLunar: true,
      showBadges: true,
    })
  }
  assert.deepEqual(
    parsePreferences('{"showLunar":false,"showBadges":"false"}'),
    { showLunar: false, showBadges: true },
  )
})

test('单项设置保留其他选项，保存成功才广播更新', () => {
  const originalWindow = globalThis.window
  const entries = new Map([
    [preferencesKey, '{"showLunar":false,"showBadges":true}'],
  ])
  const notifications = []
  globalThis.window = {
    localStorage: {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
    },
    dispatchEvent: (event) => notifications.push(event.type),
  }
  try {
    savePreferences({ showBadges: false })
    assert.deepEqual(readPreferences(), { showLunar: false, showBadges: false })
    assert.deepEqual(notifications, ['calendar-preferences-changed'])
    globalThis.window.localStorage.setItem = () => {
      throw new Error('Storage unavailable')
    }
    assert.throws(
      () => savePreferences({ showLunar: true }),
      /Storage unavailable/,
    )
    assert.deepEqual(readPreferences(), { showLunar: false, showBadges: false })
    assert.equal(notifications.length, 1)
  } finally {
    globalThis.window = originalWindow
  }
})

test('无法读取本地存储时月历仍可使用默认设置', () => {
  const originalWindow = globalThis.window
  globalThis.window = {
    get localStorage() {
      throw new Error('Access denied')
    },
  }
  try {
    assert.deepEqual(readPreferences(), { showLunar: true, showBadges: true })
  } finally {
    globalThis.window = originalWindow
  }
})
