import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Home() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // IDs baseados no seu banco de dados: Hockey = 2, Futebol = 1
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

      <header className="text-center mb-12">
        <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter">
          iCHUTE <span className="text-[#0077FF]">SPORTS</span>
        </h1>
        <p className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em] mt-2 italic">
          Escolha uma modalidade
        </p>
      </header>

      <div className="grid gap-6 w-full max-w-md">
        {/* BOTÃO HOCKEY (ID 2) */}
        <button
          onClick={() => selecionarEsporte(2)}
          className="group relative bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[30px] flex items-center justify-between overflow-hidden transition-all hover:border-[#0077FF] hover:shadow-[0_0_30px_rgba(0,119,255,0.2)] active:scale-95"
        >
          <div className="relative z-10">
            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#0077FF] transition-colors">
              HOCKEY
            </h2>
          </div>
          <span className="text-4xl grayscale group-hover:grayscale-0 transition-all">🏒</span>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077FF] to-transparent opacity-0 group-hover:opacity-5 transition-opacity" />
        </button>

        {/* BOTÃO FUTEBOL (ID 1) */}
        <button
          onClick={() => selecionarEsporte(1)}
          className="group relative bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[30px] flex items-center justify-between overflow-hidden transition-all hover:border-[#0077FF] hover:shadow-[0_0_30px_rgba(0,119,255,0.2)] active:scale-95"
        >
          <div className="relative z-10">
            <h2 className="text-2xl font-black italic uppercase tracking-tight group-hover:text-[#0077FF] transition-colors">
              FUTEBOL
            </h2>
          </div>
          <span className="text-4xl grayscale group-hover:grayscale-0 transition-all">⚽</span>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077FF] to-transparent opacity-0 group-hover:opacity-5 transition-opacity" />
        </button>
      </div>

      <footer className="mt-20 opacity-20">
        <span className="font-black italic uppercase text-[10px] tracking-[0.5em]">iChute Engine v3.0</span>
      </footer>
    </div>
  );
}