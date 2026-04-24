import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';

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
  
  // Lógica Híbrida
  const [isFootball, setIsFootball] = useState(false);
  const [officialLeagueId, setOfficialLeagueId] = useState(null);
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toLocaleDateString('en-CA'));
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [listaRodadas, setListaRodadas] = useState([]);

  const proximosDias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });

  // 1. Efeito de Inicialização (Identifica Esporte e Usuário)
  useEffect(() => {
    async function initPage() {
      if (!ligaId || ligaId === "undefined") return;
      setLoading(true);
      try {
        // Pega ID numérico do usuário
        const { data: { user } } = await supabase.auth.getUser();
        const { data: userData } = await supabase.from('users').select('id').eq('email', user?.email).single();
        setNumericUserId(userData?.id);

        // Pega info da liga e esporte
        const { data: infoLiga } = await supabase
          .from('user_leagues')
          .select(`name, official_league_id, leagues (sport_id)`)
          .eq('id', ligaId)
          .single();

        setLigaNome(infoLiga.name);
        setOfficialLeagueId(infoLiga.official_league_id);
        
        const football = infoLiga.leagues.sport_id === 1; // Ajuste o ID se seu banco for diferente
        setIsFootball(football);

        if (football) {
          // Busca rodadas e define a atual
          const { data: rounds } = await supabase.from('matches').select('round')
            .eq('league_id', infoLiga.official_league_id).order('round', { ascending: true });
          const uniqueRounds = [...new Set(rounds?.map(r => r.round))];
          setListaRodadas(uniqueRounds);

          const { data: currentMatch } = await supabase.from('matches').select('round')
            .eq('league_id', infoLiga.official_league_id).neq('status', 'FINISHED')
            .order('date', { ascending: true }).limit(1).single();
          
          const targetRound = currentMatch?.round || uniqueRounds[0];
          setRodadaSelecionada(targetRound);
          fetchMatches(infoLiga.official_league_id, true, targetRound, userData?.id);
        } else {
          // NHL: Busca por data
          fetchMatches(infoLiga.official_league_id, false, dataSelecionada, userData?.id);
        }
      } catch (err) {
        console.error("Erro init iChute:", err.message);
      }
    }
    initPage();
  }, [ligaId]);

  // 2. Motor de Busca de Jogos e Palpites Existentes
  async function fetchMatches(offId, footballMode, filterValue, uId) {
    setLoading(true);
    try {
      let query = supabase.from('matches').select(`*, home:home_team_id(name, url_logo), away:away_team_id(name, url_logo)`)
        .eq('league_id', offId);

      if (footballMode) {
        query = query.eq('round', filterValue);
      } else {
        const inicio = new Date(`${filterValue}T00:00:00Z`);
        const fim = new Date(inicio); fim.setHours(fim.getHours() + 36);
        query = query.gte('date', inicio.toISOString()).lte('date', fim.toISOString());
      }

      const { data: matchesData } = await query.order('date', { ascending: true });
      
      const filtrados = footballMode ? matchesData : (matchesData || []).filter(j => 
        new Date(j.date).toLocaleDateString('en-CA') === filterValue
      );
      setJogos(filtrados);

      // Carrega palpites já salvos
      if (uId && filtrados.length > 0) {
        const { data: existingPreds } = await supabase.from('predictions').select('*')
          .eq('user_id', uId).eq('user_league_id', ligaId).in('match_id', filtrados.map(j => j.id));

        const map = {};
        existingPreds?.forEach(p => map[p.match_id] = { home: p.prediction_home, away: p.prediction_away });
        setPalpites(map);
      }
    } finally {
      setLoading(false);
    }
  }

  // 3. Handlers de Input e Gravação (UPSERT)
  const handleInputChange = (matchId, side, value) => {
    setPalpites(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value === "" ? "" : parseInt(value) }
    }));
  };

  const handleConfirmar = async () => {
    if (!numericUserId) return alert("Erro: Usuário não identificado");
    setSaving(true);
    const payloads = Object.keys(palpites).map(matchId => ({
      user_id: numericUserId,
      match_id: parseInt(matchId),
      user_league_id: parseInt(ligaId),
      prediction_home: palpites[matchId].home ?? 0,
      prediction_away: palpites[matchId].away ?? 0,
      points_earned: 0
    }));

    try {
      const { error } = await supabase.from('predictions')
        .upsert(payloads, { onConflict: 'user_id,match_id,user_league_id' });
      if (error) throw error;
      alert("PALPITES REGISTRADOS! ⚡");
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatarHoraLocal = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (loading && !jogos.length) return <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black animate-pulse">SINCRONIZANDO...</div>;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40">
      <header className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]">← VOLTAR</button>
          <h1 className="text-xl font-black italic text-[#0077FF] uppercase text-right">iCHUTE <span className="text-white block text-sm">{ligaNome}</span></h1>
        </div>

        {isFootball ? (
          <select 
            value={rodadaSelecionada} 
            onChange={(e) => { setRodadaSelecionada(e.target.value); fetchMatches(officialLeagueId, true, e.target.value, numericUserId); }}
            className="w-full bg-[#1A1C3A] border border-[#26283A] p-4 rounded-2xl font-black italic uppercase text-[#0077FF] focus:outline-none"
          >
            {listaRodadas.map(r => <option key={r} value={r}>{r}ª RODADA</option>)}
          </select>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            {proximosDias.map((data) => (
              <button key={data} onClick={() => { setDataSelecionada(data); fetchMatches(officialLeagueId, false, data, numericUserId); }}
                className={`flex-shrink-0 px-6 py-4 rounded-[20px] font-black text-xs uppercase italic border ${data === dataSelecionada ? 'bg-[#0077FF] text-white border-[#0077FF]' : 'bg-[#1A1C3A] text-gray-400 border-[#26283A]'}`}>
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
            <div key={jogo.id} className="relative bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[35px] shadow-2xl">
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1 flex flex-col items-center text-center gap-3">
                  <img src={jogo.home?.url_logo} className="w-14 h-14 object-contain" alt="" />
                  <span className="text-[11px] font-black uppercase tracking-tight">{jogo.home?.name}</span>
                </div>
                <div className="flex items-center gap-3 bg-[#0A0E2A] p-4 rounded-[25px] border border-[#26283A]">
                  <input type="number" value={palpites[jogo.id]?.home ?? ""} onChange={(e) => handleInputChange(jogo.id, 'home', e.target.value)}
                    className="w-16 h-16 text-center bg-[#1A1C3A] rounded-2xl font-black text-3xl text-[#0077FF]" placeholder="0" />
                  <span className="text-[#26283A] font-black italic text-2xl">X</span>
                  <input type="number" value={palpites[jogo.id]?.away ?? ""} onChange={(e) => handleInputChange(jogo.id, 'away', e.target.value)}
                    className="w-16 h-16 text-center bg-[#1A1C3A] rounded-2xl font-black text-3xl text-[#0077FF]" placeholder="0" />
                </div>
                <div className="flex-1 flex flex-col items-center text-center gap-3">
                  <img src={jogo.away?.url_logo} className="w-14 h-14 object-contain" alt="" />
                  <span className="text-[11px] font-black uppercase tracking-tight">{jogo.away?.name}</span>
                </div>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-black text-[#B0C4DE] opacity-40 uppercase italic">
                {formatarHoraLocal(jogo.date)}
              </div>
            </div>
          ))
        )}

        <button 
          onClick={handleConfirmar} 
          disabled={saving}
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-xl font-black py-6 rounded-[25px] uppercase italic text-xl z-40 transition-all ${saving ? 'bg-gray-700' : 'bg-[#0077FF]'}`}
        >
          {saving ? 'GRAVANDO...' : 'CONFIRMAR PALPITES'}
        </button>
      </div>

      <BottomNav />
      <style dangerouslySetInnerHTML={{__html: `input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } .no-scrollbar::-webkit-scrollbar { display: none; }`}} />
    </div>
  );
}