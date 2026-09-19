import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/renderer/src/calendar.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const { getHolidayRange, addMonths, buildHolidayMap, buildMonthDays, getCountdown, getLunarDate, parseDate } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('农历使用真实日期，正确显示春节、中秋及闰月', () => {
  assert.deepEqual(getLunarDate(parseDate('2026-02-17')), { month: '正月', day: '初一', label: '正月' })
  assert.equal(getLunarDate(parseDate('2026-09-25')).day, '十五')
  assert.equal(getLunarDate(parseDate('2026-09-25')).month, '八月')
  assert.equal(getLunarDate(parseDate('2025-07-25')).month, '闰六月')
})

test('月份切换正确跨年', () => {
  assert.deepEqual(addMonths(2026, 12, 1), { year: 2027, month: 1 })
  assert.deepEqual(addMonths(2026, 1, -1), { year: 2025, month: 12 })
})

test('月历以周一开始并包含闰年二月二十九日', () => {
  const days = buildMonthDays(2024, 2, {}, parseDate('2024-02-29'))
  assert.equal(days.length, 42)
  assert.equal(days[0].date.getDay(), 1)
  assert.equal(days.filter(day => day.isCurrentMonth).length, 29)
  assert.equal(days.find(day => day.isToday).key, '2024-02-29')
})

test('跨年网格中的休息日和补班日保留标记', () => {
  const days = buildMonthDays(2025, 12, buildHolidayMap(2026), parseDate('2025-12-31'))
  assert.equal(days.find(day => day.key === '2026-01-01').badge, 'rest')
  assert.equal(days.find(day => day.key === '2026-01-04').badge, 'work')
})

test('倒计时区分假期中、即将放假和没有安排', () => {
  const holidays = buildHolidayMap(2026)
  assert.equal(getCountdown(parseDate('2026-09-19'), holidays).days, 6)
  assert.equal(getCountdown(parseDate('2026-09-25'), holidays).days, 0)
  assert.equal(getCountdown(parseDate('2026-12-31'), holidays), null)
  assert.equal(getCountdown(parseDate('2027-01-01'), {}), null)
})

test('倒计时按自然日计算，跨夏令时仍是一天', () => {
  const oldTimezone = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    const holidays = { '2026-11-02': { name: '测试假期', kind: 'holiday', badge: 'rest' } }
    assert.equal(getCountdown(parseDate('2026-11-01'), holidays).days, 1)
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ
    else process.env.TZ = oldTimezone
  }
})

test('当天中午仍属于假期，跨午夜后按新日期重新计算', () => {
  const holidays = buildHolidayMap(2026)
  assert.equal(getCountdown(new Date(2026, 8, 24, 23, 59), holidays).days, 1)
  assert.equal(getCountdown(new Date(2026, 8, 25, 12, 30), holidays).days, 0)
  assert.equal(getCountdown(new Date(2026, 8, 28, 0, 0), holidays).days, 3)
})

test('年底倒计时使用下一年的已公布假期', () => {
  const holidays = { ...buildHolidayMap(2025), ...buildHolidayMap(2026) }
  assert.deepEqual(getCountdown(new Date(2025, 11, 31, 18), holidays), { name: '2026年元旦', days: 1 })
})

test('远程年度安排同时驱动休班标记、假期跳转和倒计时', () => {
  const ranges = [{ key: 'national-day', name: '国庆节、中秋节', startDate: '2030-10-01', endDate: '2030-10-03', workdays: ['2030-09-29'] }]
  const map = buildHolidayMap(2030, ranges)
  assert.equal(map['2030-09-29'].badge, 'work')
  assert.equal(map['2030-10-02'].badge, 'rest')
  assert.equal(getHolidayRange(2030, 'national-day', ranges).startDate, '2030-10-01')
  assert.equal(getHolidayRange(2030, 'mid-autumn', ranges).startDate, '2030-10-01')
  assert.equal(getCountdown(parseDate('2030-09-28'), map).days, 3)
})
