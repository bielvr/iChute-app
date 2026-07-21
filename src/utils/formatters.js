export function formatGoalDifference(diff) {

    if (diff > 0) {
        return `+${diff}`;
    }

    return `${diff}`;

}

export function formatScore(home, away) {

    if (home == null || away == null) {
        return "- x -";
    }

    return `${home} x ${away}`;

}

export function formatPercentage(value, digits = 2) {

    return `${Number(value).toFixed(digits)}%`;

}