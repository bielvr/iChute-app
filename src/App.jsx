import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Home from './pages/Home'; 
import Ligas from './pages/Ligas'; 
import Predictions from './pages/Predictions'; 
import Login from './pages/Login'; 

function App() {
  // undefined evita que a app redirecione antes de validar se há um user guardado no cache
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    // Verifica se já existe uma sessão ativa ao carregar a página
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Ouve mudanças de estado (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Enquanto o Supabase não responde, não renderizamos nada para evitar saltos de página
  if (session === undefined) return null;

  return (
    <Router>
      <Routes>
        {/* Rota Raiz: Se logado, vai para Sports. Caso contrário, Login */}
        <Route 
          path="/" 
          element={session ? <Navigate to="/home" replace /> : <Login />} 
        />

        {/* Escolha do Esporte */}
        <Route 
          path="/home" 
          element={session ? <Home /> : <Navigate to="/" replace />} 
        />

        {/* Minhas Ligas */}
        <Route 
          path="/leagues/:sportId" 
          element={session ? <Ligas /> : <Navigate to="/" replace />} 
        />

        {/* Palpites iChute */}
        <Route 
          path="/predictions/:ligaId" 
          element={session ? <Predictions /> : <Navigate to="/" replace />} 
        />

        {/* Fallback para rotas inexistentes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;