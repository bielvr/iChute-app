import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Import das suas páginas (ajuste os caminhos se necessário)
import Login from './pages/Login';
import Home from './pages/Home';
import Ligas from './pages/Ligas';
import Predictions from './pages/Predictions';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pega a sessão atual ao carregar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Escuta mudanças (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null; // Evita piscar a tela de login antes de checar a sessão

  return (
    <BrowserRouter>
      <Routes>
        {/* Se NÃO está logado, vai para Login. Se ESTÁ, vai para Home */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        {/* Rotas Protegidas */}
        <Route path="/" element={session ? <Home /> : <Navigate to="/login" />} />
        <Route path="/ligas/:esporteId" element={session ? <Ligas /> : <Navigate to="/login" />} />
        <Route path="/palpites/:ligaId" element={session ? <Predictions /> : <Navigate to="/login" />} />

        {/* Catch-all: Redireciona qualquer erro para a Home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}