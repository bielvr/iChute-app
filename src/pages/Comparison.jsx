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
      setLoading(true);
      try {
        // 1. Buscar membros da liga
        const { data: membros } = await supabase
          .from('user_leagues_members')
          .select('user_id, users(name)')
          .eq('user_league_id', ligaId);
        setUsuarios(membros?.map(m => ({ id: m.user_id, name: m.users.name })) || []);

        // 2. Buscar Info da Liga (oficial_league_id e Sport)
        const { data: ligaInfo } = await supabase
          .from('user_leagues')
          .select(`
            official_league_id,
            official_leagues (sport_id)
          `)
          .eq('id', ligaId)
          .single();

        const sId = ligaInfo?.official_leagues?.sport_id;
        setSportId(sId);

        // 3. Buscar Jogos (Apenas os que já começaram ou terminaram)
        const agora = new Date().toISOString();
        const { data: matches } = await supabase
          .from('matches')
          .select(`*, home:home_team_id(name, url_logo), away:away_team_id(name, url_logo)`)
          .eq('league_id', ligaInfo.official_league_id)
          .lte('date', agora)
          .order('date', { ascending: true }); // Ascendente para a linha do tempo da NHL fazer sentido

        const listaJogos = matches || [];
        setJogos(listaJogos);

        // 4. Lógica de Agrupamento (Tabs)
        if (sId === 2) { // NHL (por Datas)
          const datasUnicas = [...new Set(listaJogos.map(m => m.date.split('T')[0]))].sort();
          setTabs(datasUnicas);
          setActiveTab(datasUnicas[datasUnicas.length - 1]); // Seleciona a mais recente
        } else { // Futebol (por Rodadas com jogos finalizados)
          const rodadasComFinalizados = [...new Set(
            listaJogos
              .filter(m => ['finished', 'off'].includes(m.status?.toLowerCase()))
              .map(m => m.round)
          )].sort((a, b) => b - a); // Rodada mais nova primeiro
          setTabs(rodadasComFinalizados);
          setActiveTab(rodadasComFinalizados[0]);
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
        console.error("Erro no carregamento:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [ligaId]);

  // Efeito para rolar a barra da NHL para a direita no início
  useEffect(() => {
    if (sportId === 2 && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [tabs, sportId]);

  const getPointTheme = (pts) => {
    if (pts >= 3) return { bg: "bg-[#0077FF]", text: "text-white", border: "border-[#0077FF]" };
    if (pts === 2) return { bg: "bg-[#0077FF]/40", text: "text-[#0077FF]", border: "border-[#0077FF]/50" };
    if (pts === 1) return { bg: "bg-[#1A1C3A]", text: "text-white/70", border: "border-[#26283A]" };
    return { bg: "bg-[#0A0E2A]", text: "text-white/20", border: "border-transparent" };
  };

  const formatTabName = (tab) => {
    if (sportId === 2) {
      const d = new Date(tab + 'T12:00:00');
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
    return `${tab}ª RODADA`;
  };

  const jogosFiltrados = jogos.filter(j => 
    sportId === 2 ? j.date.startsWith(activeTab) : j.round === activeTab
  );

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center">
      <div className="text-[#0077FF] font-black italic animate-pulse">ATUALIZANDO RESULTADOS...</div>
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
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest italic">Resultados</span>
        </div>
      </header>

      {/* Barra de Rodadas / Datas */}
      <div className="max-w-2xl mx-auto mb-8">
        <div 
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-4 no-scrollbar select-none"
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-6 py-3 rounded-2xl font-black italic text-[11px] uppercase transition-all border ${
                activeTab === tab 
                ? 'bg-[#0077FF] border-[#0077FF] text-white shadow-lg' 
                : 'bg-[#1A1C3A] border-[#26283A] text-white/40'
              }`}
            >
              {formatTabName(tab)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto grid gap-6">
        {jogosFiltrados.length === 0 && (
          <div className="text-center py-20 text-white/20 font-black italic uppercase">Nenhum resultado nesta seleção</div>
        )}

        {jogosFiltrados.map((jogo) => (
          <div key={jogo.id} className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[30px] shadow-2xl">
            {/* Placar Real */}
            <div className="flex justify-between items-center mb-6 px-2 bg-[#0A0E2A]/40 p-5 rounded-[25px]">
              <div className="flex flex-col items-center w-1/3">
                <img src={jogo.home?.url_logo} className="w-10 h-10 object-contain mb-2" alt="" />
                <span className="text-[9px] font-black uppercase text-center text-white/50">{jogo.home?.name}</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-black italic">{jogo.goals_home ?? 0}</span>
                  <span className="text-[#0077FF] font-black italic opacity-30 text-xl">X</span>
                  <span className="text-4xl font-black italic">{jogo.goals_away ?? 0}</span>
                </div>
                <span className={`text-[7px] font-black px-3 py-1 rounded-full uppercase mt-2 tracking-widest italic ${['finished', 'off'].includes(jogo.status?.toLowerCase()) ? 'bg-green-500/20 text-green-500' : 'bg-white/5 text-white/40'}`}>
                  {['finished', 'off'].includes(jogo.status?.toLowerCase()) ? 'Encerrado' : 'Em andamento'}
                </span>
              </div>

              <div className="flex flex-col items-center w-1/3">
                <img src={jogo.away?.url_logo} className="w-10 h-10 object-contain mb-2" alt="" />
                <span className="text-[9px] font-black uppercase text-center text-white/50">{jogo.away?.name}</span>
              </div>
            </div>

            {/* Comparativo de Palpites */}
            <div className="space-y-2">
              {usuarios.map((u) => {
                const p = palpitesMatriz[jogo.id]?.[u.id];
                const pts = p?.points || 0;
                const theme = getPointTheme(pts);
                
                return (
                  <div key={u.id} className={`flex justify-between items-center p-3 rounded-2xl border transition-all ${theme.border} ${pts >= 3 ? 'bg-[#0077FF]/10' : 'bg-[#0A0E2A]/50'}`}>
                    <span className="text-[10px] font-black uppercase italic text-white/60">{u.name.split(' ')[0]}</span>
                    
                    <div className="flex items-center gap-4">
                      <span className={`font-black italic text-sm ${p ? 'text-white' : 'text-white/20'}`}>
                        {p ? `${p.home} x ${p.away}` : '-- x --'}
                      </span>
                      
                      <div className={`min-w-[60px] text-center py-1.5 px-3 rounded-xl text-[9px] font-black italic uppercase ${theme.bg} ${theme.text}`}>
                        {pts > 0 ? `+${pts} PTS` : '0 PTS'}
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