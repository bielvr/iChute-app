import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Logo from '../components/Logo';

export default function Home() {
  const navigate = useNavigate();
  const [esportes, setEsportes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mapeamento de emojis para cada esporte conforme os IDs e esportes do banco
  const emojisEsportes = {
    1: '⚽', // Futebol
    2: '🏒', // Ice Hockey
    3: '🏎️', // Automobilismo
    4: '🚲', // Ciclismo
    5: '🏀', // Basquete
    6: '⚾', // Beisebol
    7: '🏈', // Futebol Americano
    8: '🎾', // Tênis
    9: '🏐', // Vôlei
  };

  useEffect(() => {
    async function fetchSports() {
      try {
        const { data, error } = await supabase
          .from('sports')
          .select('id, name')
          .eq('show', true); // ← Mostra apenas os que estão como true no banco

        if (error) throw error;
        setEsportes(data || []);
      } catch (err) {
        console.error("Erro ao buscar esportes:", err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSports();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const selecionarEsporte = (id) => {
    console.log("Navegando para esporte ID:", id);
    navigate(`/leagues/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans flex flex-col items-center justify-center relative">
      
      {/* Botão de Logout */}
      <button 
        onClick={handleLogout}
        className="absolute top-6 right-6 bg-[#1A1C3A] text-gray-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase italic border border-[#26283A] hover:text-white transition-all"
      >
        SAIR
      </button>

      <header className="flex flex-col items-center justify-center text-center mb-12 select-none">
        {/* Container que alinha o Símbolo do Raio ao lado do Nome da Marca */}
        <div className="flex items-center gap-3 justify-center">
          {/* Renderiza APENAS o símbolo gráfico (raio/mira) combinando com o tamanho do texto */}
          <Logo size="md" showText={false} />
    
          <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter leading-none">
            iCHUTE
          </h1>
        </div>
  
        <p className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em] mt-3 italic">
          Escolha uma modalidade
        </p>
      </header>

      <div className="grid gap-6 w-full max-w-md">
        {loading ? (
          <p className="text-center text-xs opacity-40 font-bold uppercase">Carregando esportes...</p>
        ) : esportes.length === 0 ? (
          <p className="text-center text-xs opacity-40 font-bold uppercase">Nenhuma modalidade ativa no momento.</p>
        ) : (
          esportes.map((esporte) => (
            <button
              key={esporte.id}
              onClick={() => selecionarEsporte(esporte.id)}
              className="group relative bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[30px] flex items-center justify-between overflow-hidden transition-all hover:border-[#0077FF] hover:shadow-[0_0_30px_rgba(0,119,255,0.2)] active:scale-95"
            >
              <div className="relative z-10">
                <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#0077FF] transition-colors">
                  {esporte.name === 'Football' ? 'FUTEBOL' : esporte.name === 'Ice Hockey' ? 'HOCKEY' : esporte.name.toUpperCase()}
                </h2>
              </div>
              <span className="text-4xl grayscale group-hover:grayscale-0 transition-all">
                {emojisEsportes[esporte.id] || '🏆'}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#0077FF] to-transparent opacity-0 group-hover:opacity-5 transition-opacity" />
            </button>
          ))
        )}
      </div>

      <footer className="mt-20 opacity-20">
        <span className="font-black italic uppercase text-[10px] tracking-[0.5em]">iChute Engine v3.0</span>
      </footer>
    </div>
  );
}