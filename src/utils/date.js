export function formatDate(date, locale = 'pt-BR') { return new Date(date).toLocaleDateString(locale); }
export function formatTime(date, locale = 'pt-BR') { return new Date(date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }); }
export function toInputDate(date) { return new Date(date).toLocaleDateString('en-CA'); }
export function formatCalendarDate(dateString, locale = 'pt-BR') { if (!dateString) return ''; return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${dateString}T12:00:00`)).toUpperCase(); }
export function isToday(dateString) { return dateString === toInputDate(new Date()); }
export function changeMonth(currentMonth, direction) { const month = new Date(currentMonth); month.setMonth(month.getMonth() + direction); return month; }
export function buildCalendarDays(currentMonth, gamesPerDay = {}) { const year = currentMonth.getFullYear(); const month = currentMonth.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const totalDays = new Date(year, month + 1, 0).getDate(); const days = Array.from({ length: firstDay }, () => null); for (let day = 1; day <= totalDays; day += 1) { const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; days.push({ day, dateString, games: gamesPerDay[dateString] ?? 0 }); } return days; }
export function buildGamesCountMap(matches = []) { return matches.reduce((map, match) => { const date = toInputDate(match.date); map[date] = (map[date] ?? 0) + 1; return map; }, {}); }
