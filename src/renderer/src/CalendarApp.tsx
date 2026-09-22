import React, { useEffect, useMemo, useRef, useState } from 'react'
import { desktopApi } from './api/desktop'
import { holidaySync } from './holidaySync'
import type { AlmanacRecord } from '../../shared/almanac/types'
import type { ClockSnapshot } from '../../shared/clock/types'

import {
  text,
  holidayRangesByYear,
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
} from './calendar'
import type { CalendarDay, HolidayKey } from './calendar'

export function CalendarApp(): React.ReactElement {
  const calendarWindowRef = useRef<HTMLElement | null>(null)
  const lastClockSnapshotRef = useRef<ClockSnapshot | null>(null)
  const [holidayData, setHolidayData] = useState(() => holidaySync.read())
  const [now, setNow] = useState(() => new Date())
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayKey>('all')
  const [statusMessage, setStatusMessage] = useState('')
  const [yearMenuOpen, setYearMenuOpen] = useState(false)
  const [monthMenuOpen, setMonthMenuOpen] = useState(false)
  const [holidayMenuOpen, setHolidayMenuOpen] = useState(false)
  const [yearWindow, setYearWindow] = useState({
    start: currentYear - 4,
    end: currentYear + 6,
  })
  const [almanacRecord, setAlmanacRecord] = useState<AlmanacRecord | null>(null)
  const [almanacRevision, setAlmanacRevision] = useState(0)
  const previousTodayKeyRef = useRef(formatDate(now))

  const availableYears = useMemo(
    () => ({ ...holidayRangesByYear, ...holidayData.years }),
    [holidayData.years],
  )
  const todayKey = formatDate(now)
  useEffect(() => {
    let active = true
    const check = () => {
      if (document.visibilityState === 'hidden') return
      void holidaySync.check().then((data) => {
        if (active) {
          setHolidayData({ ...data })
        }
      })
    }
    check()
    document.addEventListener('visibilitychange', check)
    const unsubscribe = desktopApi.onCalendarShown(check)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', check)
      unsubscribe()
    }
  }, [todayKey])

  const holidayMap = useMemo(
    () => ({
      ...buildHolidayMap(viewYear - 1, availableYears[viewYear - 1]),
      ...buildHolidayMap(viewYear, availableYears[viewYear]),
      ...buildHolidayMap(viewYear + 1, availableYears[viewYear + 1]),
    }),
    [viewYear, availableYears],
  )
  const days = useMemo(
    () => buildMonthDays(viewYear, viewMonth, holidayMap, now),
    [holidayMap, now, viewMonth, viewYear],
  )
  const selectedHolidayMap = useMemo(
    () => ({
      ...buildHolidayMap(
        selectedDate.getFullYear(),
        availableYears[selectedDate.getFullYear()],
      ),
      ...buildHolidayMap(
        selectedDate.getFullYear() + 1,
        availableYears[selectedDate.getFullYear() + 1],
      ),
    }),
    [selectedDate, availableYears],
  )
  const selectedText = getDisplayText(selectedDate, selectedHolidayMap)
  const selectedLunar = getLunarDate(selectedDate)
  const selectedSchedule = selectedHolidayMap[formatDate(selectedDate)]
  const todayYear = now.getFullYear()
  const upcomingHolidayMap = useMemo(
    () => ({
      ...buildHolidayMap(todayYear, availableYears[todayYear]),
      ...buildHolidayMap(todayYear + 1, availableYears[todayYear + 1]),
    }),
    [todayYear, availableYears],
  )
  const countdown = useMemo(
    () => getCountdown(now, upcomingHolidayMap),
    [now, upcomingHolidayMap],
  )
  const visibleYears = useMemo(
    () => buildYearWindow(yearWindow.start, yearWindow.end),
    [yearWindow],
  )

  function jumpToDate(date: Date): void {
    setViewYear(date.getFullYear())
    setViewMonth(date.getMonth() + 1)
    setSelectedDate(
      new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    )
    setSelectedHoliday('all')
    setStatusMessage('')
    ensureYearVisible(date.getFullYear())
  }

  useEffect(() => {
    let cancelled = false
    let pollTimer = 0

    const syncClockSnapshot = (snapshot: ClockSnapshot): void => {
      const previous = lastClockSnapshotRef.current

      if (
        !previous ||
        previous.dateKey !== snapshot.dateKey ||
        previous.timezoneOffset !== snapshot.timezoneOffset ||
        previous.timeZone !== snapshot.timeZone
      ) {
        lastClockSnapshotRef.current = snapshot
        setNow(toClockDate(snapshot))
      }
    }

    void desktopApi.getClockSnapshot().then((snapshot) => {
      if (!cancelled) {
        syncClockSnapshot(snapshot)
      }
    })

    const unsubscribe = desktopApi.onClockChanged((snapshot) => {
      syncClockSnapshot(snapshot)
    })

    pollTimer = window.setInterval(() => {
      void desktopApi.getClockSnapshot().then((snapshot) => {
        if (!cancelled) {
          syncClockSnapshot(snapshot)
        }
      })
    }, 30000)

    return () => {
      cancelled = true
      window.clearInterval(pollTimer)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const selectedDateKey = formatDate(selectedDate)

    const unsubscribe = desktopApi.onAlmanacUpdated((record) => {
      if (record === null) {
        cancelled = true
        setAlmanacRevision((revision) => revision + 1)
      } else if (record.date === selectedDateKey) {
        // A pushed fresh record must not be overwritten by an older cache response.
        cancelled = true
        setAlmanacRecord(record)
      }
    })

    setAlmanacRecord(null)
    void desktopApi
      .getAlmanac(selectedDateKey)
      .then((result) => {
        if (!cancelled) {
          setAlmanacRecord(result.record)
        }
      })
      .catch(() => {
        if (!cancelled) setAlmanacRecord(null)
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [selectedDate, almanacRevision])

  useEffect(() => {
    const preventContextMenu = (event: MouseEvent): void => {
      event.preventDefault()
    }

    document.addEventListener('contextmenu', preventContextMenu)

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [])

  useEffect(() => {
    const target = calendarWindowRef.current

    if (!target) {
      return
    }

    let previousSize = ''
    const reportSize = (): void => {
      const rect = target.getBoundingClientRect()
      const size = {
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      }
      const sizeKey = `${size.width}:${size.height}`
      if (sizeKey === previousSize) return
      previousSize = sizeKey
      void desktopApi.reportCalendarSize(size).catch(() => {
        previousSize = ''
      })
    }

    const observer = new ResizeObserver(() => {
      reportSize()
    })

    observer.observe(target)
    reportSize()

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    return desktopApi.onCalendarShown(() => {
      void desktopApi.getClockSnapshot().then((snapshot) => {
        lastClockSnapshotRef.current = snapshot
        const today = toClockDate(snapshot)
        setNow(today)
        jumpToDate(today)
        setAlmanacRevision((revision) => revision + 1)
      })
    })
  }, [])

  useEffect(() => {
    const previousTodayKey = previousTodayKeyRef.current
    const currentTodayKey = formatDate(now)

    if (previousTodayKey !== currentTodayKey) {
      setSelectedDate((current) =>
        formatDate(current) === previousTodayKey ? new Date(now) : current,
      )

      if (
        viewYear === parseDate(previousTodayKey).getFullYear() &&
        viewMonth === parseDate(previousTodayKey).getMonth() + 1
      ) {
        setViewYear(now.getFullYear())
        setViewMonth(now.getMonth() + 1)
      }
    }

    previousTodayKeyRef.current = currentTodayKey
  }, [now, viewMonth, viewYear])

  function jumpToHoliday(year: number, key: HolidayKey): boolean {
    const range = getHolidayRange(year, key, availableYears[year])

    if (!range) {
      return false
    }

    const date = parseDate(range.startDate)
    setViewYear(date.getFullYear())
    setViewMonth(date.getMonth() + 1)
    setSelectedDate(date)
    setStatusMessage(`${range.name}: ${range.startDate} - ${range.endDate}`)

    return true
  }

  function ensureYearVisible(year: number): void {
    setYearWindow((current) => ({
      start: Math.min(current.start, year - 4),
      end: Math.max(current.end, year + 6),
    }))
  }

  function changeYear(year: number): void {
    setViewYear(year)
    ensureYearVisible(year)
    setYearMenuOpen(false)

    if (selectedHoliday !== 'all' && !jumpToHoliday(year, selectedHoliday)) {
      setStatusMessage(text.noHolidayData)
    }
  }

  function changeMonthValue(month: number): void {
    setViewMonth(month)
    setMonthMenuOpen(false)
    setSelectedHoliday('all')
    setStatusMessage('')
  }

  function handleYearScroll(event: React.UIEvent<HTMLDivElement>): void {
    const target = event.currentTarget
    const nearTop = target.scrollTop < 24
    const nearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 24

    if (nearTop) {
      setYearWindow((current) => ({ ...current, start: current.start - 10 }))
    }

    if (nearBottom) {
      setYearWindow((current) => ({ ...current, end: current.end + 10 }))
    }
  }

  function changeHoliday(key: HolidayKey): void {
    setSelectedHoliday(key)
    setHolidayMenuOpen(false)

    if (key === 'all') {
      setStatusMessage('')
      return
    }

    if (!jumpToHoliday(viewYear, key)) {
      setStatusMessage(text.noHolidayData)
    }
  }

  function changeMonth(delta: number): void {
    const next = addMonths(viewYear, viewMonth, delta)
    setViewYear(next.year)
    setViewMonth(next.month)
    ensureYearVisible(next.year)
    setSelectedHoliday('all')
    setStatusMessage('')
  }

  function jumpToday(): void {
    jumpToDate(now)
  }

  function selectDay(day: CalendarDay): void {
    setSelectedDate(day.date)
    setSelectedHoliday('all')
    setStatusMessage('')

    if (!day.isCurrentMonth) {
      setViewYear(day.date.getFullYear())
      setViewMonth(day.date.getMonth() + 1)
      ensureYearVisible(day.date.getFullYear())
    }
  }

  return (
    <main
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setYearMenuOpen(false)
          setMonthMenuOpen(false)
          setHolidayMenuOpen(false)
        }
      }}
      onClick={() => {
        setYearMenuOpen(false)
        setMonthMenuOpen(false)
        setHolidayMenuOpen(false)
      }}
    >
      <section ref={calendarWindowRef} className="calendar-window">
        <div className="window-heading">
          <div>
            <img
              className="app-mark"
              src={`./date-icons/${now.getDate()}.svg`}
              alt=""
              aria-hidden="true"
            />
            <span>日历</span>
          </div>
          <span className="window-subtitle">农历 · 节假日</span>
        </div>
        <header className="toolbar">
          <div
            className="toolbar-start"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="picker holiday-picker">
              <button
                aria-expanded={holidayMenuOpen}
                aria-label={text.allHolidays}
                className="control picker-button holiday-control"
                onClick={() => {
                  setHolidayMenuOpen((open) => !open)
                  setYearMenuOpen(false)
                  setMonthMenuOpen(false)
                }}
              >
                <span>
                  {holidayOptions.find(
                    (option) => option.key === selectedHoliday,
                  )?.label ?? text.allHolidays}
                </span>
                <span className="select-caret" aria-hidden="true" />
              </button>
              {holidayMenuOpen && (
                <div className="picker-menu holiday-menu">
                  {holidayOptions.map((option) => {
                    const disabled =
                      option.key !== 'all' &&
                      !getHolidayRange(
                        viewYear,
                        option.key,
                        availableYears[viewYear],
                      )

                    return (
                      <button
                        key={option.key}
                        className={classNames(
                          'picker-option',
                          option.key === selectedHoliday && 'is-active',
                        )}
                        disabled={disabled}
                        onClick={() => {
                          if (!disabled) {
                            changeHoliday(option.key)
                          }
                        }}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            className="toolbar-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="year-picker">
              <button
                aria-expanded={yearMenuOpen}
                aria-label={text.year}
                className="control year-picker-button"
                onClick={() => {
                  setYearMenuOpen((open) => {
                    if (!open) {
                      const year = now.getFullYear()
                      setYearWindow({ start: year - 4, end: year + 6 })
                    }
                    return !open
                  })
                  setMonthMenuOpen(false)
                  setHolidayMenuOpen(false)
                }}
              >
                <span>
                  {viewYear}
                  {text.year}
                </span>
                <span className="select-caret" aria-hidden="true" />
              </button>
              {yearMenuOpen && (
                <div className="year-menu" onScroll={handleYearScroll}>
                  {visibleYears.map((year) => (
                    <button
                      key={year}
                      className={classNames(
                        'year-option',
                        year === viewYear && 'is-active',
                      )}
                      onClick={() => changeYear(year)}
                    >
                      {year}
                      {text.year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="arrow-button"
              aria-label={text.previousMonth}
              onClick={() => changeMonth(-1)}
            >
              <span className="chevron chevron-left" aria-hidden="true" />
            </button>
            <div className="picker">
              <button
                aria-expanded={monthMenuOpen}
                aria-label={text.month}
                className="control picker-button control-month"
                onClick={() => {
                  setMonthMenuOpen((open) => !open)
                  setYearMenuOpen(false)
                  setHolidayMenuOpen(false)
                }}
              >
                <span>
                  {viewMonth}
                  {text.month}
                </span>
                <span className="select-caret" aria-hidden="true" />
              </button>
              {monthMenuOpen && (
                <div className="picker-menu month-menu">
                  {monthOptions.map((month) => (
                    <button
                      key={month}
                      className={classNames(
                        'picker-option',
                        month === viewMonth && 'is-active',
                      )}
                      onClick={() => changeMonthValue(month)}
                    >
                      {month}
                      {text.month}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="arrow-button"
              aria-label={text.nextMonth}
              onClick={() => changeMonth(1)}
            >
              <span className="chevron" aria-hidden="true" />
            </button>
          </div>

          <button className="today-button" onClick={jumpToday}>
            {text.today}
          </button>
        </header>

        {statusMessage && <div className="status-strip">{statusMessage}</div>}

        <div className="calendar-body">
          <div className="week-grid">
            {weekDays.map((day, index) => (
              <div
                key={day}
                className={classNames('week-day', index > 4 && 'weekend')}
              >
                {day}
              </div>
            ))}
          </div>

          <div className="month-grid">
            {days.map((day) => {
              const isSelected = isSameDate(day.date, selectedDate)

              return (
                <button
                  key={day.key}
                  aria-label={`${day.key} ${day.lunar}${day.badge ? ` ${badgeText(day.badge)}` : ''}`}
                  aria-pressed={isSelected}
                  aria-current={day.isToday ? 'date' : undefined}
                  className={classNames(
                    'day-cell',
                    day.isToday && 'is-today',
                    day.kind === 'muted' && 'is-muted',
                    day.kind === 'holiday' && 'is-holiday',
                    day.kind === 'workday' && 'is-workday',
                    isSelected && 'is-selected',
                  )}
                  onClick={() => selectDay(day)}
                >
                  {day.badge && (
                    <span
                      className={classNames(
                        'day-badge',
                        day.badge === 'rest' && 'badge-rest',
                        day.badge === 'work' && 'badge-work',
                        day.badge === 'today' && 'badge-today',
                      )}
                    >
                      {badgeText(day.badge)}
                    </span>
                  )}
                  <span className="day-number">{day.day}</span>
                  <span className="lunar-text">{day.lunar}</span>
                </button>
              )
            })}
          </div>
        </div>

        <footer className="detail-panel">
          <div className="selection-summary">
            <span>
              {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日{' '}
              <span className="summary-lunar">
                {selectedLunar.month}
                {selectedLunar.day}
              </span>
            </span>
            <span className="summary-festival">
              {selectedSchedule?.kind === 'holiday'
                ? `${selectedSchedule.name} · 放假`
                : selectedSchedule?.kind === 'workday'
                  ? '调休补班'
                  : selectedText !== selectedLunar.label
                    ? selectedText
                    : availableYears[selectedDate.getFullYear()]?.length
                      ? '无特别放假或调休安排'
                      : '放假安排待公布 / 暂未收录'}
            </span>
          </div>
          {almanacRecord && (
            <>
              <div className="festival-links">
                <span>{selectedText}</span>
              </div>

              <article className="almanac-card">
                <div className="lunar-summary">
                  <strong>
                    {almanacRecord.lunarMonthLabel || selectedLunar.month}{' '}
                    {almanacRecord.lunarDayLabel || selectedLunar.day}
                  </strong>
                  <span>
                    {almanacRecord.ganzhiYear ||
                      `${selectedDate.getFullYear()}${text.year}`}{' '}
                    {almanacRecord.zodiac || ''}
                  </span>
                </div>

                <div className="almanac-lines">
                  <p>
                    <span className="almanac-tag tag-good">
                      {text.suitable}
                    </span>
                    {almanacRecord.good}
                  </p>
                  <p>
                    <span className="almanac-tag tag-bad">{text.avoid}</span>
                    {almanacRecord.bad}
                  </p>
                </div>
              </article>
            </>
          )}
          <div className="countdown-line" aria-label="以今天为基准的假期倒计时">
            <span className="countdown-dot" aria-hidden="true" />
            {countdown ? (
              <>
                {countdown.days === 0 ? (
                  `${countdown.name} · 今天是假期`
                ) : (
                  <>
                    {text.distance} {countdown.name} {text.remains}{' '}
                    <strong>{countdown.days}</strong> {text.days}
                  </>
                )}
              </>
            ) : (
              '暂无后续假期安排'
            )}
          </div>
          <details className="holiday-source">
            <summary>数据来源</summary>
            <p>
              {holidayData.years[viewYear]
                ? '节假日数据：开源节假日库'
                : availableYears[viewYear]
                  ? '节假日数据：内置放假安排'
                  : '当前年份暂无放假安排'}
            </p>
            {holidayData.checkedAt && (
              <p>
                检查时间：
                {new Date(holidayData.checkedAt).toLocaleDateString('zh-CN')}
              </p>
            )}
          </details>
        </footer>
      </section>
    </main>
  )
}
