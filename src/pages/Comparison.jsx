import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';

export default function Comparison() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [jogos, setJogos] = useState([]);
  const [palpitesMatriz, setPalpitesMatriz] = useState({});
  const [sportId, setSportId] = useState(null);
  
  const [tabs, setTabs] = useState([]); 
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    async function loadData() {
      if (!ligaId) return;
      setLoading(true);
      
      try {
        // 1. Buscar membros (Corrigido para user_league_members)
        const { data: membros, error: errMembros } = await supabase
          .from('user_league_members')
          .select('user_id, users(name)')
          .eq('user_league_id', ligaId);
        
        if (errMembros) throw errMembros;
        setUsuarios(membros?.map(m => ({ id: m.user_id, name: m.users?.name || 'Usuário' })) || []);

        // 2. Info da Liga e Sport (Corrigido para leagues)
        const { data: ligaInfo, error: errLiga } = await supabase
          .from('user_leagues')
          .select(`
            official_league_id,
            leagues:official_league_id (sport_id)
          `)
          .eq('id', ligaId)
          .single();

        if (errLiga || !ligaInfo) throw new Error("Liga não encontrada");

        const sId = ligaInfo.leagues?.sport_id;
        setSportId(sId);

        // 3. Buscar Jogos (LTE agora = iniciados ou terminados)
        const agora = new Date().toISOString();
        const { data: matches, error: errMatches } = await supabase
          .from('matches')
          .select(`*, home:home_team_id(name, url_logo), away:away_team_id(name, url_logo)`)
          .eq('league_id', ligaInfo.official_league_id)
          .lte('date', agora)
          .order('date', { ascending: true });

        if (errMatches) throw errMatches;
        const listaJogos = matches || [];
        setJogos(listaJogos);

        // 4. Lógica de Abas (Soccer vs NHL)
        if (sId === 2) { // NHL (Datas)
          const datasUnicas = [...new Set(listaJogos.map(m => m.date.split('T')[0]))].sort();
          setTabs(datasUnicas);
          setActiveTab(datasUnicas[datasUnicas.length - 1]);
        } else { // Futebol (Rodadas)
          const rodadas = [...new Set(listaJogos.map(m => m.round))].sort((a, b) => b - a);
          setTabs(rodadas);
          setActiveTab(rodadas[0]);
        }

        // 5. Buscar Palpites
        const { data: allPreds } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_league_id', ligaId);

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

      } catch (err) {
        console.error("Erro no carregamento:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [ligaId]);

  // Scroll automático para o final na NHL
  useEffect(() => {
    if (sportId === 2 && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [tabs, sportId]);

  const getPointTheme = (pts) => {
    if (pts >= 3) return { bg: "bg-[#0077FF]", text: "text-white", border: "border-[#0077FF]" };
    if (pts === 2) return { bg: "bg-[#0077FF]/40", text: "text-[#0077FF]", border: "border-[#0077FF]/50" };
    return { bg: "bg-[#0A0E2A]", text: "text-white/20", border: "border-transparent" };
  };

  const jogosFiltrados = jogos.filter(j => 
    sportId === 2 ? j.date.startsWith(activeTab) : j.round === activeTab
  );

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center">
      <div className="text-[#0077FF] font-black italic animate-pulse">CARREGANDO DADOS...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-40 font-sans">
      <header className="max-w-2xl mx-auto flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)} className="bg-[#1A1C3A] px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A] uppercase italic transition-all hover:bg-[#0077FF]">
          ← VOLTAR
        </button>
        <div className="text-right">
          <h1 className="text-xl font-black italic text-[#0077FF] uppercase tracking-tighter leading-none">iCHUTE</h1>
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest italic">Comparativo de Resultados</span>
        </div>
      </header>

      {/* Seleção de Rodada/Data */}
      <div className="max-w-2xl mx-auto mb-8 overflow-hidden">
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-black italic text-[10px] border transition-all ${
                activeTab === tab ? 'bg-[#0077FF] border-[#0077FF] text-white' : 'bg-[#1A1C3A] border-[#26283A] text-white/30'
              }`}
            >
              {sportId === 2 ? new Date(tab + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : `${tab}ª RODADA`}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto grid gap-6">
        {jogosFiltrados.length === 0 && (
          <div className="text-center py-20 text-white/10 font-black italic uppercase">Nenhum resultado disponível</div>
        )}

        {jogosFiltrados.map((jogo) => (
          <div key={jogo.id} className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[30px]">
            {/* Placar Real - Usando goals_home/away do schema */}
            <div className="flex justify-between items-center mb-6 bg-[#0A0E2A]/50 p-4 rounded-[20px]">
              <div className="flex flex-col items-center w-1/3">
                <img src={jogo.home?.url_logo} className="w-8 h-8 object-contain mb-1" alt="" />
                <span className="text-[8px] font-black uppercase text-white/40">{jogo.home?.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black italic">{jogo.goals_home ?? '-'}</span>
                <span className="text-[#0077FF] font-black italic opacity-30">X</span>
                <span className="text-3xl font-black italic">{jogo.goals_away ?? '-'}</span>
              </div>
              <div className="flex flex-col items-center w-1/3">
                <img src={jogo.away?.url_logo} className="w-8 h-8 object-contain mb-1" alt="" />
                <span className="text-[8px] font-black uppercase text-white/40">{jogo.away?.name}</span>
              </div>
            </div>

            {/* Lista de Palpites da Liga */}
            <div className="grid gap-2">
              {usuarios.map((u) => {
                const p = palpitesMatriz[jogo.id]?.[u.id];
                const pts = p?.points || 0;
                const theme = getPointTheme(pts);
                return (
                  <div key={u.id} className={`flex justify-between items-center p-3 rounded-xl border ${theme.border} bg-[#0A0E2A]/40`}>
                    <span className="text-[9px] font-black uppercase italic text-white/50">{u.name.split(' ')[0]}</span>
                    <div className="flex items-center gap-3">
                      <span className={`font-black italic text-xs ${p ? 'text-white' : 'text-white/20'}`}>
                        {p ? `${p.home} x ${p.away}` : '-- x --'}
                      </span>
                      <div className={`min-w-[50px] text-center py-1 px-2 rounded-lg text-[8px] font-black italic ${theme.bg} ${theme.text}`}>
                        {pts} PTS
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}