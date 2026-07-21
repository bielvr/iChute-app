export function formatDate(date) {
    return new Date(date).toLocaleDateString("pt-BR");
}

export function formatTime(date) {
    return new Date(date).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function toInputDate(date) {
    return new Date(date).toLocaleDateString("en-CA");
}

export function formatCalendarDate(dateString) {
    if (!dateString) return "";

    const [year, month, day] = dateString.split("-");

    const months = [
        "JAN",
        "FEV",
        "MAR",
        "ABR",
        "MAI",
        "JUN",
        "JUL",
        "AGO",
        "SET",
        "OUT",
        "NOV",
        "DEZ"
    ];

    return `${day} DE ${months[Number(month) - 1]} DE ${year}`;
}

export function isToday(dateString) {
    return dateString === toInputDate(new Date());
}

export function changeMonth(currentMonth, direction) {
    const month = new Date(currentMonth);
    month.setMonth(month.getMonth() + direction);

    return month;
}

export function buildCalendarDays(currentMonth, gamesPerDay = {}) {

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];

    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {

        const monthFormatted = String(month + 1).padStart(2, "0");
        const dayFormatted = String(day).padStart(2, "0");

        const dateString =
            `${year}-${monthFormatted}-${dayFormatted}`;

        days.push({
            day,
            dateString,
            games: gamesPerDay[dateString] ?? 0
        });

    }

    return days;

}

export function buildGamesCountMap(matches = []) {

    const map = {};

    matches.forEach(match => {

        const date = toInputDate(match.date);

        map[date] = (map[date] || 0) + 1;

    });

    return map;

}