import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';

// Dicionário NHL
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

// Dicionário Oficial da Copa mapeado por ID
const WORLD_CUP_MAPPING = {
  53: { grupo: "Grupo A" }, 54: { grupo: "Grupo E" }, 55: { grupo: "Grupo H" }, 56: { grupo: "Grupo J" },
  57: { grupo: "Grupo J" }, 58: { grupo: "Grupo D" }, 59: { grupo: "Grupo J" }, 60: { grupo: "Grupo G" },
  61: { grupo: "Grupo B" }, 62: { grupo: "Grupo C" }, 63: { grupo: "Grupo H" }, 64: { grupo: "Grupo B" },
  65: { grupo: "Grupo B" }, 66: { grupo: "Grupo K" }, 67: { grupo: "Grupo K" }, 68: { grupo: "Grupo A" },
  69: { grupo: "Grupo E" }, 70: { grupo: "Grupo L" }, 71: { grupo: "Grupo E" }, 72: { grupo: "Grupo G" },
  73: { grupo: "Grupo E" }, 74: { grupo: "Grupo C" }, 75: { grupo: "Grupo H" }, 76: { grupo: "Grupo D" },
  77: { grupo: "Grupo I" }, 78: { grupo: "Grupo L" }, 79: { grupo: "Grupo C" }, 80: { grupo: "Grupo L" },
  81: { grupo: "Grupo G" }, 82: { grupo: "Grupo I" }, 83: { grupo: "Grupo F" }, 84: { grupo: "Grupo J" },
  85: { grupo: "Grupo C" }, 86: { grupo: "Grupo A" }, 87: { grupo: "Grupo I" }, 88: { grupo: "Grupo G" },
  89: { grupo: "Grupo F" }, 90: { grupo: "Grupo L" }, 91: { grupo: "Grupo D" }, 92: { grupo: "Grupo K" },
  93: { grupo: "Grupo I" }, 94: { grupo: "Grupo F" }, 95: { grupo: "Grupo B" }, 96: { grupo: "Grupo A" },
  97: { grupo: "Grupo F" }, 98: { grupo: "Grupo D" }, 99: { grupo: "Grupo H" }, 100: { grupo: "Grupo K" }
};

