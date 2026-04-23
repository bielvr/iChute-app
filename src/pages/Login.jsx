import { useState } from "react";
import { supabase } from "../supabaseClient"; // Caminho corrigido para sair da pasta pages

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Isso garante que o usuário volte para o site após clicar no email
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage("Erro: " + error.message);
    } else {
      setMessage("Sucesso! Verifique seu e-mail para acessar o link de login.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[40px] shadow-2xl">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-black italic text-[#0077FF] uppercase tracking-tighter">
            iCHUTE
          </h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">
            Entrar na Plataforma
          </p>
        </header>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2 ml-2 italic">
              Seu E-mail
            </label>
            <input
              type="email"
              placeholder="exemplo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-[#0077FF] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0077FF] hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-[0_10px_30px_rgba(0,119,255,0.3)] uppercase italic text-lg transition-all disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Receber Link de Acesso"}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-2xl text-center text-xs font-black uppercase italic border ${
            message.includes("Erro") 
              ? "bg-red-500/10 border-red-500/50 text-red-500" 
              : "bg-green-500/10 border-green-500/50 text-green-500"
          }`}>
            {message}
          </div>
        )}

        <footer className="mt-10 text-center">
          <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest italic">
            Acesso via Magic Link • Sem senhas
          </p>
        </footer>
      </div>
    </div>
  );
}