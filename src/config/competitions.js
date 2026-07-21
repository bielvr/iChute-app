export const COMPETITIONS = {
    12: {
        rounds: {
            4: "16 avos de final",
            5: "Oitavas de final",
            6: "Quartas de final",
            7: "Semifinal",
            8: "3º Lugar",
            9: "Final"
        }
    }
}
export function getRoundName(competitionId, round) {
    const competition = COMPETITIONS[competitionId];
    if (!competition?.roundNames) {
        return `${round}ª RODADA`;
    }
    return competition.roundNames[round] ?? `${round}ª RODADA`;
}