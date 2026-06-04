import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';
import Logo from '../components/Logo';

export default function Predictions() {
  const { ligaId } = useParams();
  const navigate = useNavigate();

  // Estados de Dados
  const [jogos, setJogos] = useState([]);
  const [palpites, setPalpites] = useState({});
  const [ligaNome, setLigaNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numericUserId, setNumericUserId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  
  // Estado para controlar o feedback de salvamento individual de cada jogo: 'salvando' | 'sucesso' | 'erro'
  const [statusSalvamento, setStatusSalvamento] = useState({});

  // Lógica Híbrida e Temporada Dinâmica
  const [isFootball, setIsFootball] = useState(false);
  const [officialLeagueId, setOfficialLeagueId] = useState(null);
  const [temporadaAtiva, setTemporadaAtiva] = useState('');
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toLocaleDateString('en-CA'));
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [listaRodadas, setListaRodadas] = useState([]);

  const proximosDias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });

  useEffect(() => {
    async function initPage() {
      if (!ligaId || ligaId === "undefined") return;
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: userData } = await supabase.from('users').select('id').eq('email', user?.email).single();
        setNumericUserId(userData?.id);

        const { data: infoLiga } = await supabase
          .from('user_leagues')
          .select(`name, owner_id, official_league_id, leagues (sport_id)`)
          .eq('id', ligaId)
          .single();

        setLigaNome(infoLiga.name);
        setOfficialLeagueId(infoLiga.official_league_id);
        
        if (userData?.id && infoLiga.owner_id === userData.id) {
          setIsOwner(true);
        }
        
        const football = infoLiga.leagues.sport_id === 1; 
        setIsFootball(football);

        const { data: maxSeasonData } = await supabase
          .from('matches')
          .select('season')
          .eq('league_id', infoLiga.official_league_id)
          .order('season', { ascending: false })
          .limit(1);
        
        const ultimaTemporada = maxSeasonData && maxSeasonData.length > 0 ? maxSeasonData[0].season : new Date().getFullYear().toString();
        setTemporadaAtiva(ultimaTemporada);

        if (football) {
          const { data: rounds } = await supabase.from('matches')
            .select('round')
            .eq('league_id', infoLiga.official_league_id)
            .eq('season', ultimaTemporada)
            .order('round', { ascending: true });
          
          const uniqueRounds = [...new Set(rounds?.map(r => r.round))];
          setListaRodadas(uniqueRounds);

          const now = new Date().toISOString();
          const { data: currentMatch } = await supabase.from('matches')
            .select('round')
            .eq('league_id', infoLiga.official_league_id)
            .eq('season', ultimaTemporada)
            .gte('date', now)
            .order('date', { ascending: true })
            .limit(1)
            .maybeSingle();
          
          let targetRound = currentMatch?.round;
          if (!targetRound) {
            const { data: lastMatch } = await supabase.from('matches')
              .select('round')
              .eq('league_id', infoLiga.official_league_id)
              .eq('season', ultimaTemporada)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle();
            targetRound = lastMatch?.round || uniqueRounds[0];
          }

          setRodadaSelecionada(targetRound);
          fetchMatches(infoLiga.official_league_id, ultimaTemporada, true, targetRound, userData?.id);
        } else {
          fetchMatches(infoLiga.official_league_id, ultimaTemporada, false, dataSelecionada, userData?.id);
        }
      } catch (err) {
        console.error("Erro init iChute:", err.message);
      }
    }
    initPage();
  }, [ligaId]);

  async function fetchMatches(offId, seasonStr, footballMode, filterValue, uId) {
    setLoading(true);
    try {
      let query = supabase.from('matches')
        .select(`*, home:home_team_id(name, url_logo), away:away_team_id(name, url_logo)`)
        .eq('league_id', offId)
        .eq('season', seasonStr);

      if (footballMode) {
        query = query.eq('round', filterValue);
      } else {
        const inicio = new Date(`${filterValue}T00:00:00Z`);
        const fim = new Date(inicio); 
        fim.setHours(fim.getHours() + 36);
        query = query.gte('date', inicio.toISOString()).lte('date', fim.toISOString());
      }

      const { data: matchesData } = await query.order('date', { ascending: true });
      
      const filtrados = footballMode ? matchesData : (matchesData || []).filter(j => 
        new Date(j.date).toLocaleDateString('en-CA') === filterValue
      );
      setJogos(filtrados);

      if (uId && filtrados.length > 0) {
        const { data: existingPreds } = await supabase.from('predictions')
          .select('*')
          .eq('user_id', uId)
          .eq('user_league_id', ligaId)
          .in('match_id', filtrados.map(j => j.id));

        const map = {};
        existingPreds?.forEach(p => {
          map[p.match_id] = { home: p.prediction_home, away: p.prediction_away };
        });
        setPalpites(map);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleInputChange = (matchId, side, value) => {
    setPalpites(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value === "" ? "" : parseInt(value) }
    }));
  };

  const salvarPalpiteIndividual = async (matchId) => {
    if (!numericUserId) return;
    const palpiteJogo = palpites[matchId];
    
    if (!palpiteGridValido(palpiteJogo)) return;

    setStatusSalvamento(prev => ({ ...prev, [matchId]: 'salvando' }));

    const payload = {
      user_id: numericUserId,
      match_id: parseInt(matchId),
      user_league_id: parseInt(ligaId),
      prediction_home: palpiteJogo?.home ?? 0,
      prediction_away: palpiteJogo?.away ?? 0,
      points_earned: 0
    };

    try {
      const { error } = await supabase.from('predictions')
        .upsert([payload], { onConflict: 'user_id,match_id,user_league_id' });
      if (error) throw error;
      
      setStatusSalvamento(prev => ({ ...prev, [matchId]: 'sucesso' }));
      setTimeout(() => {
        setStatusSalvamento(prev => ({ ...prev, [matchId]: null }));
      }, 2500);
    } catch (err) {
      console.error("Erro salvamento em lote dinâmico:", err.message);
      setStatusSalvamento(prev => ({ ...prev, [matchId]: 'erro' }));
    }
  };

  const palpiteGridValido = (p) => {
    if (!p) return false;
    return (p.home !== undefined && p.home !== "") || (p.away !== undefined && p.away !== "");
  };

  const handleConfirmar = async () => {
    if (!numericUserId) return alert("Erro: Usuário não identificado");
    setSaving(true);
    
    const payloads = Object.keys(palpites)
      .filter(id => palpiteGridValido(palpites[id]))
      .map(matchId => ({
        user_id: numericUserId,
        match_id: parseInt(matchId),
        user_league_id: parseInt(ligaId),
        prediction_home: palpites[matchId].home ?? 0,
        prediction_away: palpites[matchId].away ?? 0,
        points_earned: 0
      }));

    if (payloads.length === 0) {
      setSaving(false);
      return alert("Insira ao menos um palpite antes de confirmar.");
    }

    try {
      const { error } = await supabase.from('predictions')
        .upsert(payloads, { onConflict: 'user_id,match_id,user_league_id' });
      if (error) throw error;
      alert("TODOS OS PALPITES FORAM BLINDADOS! ⚡");
    } catch (err) {
      alert("Erro ao salvar lote total: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatarDataHora = (dateString) => {
    const dataObj = new Date(dateString);
    const hora = dataObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (isFootball) {
      const dia = dataObj.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      return `${dia} - ${hora}`;
    }
    return hora;
  };

  if (loading && !jogos.length) {
    return <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black animate-pulse">SINCRONIZANDO...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40 overflow-x-hidden">
      <header className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]">← VOLTAR</button>
          
          <div className="flex items-center gap-3 text-right">
            {isOwner && (
              <Link 
                to={`/leagues/${ligaId}/settings`} 
                className="bg-[#1A1C3A] border border-[#26283A] text-gray-400 hover:text-[#0077FF] hover:border-[#0077FF] p-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all mr-1"
              >
                ⚙️
              </Link>
            )}
            <div>
              <Logo size="sm" />
              <span className="text-white block text-sm opacity-80">{ligaNome}</span>
            </div>
          </div>
        </div>

        {isFootball ? (
          <select 
            value={rodadaSelecionada} 
            onChange={(e) => { 
              setRodadaSelecionada(e.target.value); 
              fetchMatches(officialLeagueId, temporadaAtiva, true, e.target.value, numericUserId); 
            }}
            className="w-full bg-[#1A1C3A] border border-[#26283A] p-4 rounded-2xl font-black italic uppercase text-[#0077FF] focus:outline-none"
          >
            {listaRodadas.map(r => <option key={r} value={r}>{r}ª RODADA</option>)}
          </select>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            {proximosDias.map((data) => (
              <button 
                key={data} 
                onClick={() => { setDataSelecionada(data); fetchMatches(officialLeagueId, temporadaAtiva, false, data, numericUserId); }}
                className={`flex-shrink-0 px-6 py-4 rounded-[20px] font-black text-xs uppercase italic border ${data === dataSelecionada ? 'bg-[#0077FF] text-white border-[#0077FF]' : 'bg-[#1A1C3A] text-gray-400 border-[#26283A]'}`}
              >
                {data === new Date().toLocaleDateString('en-CA') ? 'HOJE' : data.split('-').reverse().slice(0,2).join('/')}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="grid gap-6 max-w-2xl mx-auto">
        {jogos.length === 0 ? (
          <p className="text-center p-10 opacity-30 font-black italic uppercase">Sem jogos para este filtro</p>
        ) : (
          jogos.map((jogo) => (
            <div key={jogo.id} className="relative bg-[#1A1C3A] border border-[#26283A] p-4 sm:p-8 rounded-[35px] shadow-2xl w-full mx-auto overflow-hidden">
              <div className="flex justify-between items-center gap-2 sm:gap-4">
                <div className="flex-1 flex flex-col items-center text-center gap-2">
                  <img src={jogo.home?.url_logo} className="w-10 h-10 sm:w-14 sm:h-14 object-contain" alt={jogo.home?.name} />
                  <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-tight leading-tight">{jogo.home?.name}</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1 sm:gap-3 bg-[#0A0E2A] p-2 sm:p-4 rounded-[25px] border border-[#26283A]">
                    <input 
                      type="number" 
                      value={palpites[jogo.id]?.home ?? ""} 
                      onChange={(e) => handleInputChange(jogo.id, 'home', e.target.value)}
                      onBlur={() => salvarPalpiteIndividual(jogo.id)}
                      className="w-10 h-10 sm:w-16 sm:h-16 text-center bg-[#1A1C3A] rounded-2xl font-black text-xl sm:text-3xl text-[#0077FF] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      placeholder="0" 
                    />
                    <span className="text-[#26283A] font-black italic text-lg sm:text-2xl">X</span>
                    <input 
                      type="number" 
                      value={palpites[jogo.id]?.away ?? ""} 
                      onChange={(e) => handleInputChange(jogo.id, 'away', e.target.value)}
                      onBlur={() => salvarPalpiteIndividual(jogo.id)}
                      className="w-10 h-10 sm:w-16 sm:h-16 text-center bg-[#1A1C3A] rounded-2xl font-black text-xl sm:text-3xl text-[#0077FF] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      placeholder="0" 
                    />
                  </div>
                  
                  <div className="h-3 flex items-center justify-center">
                    {statusSalvamento[jogo.id] === 'salvando' && (
                      <span className="text-[8px] font-black tracking-widest text-yellow-500 uppercase animate-pulse">Sincronizando...</span>
                    )}
                    {statusSalvamento[jogo.id] === 'sucesso' && (
                      <span className="text-[8px] font-black tracking-widest text-green-400 uppercase">✓ Salvo com sucesso</span>
                    )}
                    {statusSalvamento[jogo.id] === 'erro' && (
                      <span className="text-[8px] font-black tracking-widest text-red-500 uppercase">⚠️ Erro ao salvar</span>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center text-center gap-2">
                  <img src={jogo.away?.url_logo} className="w-10 h-10 sm:w-14 sm:h-14 object-contain" alt={jogo.away?.name} />
                  <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-tight leading-tight">{jogo.away?.name}</span>
                </div>
              </div>

              <div className="mt-2 text-center text-[9px] sm:text-[10px] font-black text-[#B0C4DE] opacity-40 uppercase italic">
                {formatarDataHora(jogo.date)}
              </div>
            </div>
          ))
        )}

        <button 
          onClick={handleConfirmar} 
          disabled={saving}
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-xl font-black py-6 rounded-[25px] uppercase italic text-xl z-40 shadow-2xl transition-all active:scale-95 ${saving ? 'bg-gray-700 cursor-not-allowed' : 'bg-[#0077FF] hover:bg-[#0066DD]'}`}
        >
          {saving ? 'GRAVANDO...' : 'CONFIRMAR PALPITES'}
        </button>
      </div>

      <BottomNav />
      
      <style dangerouslySetInnerHTML={{__html: `
        input::-webkit-outer-spin-button, 
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } 
        input[type=number] { -moz-appearance: textfield; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}