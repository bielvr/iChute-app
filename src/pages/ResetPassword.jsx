import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo"; // Importação da Logo para manter o padrão visual

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isValidFlow, setIsValidFlow] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Verifica se a URL atual contém o token de acesso vindo do e-mail de recuperação
    const hasToken = window.location.hash.includes("access_token=") || 
                     window.location.search.includes("type=recovery");

    if (hasToken) {
      setIsValidFlow(true);
    } else {
      setMessage("Link inválido ou expirado. Solicite uma nova recuperação.");
    }
    setCheckingToken(false);
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      setMessage("Erro: " + error.message);
    } else {
      setMessage("Senha atualizada com sucesso!");
      // Ajustado de "/login" para "/" para casar com a rota raiz do seu App.jsx
      setTimeout(() => navigate("/"), 2000); 
    }
    setLoading(false);
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center p-4 text-white font-sans">
        <p className="text-[#0077FF] font-black animate-pulse text-xs uppercase tracking-widest">Verificando Credenciais...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center p-4 text-white font-sans">
      <div className="w-full max-w-md bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[40px] shadow-2xl">
        
        {/* Logo unificada da marca */}
        <div className="flex justify-center mb-6">
          <Logo size="md" showText={true} />
        </div>

        <h2 className="text-xl font-black italic text-[#0077FF] uppercase mb-6 text-center tracking-tight">Nova Senha</h2>
        
        {isValidFlow ? (
          <form onSubmit={handleReset} className="space-y-4">
            <input 
              type="password" 
              placeholder="Digite a nova senha" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF]" 
              required 
            />
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-[#0077FF] py-4 rounded-2xl font-black italic uppercase shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Processando..." : "Atualizar Senha"}
            </button>
          </form>
        ) : (
          /* Tela de Bloqueio para acessos indevidos */
          <div className="text-center space-y-6">
            <button 
              onClick={() => navigate("/")} 
              className="w-full bg-[#1A1C3A] border border-[#26283A] py-4 rounded-2xl font-black italic text-xs uppercase tracking-wider text-gray-400 hover:text-white hover:bg-[#0077FF] transition-all"
            >
              ← Voltar para o Login
            </button>
          </div>
        )}
        
        {message && (
          <p className={`mt-6 text-center text-[10px] font-black uppercase italic tracking-wide ${isValidFlow && !message.includes("Erro") ? "text-green-400" : "text-[#0077FF]"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}