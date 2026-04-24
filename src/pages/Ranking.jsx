import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from '../components/BottomNav';

export default function Ranking() {
  const { ligaId } = useParams();
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    async function getRanking() {
      // Aqui usamos a view que você já tem no banco (ajuste o nome se necessário)
      const { data } = await supabase.from('ranking_detalhado')
        .select('*').eq('user_league_id', ligaId).order('total_points', { ascending: false });
      setRanking(data || []);
    }
    getRanking();
  }, [ligaId]);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-32 font-sans">
      <h1 className="text-2xl font-black italic text-[#0077FF] uppercase mb-8 text-center tracking-tighter">Ranking Geral</h1>
      <div className="max-w-2xl mx-auto grid gap-3">
        {ranking.map((user, index) => (
          <div key={user.user_id} className={`flex items-center justify-between p-5 rounded-[25px] border ${index === 0 ? 'bg-[#0077FF] border-white' : 'bg-[#1A1C3A] border-[#26283A]'}`}>
            <div className="flex items-center gap-4">
              <span className="font-black italic text-xl opacity-30">{index + 1}º</span>
              <span className="font-bold uppercase text-xs tracking-tight">{user.user_name}</span>
            </div>
            <div className="text-right">
              <span className="block font-black text-xl italic">{user.total_points}</span>
              <span className="text-[8px] font-black uppercase opacity-60">PONTOS</span>
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}