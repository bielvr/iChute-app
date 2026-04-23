import { Link } from 'react-router-dom';

const ESPORTES = [
  { id: 'hockey', name: 'HOCKEY', icon: '🏒' },
  { id: 'football', name: 'FUTEBOL', icon: '⚽' }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6">
      <header className="mb-12 mt-8">
        <h1 className="text-3xl font-black italic uppercase">iCHUTE <span className="text-[#0077FF]">SPORTS</span></h1>
        <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-2">Escolha uma modalidade</p>
      </header>

      <div className="grid gap-4 max-w-lg mx-auto">
        {ESPORTES.map((esporte) => (
          <Link 
            key={esporte.id}
            to={`/ligas/${esporte.id}`}
            className="bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[35px] flex items-center justify-between hover:border-[#0077FF] transition-all group"
          >
            <span className="text-2xl font-black italic uppercase group-hover:text-[#0077FF] transition-colors">{esporte.name}</span>
            <span className="text-4xl">{esporte.icon}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}