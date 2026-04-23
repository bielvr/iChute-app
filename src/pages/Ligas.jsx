import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { sportId } = useParams();
  const navigate = useNavigate();
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);

  const tituloEsporte = String(sportId) === "2" ? "HOCKEY" : "FUTEBOL";

  useEffect(() => {
    async function fetchLigas() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        /**
         * LÓGICA CONFORME SCHEMA:
         * 1. Entramos em user_league_members para ver onde o user_id está.
         * 2. Fazemos o JOIN com user_leagues para pegar o nome da liga.
         * 3. Fazemos o JOIN com leagues para filtrar pelo sport_id (1 ou 2).
         */
        const { data, error } = await supabase
          .from('user_league_members')
          .select(`
            user_league_id,
            user_leagues!inner (
              id,
              name,
              official_league_id,
              leagues!inner (
                sport_id
              )
            )
          `)
          .eq('user_id', user.id)
          .eq('user_leagues.leagues.sport_id', parseInt(sportId));

        if (error) throw error;

        // Limpando o retorno para o estado
        const ligasFormatadas = data.map(item => ({
          id: item.user_leagues.id,
          name: item.user_leagues.name
        }));

        setLigas(ligasFormatadas);
      } catch (error) {
        console.error("Erro iChute Schema:", error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchLigas();
  }, [sportId]);

  if (loading) return <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black italic">CONECTANDO AO SCHEMA...</div>;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans uppercase italic">
      <header className="flex items-center justify-between mb-12 max-w-2xl mx-auto">
        <button onClick={() => navigate('/home')} className="bg-[#1A1C3A] px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]">← VOLTAR</button>
        <h1 className="text-xl font-black text-right tracking-tighter">
          MINHAS LIGAS <span className="text-[#0077FF] block text-sm">{tituloEsporte}</span>
        </h1>
      </header>

      <div className="grid gap-6 max-w-2xl mx-auto">
        {ligas.length === 0 ? (
          <div className="text-center p-20 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-600 text-[10px]">Nenhuma liga de {tituloEsporte} no seu perfil</p>
          </div>
        ) : (
          ligas.map((liga) => (
            <button 
              key={liga.id} 
              onClick={() => navigate(`/predictions/${liga.id}`)}
              className="bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[35px] flex items-center justify-between hover:border-[#0077FF] transition-all"
            >
              <span className="text-lg font-black">{liga.name}</span>
              <span className="text-[#0077FF]">→</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}