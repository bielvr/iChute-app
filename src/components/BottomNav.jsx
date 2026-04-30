import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { LayoutGrid, PenLine, Trophy, HelpCircle } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const { ligaId } = useParams();
  const location = useLocation();

  const tabs = [
    { id: 'results', label: 'Resultados', icon: LayoutGrid, path: `/leagues/${ligaId}/results` },
    { id: 'predictions', label: 'Palpites', icon: PenLine, path: `/leagues/predictions/${ligaId}` },
    { id: 'ranking', label: 'Ranking', icon: Trophy, path: `/leagues/${ligaId}/ranking` },
    { id: 'whatif', label: 'E se?', icon: HelpCircle, path: `/leagues/${ligaId}/whatif` },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1A1C3A] border-t border-[#26283A] flex justify-around items-center pb-6 pt-3 z-50">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path || (tab.id === 'predictions' && location.pathname.endsWith(ligaId));
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#0077FF]' : 'text-gray-500'}`}
          >
            <Icon size={24} strokeWidth={isActive ? 3 : 2} />
            <span className="text-[10px] font-black uppercase italic tracking-tighter">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}