import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { sportId } = useParams();
  const [ligasAtivas, setLigasAtivas] = useState([]);
  const [ligasReaisDisponiveis, setLigasReaisDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [newLeagueName, setNewLeagueName] = useState("");
  const [selectedOfficialLeague, setSelectedOfficialLeague] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [points, setPoints] = useState({ exact: 10, winnerOne: 7, winnerOnly: 5 });

  const nomeEsporte = String(sportId) === '2' ? 'HOCKEY' : 'FUTEBOL';

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
      if (!userData) return;

      // 1. Ligas do Usuário
      const { data: participacoes } = await supabase
        .from('user_league_members')
        .select(`user_league_id, user_leagues ( id, name, official_league_id, leagues!official_league_id ( sport_id ) )`)
        .eq('user_id', userData.id);

      if (participacoes) {
        const filtradas = participacoes
          .map(p => p.user_leagues)
          .filter(l => l && String(l.leagues?.sport_id) === String(sportId));
        setLigasAtivas(filtradas);
      }

      // 2. BUSCA NHL/LIGAS REAIS - Ajustado para ser mais flexível
      const { data: reais, error: errReais } = await supabase
        .from('leagues')
        .select('id, name, api_id')
        .eq('sport_id', sportId); // Filtra apenas pelo esporte, removemos o neq('EMPTY') para testar
      
      // Filtramos no JS para garantir que nulos ou "EMPTY" não apareçam, mas a NHL sim
      const reaisFiltradas = reais?.filter(r => r.api_id && r.api_id !== 'EMPTY') || [];
      setLigasReaisDisponiveis(reaisFiltradas);

    } catch (err) {
      console.error("Erro iChute:", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [sportId]);

  // Funções handleJoinLeague e handleCreateLeague permanecem as mesmas...
  // (Mantendo o foco no visual dos inputs que você pediu)

  const handleJoinLeague = async () => {
    if (!inviteCodeInput) return alert("Digite o código da liga!");
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
      const { data: league, error } = await supabase.from('user_leagues').select('id, name').eq('id', inviteCodeInput).single();
      if (error || !league) throw new Error("Liga não encontrada.");
      await supabase.from('user_league_members').insert({ user_league_id: league.id, user_id: userData.id, role: 'player' });
      setInviteCodeInput("");
      fetchData();
    } catch (err) { alert(err.message); } finally { setProcessing(false); }
  };

  const handleCreateLeague = async () => {
    if (!newLeagueName || !selectedOfficialLeague) return alert("Preencha tudo!");
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
      const { data: config } = await supabase.from('leagues_config').insert({
        exact_score_points: points.exact,
        winner_and_one_goal_points: points.winnerOne,
        winner_only_points: points.winnerOnly
      }).select().single();
      const { data: league } = await supabase.from('user_leagues').insert({
        name: newLeagueName,
        owner_id: userData.id,
        config_id: config.id,
        official_league_id: selectedOfficialLeague
      }).select().single();
      await supabase.from('user_league_members').insert({ user_league_id: league.id, user_id: userData.id, role: 'admin' });
      setNewLeagueName("");
      fetchData();
    } catch (err) { alert(err.message); } finally { setProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans pb-20">
      {/* Cabeçalho omitido para brevidade... */}

      <div className="grid gap-4 max-w-lg mx-auto mb-12">
        <h2 className="text-xs font-black italic uppercase opacity-40 ml-2 text-center">Suas Ligas Ativas</h2>
        {ligasAtivas.map((liga) => (
          <div key={liga.id} className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[30px] flex justify-between items-center group shadow-lg">
            <div>
              <span className="block font-black italic uppercase group-hover:text-[#0077FF] transition-all">{liga.name}</span>
              <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Código: <span className="text-[#0077FF]">{liga.id}</span></span>
            </div>
            <Link to={`/predictions/${liga.id}`} className="bg-[#0A0E2A] p-3 rounded-full hover:scale-110 transition-transform">
              <span className="text-[#0077FF] font-bold">→</span>
            </Link>
          </div>
        ))}
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        <section className="bg-[#1A1C3A] p-8 rounded-[40px] border border-[#26283A] shadow-2xl">
          <h2 className="text-center font-black italic uppercase text-[#0077FF] mb-6">Criar Nova Liga</h2>
          
          <div className="space-y-4">
            <input type="text" placeholder="NOME DA LIGA" value={newLeagueName} onChange={(e) => setNewLeagueName(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none text-center" />
            
            <select value={selectedOfficialLeague} onChange={(e) => setSelectedOfficialLeague(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none text-center appearance-none text-gray-400">
              <option value="">VINCULAR À LIGA REAL...</option>
              {ligasReaisDisponiveis.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            {/* PONTUAÇÃO SEM SETINHAS E CENTRALIZADA */}
            <div className="grid grid-cols-3 gap-2 py-4 border-y border-[#26283A]">
              {[
                { label: 'Placar Exato', key: 'exact' },
                { label: 'Venc +1 Gol', key: 'winnerOne' },
                { label: 'Só Vencedor', key: 'winnerOnly' }
              ].map((item) => (
                <div key={item.key} className="text-center">
                  <p className="text-[7px] font-black uppercase mb-2 opacity-50 tracking-tighter">{item.label}</p>
                  <input 
                    type="number" 
                    value={points[item.key]} 
                    onChange={e => setPoints({...points, [item.key]: e.target.value})}
                    style={{ MozAppearance: 'textfield' }} // Remove setinhas no Firefox
                    className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-3 text-center font-black text-[#0077FF] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  />
                </div>
              ))}
            </div>

            <button onClick={handleCreateLeague} disabled={processing} className="w-full bg-[#0077FF] py-4 rounded-2xl font-black italic text-lg uppercase shadow-lg active:scale-95 transition-all">
              {processing ? "CRIANDO..." : "GERAR LIGA E CÓDIGO"}
            </button>
          </div>
        </section>

        {/* INPUT DE CÓDIGO TAMBÉM CENTRALIZADO */}
        <div className="bg-[#1A1C3A] p-6 rounded-[35px] border border-[#26283A] flex gap-3 items-center">
          <input 
            type="number" 
            placeholder="CÓDIGO" 
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
            className="w-24 bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
          />
          <button onClick={handleJoinLeague} className="flex-1 bg-transparent border-2 border-[#26283A] py-4 rounded-2xl font-black italic uppercase text-xs hover:border-[#0077FF]">
            Entrar em Liga
          </button>
        </div>
      </div>
    </div>
  );
}