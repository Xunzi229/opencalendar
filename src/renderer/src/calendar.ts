import type { ClockSnapshot } from '../../shared/clock/types'

type DayKind = 'normal' | 'holiday' | 'workday' | 'muted'
type BadgeKind = 'rest' | 'work' | 'today'
type HolidayKey =
  | 'all'
  | 'new-year'
  | 'spring-festival'
  | 'qingming'
  | 'labor-day'
  | 'dragon-boat'
  | 'mid-autumn'
  | 'national-day'

interface CalendarDay {
  date: Date
  day: number
  key: string
  lunar: string
  kind: DayKind
  badge?: BadgeKind
  isCurrentMonth: boolean
  isToday: boolean
}

interface HolidayInfo {
  holidayKey?: HolidayKey
  name: string
  kind: Exclude<DayKind, 'normal' | 'muted'>
  badge: Exclude<BadgeKind, 'today'>
}

interface HolidayOption {
  key: HolidayKey
  label: string
}

interface HolidayRange {
  key: Exclude<HolidayKey, 'all'>
  name: string
  startDate: string
  endDate: string
  workdays?: string[]
}

const text = {
  allHolidays: '\u5047\u671f',
  year: '\u5e74',
  month: '\u6708',
  today: '\u4eca\u5929',
  previousMonth: '\u4e0a\u4e2a\u6708',
  nextMonth: '\u4e0b\u4e2a\u6708',
  rest: '\u4f11',
  work: '\u73ed',
  currentDay: '\u4eca',
  suitable: '\u5b9c',
  avoid: '\u5fcc',
  distance: '\u8ddd\u79bb',
  remains: '\u8fd8\u6709',
  days: '\u5929',
  nextHoliday: '\u4e0b\u4e00\u4e2a\u8282\u65e5',
  noHolidayData:
    '\u5f53\u524d\u5e74\u4efd\u6682\u65e0\u8be5\u8282\u5047\u65e5\u6570\u636e',
  zodiacHorse: '\u9a6c',
  settingsTitle: '\u914d\u7f6e TianAPI Key',
  apiKeyLabel: 'TianAPI Key',
  save: '\u4fdd\u5b58',
  clear: '\u6e05\u9664',
  close: '\u5173\u95ed',
  apiKeySaved: 'TianAPI Key \u5df2\u4fdd\u5b58',
  apiKeyCleared: 'TianAPI Key \u5df2\u6e05\u9664',
  apiKeyHint:
    '\u672a\u914d\u7f6e\u6216 Key \u5931\u6548\u65f6\uff0c\u9ec4\u5386\u9762\u677f\u4f1a\u81ea\u52a8\u9690\u85cf\u3002',
}

const weekDays = [
  '\u4e00',
  '\u4e8c',
  '\u4e09',
  '\u56db',
  '\u4e94',
  '\u516d',
  '\u65e5',
]
const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)
const currentYear = new Date().getFullYear()

const holidayOptions: HolidayOption[] = [
  { key: 'all', label: text.allHolidays },
  { key: 'new-year', label: '\u5143\u65e6' },
  { key: 'spring-festival', label: '\u6625\u8282' },
  { key: 'qingming', label: '\u6e05\u660e\u8282' },
  { key: 'labor-day', label: '\u52b3\u52a8\u8282' },
  { key: 'dragon-boat', label: '\u7aef\u5348\u8282' },
  { key: 'mid-autumn', label: '\u4e2d\u79cb\u8282' },
  { key: 'national-day', label: '\u56fd\u5e86\u8282' },
]

const holidayRangesByYear: Record<number, HolidayRange[]> = {
  2026: [
    {
      key: 'new-year',
      name: '\u5143\u65e6',
      startDate: '2026-01-01',
      endDate: '2026-01-03',
      workdays: ['2026-01-04'],
    },
    {
      key: 'spring-festival',
      name: '\u6625\u8282',
      startDate: '2026-02-15',
      endDate: '2026-02-23',
      workdays: ['2026-02-14', '2026-02-28'],
    },
    {
      key: 'qingming',
      name: '\u6e05\u660e',
      startDate: '2026-04-04',
      endDate: '2026-04-06',
    },
    {
      key: 'labor-day',
      name: '\u52b3\u52a8\u8282',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      workdays: ['2026-05-09'],
    },
    {
      key: 'dragon-boat',
      name: '\u7aef\u5348\u8282',
      startDate: '2026-06-19',
      endDate: '2026-06-21',
    },
    {
      key: 'mid-autumn',
      name: '\u4e2d\u79cb\u8282',
      startDate: '2026-09-25',
      endDate: '2026-09-27',
    },
    {
      key: 'national-day',
      name: '\u56fd\u5e86\u8282',
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      workdays: ['2026-09-20', '2026-10-10'],
    },
  ],
}

const festivalMap: Record<string, string> = {
  '01-01': '\u5143\u65e6',
  '02-14': '\u60c5\u4eba\u8282',
  '03-08': '\u5987\u5973\u8282',
  '03-12': '\u690d\u6811\u8282',
  '04-01': '\u611a\u4eba\u8282',
  '04-22': '\u5730\u7403\u65e5',
  '05-01': '\u52b3\u52a8\u8282',
  '05-04': '\u9752\u5e74\u8282',
  '06-01': '\u513f\u7ae5\u8282',
  '09-10': '\u6559\u5e08\u8282',
  '10-01': '\u56fd\u5e86\u8282',
  '12-25': '\u5723\u8bde\u8282',
}

