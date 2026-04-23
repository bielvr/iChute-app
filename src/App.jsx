import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

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
      
      {/* ATENÇÃO: A rota deve ser exatamente esta para o Home.jsx funcionar */}
      <Route path="/leagues/:sportId" element={session ? <Ligas /> : <Navigate to="/" replace />} />
      
      <Route path="/predictions/:ligaId" element={session ? <Predictions /> : <Navigate to="/" replace />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;