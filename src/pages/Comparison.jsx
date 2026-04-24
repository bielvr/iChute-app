import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';

export default function Comparison() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [jogos, setJogos] = useState([]);
  const [palpitesMatriz, setPalpitesMatriz] = useState({});

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Membros da liga
        const { data: membros } = await supabase
          .from('user_leagues_members')
          .select('user_id, users(name)')
          .eq('user_league_id', ligaId);
        
        const listaUsers = membros?.map(m => ({ id: m.user_id, name: m.users.name })) || [];
        setUsuarios(listaUsers);

        // 2. Info da liga e Jogos (LTE agora = iniciados ou terminados)
        const { data: ligaInfo } = await supabase
          .from('user_leagues')
          .select('official_league_id')
          .eq('id', ligaId)
          .single();

        const agora = new Date().toISOString();

        const { data: matches } = await supabase
          .from('matches')
          .select(`*, home:home_team_id(name, url_logo), away:away_team_id(name, url_logo)`)
          .eq('league_id', ligaInfo.official_league_id)
          .lte('date', agora)
          .order('date', { ascending: false });
        
        setJogos(matches || []);

        // 3. Buscar palpites (Confiando na coluna points_earned do banco)
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
        console.error("Erro Comparison:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [ligaId]);

  // Lógica de cores baseada na sua paleta e nos pontos vindos do banco
  const getPointTheme = (pts) => {
    if (pts >= 3) return { 
      bg: "bg-[#0077FF]", 
      text: "text-white", 
      border: "border-[#0077FF]",
      label: "CRAVOU" 
    };
    if (pts === 2) return { 
      bg: "bg-[#0077FF]/40", 
      text: "text-[#0077FF]", 
      border: "border-[#0077FF]/50",
      label: "MEIO CHEIO" 
    };
    if (pts === 1) return { 
      bg: "bg-[#1A1C3A]", 
      text: "text-white/70", 
      border: "border-[#26283A]",
      label: "VENCEDOR" 
    };
    return { 
      bg: "bg-[#0A0E2A]", 
      text: "text-white/20", 
      border: "border-transparent",
      label: "ERROU" 
    };
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center">
      <div className="text-[#0077FF] font-black italic animate-pulse tracking-tighter">PROCESSANDO RANKINGS...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-40 font-sans">
      <header className="max-w-2xl mx-auto flex justify-between items-center mb-10">
        <button onClick={() => navigate(-1)} className="bg-[#1A1C3A] px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A] uppercase italic transition-all hover:bg-[#0077FF]">
          ← VOLTAR
        </button>
        <div className="text-right">
          <h1 className="text-xl font-black italic text-[#0077FF] uppercase tracking-tighter leading-none">iCHUTE</h1>
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest italic">Comparativo de Liga</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto grid gap-6">
        {jogos.map((jogo) => (
          <div key={jogo.id} className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[30px] shadow-2xl">
            {/* Cabeçalho do Card: Placar Real */}
            <div className="flex justify-between items-center mb-6 px-2 bg-[#0A0E2A]/30 p-4 rounded-[20px]">
              <div className="flex flex-col items-center w-1/3">
                <img src={jogo.home?.url_logo} className="w-10 h-10 object-contain mb-2" alt="" />
                <span className="text-[9px] font-black uppercase text-center text-white/50">{jogo.home?.name}</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-black italic">{jogo.home_score ?? '-'}</span>
                  <span className="text-[#0077FF] font-black italic opacity-30 text-lg">X</span>
                  <span className="text-3xl font-black italic">{jogo.away_score ?? '-'}</span>
                </div>
                {jogo.status === 'FINISHED' && (
                  <span className="text-[7px] font-black bg-white/5 px-3 py-1 rounded-full text-white/40 uppercase mt-2 tracking-widest italic">Encerrado</span>
                )}
              </div>

              <div className="flex flex-col items-center w-1/3">
                <img src={jogo.away?.url_logo} className="w-10 h-10 object-contain mb-2" alt="" />
                <span className="text-[9px] font-black uppercase text-center text-white/50">{jogo.away?.name}</span>
              </div>
            </div>

            {/* Listagem de Palpites da Galera */}
            <div className="space-y-1.5 px-1">
              {usuarios.map((u) => {
                const p = palpitesMatriz[jogo.id]?.[u.id];
                const pts = p?.points || 0;
                const theme = getPointTheme(pts);
                
                return (
                  <div key={u.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${theme.border} ${pts >= 3 ? 'bg-[#0077FF]/10' : 'bg-[#0A0E2A]/40'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase italic text-white/40">{u.name.split(' ')[0]}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`font-black italic text-sm ${pts >= 2 ? 'text-white' : 'text-white/40'}`}>
                        {p ? `${p.home} x ${p.away}` : '-- x --'}
                      </span>
                      
                      <div className={`min-w-[55px] text-center py-1 px-2 rounded-lg text-[8px] font-black italic uppercase ${theme.bg} ${theme.text}`}>
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