import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { sportId } = useParams();
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Estados para os formulários
  const [newLeagueName, setNewLeagueName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const nomeEsporte = String(sportId) === '2' ? 'HOCKEY' : 'FUTEBOL';

  async function fetchMinhasLigas() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userData) return;

      const { data: participacoes } = await supabase
        .from('user_league_members')
        .select('user_league_id')
        .eq('user_id', userData.id);

      if (!participacoes?.length) {
        setLigas([]);
        return;
      }

      const idsDasLigas = participacoes.map(p => p.user_league_id);

      const { data: ligasEncontradas, error: errLigas } = await supabase
        .from('user_leagues')
        .select(`
          id,
          name,
          leagues!official_league_id ( sport_id )
        `)
        .in('id', idsDasLigas);

      if (errLigas) throw errLigas;

      const filtradas = ligasEncontradas.filter(liga => 
        String(liga.leagues?.sport_id) === String(sportId)
      );

      setLigas(filtradas);
    } catch (err) {
      console.error("Erro iChute:", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sportId) fetchMinhasLigas();
  }, [sportId]);

  // Função para CRIAR nova liga
  const handleCreateLeague = async () => {
    if (!newLeagueName) return alert("Digite o nome da liga");
    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();

      // 1. Cria Configuração
      const { data: config } = await supabase.from('leagues_config').insert({
        exact_score_points: 10,
        winner_and_one_goal_points: 7,
        winner_only_points: 5
      }).select().single();

      // 2. Cria a Liga
      const { data: league } = await supabase.from('user_leagues').insert({
        name: newLeagueName,
        owner_id: userData.id,
        config_id: config.id,
        official_league_id: sportId // Vincula ao esporte da página atual
      }).select().single();

      // 3. Adiciona como Membro Admin
      await supabase.from('user_league_members').insert({
        user_league_id: league.id,
        user_id: userData.id,
        role: 'admin'
      });

      setNewLeagueName("");
      fetchMinhasLigas(); // Atualiza a lista
    } catch (err) {
      alert("Erro ao criar liga: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans">
      <header className="mb-10 mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/home" className="bg-[#1A1C3A] p-3 rounded-xl text-xs font-black italic hover:bg-[#26283A] transition-all">
            ← VOLTAR
          </Link>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">
            Ligas <span className="text-[#0077FF]">{nomeEsporte}</span>
          </h1>
        </div>
      </header>

      <div className="grid gap-8 max-w-lg mx-auto">
        
        {/* SEÇÃO: CRIAR/ENTRAR (Sempre visível) */}
        <section className="bg-[#1A1C3A] p-6 rounded-[35px] border border-[#26283A] space-y-4">
          <h2 className="text-xs font-black italic uppercase opacity-40 mb-2 text-center">Gestão de Ligas</h2>
          
          <div className="flex flex-col gap-2">
            <input 
              type="text" 
              placeholder="NOME DA NOVA LIGA" 
              value={newLeagueName}
              onChange={(e) => setNewLeagueName(e.target.value)}
              className="bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-1 focus:ring-[#0077FF] text-sm"
            />
            <button 
              onClick={handleCreateLeague} 
              disabled={creating}
              className="bg-[#0077FF] py-3 rounded-2xl font-black italic uppercase hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {creating ? "PROCESSANDO..." : "CRIAR MINHA LIGA"}
            </button>
          </div>

          <div className="relative py-2 flex items-center">
            <div className="flex-grow border-t border-[#26283A]"></div>
            <span className="flex-shrink mx-4 text-[10px] font-black opacity-20 italic">OU</span>
            <div className="flex-grow border-t border-[#26283A]"></div>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="CÓDIGO" 
              className="w-24 bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none text-center text-sm"
            />
            <button className="flex-1 bg-transparent border-2 border-[#26283A] rounded-2xl font-black italic uppercase text-xs hover:border-[#0077FF] transition-all">
              Entrar em Liga
            </button>
          </div>
        </section>

        {/* LISTAGEM DE LIGAS */}
        <section className="space-y-3">
          <h2 className="text-xs font-black italic uppercase opacity-40 ml-2">Participando Atualmente</h2>
          
          {loading ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <div className="w-6 h-6 border-4 border-[#0077FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : ligas.length > 0 ? (
            ligas.map((liga) => (
              <Link 
                key={liga.id}
                to={`/predictions/${liga.id}`}
                className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[25px] flex justify-between items-center hover:border-[#0077FF] transition-all group"
              >
                <span className="font-black italic uppercase text-sm group-hover:text-[#0077FF]">{liga.name}</span>
                <span className="text-[#0077FF] font-bold">→</span>
              </Link>
            ))
          ) : (
            <div className="text-center p-10 border border-dashed border-[#26283A] rounded-[30px] opacity-40">
              <p className="font-black italic uppercase text-[10px]">Nenhuma liga ativa</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}