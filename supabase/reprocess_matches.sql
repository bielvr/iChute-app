-- 2.1 Destravar Palmeiras x Bragantino (Partida 297)
UPDATE public.matches
SET status = 'finished',
    goals_home = 2,
    goals_away = 0
WHERE id = 297;

-- 2.2 Re-disparar a trigger de pontuação para os jogos da NHL com status 'final' ou 'off'
UPDATE public.matches
SET status = status
WHERE league_id = 14
  AND LOWER(status) IN ('final', 'off')
  AND goals_home IS NOT NULL;
