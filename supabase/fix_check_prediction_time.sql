-- Atualizar check_prediction_time() para usar IS NOT DISTINCT FROM com segurança para NULLs
CREATE OR REPLACE FUNCTION public.check_prediction_time()
RETURNS TRIGGER AS $$
DECLARE
    match_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1. CORREÇÃO: Se for um UPDATE e o usuário NÃO mexeu no palpite de gols, 
    -- significa que o sistema está apenas calculando pontos. Passa direto!
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.prediction_home IS NOT DISTINCT FROM NEW.prediction_home AND 
            OLD.prediction_away IS NOT DISTINCT FROM NEW.prediction_away) THEN
            RETURN NEW;
        END IF;
    END IF;

    -- 2. Busca o horário oficial do início do jogo na tabela matches
    SELECT date INTO match_start_time 
    FROM public.matches 
    WHERE id = NEW.match_id;

    -- 3. Compara se o horário atual (now()) é maior ou igual ao início do jogo
    IF now() >= match_start_time THEN
        RAISE EXCEPTION 'Bah! Não dá pra palpitar em jogo que já começou ou terminou.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
