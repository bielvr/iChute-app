import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { esporteId } = useParams();
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMinhasLigas() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Buscamos na user_league_members para saber de quais o usuário participa
      // Mas filtramos através da tabela leagues para garantir o esporte correto
      const { data, error } = await supabase
        .from('user_league_members')
        .select(`
          user_leagues!inner (
            id,
            name,
            leagues!inner (
              sport_id
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('user_leagues.leagues.sport_id', esporteId);

      if (!error) {
        setLigas(data);
      } else {
        console.error("Erro ao buscar ligas:", error);
      }
      setLoading(false);
    }

    if (esporteId) fetchMinhasLigas();
  }, [esporteId]);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6">
      <header className="mb-10 mt-4 flex items-center gap-4">
        <Link to="/" className="bg-[#1A1C3A] p-3 rounded-xl text-xs font-black italic">←</Link>
        <h1 className="text-2xl font-black italic uppercase">
          Minhas Ligas <span className="text-[#0077FF]">{esporteId === '1' ? 'FUTEBOL' : 'HOCKEY'}</span>
        </h1>
      </header>

      <div className="grid gap-4 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center opacity-50">Carregando...</p>
        ) : ligas.length > 0 ? (
          ligas.map((item) => (
            <Link 
              key={item.user_leagues.id}
              to={`/palpites/${item.user_leagues.id}`}
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] transition-all"
            >
              <span className="font-black italic uppercase">{item.user_leagues.name}</span>
              <span className="text-[10px] font-black opacity-50 bg-[#26283A] px-3 py-1 rounded-full group-hover:bg-[#0077FF]">ENTRAR</span>
            </Link>
          ))
        ) : (
          <div className="text-center p-10 border border-dashed border-gray-800 rounded-[30px]">
            <p className="text-gray-500 italic text-sm">Você não participa de nenhuma liga de {esporteId === '1' ? 'Futebol' : 'Hockey'} ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}