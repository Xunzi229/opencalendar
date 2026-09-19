import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/renderer/src/holidaySync.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const { createHolidaySync, parseHolidayFeed } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const group = {
  Name: '元旦',
  StartDate: '2026-01-01',
  EndDate: '2026-01-03',
  Duration: 3,
  CompDays: ['2026-01-04'],
  URL: 'https://www.gov.cn/zhengce/content/202511/content_7047090.htm',
}
const feed = { Years: { 2026: [group] } }
function storage() {
  const data = new Map()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  }
}
const response = (value) => ({ ok: true, json: async () => value })

test('解析放假区间、补班日期与政府通知链接', () => {
  const range = parseHolidayFeed(feed)[2026][0]
  assert.equal(range.key, 'new-year')
  assert.deepEqual(range.workdays, ['2026-01-04'])
  assert.equal(range.sourceUrl, group.URL)
})

test('拒绝错误日期、冲突安排和伪造政府域名', () => {
  for (const override of [
    { StartDate: '2026-02-30' },
    { EndDate: '2026-02-01' },
    { CompDays: ['2026-01-02'] },
    { CompDays: ['not-a-date'] },
    { URL: 'https://gov.cn.example.com/notice' },
    { Name: '预测假期' },
  ])
    assert.throws(() =>
      parseHolidayFeed({ Years: { 2026: [{ ...group, ...override }] } }),
    )
  assert.throws(() =>
    parseHolidayFeed({
      Years: { 2026: [group, { ...group, EndDate: 'broken' }] },
    }),
  )
})

test('并发与同日重复调用仅检查一次，重启后仍受限制', async () => {
  const store = storage()
  let calls = 0
  const request = async () => {
    calls++
    return response(feed)
  }
  let date = new Date(2026, 8, 19, 10)
  const sync = createHolidaySync(store, request, () => date)
  const [first, second] = await Promise.all([sync.check(), sync.check()])
  assert.equal(calls, 1)
  assert.equal(first.status, 'ready')
  assert.deepEqual(first, second)
  await sync.check()
  const restarted = createHolidaySync(store, request, () => date)
  assert.equal(restarted.read().years[2026][0].name, '元旦')
  await restarted.check()
  assert.equal(calls, 1)
  date = new Date(2026, 8, 20, 1)
  await restarted.check()
  assert.equal(calls, 2)
})

test('断网保留成功缓存，失败当天包括重启不再联网', async () => {
  const store = storage()
  let date = new Date(2026, 8, 19)
  let calls = 0
  const request = async () => {
    calls++
    if (calls > 1) throw Error('offline')
    return response(feed)
  }
  const sync = createHolidaySync(store, request, () => date)
  const success = await sync.check()
  date = new Date(2026, 8, 20)
  const failure = await sync.check()
  assert.equal(failure.status, 'offline')
  assert.deepEqual(failure.years, success.years)
  assert.equal(failure.updatedAt, success.updatedAt)
  const restarted = createHolidaySync(store, request, () => date)
  await restarted.check()
  assert.equal(calls, 2)
  assert.equal(restarted.read().status, 'offline')
})

test('新增年份不删除旧年份，无效更新不覆盖缓存', async () => {
  const store = storage()
  let date = new Date(2026, 8, 19)
  let data = feed
  const sync = createHolidaySync(
    store,
    async () => response(data),
    () => date,
  )
  await sync.check()
  date = new Date(2026, 8, 20)
  data = {
    Years: {
      2027: [
        {
          ...group,
          StartDate: '2027-01-01',
          EndDate: '2027-01-03',
          CompDays: [],
        },
      ],
    },
  }
  const added = await sync.check()
  assert.deepEqual(Object.keys(added.years), ['2026', '2027'])
  date = new Date(2026, 8, 21)
  data = { Years: {} }
  const invalid = await sync.check()
  assert.equal(invalid.status, 'offline')
  assert.deepEqual(invalid.years, added.years)
})

test('缓存损坏可恢复，存储不可写时提示且保持会话内限频', async () => {
  const corrupt = { getItem: () => '{broken', setItem: () => {} }
  const sync = createHolidaySync(corrupt, async () => response(feed))
  assert.deepEqual(sync.read().years, {})
  assert.equal((await sync.check()).status, 'ready')
  let calls = 0
  const unavailable = {
    getItem: () => {
      throw Error('denied')
    },
    setItem: () => {
      throw Error('denied')
    },
  }
  const fallback = createHolidaySync(unavailable, async () => {
    calls++
    return response(feed)
  })
  assert.equal((await fallback.check()).persisted, false)
  await fallback.check()
  assert.equal(calls, 1)
})
