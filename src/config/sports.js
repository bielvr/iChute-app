export const SPORT_METADATA = {
  1: { icon: '⚽', translationKey: 'football' }, 2: { icon: '🏒', translationKey: 'iceHockey' }, 3: { icon: '🏎️', translationKey: 'motorsport' }, 4: { icon: '🚲', translationKey: 'cycling' }, 5: { icon: '🏀', translationKey: 'basketball' }, 6: { icon: '⚾', translationKey: 'baseball' }, 7: { icon: '🏈', translationKey: 'americanFootball' }, 8: { icon: '🎾', translationKey: 'tennis' }, 9: { icon: '🏐', translationKey: 'volleyball' },
};
export function getSportMetadata(sport) { return SPORT_METADATA[sport.id] ?? { icon: '🏆', translationKey: null }; }
