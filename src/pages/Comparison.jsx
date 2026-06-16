import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';
import Logo from '../components/Logo';

export default function Comparison() {
  const { ligaId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadingPreds, setLoadingPreds] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [jogos, setJogos] = useState([]);
  const [palpitesMatriz, setPalpitesMatriz] = useState({});
  const [sportId, setSportId] = useState(null);
  const [officialLeagueId, setOfficialLeagueId] = useState(null);
  const [temporadaAtiva, setTemporadaAtiva] = useState('');

  // Configurações customizadas de pontuação da liga do usuário
  const [pontosConfig, setPontosConfig] = useState({
    cravada: 3,
    cheio: 2,
    resultado: 1
  });

  // Lógica de Abas e Filtros Adaptados
  const [isFootball, setIsFootball] = useState(false);
  const [listaRodadas, setListaRodadas] = useState([]);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toLocaleDateString('en-CA'));

  // Estados do Calendário Customizado Dropdown
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [mesAtualCalendario, setMesAtualCalendario] = useState(new Date());
  const [contagemJogosPorDia, setContagemJogosPorDia] = useState({});

  // EFEITO 1: Carregar estrutura da Liga, Configurações de Pontos, Membros e Partidas
  useEffect(() => {
    async function loadBaseData() {
      if (!ligaId) return;
      setLoading(true);
      
      try {
        // 1. Buscar membros da liga
        const { data: membros, error: errMembros } = await supabase
          .from('user_league_members')
          .select('user_id, users(name)')
          .eq('user_league_id', ligaId);
        
        if (errMembros) throw errMembros;
        setUsuarios(membros?.map(m => ({ id: m.user_id, name: m.users?.name || 'Usuário' })) || []);

        // 2. Info da Liga, Sport e Regras customizadas de Pontuação
        const { data: ligaInfo, error: errLiga } = await supabase
          .from('user_leagues')
          .select(`
            official_league_id,
            leagues:official_league_id (sport_id),
            leagues_config:config_id (exact_score_points, winner_and_one_goal_points, winner_only_points)
          `)
          .eq('id', ligaId)
          .single();

        if (errLiga || !ligaInfo) throw new Error("Liga não encontrada");

        // Alimentar o estado de regras com os pontos configurados pelo dono da liga
        if (ligaInfo.leagues_config) {
          setPontosConfig({
            cravada: ligaInfo.leagues_config.exact_score_points ?? 3,
            cheio: ligaInfo.leagues_config.winner_and_one_goal_points ?? 2,
            resultado: ligaInfo.leagues_config.winner_only_points ?? 1
          });
        }

        const sId = ligaInfo.leagues?.sport_id;
        setSportId(sId);
        const football = sId === 1;
        setIsFootball(football);
        setOfficialLeagueId(ligaInfo.official_league_id);

        // Buscar última temporada disponível
        const { data: maxSeasonData } = await supabase
          .from('matches')
          .select('season')
          .eq('league_id', ligaInfo.official_league_id)
          .order('season', { ascending: false })
          .limit(1);
        
        const ultimaTemporada = maxSeasonData && maxSeasonData.length > 0 ? maxSeasonData[0].season : new Date().getFullYear().toString();
        setTemporadaAtiva(ultimaTemporada);

        if (football) {
          // Coletar rodadas disponíveis
          const { data: rounds } = await supabase.from('matches')
            .select('round')
            .eq('league_id', ligaInfo.official_league_id)
            .eq('season', ultimaTemporada)
            .order('round', { ascending: true });
          
          const uniqueRounds = [...new Set(rounds?.map(r => r.round))];
          setListaRodadas(uniqueRounds);

          // Localiza a rodada atual baseada no tempo real
          const { data: currentMatch } = await supabase.from('matches')
            .select('round, date')
            .eq('league_id', ligaInfo.official_league_id)
            .eq('season', ultimaTemporada)
            .lte('date', new Date().toISOString())
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

          let targetRound = currentMatch?.round || uniqueRounds[0];
          let dataAlvo = new Date().toLocaleDateString('en-CA');

          if (currentMatch) {
            dataAlvo = new Date(currentMatch.date).toLocaleDateString('en-CA');
          }

          setRodadaSelecionada(targetRound);
          setDataSelecionada(dataAlvo);
          setMesAtualCalendario(new Date(dataAlvo + 'T12:00:00'));

          await buscarContagemJogos(ligaInfo.official_league_id, ultimaTemporada, true, targetRound);
          fetchMatches(ligaInfo.official_league_id, ultimaTemporada, dataAlvo);
        } else {
          // Outros Esportes: Calendário Geral de datas passadas
          await buscarContagemJogos(ligaInfo.official_league_id, ultimaTemporada, false, null);

          const { data: ultimoJogoPassado } = await supabase.from('matches')
            .select('date')
            .eq('league_id', ligaInfo.official_league_id)
            .eq('season', ultimaTemporada)
            .lte('date', new Date().toISOString())
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

          const dataAlvo = ultimoJogoPassado 
            ? new Date(ultimoJogoPassado.date).toLocaleDateString('en-CA') 
            : new Date().toLocaleDateString('en-CA');

          setDataSelecionada(dataAlvo);
          setMesAtualCalendario(new Date(dataAlvo + 'T12:00:00'));
          fetchMatches(ligaInfo.official_league_id, ultimaTemporada, dataAlvo);
        }

      } catch (err) {
        console.error("Erro no carregamento base:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBaseData();
  }, [ligaId]);

  // Função dinâmica para contar volume de jogos por dia convertendo para data local do dispositivo
  async function buscarContagemJogos(offId, seasonStr, footballMode, roundValue) {
    try {
      let query = supabase.from('matches')
        .select('date')
        .eq('league_id', offId)
        .eq('season', seasonStr);

      if (footballMode && roundValue) {
        query = query.eq('round', roundValue);
      }
      
      const { data } = await query;
      const mapaContagem = {};
      data?.forEach(j => {
        // Mapeia na bolinha com base no fuso local do navegador do usuário
        const dStr = new Date(j.date).toLocaleDateString('en-CA');
        mapaContagem[dStr] = (mapaContagem[dStr] || 0) + 1;
      });
      setContagemJogosPorDia(mapaContagem);
    } catch (e) {
      console.error(e);
    }
  }

  // Busca partidas do dia selecionado respeitando fuso local
  async function fetchMatches(offId, seasonStr, dateStr) {
    setLoadingPreds(true);
    try {
      // Amortece a busca do banco trazendo uma janela de 48h (D-1 até D+1) baseada no meio do dia local
      const dataBase = new Date(`${dateStr}T12:00:00`);
      const inicioQuery = new Date(dataBase.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const fimQuery = new Date(dataBase.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { data: matchesData } = await supabase.from('matches')
        .select(`*, home:home_team_id(name, url_logo), away:away_team_id(name, url_logo)`)
        .eq('league_id', offId)
        .eq('season', seasonStr)
        .gte('date', inicioQuery)
        .lte('date', fimQuery)
        .order('date', { ascending: true });

      // O FILTRO REAL: Filtra rigorosamente comparando com o dia local do navegador
      const filtrados = (matchesData || []).filter(j => 
        new Date(j.date).toLocaleDateString('en-CA') === dateStr
      );
      
      setJogos(filtrados);

      if (filtrados.length > 0) {
        const matchIds = filtrados.map(j => j.id);
        const { data: allPreds } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_league_id', ligaId)
          .in('match_id', matchIds);

        const matriz = {};
        allPreds?.forEach(p => {
          if (!matriz[p.match_id]) matriz[p.match_id] = {};
          matriz[p.match_id][p.user_id] = {
            home: p.prediction_home,
            away: p.prediction_away,
            points: p.points_earned ?? 0
          };
        });
        setPalpitesMatriz(matriz);
      } else {
        setPalpitesMatriz({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreds(false);
    }
  }

  const handleMudancaRodada = async (novaRodada) => {
    setRodadaSelecionada(novaRodada);
    setLoadingPreds(true);
    
    await buscarContagemJogos(officialLeagueId, temporadaAtiva, true, novaRodada);
    
    const { data: primeiroJogo } = await supabase.from('matches')
      .select('date')
      .eq('league_id', officialLeagueId)
      .eq('season', temporadaAtiva)
      .eq('round', novaRodada)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle();

    let novaDataFoco = new Date().toLocaleDateString('en-CA');
    if (primeiroJogo) {
      novaDataFoco = new Date(primeiroJogo.date).toLocaleDateString('en-CA');
    }
    
    setDataSelecionada(novaDataFoco);
    setMesAtualCalendario(new Date(novaDataFoco + 'T12:00:00'));
    fetchMatches(officialLeagueId, temporadaAtiva, novaDataFoco);
  };

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
      const mesFormatado = String(mes + 1).padStart(2, '0');
      const diaFormatado = String(dia).padStart(2, '0');
      const dataStringCompleta = `${ano}-${mesFormatado}-${diaFormatado}`;
      
      painelDias.push({
        dia,
        dataString: dataStringCompleta,
        qtdJogos: contagemJogosPorDia[dataStringCompleta] || 0
      });
    }
    return painelDias;
  };

  const mudoMes = (direcao) => {
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

  const getPointTheme = (pts) => {
    if (pts > 0 && pts === pontosConfig.cravada) {
      return { bg: "bg-[#39FF14]", text: "text-white", border: "border-[#39FF14]" };
    }
    if (pts > 0 && pts === pontosConfig.cheio) {
      return { bg: "bg-[#FAFF00]/40", text: "text-[B0C4DE]", border: "border-[#FAFF00]/50" };
    }
    if (pts > 0 && pts === pontosConfig.resultado) {
      return { bg: "bg-[#0077FF]/40", text: "text-[F0F8FF]", border: "border-[#0077FF]/50" };
    }
    return { bg: "bg-[#0A0E2A]", text: "text-white/20", border: "border-transparent" };
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center">
      <div className="text-[#0077FF] font-black italic animate-pulse tracking-widest">SINCRONIZANDO...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-40 font-sans">
      <header className="max-w-2xl mx-auto flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center mb-2">
          <button onClick={() => navigate(-1)} className="bg-[#1A1C3A] px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A] uppercase italic transition-all hover:bg-[#0077FF]">
            ← VOLTAR
          </button>
          <div className="text-right">
            <Logo size="sm" />
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest italic">Comparativo de Liga</span>
          </div>
        </div>

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
                <button onClick={() => mudoMes(-1)} className="text-[#0077FF] font-black text-lg p-1 px-3 bg-[#1A1C3A] rounded-lg">‹</button>
                <span className="font-black italic uppercase text-xs sm:text-sm tracking-wide text-white">
                  {mesAtualCalendario.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => mudoMes(1)} className="text-[#0077FF] font-black text-lg p-1 px-3 bg-[#1A1C3A] rounded-lg">›</button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-gray-500 uppercase mb-2">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>

              <div className="grid grid-cols-7 gap-y-3 gap-x-1">
                {gerarDiasDoCalendario().map((item, index) => {
                  if (!item) return <div key={`empty-${index}`} />;
                  
                  const isHoje = item.dataString === new Date().toLocaleDateString('en-CA');
                  const isSelecionado = item.dataString === dataSelecionada;

                  return (
                    <button
                      key={item.dataString}
                      onClick={() => {
                        setDataSelecionada(item.dataString);
                        setCalendarioAberto(false);
                        fetchMatches(officialLeagueId, temporadaAtiva, item.dataString);
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
                    const hoje = new Date().toLocaleDateString('en-CA');
                    setDataSelecionada(hoje);
                    setMesAtualCalendario(new Date());
                    setCalendarioAberto(false);
                    fetchMatches(officialLeagueId, temporadaAtiva, hoje);
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

      {/* Grid de Comparação de Palpites */}
      <div className="max-w-2xl mx-auto grid gap-6 relative">
        {loadingPreds && (
          <div className="absolute inset-0 bg-[#0A0E2A]/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-3xl min-h-[200px]">
            <div className="text-[#0077FF] text-[10px] font-black tracking-wider animate-pulse">ATUALIZANDO PALPITES...</div>
          </div>
        )}

        {jogos.length === 0 && (
          <div className="text-center py-20 text-white/10 font-black italic uppercase tracking-widest">Nenhum resultado para este dia</div>
        )}

        {jogos.map((jogo) => {
          // Verifica se o jogo já começou comparando os timestamps em UTC
          const jogoJaComecou = new Date().toISOString() >= jogo.date;

          return (
            <div key={jogo.id} className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[30px]">
              <div className="flex justify-between items-center mb-6 bg-[#0A0E2A]/50 p-4 rounded-[20px]">
                <div className="flex flex-col items-center w-1/3">
                  <img src={jogo.home?.url_logo} className="w-8 h-8 object-contain mb-1" alt="" />
                  <span className="text-[8px] font-black uppercase text-white/40 text-center">{jogo.home?.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black italic">{jogo.goals_home ?? '-'}</span>
                  <span className="text-[#0077FF] font-black italic opacity-30">X</span>
                  <span className="text-3xl font-black italic">{jogo.goals_away ?? '-'}</span>
                </div>
                <div className="flex flex-col items-center w-1/3">
                  <img src={jogo.away?.url_logo} className="w-8 h-8 object-contain mb-1" alt="" />
                  <span className="text-[8px] font-black uppercase text-white/40 text-center">{jogo.away?.name}</span>
                </div>
              </div>

              <div className="grid gap-2">
                {usuarios.map((u) => {
                  const p = palpitesMatriz[jogo.id]?.[u.id];
                  const pts = p?.points || 0;
                  const theme = getPointTheme(pts);
                  
                  // Se o palpite for do próprio usuário logado, você pode querer mostrar sempre. 
                  // Caso contrário, segue a regra estrita do horário do jogo.
                  const ehDonoDoPalpite = u.id === (supabase.auth.user?.()?.id || null);
                  const revelarPalpite = jogoJaComecou || ehDonoDoPalpite;

                  return (
                    <div key={u.id} className={`flex justify-between items-center p-3 rounded-xl border ${theme.border} bg-[#0A0E2A]/40`}>
                      <span className="text-[9px] font-black uppercase italic text-white/50">{u.name.split(' ')[0]}</span>
                      <div className="flex items-center gap-3">
                        <span className={`font-black italic text-xs ${p ? 'text-white' : 'text-white/20'}`}>
                          {p 
                            ? (revelarPalpite ? `${p.home} x ${p.away}` : "?? x ??") 
                            : '-- x --'
                          }
                        </span>
                        <div className={`min-w-[55px] text-center py-1 px-2 rounded-lg text-[8px] font-black italic ${theme.bg} ${theme.text}`}>
                          {pts} PTS
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <BottomNav />

      <style dangerouslySetInnerHTML={{__html: `
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