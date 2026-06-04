import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

import Home from './pages/Home'; 
import Ligas from './pages/Ligas'; 
import Login from './pages/Login'; 
import Predictions from './pages/Predictions'; 
import Ranking from './pages/Ranking';
import Comparison from './pages/Comparison';
import ResetPassword from './pages/ResetPassword';
import LeagueSettings from './pages/LeagueSettings';
import WhatIf from './pages/WhatIf';
import UserSettings from './pages/UserSettings';

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
      {/* Rotas de Autenticação */}
      <Route path="/" element={session ? <Navigate to="/home" replace /> : <Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Dashboard Principal (Home) */}
      <Route path="/home" element={session ? <Home /> : <Navigate to="/" replace />} />
      
      {/* Configurações Globais do Usuário (Acessada pela engrenagem da Home) */}
      <Route path="/settings" element={session ? <UserSettings /> : <Navigate to="/" replace />} />
      
      {/* Seleção de Ligas por Esporte (ex: /leagues/1 para Futebol, /leagues/2 para Hockey) */}
      <Route path="/leagues/:sportId" element={session ? <Ligas /> : <Navigate to="/" replace />} />
      
      {/* Rotas Internas de uma Liga Específica */}
      <Route path="/predictions/:ligaId" element={session ? <Predictions /> : <Navigate to="/" replace />} />
      <Route path="/leagues/:ligaId/results" element={session ? <Comparison /> : <Navigate to="/" replace />} />
      <Route path="/leagues/:ligaId/ranking" element={session ? <Ranking /> : <Navigate to="/" replace />} />
      <Route path="/leagues/:ligaId/settings" element={session ? <LeagueSettings /> : <Navigate to="/" replace />} />
      <Route path="/leagues/:ligaId/whatif" element={session ? <WhatIf /> : <Navigate to="/" replace />} />

      {/* Fallback para rotas inexistentes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;