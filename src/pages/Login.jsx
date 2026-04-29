import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(""); // 1. Novo estado para o nome
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
            data: { full_name: fullName } // 2. Enviando o nome para o Auth do Supabase
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

  // ... (manter handleForgotPassword igual)

  return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center p-4 font-sans text-white">
      <div className="w-full max-w-md bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[40px] shadow-2xl">
        <h1 className="text-4xl font-black italic text-[#0077FF] text-center uppercase mb-8">iCHUTE</h1>
        
        <div className="flex bg-[#0A0E2A] rounded-2xl p-1 mb-8 border border-[#26283A]">
          <button onClick={() => setIsSignUp(false)} className={`flex-1 py-2 rounded-xl font-black italic text-xs uppercase transition-all ${!isSignUp ? 'bg-[#0077FF]' : 'text-gray-500'}`}>Entrar</button>
          <button onClick={() => setIsSignUp(true)} className={`flex-1 py-2 rounded-xl font-black italic text-xs uppercase transition-all ${isSignUp ? 'bg-[#0077FF]' : 'text-gray-500'}`}>Cadastrar</button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {/* 3. Campo de Nome condicional (só aparece no cadastro) */}
          {isSignUp && (
            <input 
              type="text" 
              placeholder="Nome Completo" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF]" 
              required 
            />
          )}

          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF]" required />
          <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF]" required />
          
          <button type="submit" disabled={loading} className="w-full bg-[#0077FF] py-4 rounded-2xl font-black italic text-lg uppercase shadow-lg disabled:opacity-50">
            {loading ? "Processando..." : isSignUp ? "Criar Conta" : "Entrar"}
          </button>
        </form>

        {!isSignUp && (
          <button onClick={handleForgotPassword} className="w-full mt-4 text-[10px] font-black uppercase italic text-gray-500 hover:text-[#0077FF] transition-all">
            Esqueci minha senha
          </button>
        )}

        {message && <p className="mt-4 text-center text-[10px] font-black uppercase italic text-[#0077FF]">{message}</p>}
      </div>
    </div>
  );
}