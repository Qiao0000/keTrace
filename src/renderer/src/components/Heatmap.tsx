interface Props {
  data: { dates?: string[]; days: string[]; topApps?: string[]; hours: number[]; grid: number[][] };
}

interface CalendarDay {
  date: string;
  weekday: string;
  topApp: string;
  minutes: number;
}

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function cellLevel(minutes: number, maxMinutes: number): number {
  if (minutes <= 0 || maxMinutes <= 0) return 0;
  const ratio = minutes / maxMinutes;
  if (ratio < 0.2) return 1;
  if (ratio < 0.45) return 2;
  if (ratio < 0.7) return 3;
  return 4;
}

function fmtMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}小时${mins}分` : `${hours}小时`;
}

function fmtShortDate(date: string): string {
  return date.slice(5);
}

function dayNumber(date: string): string {
  return String(Number(date.slice(8, 10)));
}

function monthLabel(days: CalendarDay[]): string {
  if (days.length === 0) return "";
  const first = days[0].date.slice(0, 7);
  const last = days[days.length - 1].date.slice(0, 7);
  return first === last ? first : `${first} / ${last}`;
}

function weekdayIndex(date: string): number {
  const day = new Date(`${date}T00:00:00`).getDay();
  return (day + 6) % 7;
}

export function Heatmap({ data }: Props) {
  const dates = data.dates && data.dates.length === data.grid.length
    ? data.dates
    : data.grid.map((_, i) => data.days[i] ?? "");

  const calendarDays: CalendarDay[] = data.grid.map((row, i) => ({
    date: dates[i],
    weekday: data.days[i] ?? "",
    topApp: data.topApps?.[i] ?? "",
    minutes: Math.round(row.reduce((sum, value) => sum + value, 0)),
  }));

  if (calendarDays.length === 0) return null;

  const maxMinutes = Math.max(...calendarDays.map((d) => d.minutes), 0);
  const leadingBlanks = dates[0] && /^\d{4}-\d{2}-\d{2}$/.test(dates[0]) ? weekdayIndex(dates[0]) : 0;
  const isMonthView = calendarDays.length > 10;

  return (
    <div className="calendar-heatmap">
      <div className="calendar-heatmap-head">
        <div>
          <div className="calendar-heatmap-title">{isMonthView ? "月度日历" : "本周日历"}</div>
          <div className="text-muted">{monthLabel(calendarDays)}</div>
        </div>
        <div className="calendar-heatmap-legend">
          <span>少</span>
          {[0, 1, 2, 3, 4].map((lv) => (
            <span key={lv} className={`calendar-day-swatch hlv${lv}`} />
          ))}
          <span>多</span>
        </div>
      </div>

      {isMonthView && (
        <div className="calendar-weekdays">
          {WEEKDAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
      )}

      <div className={isMonthView ? "calendar-grid month" : "calendar-grid week"}>
        {isMonthView && Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} className="calendar-day blank" />
        ))}
        {calendarDays.map((day) => {
          const level = cellLevel(day.minutes, maxMinutes);
          return (
            <div
              key={day.date}
              className={`calendar-day hlv${level} ${day.date === new Date().toISOString().slice(0, 10) ? "today" : ""}`}
              title={`${day.date} ${day.weekday} · ${fmtMinutes(day.minutes)}${day.topApp ? ` · ${day.topApp}` : ""}`}
            >
              <span className="calendar-day-main">
                <span className="calendar-day-number">{dayNumber(day.date)}</span>
                <span className="calendar-day-date">{fmtShortDate(day.date)}</span>
                {day.topApp && <span className="calendar-day-app">{day.topApp}</span>}
              </span>
              <span className="calendar-day-minutes">{day.minutes > 0 ? fmtMinutes(day.minutes) : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
