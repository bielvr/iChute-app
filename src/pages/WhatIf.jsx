import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';
import Logo from '../components/Logo';

// Dicionário para classificar conferência/divisão na NHL sem mexer no banco
const NHL_MAPPING = {
  "Edmonton Oilers": { conf: "Oeste", div: "Pacífico" },
  "Colorado Avalanche": { conf: "Oeste", div: "Central" },
  "Vegas Golden Knights": { conf: "Oeste", div: "Pacífico" },
  "Montréal Canadiens": { conf: "Leste", div: "Atlântico" },
  "Carolina Hurricanes": { conf: "Leste", div: "Metropolitana" },
  "Tampa Bay Lightning": { conf: "Leste", div: "Atlântico" },
  "Minnesota Wild": { conf: "Oeste", div: "Central" },
  "Washington Capitals": { conf: "Leste", div: "Metropolitana" },
  "St. Louis Blues": { conf: "Oeste", div: "Central" },
  "Detroit Red Wings": { conf: "Leste", div: "Atlântico" },
  "New Jersey Devils": { conf: "Leste", div: "Metropolitana" },
  "Dallas Stars": { conf: "Oeste", div: "Central" },
  "Pittsburgh Penguins": { conf: "Leste", div: "Metropolitana" },
  "Florida Panthers": { conf: "Leste", div: "Atlântico" },
  "Boston Bruins": { conf: "Leste", div: "Atlântico" },
  "Anaheim Ducks": { conf: "Oeste", div: "Pacífico" },
  "Utah Mammoth": { conf: "Oeste", div: "Central" },
  "New York Rangers": { conf: "Leste", div: "Metropolitana" },
  "Philadelphia Flyers": { conf: "Leste", div: "Metropolitana" },
  "Ottawa Senators": { conf: "Leste", div: "Atlântico" },
  "Winnipeg Jets": { conf: "Oeste", div: "Central" },
  "Buffalo Sabres": { conf: "Leste", div: "Atlântico" },
  "Los Angeles Kings": { conf: "Oeste", div: "Pacífico" },
  "Toronto Maple Leafs": { conf: "Leste", div: "Atlântico" },
  "San Jose Sharks": { conf: "Oeste", div: "Pacífico" },
  "Seattle Kraken": { conf: "Oeste", div: "Pacífico" },
  "Columbus Blue Jackets": { conf: "Leste", div: "Metropolitana" }
};

