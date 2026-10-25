-- 1.1 Destravar trigger de tempo para permitir updates de sistema em TODAS as ligas
CREATE OR REPLACE FUNCTION public.fn_validate_prediction_kickoff()
RETURNS TRIGGER AS $$
DECLARE
    v_match_date TIMESTAMPTZ;
BEGIN
    -- REGRA DE OURO: Se os palpites do usuário NÃO mudaram, é um UPDATE de sistema (cálculo de pontos).
    -- Libera imediatamente sem checar horário (com proteção para NULL)!
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.prediction_home IS NOT DISTINCT FROM NEW.prediction_home AND 
            OLD.prediction_away IS NOT DISTINCT FROM NEW.prediction_away) THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT date INTO v_match_date
    FROM public.matches
    WHERE id = NEW.match_id;

    IF v_match_date IS NULL THEN
        RAISE EXCEPTION 'Partida com id % não encontrada.', NEW.match_id;
    END IF;

    -- Tolerância de 60s apenas para palpites manuais novos ou alterados
    IF NOW() > (v_match_date + INTERVAL '60 seconds') THEN
        RAISE EXCEPTION 'Apostas encerradas para a partida %.', NEW.match_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1.2 Garantir proteção com NULL safety também na check_prediction_time
CREATE OR REPLACE FUNCTION public.check_prediction_time()
RETURNS TRIGGER AS $$
DECLARE
    match_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.prediction_home IS NOT DISTINCT FROM NEW.prediction_home AND 
            OLD.prediction_away IS NOT DISTINCT FROM NEW.prediction_away) THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT date INTO match_start_time 
    FROM public.matches 
    WHERE id = NEW.match_id;

    IF now() >= match_start_time THEN
        RAISE EXCEPTION 'Bah! Não dá pra palpitar em jogo que já começou ou terminou.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1.3 Atualizar o motor de cálculo para aceitar TODOS os status de todas as ligas suportadas
-- (Futebol internacional, Brasileirão, NHL, NBA, MLB, NFL)
CREATE OR REPLACE FUNCTION public.fn_update_points_on_match_final()
RETURNS TRIGGER AS $$
BEGIN
    -- Dispara se o jogo foi finalizado em qualquer formato de API
    IF (LOWER(NEW.status) IN ('finished', 'off', 'final', 'ft', 'aet', 'pen', 'completed')) 
       AND NEW.goals_home IS NOT NULL 
       AND NEW.goals_away IS NOT NULL THEN

        UPDATE public.predictions p
        SET points_earned = CASE
            -- 1. PLACAR EXATO (Cravada)
            WHEN p.prediction_home = NEW.goals_home AND p.prediction_away = NEW.goals_away 
                THEN lc.exact_score_points
            
            -- 2. VENCEDOR/TENDÊNCIA + GOL DE UM TIME (Bônus - futebol ou esportes com empate)
            WHEN (
                (
                  (p.prediction_home > p.prediction_away AND NEW.goals_home > NEW.goals_away) OR 
                  (p.prediction_home < p.prediction_away AND NEW.goals_home < NEW.goals_away) OR 
                  (p.prediction_home = p.prediction_away AND NEW.goals_home = NEW.goals_away)
                )
                AND (NEW.goals_home != NEW.goals_away OR lc.exact_score_points = lc.winner_and_one_goal_points)
                AND (p.prediction_home = NEW.goals_home OR p.prediction_away = NEW.goals_away)
            ) THEN lc.winner_and_one_goal_points

            -- 3. APENAS VENCEDOR OU EMPATE
            WHEN (
                (p.prediction_home > p.prediction_away AND NEW.goals_home > NEW.goals_away) OR 
                (p.prediction_home < p.prediction_away AND NEW.goals_home < NEW.goals_away) OR 
                (p.prediction_home = p.prediction_away AND NEW.goals_home = NEW.goals_away)
            ) THEN lc.winner_only_points
            
            ELSE 0
        END
        FROM public.user_leagues ul
        JOIN public.leagues_config lc ON ul.config_id = lc.id
        WHERE p.user_league_id = ul.id
          AND p.match_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
