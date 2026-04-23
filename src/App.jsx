import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Ligas from './pages/Ligas';

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
        <Route path="/palpites/:ligaId" element={<div className="text-white p-10">Página de Palpites em breve!</div>} />

        {/* ROTA DE SEGURANÇA (404) */}
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}

export default App;