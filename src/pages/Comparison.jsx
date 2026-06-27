import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';
import Logo from '../components/Logo';
import * as htmlToImage from 'html-to-image';

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
  const [sportId, setSportId] = useState(null);

  // Dicionário de referências para capturar cada card individualmente
  const cardRefs = useRef({});

  const [pontosConfig, setPontosConfig] = useState({
    cravada: 3,
    cheio: 2,
    resultado: 1
  });

  const [isFootball, setIsFootball] = useState(false);
  const [listaRodadas, setListaRodadas] = useState([]);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toLocaleDateString('en-CA'));

  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [mesAtualCalendario, setMesAtualCalendario] = useState(new Date());
  const [contagemJogosPorDia, setContagemJogosPorDia] = useState({});

  // --- NOVA FUNÇÃO PARA MAPEAR AS FASES DA COPA ---
  const formatarNomeRodada = (r) => {
    if (officialLeagueId === 12) {
      const fasesCopa = {
        4: "16 avos de final",
        5: "Oitavas de final",
        6: "Quartas de final",
        7: "Semifinal",
        8: "3º Lugar",
        9: "Final"
      };
      return fasesCopa[r] || `${r}ª RODADA`;
    }
    return `${r}ª RODADA`;
  };

  useEffect(() => {
    async function loadBaseData() {
      if (!ligaId) return;
      setLoading(true);
      
      try {
        const { data: membros, error: errMembros } = await supabase
          .from('user_league_members')
          .select('user_id, users(name)')
          .eq('user_league_id', ligaId);
        
        if (errMembros) throw errMembros;
        setUsuarios(membros?.map(m => ({ id: m.user_id, name: m.users?.name || 'Usuário' })) || []);

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

        if (ligaInfo.leagues_config) {
          setPontosConfig({
            cravada: ligaInfo.leagues_config.exact_score_points ?? 3,
            cheio: ligaInfo.leagues_config.winner_and_one_goal_points ?? 2,
            resultado: ligaInfo.leagues_config.winner_only_points ?? 1
          });
        }

        const sId = ligaInfo.leagues?.sport_id;
        setSportId(sId);
        setSportId(infoLiga.leagues.sport_id);
        const football = sId === 1;
        setIsFootball(football);
        setOfficialLeagueId(ligaInfo.official_league_id);

        const { data: maxSeasonData } = await supabase
          .from('matches')
          .select('season')
          .eq('league_id', ligaInfo.official_league_id)
          .order('season', { ascending: false })
          .limit(1);
        
        const ultimaTemporada = maxSeasonData && maxSeasonData.length > 0 ? maxSeasonData[0].season : new Date().getFullYear().toString();
        setTemporadaAtiva(ultimaTemporada);

        if (football) {
          const { data: rounds } = await supabase.from('matches')
            .select('round')
            .eq('league_id', ligaInfo.official_league_id)
            .eq('season', ultimaTemporada)
            .order('round', { ascending: true });
          
          const uniqueRounds = [...new Set(rounds?.map(r => r.round))];
          setListaRodadas(uniqueRounds);

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
  }, [ligaId, officialLeagueId]); // Adicionado officialLeagueId como dependência segura

  async function buscarContagemJogos(offId, seasonStr, footballMode, roundValue) {
    try {
      let query = supabase.from('matches').select('date').eq('league_id', offId).eq('season', seasonStr);
      if (footballMode && roundValue) {
        query = query.eq('round', roundValue);
      }
      const { data } = await query;
      const mapaContagem = {};
      data?.forEach(j => {
        const dStr = new Date(j.date).toLocaleDateString('en-CA');
        mapaContagem[dStr] = (mapaContagem[dStr] || 0) + 1;
      });
      setContagemJogosPorDia(mapaContagem);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchMatches(offId, seasonStr, dateStr) {
    setLoadingPreds(true);
    try {
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

  const converterImagemParaBase64 = (url) => {
    return new Promise((resolve) => {
      if (!url) return resolve('');
      const img = new Image();
      const urlComBypass = url.includes('?') ? `${url}&cors=bypass` : `${url}?cors=bypass`;
      img.crossOrigin = 'anonymous';
      img.src = urlComBypass;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        try {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error("Erro ao renderizar imagem no canvas intermediário:", e);
          resolve('');
        }
      };
      img.onerror = () => {
        console.warn("Não foi possível carregar a imagem via CORS:", url);
        resolve('');
      };
    });
  };

  const handleShareCard = async (jogo) => {
    if (!jogo) return;
    
    const elementoCard = cardRefs.current[jogo.id];
    if (!elementoCard) {
      alert("Não foi possível renderizar o card.");
      return;
    }

    try {
      const botaoShare = elementoCard.querySelector('button');
      if (botaoShare) botaoShare.style.visibility = 'hidden';

      const dataUrl = await htmlToImage.toPng(elementoCard, {
        quality: 0.95,
        backgroundColor: '#1A1C3A',
        style: { borderRadius: '30px' },
        cacheBust: true, 
      });

      if (botaoShare) botaoShare.style.visibility = 'visible';

      const res = await fetch(dataUrl);
      const blobPng = await res.blob();

      const nomeArquivo = `iChute-${jogo.home?.name || 'confronto'}.png`;
      const arquivoImagem = new File([blobPng], nomeArquivo, { type: 'image/png' });
      const textoCompartilhar = `🏆 *iChute* 🏆\nConfira os palpites do jogo direto no app!`;

      if (navigator.canShare && navigator.canShare({ files: [arquivoImagem] })) {
        try {
          await navigator.share({
            files: [arquivoImagem],
            title: 'iChute Comparativo',
            text: textoCompartilhar
          });
        } catch (shareErr) {
          console.error("Compartilhamento nativo cancelado:", shareErr);
        }
      } else {
        const linkDownloadTemp = document.createElement('a');
        linkDownloadTemp.href = dataUrl;
        linkDownloadTemp.download = nomeArquivo;
        linkDownloadTemp.click();
        alert("Card gerado e baixado! Agora é só colar no grupo do WhatsApp! 👍");
      }

    } catch (err) {
      console.error("Erro geral na geração do card:", err);
      alert("Houve um problema ao gerar o print do card.");
    }
  };

  const gerarDiasDoCalendario = () => {
    const ano = mesAtualCalendario.getFullYear();
    const mes = mesAtualCalendario.getMonth();
    const primeiroDiaDoMes = new Date(ano, mes, 1).getDay();
    const totalDiasNoMes = new Date(ano, mes + 1, 0).getDate();
    
    const painelDias = [];
    for (let i = 0; i < primeiroDiaDoMes; i++) painelDias.push(null);
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
      return { bg: "bg-[#39FF14]", text: "text-[#2B302A]", border: "border-[#39FF14]" }; 
    }
    if (pts > 0 && pts === pontosConfig.cheio) {
      return { bg: "bg-[#FAFF00]/40", text: "text-white", border: "border-[#FAFF00]/50" };
    }
    if (pts > 0 && pts === pontosConfig.resultado) {
      return { bg: "bg-[#0077FF]/40", text: "text-white", border: "border-[#0077FF]/50" };
    }
    return { bg: "bg-[#0A0E2A]/60", text: "text-white/20", border: "border-white/5" };
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center">
      <div className="text-[#0077FF] font-black italic animate-pulse tracking-widest">SINCRONIZANDO...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-40 font-sans subpixel-antialiased">
      <header className="max-w-2xl mx-auto flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center mb-2">
          <button 
            onClick={() => navigate(sportId ? `/leagues/${sportId}` : '/home')} 
            className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]"
          >
            ← VOLTAR
          </button>
          <div className="text-right">
            <Link to="/" className="block">
                <Logo size="sm" />
              </Link>
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
              {/* --- ALTERADO AQUI PARA FAZER O MAPEAMENTO COM A NOVA FUNÇÃO --- */}
              {listaRodadas.map(r => (
                <option key={r} value={r}>
                  {formatarNomeRodada(r)}
                </option>
              ))}
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
          const jogoJaComecou = new Date().toISOString() >= jogo.date;

          return (
            <div 
              key={jogo.id} 
              ref={el => cardRefs.current[jogo.id] = el}
              className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[30px] relative overflow-hidden"
            >
              <button 
                onClick={() => handleShareCard(jogo)}
                className="absolute top-4 right-5 text-white/30 hover:text-[#0077FF] transition-colors z-20"
                title="Compartilhar resultado"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186l5.566-3.132m-5.566 3.132l5.566 3.132m0 0a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185m0-6.264a2.25 2.25 0 1 0 3.933-2.186 2.25 2.25 0 0 0-3.933 2.186" />
                </svg>
              </button>

              <div className="flex justify-center items-center gap-6 mb-6 bg-[#0A0E2A]/50 py-4 px-6 rounded-[20px] max-w-md mx-auto">
                <div className="flex items-center gap-3 justify-end w-5/12">
                  <span className="text-[11px] font-black uppercase text-white/80 tracking-wide text-right truncate max-w-[90px]">{jogo.home?.name}</span>
                  <img src={jogo.home?.url_logo} className="w-7 h-7 object-contain" alt="" />
                </div>

                <div className="flex items-center gap-2.5 justify-center w-2/12 select-none">
                  <span className="text-2xl font-black italic tracking-tighter text-white">{jogo.goals_home ?? '-'}</span>
                  <span className="text-[#0077FF] text-xs font-black italic opacity-40">X</span>
                  <span className="text-2xl font-black italic tracking-tighter text-white">{jogo.goals_away ?? '-'}</span>
                </div>

                <div className="flex items-center gap-3 justify-start w-5/12">
                  <img src={jogo.away?.url_logo} className="w-7 h-7 object-contain" alt="" />
                  <span className="text-[11px] font-black uppercase text-white/80 tracking-wide text-left truncate max-w-[90px]">{jogo.away?.name}</span>
                </div>
              </div>

              <div className="grid gap-2">
                {usuarios.map((u) => {
                  const p = palpitesMatriz[jogo.id]?.[u.id];
                  const pts = p?.points || 0;
                  const theme = getPointTheme(pts);
                  
                  const ehDonoDoPalpite = u.id === (supabase.auth.user?.()?.id || null);
                  const revelarPalpite = jogoJaComecou || ehDonoDoPalpite;

                  return (
                    <div key={u.id} className={`flex justify-between items-center p-3 rounded-xl border ${theme.border} bg-[#0A0E2A]/40`}>
                      <span className="text-[10px] font-black uppercase italic text-white/50 w-1/4">{u.name.split(' ')[0]}</span>
                      
                      <div className="w-2/4 flex justify-center">
                        <span className={`font-black italic text-xs tracking-wider ${p ? 'text-white' : 'text-white/20'}`}>
                          {p 
                            ? (revelarPalpite ? `${p.home} x ${p.away}` : "?? x ??") 
                            : '-- x --'
                          }
                        </span>
                      </div>

                      <div className="w-1/4 flex justify-end">
                        <div className={`min-w-[60px] text-center py-1 px-2 rounded-lg text-[8px] font-black italic tracking-wide transition-all ${theme.bg} ${theme.text}`}>
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