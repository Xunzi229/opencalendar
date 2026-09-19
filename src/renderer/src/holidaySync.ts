import type { HolidayRange } from './calendar'

export const HOLIDAY_SOURCE =
  'https://raw.githubusercontent.com/lanceliao/china-holiday-calender/master/holidayAPI.json'
const CACHE_KEY = 'calendar.holidays.v1'
type Years = Record<number, HolidayRange[]>
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
export interface HolidaySnapshot {
  years: Years
  checkedAt: string | null
  updatedAt: string | null
  status: 'idle' | 'ready' | 'offline'
  persisted: boolean
}

const names: Array<[string, HolidayRange['key']]> = [
  ['元旦', 'new-year'],
  ['春节', 'spring-festival'],
  ['清明', 'qingming'],
  ['劳动', 'labor-day'],
  ['端午', 'dragon-boat'],
  ['中秋', 'mid-autumn'],
  ['国庆', 'national-day'],
]

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T00:00:00Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

function officialUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'gov.cn' || url.hostname.endsWith('.gov.cn'))
    )
  } catch {
    return false
  }
}

// Reject a whole year if any range is malformed: never display a partial workday schedule.
export function parseHolidayFeed(input: unknown): Years {
  const raw = (input as { Years?: unknown } | null)?.Years
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Invalid holiday feed')
  const years: Years = {}
  for (const [yearText, groups] of Object.entries(raw)) {
    const year = Number(yearText)
    if (
      !/^\d{4}$/.test(yearText) ||
      year < 2000 ||
      year > 2200 ||
      !Array.isArray(groups) ||
      groups.length === 0 ||
      groups.length > 20
    )
      continue
    const ranges: HolidayRange[] = []
    let valid = true
    const occupied = new Set<string>()
    for (const group of groups) {
      const key =
        typeof group?.Name === 'string'
          ? names.find(([name]) => group.Name.includes(name))?.[1]
          : undefined
      const {
        StartDate: start,
        EndDate: end,
        CompDays: work = [],
        URL: url,
      } = group ?? {}
      if (
        !key ||
        !validDate(start) ||
        !validDate(end) ||
        !officialUrl(url) ||
        !Array.isArray(work) ||
        work.length > 15 ||
        work.some(
          (date) =>
            !validDate(date) || Math.abs(Number(date.slice(0, 4)) - year) > 1,
        ) ||
        Math.abs(Number(start.slice(0, 4)) - year) > 1 ||
        Number(end.slice(0, 4)) !== year ||
        end < start ||
        (Date.parse(end) - Date.parse(start)) / 86400000 > 15
      ) {
        valid = false
        break
      }
      const dates = [...work]
      for (
        let time = Date.parse(start);
        time <= Date.parse(end);
        time += 86400000
      )
        dates.push(new Date(time).toISOString().slice(0, 10))
      for (const date of dates) {
        if (occupied.has(date)) valid = false
        occupied.add(date)
      }
      if (!valid) break
      ranges.push({
        key,
        name: group.Name,
        startDate: start,
        endDate: end,
        workdays: work,
        sourceUrl: url,
      })
    }
    if (valid) years[year] = ranges
  }
  if (Object.keys(years).length === 0)
    throw new Error('No validated holiday data')
  return years
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function createHolidaySync(
  storage: StoragePort,
  fetcher: typeof fetch = fetch,
  now: () => Date = () => new Date(),
) {
  let snapshot: HolidaySnapshot = {
    years: {},
    checkedAt: null,
    updatedAt: null,
    status: 'idle',
    persisted: true,
  }
  let feed: unknown = null
  let pending: Promise<HolidaySnapshot> | null = null
  try {
    const saved = JSON.parse(storage.getItem(CACHE_KEY) ?? 'null')
    if (saved) {
      feed = saved.feed
      const timestamp = (value: unknown) =>
        typeof value === 'string' && Number.isFinite(Date.parse(value))
          ? value
          : null
      snapshot = {
        years: feed ? parseHolidayFeed(feed) : {},
        checkedAt: timestamp(saved.checkedAt),
        updatedAt: timestamp(saved.updatedAt),
        status:
          saved.status === 'offline' ? 'offline' : feed ? 'ready' : 'idle',
        persisted: true,
      }
    }
  } catch {
    /* A corrupt/unavailable cache must not prevent opening the calendar. */
  }

  const persist = () => {
    try {
      storage.setItem(
        CACHE_KEY,
        JSON.stringify({
          feed,
          checkedAt: snapshot.checkedAt,
          updatedAt: snapshot.updatedAt,
          status: snapshot.status,
        }),
      )
      snapshot.persisted = true
    } catch {
      snapshot.persisted = false
    }
  }

  return {
    read: () => snapshot,
    check(): Promise<HolidaySnapshot> {
      if (pending) return pending
      const current = now()
      if (
        snapshot.checkedAt &&
        dayKey(new Date(snapshot.checkedAt)) === dayKey(current)
      )
        return Promise.resolve(snapshot)
      // Persist attempts before networking, including failed attempts and application restarts.
      snapshot = { ...snapshot, checkedAt: current.toISOString() }
      persist()
      pending = (async () => {
        try {
          const response = await fetcher(HOLIDAY_SOURCE, {
            signal: AbortSignal.timeout(10000),
            cache: 'no-store',
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const nextFeed: unknown = await response.json()
          const nextYears = parseHolidayFeed(nextFeed)
          // Preserve previously validated years omitted by an upstream response.
          const oldYears =
            (feed as { Years?: Record<string, unknown> } | null)?.Years ?? {}
          const incoming = (nextFeed as { Years: Record<string, unknown> })
            .Years
          feed = {
            Years: {
              ...oldYears,
              ...Object.fromEntries(
                Object.keys(nextYears).map((year) => [year, incoming[year]]),
              ),
            },
          }
          snapshot = {
            ...snapshot,
            years: parseHolidayFeed(feed),
            updatedAt: current.toISOString(),
            status: 'ready',
          }
        } catch {
          snapshot = { ...snapshot, status: 'offline' }
        }
        persist()
        return snapshot
      })().finally(() => {
        pending = null
      })
      return pending
    },
  }
}

// Lazy storage access keeps private-mode storage errors inside the recoverable path.
export const holidaySync = createHolidaySync({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
})