export default function WhatIf() {
  const { ligaId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [ligaNome, setLigaNome] = useState('');
  const [isFootball, setIsFootball] = useState(true);
  const [isWorldCup, setIsWorldCup] = useState(false);
  const [tabelaCalculada, setTabelaCalculada] = useState([]);
  const [sportId, setSportId] = useState(null);

  // Filtros NHL / Copa
  const [filtroConferencia, setFiltroConferencia] = useState('Todas');
  const [filtroDivisao, setFiltroDivisao] = useState('Todas');
  const [filtroGrupo, setFiltroGrupo] = useState('Todos');

  useEffect(() => {
    if (ligaId) calcularCenarioFuture();
  }, [ligaId]);

  async function calcularCenarioFuture() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/');

      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
      if (!userData) return;

      // 1. Busca os metadados da liga
      const { data: infoLiga } = await supabase
        .from('user_leagues')
        .select(`name, official_league_id, leagues (sport_id)`)
        .eq('id', ligaId)
        .single();

      if (!infoLiga) return;

      const football = infoLiga.leagues.sport_id === 1;
      const worldCup = infoLiga.official_league_id === 12;

      setSportId(infoLiga.leagues.sport_id);
      setLigaNome(infoLiga.name);
      setIsFootball(football);
      setIsWorldCup(worldCup);

      // 2. Busca em paralelo: View de estatísticas + Tabela de Times + Jogos
      const [
        { data: statsView, error: viewError },
        { data: teamsData },
        { data: allMatches }
      ] = await Promise.all([
        supabase
          .from('user_team_what_if_stats')
          .select('*')
          .eq('user_id', userData.id)
          .eq('user_league_id', ligaId),
        
        supabase
          .from('teams')
          .select('id, name, url_logo'),

        supabase
          .from('matches')
          .select('home_team_id, away_team_id')
          .eq('league_id', infoLiga.official_league_id)
      ]);

      if (viewError) throw viewError;

      // Mapa de times para consulta rápida O(1)
      const teamsMap = {};
      teamsData?.forEach(t => {
        teamsMap[t.id] = t;
      });

      // Total de jogos por time para o cálculo de "S/ Palpite"
      const totalMatchesPerTeam = {};
      allMatches?.forEach(m => {
        totalMatchesPerTeam[m.home_team_id] = (totalMatchesPerTeam[m.home_team_id] || 0) + 1;
        totalMatchesPerTeam[m.away_team_id] = (totalMatchesPerTeam[m.away_team_id] || 0) + 1;
      });

      // 3. Monta a tabela final combinando os dados da View com as informações do time
      const finalArray = (statsView || []).map(row => {
        const team = teamsMap[row.team_id] || {};
        const teamName = team.name || 'Time Desconhecido';
        const teamId = row.team_id;

        const nhlInfo = NHL_MAPPING[teamName] || { conf: "N/A", div: "N/A" };
        const wcInfo = WORLD_CUP_MAPPING[teamId] || { grupo: "N/A" };

        const totalExpected = totalMatchesPerTeam[teamId] || 38;
        const semPalpite = totalExpected - row.jogos;

        const pPct = row.jogos > 0 ? (row.pts / (row.jogos * 2)).toFixed(2) : "0,00";

        return {
          id: teamId,
          name: teamName,
          logo: team.url_logo,
          jogos: row.jogos,
          w: row.w,
          d: row.d,
          l: row.l,
          otl: row.d,
          pts: row.pts,
          pPct,
          gf: row.gf,
          ga: row.ga,
          diff: row.diff,
          acertoW: row.acerto_v,
          acertoE: row.acerto_e,
          acertoD: row.acerto_d,
          acertoGols: row.acerto_gols,
          cravada: row.cravada,
          semPalpite: semPalpite < 0 ? 0 : semPalpite,
          conferencia: nhlInfo.conf,
          divisao: nhlInfo.div,
          grupo: wcInfo.grupo
        };
      });

      finalArray.sort((a, b) => b.pts - a.pts || b.w - a.w || b.diff - a.diff);
      setTabelaCalculada(finalArray);

    } catch (err) {
      console.error("Erro ao carregar View 'E se?':", err);
    } finally {
      setLoading(false);
    }
  }

  const tabelaFiltrada = tabelaCalculada.filter(t => {
    if (!isFootball) { 
      const bateConf = filtroConferencia === 'Todas' || t.conferencia === filtroConferencia;
      const bateDiv = filtroDivisao === 'Todas' || t.divisao === filtroDivisao;
      return bateConf && bateDiv;
    }
    if (isWorldCup) { 
      return filtroGrupo === 'Todos' || t.grupo === filtroGrupo;
    }
    return true;
  });

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black animate-pulse tracking-widest">
      PROJETANDO CENÁRIO ALTERNATIVO...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40 overflow-x-hidden">
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-6">
        <button 
          onClick={() => navigate(sportId ? `/leagues/${sportId}` : '/home')} 
          className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]"
        >
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

      {/* FILTROS EXCLUSIVOS COPA DO MUNDO */}
      {isWorldCup && (
        <div className="max-w-7xl mx-auto mb-6 bg-[#1A1C3A] p-4 rounded-[25px] border border-[#26283A]">
          <label className="block text-[8px] font-black uppercase text-gray-400 mb-2 pl-1 tracking-wider">Grupo da Copa</label>
          <select 
            value={filtroGrupo} 
            onChange={e => setFiltroGrupo(e.target.value)}
            className="w-full bg-[#0A0E2A] border border-[#26283A] text-xs font-bold rounded-xl p-3 outline-none text-white focus:border-[#0077FF]"
          >
            <option value="Todos">Todos os Grupos</option>
            {["Grupo A", "Grupo B", "Grupo C", "Grupo D", "Grupo E", "Grupo F", "Grupo G", "Grupo H", "Grupo I", "Grupo J", "Grupo K", "Grupo L"].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      )}

      {/* TABELA DE CLASSIFICAÇÃO PROJETADA */}
      <div className="max-w-7xl mx-auto bg-[#1A1C3A] border border-[#26283A] rounded-[35px] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[#0A0E2A] border-b border-[#26283A] text-gray-400 text-[9px] font-black uppercase italic tracking-wider">
                <th className="py-4 pl-6 w-12 text-center">Pos</th>
                <th className="py-4 pl-4 min-w-[180px]">Time</th>
                {isWorldCup && <th className="py-4 text-center">Grupo</th>}
                <th className="py-4 text-center">Jogos</th>
                <th className="py-4 text-center">V</th>
                <th className="py-4 text-center">{isFootball ? 'E' : 'OTL'}</th>
                <th className="py-4 text-center">D</th>
                <th className="py-4 text-center text-white bg-[#0077FF]/20 px-2">PTS</th>
                {!isFootball && <th className="py-4 text-center">P%</th>}
                <th className="py-4 text-center">GF</th>
                <th className="py-4 text-center">GA</th>
                <th className="py-4 text-center">DIFF</th>
                <th className="py-4 text-center text-[#55DD55] bg-green-500/5">Acerto V</th>
                {isFootball && <th className="py-4 text-center text-[#55DDDD] bg-cyan-500/5">Acerto E</th>}
                <th className="py-4 text-center text-[#FF5555] bg-red-500/5">Acerto D</th>
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
                  {isWorldCup && <td className="py-4 text-center font-mono text-[10px] text-gray-400 uppercase tracking-tight">{team.grupo}</td>}
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
                  {isFootball && <td className="py-4 text-center text-cyan-400 bg-cyan-500/5 font-black">{team.acertoE}</td>}
                  <td className="py-4 text-center text-red-400 bg-red-500/5 font-black">{team.acertoD}</td>
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