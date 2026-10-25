-- 1.1 Atualizar a função de validação de horário
CREATE OR REPLACE FUNCTION public.fn_validate_prediction_kickoff()
RETURNS TRIGGER AS $$
DECLARE
    v_match_date TIMESTAMPTZ;
BEGIN
    -- Se for UPDATE e os palpites não foram alterados, permite que o sistema atualize pontos
    IF TG_OP = 'UPDATE' THEN
        IF OLD.prediction_home = NEW.prediction_home AND OLD.prediction_away = NEW.prediction_away THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT date INTO v_match_date
    FROM public.matches
    WHERE id = NEW.match_id;

    IF v_match_date IS NULL THEN
        RAISE EXCEPTION 'Partida com id % não encontrada.', NEW.match_id;
    END IF;

    IF NOW() > (v_match_date + INTERVAL '60 seconds') THEN
        RAISE EXCEPTION 'Apostas encerradas para a partida %.', NEW.match_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.2 Atualizar a trigger de cálculo para aceitar 'final' (NHL/NBA/MLB) e os demais status
CREATE OR REPLACE FUNCTION public.fn_update_points_on_match_final()
RETURNS TRIGGER AS $$
BEGIN
    -- Aceita 'finished' (Futebol), 'off' e 'final' (Esportes Americanos)
    IF (LOWER(NEW.status) IN ('finished', 'off', 'final')) THEN
        UPDATE public.predictions p
        SET points_earned = CASE
            -- 1. ACERTO EXATO (CRAVADA)
            WHEN p.prediction_home = NEW.goals_home AND p.prediction_away = NEW.goals_away 
                THEN lc.exact_score_points
            
            -- 2. VENCEDOR/TENDÊNCIA + GOL DE UM TIME (BÔNUS)
            WHEN (
                (
                  (p.prediction_home > p.prediction_away AND NEW.goals_home > NEW.goals_away) OR 
                  (p.prediction_home < p.prediction_away AND NEW.goals_home < NEW.goals_away) OR 
                  (p.prediction_home = p.prediction_away AND NEW.goals_home = NEW.goals_away)
                )
                AND 
                (p.prediction_home = NEW.goals_home OR p.prediction_away = NEW.goals_away)
            ) THEN lc.winner_and_one_goal_points

            -- 3. APENAS VENCEDOR/TENDÊNCIA
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
