import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { sportId } = useParams();
  const navigate = useNavigate();
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Força o título a bater com o ID da URL
  const tituloEsporte = String(sportId) === "2" ? "HOCKEY" : "FUTEBOL";

  useEffect(() => {
    async function fetchLigas() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log("Buscando ligas para Sport ID:", sportId, "User:", user.id);

        const { data, error } = await supabase
          .from('user_leagues')
          .select('*')
          .eq('sport_id', parseInt(sportId)) // Converte "2" em 2 para o banco
          .eq('user_id', user.id);

        if (error) throw error;
        
        console.log("Ligas encontradas:", data);
        setLigas(data || []);
      } catch (error) {
        console.error("Erro na busca:", error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchLigas();
  }, [sportId]);

  if (loading) return <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black italic">SINCRONIZANDO...</div>;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans">
      <header className="flex items-center gap-4 mb-12 max-w-2xl mx-auto">
        <button onClick={() => navigate('/home')} className="bg-[#1A1C3A] px-4 py-2 rounded-xl text-[10px] font-black italic border border-[#26283A]">← VOLTAR</button>
        <h1 className="text-2xl font-black italic uppercase">MINHAS LIGAS <span className="text-[#0077FF]">{tituloEsporte}</span></h1>
      </header>

      <div className="grid gap-4 max-w-2xl mx-auto">
        {ligas.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-[#1A1C3A] rounded-[30px]">
            <p className="text-gray-500 font-black italic uppercase text-xs">Nenhuma liga encontrada para {tituloEsporte}</p>
          </div>
        ) : (
          ligas.map(liga => (
            <button 
              key={liga.id} 
              onClick={() => navigate(`/predictions/${liga.id}`)}
              className="bg-[#1A1C3A] p-6 rounded-[25px] border border-[#26283A] flex justify-between items-center hover:border-[#0077FF] transition-all"
            >
              <span className="font-black italic uppercase">{liga.name}</span>
              <span className="text-[#0077FF] font-black">ENTRAR →</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}