import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { esporteId } = useParams();
  const [ligas, setLigas] = useState([]);

  useEffect(() => {
    async function fetchMinhasLigas() {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('user_league_members')
        .select(`
          league_id,
          user_leagues!inner ( id, name, sport_type )
        `)
        .eq('user_id', user.id)
        .eq('user_leagues.sport_type', esporteId);

      if (!error) setLigas(data);
    }
    fetchMinhasLigas();
  }, [esporteId]);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6">
      <header className="mb-10 mt-4 flex items-center gap-4">
        <Link to="/" className="bg-[#1A1C3A] p-3 rounded-xl text-xs font-black italic">←</Link>
        <h1 className="text-2xl font-black italic uppercase">Minhas Ligas <span className="text-[#0077FF]">{esporteId}</span></h1>
      </header>

      <div className="grid gap-4 max-w-lg mx-auto">
        {ligas.map((item) => (
          <Link 
            key={item.user_leagues.id}
            to={`/palpites/${item.user_leagues.id}`}
            className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:bg-[#0077FF] transition-all"
          >
            <span className="font-black italic uppercase">{item.user_leagues.name}</span>
            <span className="text-[10px] font-black opacity-50">ENTRAR</span>
          </Link>
        ))}
      </div>
    </div>
  );
}