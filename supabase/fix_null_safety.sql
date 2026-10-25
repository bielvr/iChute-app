-- 1.1 Atualizar a função de validação de horário usando IS NOT DISTINCT FROM para tratar NULL com segurança
CREATE OR REPLACE FUNCTION public.fn_validate_prediction_kickoff()
RETURNS TRIGGER AS $$
DECLARE
    v_match_date TIMESTAMPTZ;
BEGIN
    -- Se for UPDATE e os palpites não foram alterados (usando IS NOT DISTINCT FROM para suportar NULLs)
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

    IF NOW() > (v_match_date + INTERVAL '60 seconds') THEN
        RAISE EXCEPTION 'Apostas encerradas para a partida %.', NEW.match_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
