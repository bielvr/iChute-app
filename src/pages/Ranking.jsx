import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';

export default function Ranking() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    async function getRankingData() {
      if (!ligaId) return;
      setLoading(true);
      
      try {
        // 1. Pega o ID do usuário que está acessando o app
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);

        // 2. Busca o ranking detalhado da view
        const { data, error } = await supabase
          .from('ranking_detalhado')
          .select('*')
          .eq('user_league_id', ligaId)
          .order('total_points', { ascending: false });

        if (!error) {
          setRanking(data || []);
        }
      } catch (err) {
        console.error("Erro ao carregar ranking:", err);
      } finally {
        setLoading(false);
      }
    }
    getRankingData();
  }, [ligaId]);

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center">
      <div className="text-[#0077FF] font-black italic animate-pulse uppercase tracking-widest">Sincronizando Ranking...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-40 font-sans">
      <header className="max-w-2xl mx-auto flex justify-between items-center mb-8">
        <button onClick={() => navigate(-1)} className="bg-[#1A1C3A] px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A] uppercase italic transition-all hover:bg-[#0077FF]">
          ← VOLTAR
        </button>
        <div className="text-right">
          <h1 className="text-xl font-black italic text-[#0077FF] uppercase tracking-tighter leading-none">iCHUTE</h1>
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest italic">Posicionamento na Liga</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto grid gap-4">
        {ranking.map((user, index) => {
          // O destaque agora é para o usuário logado, não necessariamente o 1º lugar
          const isCurrentUser = String(user.user_id) === String(currentUserId);
          
          return (
            <div 
              key={user.user_id} 
              className={`relative overflow-hidden p-5 rounded-[30px] border transition-all duration-300 ${
                isCurrentUser 
                  ? 'bg-[#0077FF] border-white shadow-[0_0_25px_rgba(0,119,255,0.5)] scale-[1.02] z-10' 
                  : 'bg-[#1A1C3A] border-[#26283A] opacity-90'
              }`}
            >
              {/* Topo: Posição, Nome e Pontos */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className={`font-black italic text-2xl ${isCurrentUser ? 'text-white' : 'text-[#0077FF]'} opacity-40`}>
                    {index + 1}º
                  </span>
                  <div className="flex flex-col">
                    <span className="font-black uppercase text-sm tracking-tighter italic leading-none">
                      {user.user_name}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[7px] font-black uppercase text-white/60 tracking-widest mt-1">VOCÊ</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="block font-black text-3xl italic leading-none">{user.total_points}</span>
                  <span className={`text-[8px] font-black uppercase ${isCurrentUser ? 'text-white/70' : 'text-[#0077FF]'}`}>PONTOS</span>
                </div>
              </div>

              {/* Grid de Stats da View ranking_detalhado */}
              <div className={`grid grid-cols-4 gap-2 pt-4 border-t ${isCurrentUser ? 'border-white/20' : 'border-white/5'}`}>
                <StatItem label="Cravadas" value={user.cravadas} active={isCurrentUser} />
                <StatItem label="Bônus" value={user.vencedor_bonus} active={isCurrentUser} />
                <StatItem label="Vencedor" value={user.vencedor_only} active={isCurrentUser} />
                <StatItem label="Jogos" value={user.total_jogos} active={isCurrentUser} />
              </div>
            </div>
          );
        })}
      </div>
      
      <BottomNav />
    </div>
  );
}

function StatItem({ label, value, active }) {
  return (
    <div className="text-center">
      <span className={`block font-black text-sm italic ${active ? 'text-white' : 'text-white/90'}`}>
        {value || 0}
      </span>
      <span className={`block text-[7px] font-black uppercase tracking-widest ${active ? 'text-white/60' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}