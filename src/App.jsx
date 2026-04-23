import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Ligas from './pages/Ligas';
import Predictions from './pages/Predictions'
import Login from './pages/Login';

// Se você já tiver a página de palpites, importe-a aqui também
// import Predictions from './pages/Predictions';

function App() {
  return (
    <div className="min-h-screen bg-[#0A0E2A]">
      <Routes>
        {/* ROTA DA HOME (ESPORTES) */}
        <Route path="/" element={<Home />} />

        {/* ROTA DAS LIGAS DO ESPORTE SELECIONADO */}
        <Route path="/ligas/:esporteId" element={<Ligas />} />

        {/* PROXIMA ROTA: PALPITES DA LIGA ESPECIFICA */}
        <Route path="/predictions/:ligaId" element={<Predictions />} />

        {/* ROTA DE SEGURANÇA (404) */}
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}

export default App;