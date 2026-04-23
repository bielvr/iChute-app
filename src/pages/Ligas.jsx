import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { sportId } = useParams();
  const navigate = useNavigate();
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Define o título visual: 1 para Futebol, 2 para Hockey
  const tituloEsporte = String(sportId) === "2" ? "HOCKEY" : "FUTEBOL";

  useEffect(() => {
    async function fetchLigas() {
      setLoading(true);
      try {
        // 1. Pega o usuário logado no momento
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error("Usuário não identificado");
          return;
        }

        // 2. Busca na user_leagues filtrando por esporte e pelo seu ID de usuário
        // Usamos parseInt para garantir que o ID do esporte vá como número para o banco
        const { data, error } = await supabase
          .from('user_leagues')
          .select('*')
          .eq('sport_id', parseInt(sportId))
          .eq('user_id', user.id);

        if (error) throw error;

        console.log("Ligas recuperadas da planilha user_leagues:", data);
        setLigas(data || []);

      } catch (error) {
        console.error("Erro ao carregar ligas:", error.message);
      } finally {
        setLoading(false);
      }
    }

    if (sportId) {
      fetchLigas();
    }
  }, [sportId]);

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black italic animate-pulse">
      SINCRONIZANDO ICHUTE...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans">
      <header className="flex items-center justify-between mb-12 max-w-2xl mx-auto">
        <button 
          onClick={() => navigate('/home')} 
          className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black uppercase italic border border-[#26283A] hover:bg-[#0077FF] transition-all"
        >
          ← VOLTAR
        </button>
        <h1 className="text-xl font-black italic text-right uppercase tracking-tighter">
          MINHAS LIGAS <span className="text-[#0077FF] block text-sm">{tituloEsporte}</span>
        </h1>
      </header>

      <div className="grid gap-6 max-w-2xl mx-auto">
        {ligas.length === 0 ? (
          <div className="text-center p-20 border-2 border-dashed border-[#1A1C3A] rounded-[40px]">
            <p className="text-gray-600 font-black uppercase tracking-widest text-[10px] italic">
              Nenhuma liga vinculada na user_leagues
            </p>
          </div>
        ) : (
          ligas.map((liga) => (
            <button 
              key={liga.id} 
              onClick={() => navigate(`/predictions/${liga.id}`)}
              className="group relative bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[35px] flex items-center justify-between overflow-hidden transition-all hover:border-[#0077FF] hover:shadow-[0_0_30px_rgba(0,119,255,0.2)] active:scale-95 text-left"
            >
              <div>
                <h2 className="text-lg font-black italic uppercase tracking-tight group-hover:text-[#0077FF] transition-colors">
                  {liga.name}
                </h2>
                <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em]">Entrar na liga</span>
              </div>
              <span className="text-2xl text-[#26283A] group-hover:text-[#0077FF] transition-colors">→</span>
            </button>
          ))
        )}
      </div>

      <footer className="mt-20 text-center opacity-20">
        <span className="font-black italic uppercase text-[9px] tracking-[0.5em]">iChute Engine</span>
      </footer>
    </div>
  );
}