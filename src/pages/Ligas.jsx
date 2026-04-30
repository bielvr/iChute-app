import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { sportId } = useParams();
  const [ligasAtivas, setLigasAtivas] = useState([]);
  const [ligasReaisDisponiveis, setLigasReaisDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Estados do Formulário
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

      // 1. Buscar Ligas que o usuário participa (Join com user_leagues)
      const { data: participacoes } = await supabase
        .from('user_league_members')
        .select(`
          user_league_id,
          user_leagues (
            id,
            name,
            official_league_id,
            leagues!official_league_id ( sport_id )
          )
        `)
        .eq('user_id', userData.id);

      if (participacoes) {
        // Filtra para mostrar apenas as ligas do esporte da página
        const filtradas = participacoes
          .map(p => p.user_leagues)
          .filter(l => l && String(l.leagues?.sport_id) === String(sportId));
        setLigasAtivas(filtradas);
      }

      // 2. Buscar Ligas Reais para o Select (NHL, Brasileirão, etc)
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

  // FUNÇÃO PARA ENTRAR EM UMA LIGA EXISTENTE VIA CÓDIGO
  const handleJoinLeague = async () => {
    if (!inviteCodeInput) return alert("Digite o código da liga!");
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();

      // Verifica se a liga existe (o código aqui é o ID da liga)
      const { data: league, error } = await supabase
        .from('user_leagues')
        .select('id, name')
        .eq('id', inviteCodeInput)
        .single();

      if (error || !league) throw new Error("Liga não encontrada com este código.");

      // Insere o membro
      const { error: joinError } = await supabase
        .from('user_league_members')
        .insert({
          user_league_id: league.id,
          user_id: userData.id,
          role: 'player'
        });

      if (joinError) {
        if (joinError.code === '23505') throw new Error("Você já está nesta liga!");
        throw joinError;
      }

      alert(`Boa! Você entrou na liga ${league.name}`);
      setInviteCodeInput("");
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateLeague = async () => {
    if (!newLeagueName || !selectedOfficialLeague) return alert("Preencha o nome e a liga real!");
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
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans pb-20">
      <header className="mb-10 mt-4 flex items-center gap-4">
        <Link to="/home" className="bg-[#1A1C3A] p-3 rounded-xl text-xs font-black italic hover:bg-[#26283A]">← VOLTAR</Link>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">Ligas <span className="text-[#0077FF]">{nomeEsporte}</span></h1>
      </header>

      {/* LISTA DE LIGAS ATIVAS */}
      <div className="grid gap-4 max-w-lg mx-auto mb-12">
        <h2 className="text-xs font-black italic uppercase opacity-40 ml-2">Suas Ligas Ativas</h2>
        {loading ? (
          <div className="text-center py-10 animate-pulse font-black uppercase text-[10px]">Sincronizando...</div>
        ) : ligasAtivas.length > 0 ? (
          ligasAtivas.map((liga) => (
            <div key={liga.id} className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[30px] flex justify-between items-center group">
              <div>
                <span className="block font-black italic uppercase group-hover:text-[#0077FF] transition-all">{liga.name}</span>
                <span className="text-[9px] font-bold opacity-40 uppercase">Código para convite: <span className="text-[#0077FF]">{liga.id}</span></span>
              </div>
              <Link to={`/predictions/${liga.id}`} className="bg-[#0A0E2A] p-3 rounded-full hover:scale-110 transition-transform">
                <span className="text-[#0077FF] font-bold">→</span>
              </Link>
            </div>
          ))
        ) : (
          <div className="text-center p-12 border-2 border-dashed border-[#1A1C3A] rounded-[40px] opacity-30">
            <p className="font-black italic uppercase text-[10px]">Nenhuma liga ativa em {nomeEsporte}</p>
          </div>
        )}
      </div>

      <hr className="border-[#1A1C3A] max-w-lg mx-auto mb-12" />

      {/* GESTÃO E CRIAÇÃO */}
      <div className="max-w-lg mx-auto space-y-6">
        {/* ENTRAR EM LIGA EXISTENTE */}
        <div className="bg-[#1A1C3A] p-6 rounded-[35px] border border-[#26283A] flex gap-3 items-center shadow-xl">
          <input 
            type="text" 
            placeholder="CÓDIGO" 
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
            className="w-24 bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 text-center font-bold outline-none focus:ring-1 focus:ring-[#0077FF]" 
          />
          <button 
            onClick={handleJoinLeague}
            disabled={processing}
            className="flex-1 bg-transparent border-2 border-[#26283A] py-4 rounded-2xl font-black italic uppercase text-xs hover:border-[#0077FF] transition-all disabled:opacity-50"
          >
            Entrar em Liga
          </button>
        </div>

        {/* CRIAR NOVA LIGA */}
        <section className="bg-[#1A1C3A] p-8 rounded-[40px] border border-[#26283A] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <span className="font-black italic text-4xl uppercase">{nomeEsporte}</span>
          </div>
          
          <h2 className="text-center font-black italic uppercase text-[#0077FF] mb-6">Criar Nova Liga</h2>
          
          <div className="space-y-4">
            <input type="text" placeholder="NOME DA LIGA (EX: GALERA DO HOCKEY)" value={newLeagueName} onChange={(e) => setNewLeagueName(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-1 focus:ring-[#0077FF]" />
            
            <select value={selectedOfficialLeague} onChange={(e) => setSelectedOfficialLeague(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-1 focus:ring-[#0077FF] text-gray-400">
              <option value="">VINCULAR À LIGA REAL...</option>
              {ligasReaisDisponiveis.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            <div className="grid grid-cols-3 gap-2 py-4 border-y border-[#26283A]">
              <div className="text-center">
                <p className="text-[7px] font-black uppercase mb-2 opacity-50">Placar Exato</p>
                <input type="number" value={points.exact} onChange={e => setPoints({...points, exact: e.target.value})} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-2 text-center font-black text-[#0077FF]" />
              </div>
              <div className="text-center">
                <p className="text-[7px] font-black uppercase mb-2 opacity-50">Venc +1 Gol</p>
                <input type="number" value={points.winnerOne} onChange={e => setPoints({...points, winnerOne: e.target.value})} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-2 text-center font-black text-[#0077FF]" />
              </div>
              <div className="text-center">
                <p className="text-[7px] font-black uppercase mb-2 opacity-50">Só Vencedor</p>
                <input type="number" value={points.winnerOnly} onChange={e => setPoints({...points, winnerOnly: e.target.value})} className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-2 text-center font-black text-[#0077FF]" />
              </div>
            </div>

            <button onClick={handleCreateLeague} disabled={processing} className="w-full bg-[#0077FF] py-4 rounded-2xl font-black italic text-lg uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50">
              {processing ? "CRIANDO..." : "GERAR LIGA E CÓDIGO"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}