const lunarDayNames = [
  '\u521d\u4e00',
  '\u521d\u4e8c',
  '\u521d\u4e09',
  '\u521d\u56db',
  '\u521d\u4e94',
  '\u521d\u516d',
  '\u521d\u4e03',
  '\u521d\u516b',
  '\u521d\u4e5d',
  '\u521d\u5341',
  '\u5341\u4e00',
  '\u5341\u4e8c',
  '\u5341\u4e09',
  '\u5341\u56db',
  '\u5341\u4e94',
  '\u5341\u516d',
  '\u5341\u4e03',
  '\u5341\u516b',
  '\u5341\u4e5d',
  '\u4e8c\u5341',
  '\u5eff\u4e00',
  '\u5eff\u4e8c',
  '\u5eff\u4e09',
  '\u5eff\u56db',
  '\u5eff\u4e94',
  '\u5eff\u516d',
  '\u5eff\u4e03',
  '\u5eff\u516b',
  '\u5eff\u4e5d',
  '\u4e09\u5341',
  '\u521d\u4e00',
]

const lunarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  month: 'long',
  day: 'numeric',
})

function getLunarDate(date: Date): {
  month: string
  day: string
  label: string
} {
  const parts = lunarFormatter.formatToParts(date)
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const dayNumber = Number(parts.find((part) => part.type === 'day')?.value)
  const day = lunarDayNames[dayNumber - 1] ?? ''
  return { month, day, label: dayNumber === 1 ? month : day }
}

function classNames(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(' ')
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatMonthDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${month}-${day}`
}

function parseDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function isSameDate(left: Date, right: Date): boolean {
  return formatDate(left) === formatDate(right)
}

function getMondayFirstWeekday(date: Date): number {
  return (date.getDay() + 6) % 7
}

function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1)

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  }
}

function eachDate(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const cursor = parseDate(startDate)
  const end = parseDate(endDate)

  while (cursor <= end) {
    dates.push(formatDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function buildHolidayMap(year: number): Record<string, HolidayInfo> {
  const result: Record<string, HolidayInfo> = {}

  for (const range of holidayRangesByYear[year] ?? []) {
    for (const date of eachDate(range.startDate, range.endDate)) {
      result[date] = {
        holidayKey: range.key,
        name: range.name,
        kind: 'holiday',
        badge: 'rest',
      }
    }

    for (const date of range.workdays ?? []) {
      result[date] = {
        holidayKey: range.key,
        name: '\u8865\u73ed',
        kind: 'workday',
        badge: 'work',
      }
    }
  }

  return result
}

function getHolidayRange(
  year: number,
  key: HolidayKey,
): HolidayRange | undefined {
  if (key === 'all') {
    return undefined
  }

  return holidayRangesByYear[year]?.find((range) => range.key === key)
}

function getDisplayText(
  date: Date,
  holidayMap: Record<string, HolidayInfo>,
): string {
  const fullDate = formatDate(date)
  const monthDay = formatMonthDay(date)

  return (
    holidayMap[fullDate]?.name ??
    festivalMap[monthDay] ??
    getLunarDate(date).label
  )
}

function buildMonthDays(
  year: number,
  month: number,
  holidayMap: Record<string, HolidayInfo>,
  today: Date,
): CalendarDay[] {
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = getMondayFirstWeekday(firstDay)
  const gridStart = new Date(year, month - 1, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)

    const fullDate = formatDate(date)
    const info = holidayMap[fullDate]
    const isCurrentMonth = date.getMonth() === month - 1
    const isToday = isSameDate(date, today)
    const kind: DayKind = !isCurrentMonth ? 'muted' : (info?.kind ?? 'normal')

    return {
      date,
      day: date.getDate(),
      key: fullDate,
      lunar: getDisplayText(date, holidayMap),
      kind,
      badge: isToday ? 'today' : info?.badge,
      isCurrentMonth,
      isToday,
    }
  })
}

function getCountdown(
  selectedDate: Date,
  holidayMap: Record<string, HolidayInfo>,
): { name: string; days: number } | null {
  const candidates = Object.entries(holidayMap)
    .filter(([, info]) => info.kind === 'holiday')
    .map(([date, info]) => ({
      date: parseDate(date),
      name: info.name,
    }))
    .filter((item) => item.date >= parseDate(formatDate(selectedDate)))
    .sort((left, right) => left.date.getTime() - right.date.getTime())

  const next = candidates[0]

  if (!next) {
    return null
  }

  const diff =
    Date.UTC(
      next.date.getFullYear(),
      next.date.getMonth(),
      next.date.getDate(),
    ) -
    Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    )

  return {
    name: `${next.date.getFullYear()}${text.year}${next.name}`,
    days: Math.ceil(diff / 86400000),
  }
}

function badgeText(badge: BadgeKind): string {
  if (badge === 'rest') {
    return text.rest
  }

  if (badge === 'work') {
    return text.work
  }

  return text.currentDay
}

function buildYearWindow(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

function toClockDate(snapshot: ClockSnapshot): Date {
  return new Date(snapshot.iso)
}

export type { CalendarDay, HolidayKey }
export {
  text,
  weekDays,
  monthOptions,
  currentYear,
  holidayOptions,
  classNames,
  formatDate,
  parseDate,
  isSameDate,
  addMonths,
  buildHolidayMap,
  getHolidayRange,
  getDisplayText,
  buildMonthDays,
  getCountdown,
  badgeText,
  buildYearWindow,
  toClockDate,
  getLunarDate,
}