export default function WhatIf() {
  const { ligaId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [ligaNome, setLigaNome] = useState('');
  const [isFootball, setIsFootball] = useState(true);
  const [tabelaCalculada, setTabelaCalculada] = useState([]);

  // Filtros NHL
  const [filtroConferencia, setFiltroConferencia] = useState('Todas');
  const [filtroDivisao, setFiltroDivisao] = useState('Todas');

  useEffect(() => {
    if (ligaId) calcularCenarioFuturo();
  }, [ligaId]);

  async function calcularCenarioFuturo() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/');

      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
      if (!userData) return;

      // 1. Pega os dados da Liga e do Esporte
      const { data: infoLiga } = await supabase
        .from('user_leagues')
        .select(`name, official_league_id, leagues (sport_id)`)
        .eq('id', ligaId)
        .single();

      setLigaNome(infoLiga.name);
      const football = infoLiga.leagues.sport_id === 1;
      setIsFootball(football);

      // 2. Pega todas as partidas da liga oficial
      const { data: matches } = await supabase
        .from('matches')
        .select(`*, home:home_team_id(id, name, url_logo), away:away_team_id(id, name, url_logo)`)
        .eq('league_id', infoLiga.official_league_id);

      // 3. Pega todos os palpites desse jogador nesta liga de amigos
      const { data: predictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userData.id)
        .eq('user_league_id', ligaId);

      const predMap = {};
      predictions?.forEach(p => {
        predMap[p.match_id] = p;
      });

      // Estrutura inicial do acumulador por Time
      const teamsStats = {};

      const inicializarTime = (team) => {
        if (!teamsStats[team.id]) {
          const nhlInfo = NHL_MAPPING[team.name] || { conf: "N/A", div: "N/A" };
          teamsStats[team.id] = {
            id: team.id,
            name: team.name,
            logo: team.url_logo,
            jogos: 0, w: 0, d: 0, l: 0, otl: 0,
            pts: 0, gf: 0, ga: 0,
            acertoW: 0, acertoL: 0, acertoGols: 0, cravada: 0, semPalpite: 0,
            conferencia: nhlInfo.conf,
            divisao: nhlInfo.div
          };
        }
      };

      // Processa cada partida mesclando a realidade (se jogada) ou o palpite (se houver)
      matches?.forEach(match => {
        if (!match.home || !match.away) return;
        inicializarTime(match.home);
        inicializarTime(match.away);

        const palpite = predMap[match.id];

        // Definindo quais placares usaremos para o cenário "E se?"
        let goalsHome = match.goals_home;
        let goalsAway = match.goals_away;
        let temPalpite = !!palpite;

        // Se o jogo não aconteceu ou o usuário quer ver o impacto do palpite dele, simulamos com o palpite
        if (temPalpite) {
          goalsHome = palpite.prediction_home;
          goalsAway = palpite.prediction_away;
        }

        // Se o jogo não aconteceu na vida real e ele não palpitou, fica sem somar na tabela simulada
        if (match.status !== 'FT' && !temPalpite) {
          teamsStats[match.home.id].semPalpite += 1;
          teamsStats[match.away.id].semPalpite += 1;
          return; 
        }

        // Atualiza jogos e gols pro cenário simulado
        teamsStats[match.home.id].jogos += 1;
        teamsStats[match.away.id].jogos += 1;
        teamsStats[match.home.id].gf += goalsHome;
        teamsStats[match.home.id].ga += goalsAway;
        teamsStats[match.away.id].gf += goalsAway;
        teamsStats[match.away.id].ga += goalsHome;

        // Cálculo de V-E-D do cenário simulado
        if (football) {
          if (goalsHome > goalsAway) {
            teamsStats[match.home.id].w += 1;
            teamsStats[match.home.id].pts += 3;
            teamsStats[match.away.id].l += 1;
          } else if (goalsHome < goalsAway) {
            teamsStats[match.away.id].w += 1;
            teamsStats[match.away.id].pts += 3;
            teamsStats[match.home.id].l += 1;
          } else {
            teamsStats[match.home.id].d += 1;
            teamsStats[match.home.id].pts += 1;
            teamsStats[match.away.id].d += 1;
            teamsStats[match.away.id].pts += 1;
          }
        } else {
          // Regra NHL (2pts Win, 1pt OTL, 0pts Loss)
          // Na simplificação de placar, se empatar no tempo normal, consideramos OTL para quem perdeu na prorrogação
          if (goalsHome > goalsAway) {
            teamsStats[match.home.id].w += 1;
            teamsStats[match.home.id].pts += 2;
            if (goalsHome === goalsAway + 1 && match.status === 'OT') { // Exemplo de prorrogação simulada
              teamsStats[match.away.id].otl += 1;
              teamsStats[match.away.id].pts += 1;
            } else {
              teamsStats[match.away.id].l += 1;
            }
          } else {
            teamsStats[match.away.id].w += 1;
            teamsStats[match.away.id].pts += 2;
            if (goalsAway === goalsHome + 1 && match.status === 'OT') {
              teamsStats[match.home.id].otl += 1;
              teamsStats[match.home.id].pts += 1;
            } else {
              teamsStats[match.home.id].l += 1;
            }
          }
        }

        // --- CÁLCULO DE ACERTOS DO JOGADOR (Comparando Palpite vs Vida Real se houver jogo encerrado) ---
        if (match.status === 'FT' && temPalpite) {
          const realH = match.goals_home;
          const realA = match.goals_away;
          const palpH = palpite.prediction_home;
          const palpA = palpite.prediction_away;

          const ganhouHomeReal = realH > realA;
          const ganhouAwayReal = realA > realH;
          const empateReal = realH === realA;

          const ganhouHomePalp = palpH > palpA;
          const ganhouAwayPalp = palpA > palpH;
          const empatePalp = palpH === palpA;

          // Cravada exata
          if (realH === palpH && realA === palpA) {
            teamsStats[match.home.id].cravada += 1;
            teamsStats[match.away.id].cravada += 1;
            // Conta cumulativamente para as outras colunas conforme a regra descrita
            teamsStats[match.home.id].acertoGols += 1;
            teamsStats[match.away.id].acertoGols += 1;
            teamsStats[match.home.id].acertoW += 1;
            teamsStats[match.away.id].acertoW += 1;
          } else {
            // Acertou vencedor ou empate de forma simples
            if ((ganhouHomeReal && ganhouHomePalp) || (ganhouAwayReal && ganhouAwayPalp) || (empateReal && empatePalp)) {
              teamsStats[match.home.id].acertoW += 1;
              teamsStats[match.away.id].acertoW += 1;
            } else {
              // Errou a tendência do time (Acerto de Derrota computado aqui)
              teamsStats[match.home.id].acertoL += 1;
              teamsStats[match.away.id].acertoL += 1;
            }

            // Acertou número de gols individual de forma isolada
            if (realH === palpH) teamsStats[match.home.id].acertoGols += 1;
            if (realA === palpA) teamsStats[match.away.id].acertoGols += 1;
          }
        }
      });

      // Transforma o objeto em array e calcula saldos finais e ordenação competitiva
      const finalArray = Object.values(teamsStats).map(t => {
        const diff = t.gf - t.ga;
        // Point Percentage na NHL: Pts / (Jogos * 2)
        const pPct = t.jogos > 0 ? (t.pts / (t.jogos * 2)).toFixed(2) : "0,00";
        return { ...t, diff, pPct };
      });

      // Ordenação Padrão: Pontos -> Vitórias -> Saldo de Gols
      finalArray.sort((a, b) => b.pts - a.pts || b.w - a.w || b.diff - a.diff);

      setTabelaCalculada(finalArray);
    } catch (err) {
      console.error("Erro ao simular cenário 'E se?':", err);
    } finally {
      setLoading(false);
    }
  }

  // Filtragem Dinâmica em memória para o cenário da NHL
  const tabelaFiltrada = tabelaCalculada.filter(t => {
    if (isFootball) return true;
    const bateConf = filtroConferencia === 'Todas' || t.conferencia === filtroConferencia;
    const bateDiv = filtroDivisao === 'Todas' || t.divisao === filtroDivisao;
    return bateConf && bateDiv;
  });

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black animate-pulse tracking-widest">
      PROJETANDO CENÁRIO FUTURO...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40 overflow-x-hidden">
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)} className="bg-[#1A1C3A] px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A] uppercase italic hover:bg-[#0077FF] transition-all">
          ← VOLTAR
        </button>
        <div className="text-right">
          <h1 className="text-xl font-black italic text-[#0077FF] uppercase tracking-tighter leading-none">CENÁRIO "E SE?"</h1>
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block mt-1">{ligaNome}</span>
        </div>
      </header>

      {/* FILTROS EXCLUSIVOS NHL */}
      {!isFootball && (
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-4 mb-6 bg-[#1A1C3A] p-4 rounded-[25px] border border-[#26283A]">
          <div>
            <label className="block text-[8px] font-black uppercase text-gray-400 mb-2 pl-1 tracking-wider">Conferência</label>
            <select 
              value={filtroConferencia} 
              onChange={e => setFiltroConferencia(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] text-xs font-bold rounded-xl p-3 outline-none text-white focus:border-[#0077FF]"
            >
              <option value="Todas">Todas as Conferências</option>
              <option value="Leste">Leste</option>
              <option value="Oeste">Oeste</option>
            </select>
          </div>
          <div>
            <label className="block text-[8px] font-black uppercase text-gray-400 mb-2 pl-1 tracking-wider">Divisão</label>
            <select 
              value={filtroDivisao} 
              onChange={e => setFiltroDivisao(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] text-xs font-bold rounded-xl p-3 outline-none text-white focus:border-[#0077FF]"
            >
              <option value="Todas">Todas as Divisões</option>
              <option value="Atlântico">Atlântico</option>
              <option value="Metropolitana">Metropolitana</option>
              <option value="Central">Central</option>
              <option value="Pacífico">Pacífico</option>
            </select>
          </div>
        </div>
      )}

      {/* TABELA DE CLASSIFICAÇÃO PROJETADA */}
      <div className="max-w-7xl mx-auto bg-[#1A1C3A] border border-[#26283A] rounded-[35px] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#0A0E2A] border-b border-[#26283A] text-gray-400 text-[9px] font-black uppercase italic tracking-wider">
                <th className="py-4 pl-6 w-12 text-center">Pos</th>
                <th className="py-4 pl-4 min-w-[180px]">Time</th>
                <th className="py-4 text-center">Jogos</th>
                <th className="py-4 text-center">W</th>
                <th className="py-4 text-center">{isFootball ? 'E' : 'OTL'}</th>
                <th className="py-4 text-center">L</th>
                <th className="py-4 text-center text-white bg-[#0077FF]/20 px-2">PTS</th>
                {!isFootball && <th className="py-4 text-center">P%</th>}
                <th className="py-4 text-center">GF</th>
                <th className="py-4 text-center">GA</th>
                <th className="py-4 text-center">DIFF</th>
                <th className="py-4 text-center text-[#55DD55] bg-green-500/5">Acerto W</th>
                <th className="py-4 text-center text-[#FF5555] bg-red-500/5">Acerto L</th>
                <th className="py-4 text-center text-amber-400 bg-amber-500/5">Acerto Gols</th>
                <th className="py-4 text-center text-[#0077FF] bg-[#0077FF]/5">Cravada</th>
                <th className="py-4 text-center text-gray-500 pr-6">S/ Palpite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26283A] text-xs font-bold">
              {tabelaFiltrada.map((team, idx) => (
                <tr key={team.id} className="hover:bg-[#0A0E2A]/40 transition-colors">
                  <td className="py-4 pl-6 text-center text-gray-500 font-black italic">{idx + 1}º</td>
                  <td className="py-4 pl-4 flex items-center gap-3">
                    <img src={team.logo} className="w-6 h-6 object-contain" alt="" />
                    <span className="uppercase tracking-tight truncate text-white">{team.name}</span>
                  </td>
                  <td className="py-4 text-center opacity-80">{team.jogos}</td>
                  <td className="py-4 text-center font-black text-white">{team.w}</td>
                  <td className="py-4 text-center opacity-80">{isFootball ? team.d : team.otl}</td>
                  <td className="py-4 text-center opacity-80">{team.l}</td>
                  <td className="py-4 text-center font-black text-[#0077FF] bg-[#0077FF]/10 text-sm px-2">{team.pts}</td>
                  {!isFootball && <td className="py-4 text-center text-gray-300 font-mono">{team.pPct}</td>}
                  <td className="py-4 text-center opacity-70">{team.gf}</td>
                  <td className="py-4 text-center opacity-70">{team.ga}</td>
                  <td className={`py-4 text-center font-mono ${team.diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {team.diff > 0 ? `+${team.diff}` : team.diff}
                  </td>
                  <td className="py-4 text-center text-green-400 bg-green-500/5 font-black">{team.acertoW}</td>
                  <td className="py-4 text-center text-red-400 bg-red-500/5 font-black">{team.acertoL}</td>
                  <td className="py-4 text-center text-amber-400 bg-amber-500/5 font-black">{team.acertoGols}</td>
                  <td className="py-4 text-center text-[#0077FF] bg-[#0077FF]/5 font-black text-sm">{team.cravada}</td>
                  <td className="py-4 text-center text-gray-600 font-normal pr-6">{team.semPalpite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BottomNav />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0A0E2A; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #26283A; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #0077FF; }
      `}} />
    </div>
  );
}