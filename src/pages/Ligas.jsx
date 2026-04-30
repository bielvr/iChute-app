import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { sportId } = useParams();
  const [ligasAtivas, setLigasAtivas] = useState([]);
  const [ligasReaisDisponiveis, setLigasReaisDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Estados do Formulário
  const [newLeagueName, setNewLeagueName] = useState("");
  const [selectedOfficialLeague, setSelectedOfficialLeague] = useState("");
  const [points, setPoints] = useState({ exact: 10, winnerOne: 7, winnerOnly: 5 });

  const nomeEsporte = String(sportId) === '2' ? 'HOCKEY' : 'FUTEBOL';

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
      if (!userData) return;

      // 1. Buscar Ligas que o usuário participa
      const { data: participacoes } = await supabase
        .from('user_league_members')
        .select('user_league_id')
        .eq('user_id', userData.id);

      if (participacoes?.length > 0) {
        const idsDasLigas = participacoes.map(p => p.user_league_id);
        const { data: ligasEncontradas } = await supabase
          .from('user_leagues')
          .select(`id, name, leagues!official_league_id ( sport_id )`)
          .in('id', idsDasLigas);

        setLigasAtivas(ligasEncontradas.filter(l => String(l.leagues?.sport_id) === String(sportId)));
      }

      // 2. Buscar Ligas Reais (Tabela leagues) para o Select
      const { data: reais } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('sport_id', sportId)
        .neq('api_id', 'EMPTY');
      
      setLigasReaisDisponiveis(reais || []);
    } catch (err) {
      console.error("Erro iChute:", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [sportId]);

  const handleCreateLeague = async () => {
    if (!newLeagueName || !selectedOfficialLeague) return alert("Preencha nome e escolha a liga real!");
    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();

      // 1. Cria Configuração personalizada
      const { data: config } = await supabase.from('leagues_config').insert({
        exact_score_points: points.exact,
        winner_and_one_goal_points: points.winnerOne,
        winner_only_points: points.winnerOnly
      }).select().single();

      // 2. Cria a Liga do Usuário
      const { data: league } = await supabase.from('user_leagues').insert({
        name: newLeagueName,
        owner_id: userData.id,
        config_id: config.id,
        official_league_id: selectedOfficialLeague
      }).select().single();

      // 3. Adiciona como Membro Admin
      await supabase.from('user_league_members').insert({
        user_league_id: league.id,
        user_id: userData.id,
        role: 'admin'
      });

      setNewLeagueName("");
      fetchData(); 
      alert("Liga criada com sucesso!");
    } catch (err) {
      alert("Erro ao criar: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans pb-20">
      <header className="mb-10 mt-4 flex items-center gap-4">
        <Link to="/home" className="bg-[#1A1C3A] p-3 rounded-xl text-xs font-black italic hover:bg-[#26283A]">← VOLTAR</Link>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">Minhas Ligas <span className="text-[#0077FF]">{nomeEsporte}</span></h1>
      </header>

      {/* LISTA DE LIGAS ATIVAS */}
      <div className="grid gap-4 max-w-lg mx-auto mb-12">
        <h2 className="text-xs font-black italic uppercase opacity-40 ml-2">Participando Atualmente</h2>
        {loading ? (
          <div className="text-center py-10 animate-pulse font-black uppercase text-[10px]">Sincronizando...</div>
        ) : ligasAtivas.length > 0 ? (
          ligasAtivas.map((liga) => (
            <Link key={liga.id} to={`/predictions/${liga.id}`} className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[30px] flex justify-between items-center hover:border-[#0077FF] group transition-all">
              <span className="font-black italic uppercase group-hover:text-[#0077FF]">{liga.name}</span>
              <span className="text-[#0077FF] font-bold">→</span>
            </Link>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px] opacity-30">
            <p className="font-black italic uppercase text-[10px]">Nenhuma liga ativa</p>
          </div>
        )}
      </div>

      <hr className="border-[#1A1C3A] max-w-lg mx-auto mb-12" />

      {/* GESTÃO E CRIAÇÃO */}
      <div className="max-w-lg mx-auto space-y-6">
        <section className="bg-[#1A1C3A] p-8 rounded-[40px] border border-[#26283A] shadow-2xl">
          <h2 className="text-center font-black italic uppercase text-[#0077FF] mb-6">Criar Nova Liga</h2>
          
          <div className="space-y-4">
            <input type="text" placeholder="NOME DA SUA LIGA" value={newLeagueName} onChange={(e) => setNewLeagueName(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-1 focus:ring-[#0077FF]" />
            
            <select value={selectedOfficialLeague} onChange={(e) => setSelectedOfficialLeague(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-1 focus:ring-[#0077FF] appearance-none text-gray-400">
              <option value="">ESCOLHA A LIGA REAL</option>
              {ligasReaisDisponiveis.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            {/* PONTUAÇÃO */}
            <div className="grid grid-cols-3 gap-2 py-4">
              <div className="text-center">
                <p className="text-[8px] font-black uppercase mb-2 opacity-50">Placar Exato</p>
                <input type="number" value={points.exact} onChange={e => setPoints({...points, exact: e.target.value})} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-2 text-center font-black text-[#0077FF]" />
              </div>
              <div className="text-center">
                <p className="text-[8px] font-black uppercase mb-2 opacity-50">Venc +1 Gol</p>
                <input type="number" value={points.winnerOne} onChange={e => setPoints({...points, winnerOne: e.target.value})} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-2 text-center font-black text-[#0077FF]" />
              </div>
              <div className="text-center">
                <p className="text-[8px] font-black uppercase mb-2 opacity-50">Só Vencedor</p>
                <input type="number" value={points.winnerOnly} onChange={e => setPoints({...points, winnerOnly: e.target.value})} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-2 text-center font-black text-[#0077FF]" />
              </div>
            </div>

            <button onClick={handleCreateLeague} disabled={creating} className="w-full bg-[#0077FF] py-4 rounded-2xl font-black italic text-lg uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50">
              {creating ? "Sincronizando..." : "Criar Minha Liga"}
            </button>
          </div>
        </section>

        <div className="bg-[#1A1C3A] p-6 rounded-[30px] border border-[#26283A] flex gap-3 items-center">
          <input type="text" placeholder="CÓDIGO" className="w-24 bg-[#0A0E2A] border border-[#26283A] rounded-xl p-3 text-center font-bold outline-none" />
          <button className="flex-1 bg-transparent border-2 border-[#26283A] py-3 rounded-xl font-black italic uppercase text-xs hover:border-[#0077FF]">Entrar em Liga</button>
        </div>
      </div>
    </div>
  );
}