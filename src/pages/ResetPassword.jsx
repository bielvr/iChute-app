import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage("Erro: " + error.message);
    else {
      setMessage("Senha atualizada!");
      setTimeout(() => navigate("/login"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[40px]">
        <h2 className="text-2xl font-black italic text-[#0077FF] uppercase mb-6 text-center">Nova Senha</h2>
        <form onSubmit={handleReset} className="space-y-4">
          <input type="password" placeholder="Digite a nova senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none" required />
          <button type="submit" disabled={loading} className="w-full bg-[#0077FF] py-4 rounded-2xl font-black italic uppercase">Atualizar Senha</button>
        </form>
        {message && <p className="mt-4 text-center text-xs font-black italic uppercase">{message}</p>}
      </div>
    </div>
  );
}