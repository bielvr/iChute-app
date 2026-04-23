import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// IMPORTAÇÕES BASEADAS NA SUA ESTRUTURA DE PASTAS
import Home from './pages/Home'; 
import Ligas from './pages/Ligas'; 
import Login from './pages/Login'; 
import Predictions from './pages/Predictions'; 
import ResetPassword from './pages/ResetPassword';

function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  return (
    <Routes>
      {/* Rota Raiz: Login ou Home */}
      <Route 
        path="/" 
        element={session ? <Navigate to="/home" replace /> : <Login />} 
      />

      {/* Escolha do Esporte */}
      <Route 
        path="/home" 
        element={session ? <Home /> : <Navigate to="/" replace />} 
      />

      {/* Minhas Ligas (Esporte selecionado) */}
      <Route 
        path="/leagues/:sportId" 
        element={session ? <Ligas /> : <Navigate to="/" replace />} 
      />

      {/* Tela de Palpites */}
      <Route 
        path="/predictions/:ligaId" 
        element={session ? <Predictions /> : <Navigate to="/" replace />} 
      />

      {/* Recuperação de Senha */}
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Fallback para evitar tela branca */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;