import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';
import Logo from '../components/Logo';

// --- HELPERS DE DATA FIXOS EM UTC ---
// Retorna sempre 'YYYY-MM-DD' baseado no tempo UTC absoluto da partida
const getUTCDateString = (dateInput) => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

// Retorna o dia atual do sistema de acordo com o UTC absoluto
const getHojeUTCString = () => {
  return new Date().toISOString().split('T')[0];
};

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

  // Estado para controlar o feedback de salvamento individual
  const [statusSalvamento, setStatusSalvamento] = useState({});

  // Lógica Híbrida e Temporada Dinâmica
  const [isFootball, setIsFootball] = useState(false);
  const [officialLeagueId, setOfficialLeagueId] = useState(null);
  const [temporadaAtiva, setTemporadaAtiva] = useState('');
  const [dataSelecionada, setDataSelecionada] = useState(getHojeUTCString());
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [listaRodadas, setListaRodadas] = useState([]);

  // --- ESTADOS DO CALENDÁRIO CUSTOMIZADO ---
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [mesAtualCalendario, setMesAtualCalendario] = useState(new Date());
  const [contagemJogosPorDia, setContagemJogosPorDia] = useState({});

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

          // Encontrar rodada atual/próxima
          const now = new Date().toISOString();
          const { data: currentMatch } = await supabase.from('matches')
            .select('round, date')
            .eq('league_id', infoLiga.official_league_id)
            .eq('season', ultimaTemporada)
            .gte('date', now)
            .order('date', { ascending: true })
            .limit(1)
            .maybeSingle();

          let targetRound = currentMatch?.round;
          let dataAlvo = getHojeUTCString();

          if (currentMatch) {
            dataAlvo = getUTCDateString(currentMatch.date);
          } else {
            const { data: lastMatch } = await supabase.from('matches')
              .select('round, date')
              .eq('league_id', infoLiga.official_league_id)
              .eq('season', ultimaTemporada)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle();
            targetRound = lastMatch?.round || uniqueRounds[0];
            if (lastMatch) dataAlvo = getUTCDateString(lastMatch.date);
          }

          setRodadaSelecionada(targetRound);
          setDataSelecionada(dataAlvo);
          setMesAtualCalendario(new Date(`${dataAlvo}T12:00:00Z`));

          // Carrega as bolinhas do calendário filtradas por essa rodada específica
          buscarContagemJogos(infoLiga.official_league_id, ultimaTemporada, true, targetRound);
          // Busca os jogos do dia inicial selecionado
          fetchMatches(infoLiga.official_league_id, ultimaTemporada, false, dataAlvo, userData?.id);
        } else {
          // Outros esportes: mapeia todos os jogos da temporada para o calendário
          buscarContagemJogos(infoLiga.official_league_id, ultimaTemporada, false, null);

          const hojeStr = getHojeUTCString();
          const { data: proximoJogo } = await supabase.from('matches')
            .select('date')
            .eq('league_id', infoLiga.official_league_id)
            .eq('season', ultimaTemporada)
            .gte('date', new Date().toISOString())
            .order('date', { ascending: true })
            .limit(1)
            .maybeSingle();

          let dataAlvo = hojeStr;
          if (proximoJogo) {
            dataAlvo = getUTCDateString(proximoJogo.date);
          } else {
            const { data: ultimoJogo } = await supabase.from('matches')
              .select('date')
              .eq('league_id', infoLiga.official_league_id)
              .eq('season', ultimaTemporada)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (ultimoJogo) dataAlvo = getUTCDateString(ultimoJogo.date);
          }

          setDataSelecionada(dataAlvo);
          setMesAtualCalendario(new Date(`${dataAlvo}T12:00:00Z`));
          fetchMatches(infoLiga.official_league_id, ultimaTemporada, false, dataAlvo, userData?.id);
        }
      } catch (err) {
        console.error("Erro init iChute:", err.message);
      }
    }
    initPage();
  }, [ligaId]);

  // Função dinâmica para contar jogos (por Rodada no futebol ou Geral em outros esportes)
  async function buscarContagemJogos(offId, seasonStr, footballMode, roundValue) {
    try {
      let query = supabase.from('matches').select('date').eq('league_id', offId).eq('season', seasonStr);
      if (footballMode && roundValue) {
        query = query.eq('round', roundValue);
      }

      const { data } = await query;
      const mapaContagem = {};
      data?.forEach(j => {
        const dStr = getUTCDateString(j.date);
        mapaContagem[dStr] = (mapaContagem[dStr] || 0) + 1;
      });
      setContagemJogosPorDia(mapaContagem);
    } catch (e) {
      console.error(e);
    }
  }

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
        // Janela exata de 24h daquele dia em UTC absoluto
        const inicio = `${filterValue}T00:00:00.000Z`;
        const fim = `${filterValue}T23:59:59.999Z`;
        query = query.gte('date', inicio).lte('date', fim);
      }

      const { data: matchesData } = await query.order('date', { ascending: true });

      const filtrados = footballMode ? matchesData : (matchesData || []).filter(j => 
        getUTCDateString(j.date) === filterValue
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

  // Mudança de Rodada (Futebol) limpa/atualiza os dias do calendário baseado nela
  const handleMudancaRodada = async (novaRodada) => {
    setRodadaSelecionada(novaRodada);
    setLoading(true);

    // 1. Atualiza as bolinhas do calendário para a nova rodada
    await buscarContagemJogos(officialLeagueId, temporadaAtiva, true, novaRodada);

    // 2. Descobre o primeiro dia que tem jogo nessa nova rodada para focar o calendário nele
    const { data: primeiroJogoRodada } = await supabase.from('matches')
      .select('date')
      .eq('league_id', officialLeagueId)
      .eq('season', temporadaAtiva)
      .eq('round', novaRodada)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle();

    let novaDataFoco = getHojeUTCString();
    if (primeiroJogoRodada) {
      novaDataFoco = getUTCDateString(primeiroJogoRodada.date);
    }

    setDataSelecionada(novaDataFoco);
    setMesAtualCalendario(new Date(`${novaDataFoco}T12:00:00Z`));

    // 3. Puxa os jogos desse dia específico da nova rodada
    fetchMatches(officialLeagueId, temporadaAtiva, false, novaDataFoco, numericUserId);
  };

  // --- GERADOR DA GRADE DO CALENDÁRIO ---
  const gerarDiasDoCalendario = () => {
    const ano = mesAtualCalendario.getFullYear();
    const mes = mesAtualCalendario.getMonth();

    const primeiroDiaDoMes = new Date(ano, mes, 1).getDay();
    const totalDiasNoMes = new Date(ano, mes + 1, 0).getDate();

    const painelDias = [];
    for (let i = 0; i < primeiroDiaDoMes; i++) {
      painelDias.push(null);
    }

    for (let dia = 1; dia <= totalDiasNoMes; dia++) {
      const mesFormatated = String(mes + 1).padStart(2, '0');
      const diaFormatated = String(dia).padStart(2, '0');
      const dataStringCompleta = `${ano}-${mesFormatated}-${diaFormatated}`;

      painelDias.push({
        dia,
        dataString: dataStringCompleta,
        qtdJogos: contagemJogosPorDia[dataStringCompleta] || 0
      });
    }
    return painelDias;
  };

  const mudarMes = (direcao) => {
    const novoMes = new Date(mesAtualCalendario);
    novoMes.setMonth(novoMes.getMonth() + direcao);
    setMesAtualCalendario(novoMes);
  };

  const formatarDataBarraSecundaria = (strData) => {
    if (!strData) return '';
    const [ano, mes, dia] = strData.split('-');
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    return `${dia} DE ${meses[parseInt(mes) - 1]} DE ${ano}`;
  };

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
      console.error("Erro salvamento individual:", err.message);
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
      alert("TODOS OS PALPITES FORAM GRAVADOS! ⚡");
    } catch (err) {
      alert("Erro ao salvar lote total: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatarDataHora = (dateString) => {
    const dataObj = new Date(dateString);
    return dataObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (loading && !jogos.length) {
    return <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black animate-pulse">SINCRONIZANDO...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40 overflow-x-hidden">
      <header className="max-w-2xl mx-auto mb-8 flex flex-col gap-3">
        {/* Topo do Header */}
        <div className="flex items-center justify-between mb-2">
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

        {/* BARRA 1: Seletor de Rodadas (Apenas Futebol) */}
        {isFootball && (
          <div className="relative w-full">
            <select 
              value={rodadaSelecionada} 
              onChange={(e) => handleMudancaRodada(e.target.value)}
              className="w-full bg-[#1A1C3A] border border-[#26283A] p-4 pr-10 rounded-2xl font-black italic uppercase text-[#0077FF] focus:outline-none appearance-none cursor-pointer select-none text-sm tracking-wide"
            >
              {listaRodadas.map(r => <option key={r} value={r}>{r}ª RODADA</option>)}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#0077FF] pointer-events-none">▼</span>
          </div>
        )}

        {/* BARRA 2: Calendário Customizado Dropdown */}
        <div className="relative w-full">
          <div 
            onClick={() => setCalendarioAberto(!calendarioAberto)}
            className="w-full bg-[#1A1C3A] border border-[#26283A] p-4 rounded-2xl font-black italic uppercase text-[#0077FF] flex justify-between items-center cursor-pointer select-none"
          >
            <span className="text-sm tracking-wide">{formatarDataBarraSecundaria(dataSelecionada)}</span>
            <span className={`text-xs transition-transform duration-300 ${calendarioAberto ? 'rotate-180' : ''}`}>▼</span>
          </div>

          {calendarioAberto && (
            <div className="absolute top-[115%] left-0 w-full bg-[#141733] border border-[#26283A] rounded-[25px] p-4 z-50 shadow-2xl animate-fadeIn">
              <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={() => mudarMes(-1)} className="text-[#0077FF] font-black text-lg p-1 px-3 bg-[#1A1C3A] rounded-lg">‹</button>
                <span className="font-black italic uppercase text-xs sm:text-sm tracking-wide text-white">
                  {mesAtualCalendario.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => mudarMes(1)} className="text-[#0077FF] font-black text-lg p-1 px-3 bg-[#1A1C3A] rounded-lg">›</button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-gray-500 uppercase mb-2">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>

              <div className="grid grid-cols-7 gap-y-3 gap-x-1">
                {gerarDiasDoCalendario().map((item, index) => {
                  if (!item) return <div key={`empty-${index}`} />;

                  const isHoje = item.dataString === getHojeUTCString();
                  const isSelecionado = item.dataString === dataSelecionada;

                  return (
                    <button
                      key={item.dataString}
                      onClick={() => {
                        setDataSelecionada(item.dataString);
                        setCalendarioAberto(false);
                        fetchMatches(officialLeagueId, temporadaAtiva, false, item.dataString, numericUserId);
                      }}
                      className={`relative flex flex-col items-center justify-center py-2 rounded-xl transition-all ${
                        isSelecionado 
                          ? 'bg-[#0077FF] text-white font-black scale-105' 
                          : isHoje 
                          ? 'bg-[#1A1C3A] border border-[#0077FF] text-white' 
                          : 'hover:bg-[#1A1C3A] text-gray-300'
                      }`}
                    >
                      <span className="text-xs font-bold">{item.dia}</span>

                      {item.qtdJogos > 0 && (
                        <span className={`text-[8px] mt-0.5 block w-3.5 h-3.5 leading-[14px] text-center rounded-full font-black ${
                          isSelecionado ? 'bg-white text-[#0077FF]' : 'bg-[#26283A] text-gray-400'
                        }`}>
                          {item.qtdJogos}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-2 border-t border-[#26283A] flex justify-center">
                <button 
                  onClick={() => {
                    const hoje = getHojeUTCString();
                    setDataSelecionada(hoje);
                    setMesAtualCalendario(new Date());
                    setCalendarioAberto(false);
                    fetchMatches(officialLeagueId, temporadaAtiva, false, hoje, numericUserId);
                  }}
                  className="bg-[#1A1C3A] border border-[#26283A] text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
                >
                  Hoje
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Grid de Jogos */}
      <div className="grid gap-6 max-w-2xl mx-auto">
        {jogos.length === 0 ? (
          <p className="text-center p-10 opacity-30 font-black italic uppercase">Sem jogos para este dia</p>
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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
      `}} />
    </div>
  );
}