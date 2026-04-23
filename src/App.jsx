import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './pages/login';
import Home from './pages/home';
import Predictions from './pages/predictions';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Home /> : <Navigate to="/login" />} />
        <Route path="/palpites/:ligaId" element={session ? <Predictions /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}