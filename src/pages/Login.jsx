import { useState } from "react";
import { supabase } from "../supabaseClient";
import Logo from "../components/Logo"; // Importação do componente da Logo

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(""); 
  const [message, setMessage] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = isSignUp 
      ? await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { full_name: fullName }
          }
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage("Erro: " + error.message);
    } else if (isSignUp) {
      setMessage("Cadastro realizado! Verifique seu e-mail.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage("Erro: Digite seu e-mail primeiro.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) setMessage("Erro: " + error.message);
    else setMessage("Link de recuperação enviado para o e-mail!");
    getLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center p-4 md:p-8 font-sans text-white">
      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8 items-center justify-between">
        
        {/* SEÇÃO DE APRESENTAÇÃO (LANDING PAGE) */}
        <div className="w-full md:w-1/2 flex flex-col space-y-6 text-center md:text-left px-4">
          <div className="hidden md:flex justify-start">
            <Logo size="lg" showText={true} />
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tight leading-none">
            Transforme seus palpites em <span className="text-[#0077FF]">estatística pura.</span>
          </h1>
          
          <p className="text-gray-400 text-sm md:text-base max-w-md">
            O **iChute** é uma plataforma inteligente desenvolvida para automatizar, analisar e gerenciar suas previsões esportivas com dashboards interativos em tempo real.
          </p>

          {/* LISTA DE BENEFÍCIOS / FEATURES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
            <div className="bg-[#1A1C3A] border border-[#26283A] p-4 rounded-2xl">
              <h3 className="font-bold text-[#0077FF] uppercase italic text-xs mb-1">⚡ Análise em Tempo Real</h3>
              <p className="text-gray-400 text-xs">Acompanhe métricas e dados de performance instantaneamente.</p>
            </div>
            <div className="bg-[#1A1C3A] border border-[#26283A] p-4 rounded-2xl">
              <h3 className="font-bold text-[#0077FF] uppercase italic text-xs mb-1">🎯 Gestão Inteligente</h3>
              <p className="text-gray-400 text-xs">Painel intuitivo construído com tecnologias modernas de mercado.</p>
            </div>
          </div>

          {/* CARD DE PREVIEW DA INTERFACE (Mockup opcional) */}
          <div className="hidden md:block opacity-40 hover:opacity-70 transition-opacity bg-[#1A1C3A] border border-[#26283A] rounded-2xl p-2 overflow-hidden h-32 relative shadow-inner">
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black uppercase italic text-gray-500 tracking-widest">
              [ Dashboard Preview ]
            </span>
            {/* Quando tiver um print do app rodando, use a tag abaixo: */}
            {/* <img src="/dashboard-preview.png" alt="Preview do Dashboard" className="w-full h-full object-cover rounded-xl" /> */}
          </div>
        </div>

        {/* SEÇÃO DO LOGIN (MANTIDA INTACTA MAS INTEGRADA) */}
        <div className="w-full max-w-md bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[40px] shadow-2xl">
          
          {/* Logo visível apenas no mobile para evitar repetição */}
          <div className="flex justify-center mb-8 md:hidden">
            <Logo size="lg" showText={true} />
          </div>
          
          <div className="flex bg-[#0A0E2A] rounded-2xl p-1 mb-8 border border-[#26283A]">
            <button type="button" onClick={() => setIsSignUp(false)} className={`flex-1 py-2 rounded-xl font-black italic text-xs uppercase transition-all ${!isSignUp ? 'bg-[#0077FF]' : 'text-gray-500'}`}>Entrar</button>
            <button type="button" onClick={() => setIsSignUp(true)} className={`flex-1 py-2 rounded-xl font-black italic text-xs uppercase transition-all ${isSignUp ? 'bg-[#0077FF]' : 'text-gray-500'}`}>Cadastrar</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <input 
                type="text" 
                placeholder="Nome Completo" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF] text-white" 
                required 
              />
            )}

            <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF] text-white" required />
            <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF] text-white" required />
            
            <button type="submit" disabled={loading} className="w-full bg-[#0077FF] py-4 rounded-2xl font-black italic text-lg uppercase shadow-lg disabled:opacity-50 text-white">
              {loading ? "Processando..." : isSignUp ? "Criar Conta" : "Entrar"}
            </button>
          </form>

          {!isSignUp && (
            <button type="button" onClick={handleForgotPassword} className="w-full mt-4 text-[10px] font-black uppercase italic text-gray-500 hover:text-[#0077FF] transition-all">
              Esqueci minha senha
            </button>
          )}

          {message && <p className="mt-4 text-center text-[10px] font-black uppercase italic text-[#0077FF]">{message}</p>}
        </div>

      </div>
    </div>
  );
}