import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Importações das páginas (Verifique se as letras maiúsculas batem com os nomes dos arquivos)
import Home from './pages/Home'; 
import Ligas from './pages/Ligas'; 
import Login from './pages/Login'; 
import Predictions from './pages/Predictions'; 

function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to="/home" replace /> : <Login />} />
      <Route path="/home" element={session ? <Home /> : <Navigate to="/" replace />} />
      
      {/* Rota de Ligas: o parâmetro sportId DEVE ser o que o Home.jsx envia */}
      <Route path="/leagues/:sportId" element={session ? <Ligas /> : <Navigate to="/" replace />} />
      
      {/* Rota de Palpites: o ligaId DEVE ser o ID da liga que vem do banco */}
      <Route path="/predictions/:ligaId" element={session ? <Predictions /> : <Navigate to="/" replace />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;