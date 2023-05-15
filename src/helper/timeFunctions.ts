export const timeToTimestamp = (time: string) => {
  const d = new Date(time)
  return new Date(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
      d.getMilliseconds(),
    ),
  )
}

export const timeToLocal = (
  originalTime: string,
  timezone?: string | undefined,
) => {
  return new Date(originalTime)
    .toLocaleString('en-US', { timeZone: timezone })
    .split(',')[0]
}

export const convertDate = (date: string | Date, timeZone: string | null) => {
  return typeof date === 'string'
    ? new Date(
        new Date(date).toLocaleString('en-US', {
          timeZone: timeZone || undefined,
        }),
      )
    : new Date(
        date.toLocaleString('en-US', {
          timeZone: timeZone || undefined,
        }),
      )
}

const padTo2Digits = (num: number) => {
  return num.toString().padStart(2, '0')
}

export const formatDate = (date: Date) => {
  return [
    padTo2Digits(date.getMonth() + 1),
    padTo2Digits(date.getDate()),
    date.getFullYear(),
  ].join('/')
}

export function getDateOfWeek(week: string, weekStart?: string): string
export function getDateOfWeek(
  week: string,
  weekStart?: string,
  returnDate?: true,
): Date
export function getDateOfWeek(
  week: string,
  weekStart = 'm',
  returnDate = false,
) {
  const [y, w] = week.split('-').map((v) => Number(v))
  const firstDay = new Date(y, 0, 0).getDay()
  let d = (w + 1) * 7 - firstDay
  if (weekStart === 's') d -= 1
  const date = new Date(y, 0, d)
  if (returnDate) {
    return date
  }
  return formatDate(date)
}

export const getDateOfMonth = (month: string) => {
  const [y, m] = month.split('-').map((v) => Number(v))

  return new Date(y, m - 1, 1)
}

export const getTimezoneOffset = (
  timeZone: string | undefined,
  date = new Date(),
) => {
  const tz = date
    .toLocaleString('en', { timeZone, timeStyle: 'long' })
    .split(' ')
    .slice(-1)[0]
  const dateString = date.toString()
  const offset =
    Date.parse(`${dateString} UTC`) - Date.parse(`${dateString} ${tz}`)

  return offset
}

export const friendlyTime = (time: number) => {
  const res = {
    d: '',
    h: '',
    min: '',
    s: '',
  }

  if (time > 0) {
    let count: number
    count = Math.floor(time / (24 * 60 * 60 * 1000))
    if (count >= 1) {
      res.d = `${count}`
    }
    count = Math.floor(time / (60 * 60 * 1000))
    if (count >= 1) {
      res.h = `${count % 24}`
    }
    count = Math.floor(time / (60 * 1000))
    if (count >= 1) {
      res.min = `${count % 60}`
    }
    if (res.d === '' && res.h === '' && res.min === '') {
      res.s = `${Math.floor(time / 1000)}`
    }
    return res
  }
  if (time === 0) {
    return { ...res, s: '0' }
  }
  return res
}
