import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Logo from '../components/Logo';

export default function LeagueSettings() {
  // CORREÇÃO: Pegando 'ligaId' exatamente como foi definido na rota do App.jsx
  const { ligaId } = useParams();
  const navigate = useNavigate();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Guardamos as pontuações e os dados da liga
  const [points, setPoints] = useState({ exact: 3, winnerOne: 2, winnerOnly: 1 });
  const [currentSeasonFilter, setCurrentSeasonFilter] = useState("2025"); 

  useEffect(() => {
    if (ligaId) {
      checkAdminAndFetchData();
    }
  }, [ligaId]); // Escutando a variável correta aqui

  async function checkAdminAndFetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/');

      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
      if (!userData) return;

      // 1. Valida se o usuário é admin na tabela user_league_members usando o ligaId correto
      const { data: memberCheck, error } = await supabase
        .from('user_league_members')
        .select('role')
        .eq('user_league_id', ligaId)
        .eq('user_id', userData.id)
        .single();

      if (error || memberCheck?.role !== 'admin') {
        alert("Acesso negado. Apenas administradores acessam esta página.");
        return navigate(`/predictions/${ligaId}`);
      }

      setIsAdmin(true);

      // 2. Busca as regras de pontuação atuais
      const { data: leagueData } = await supabase
        .from('user_leagues')
        .select(`
          config_id,
          leagues_config (
            exact_score_points,
            winner_and_one_goal_points,
            winner_only_points
          )
        `)
        .eq('id', ligaId)
        .single();

      if (leagueData && leagueData.leagues_config) {
        setPoints({
          exact: leagueData.leagues_config.exact_score_points,
          winnerOne: leagueData.leagues_config.winner_and_one_goal_points,
          winnerOnly: leagueData.leagues_config.winner_only_points,
        });
      }

      // 3. Busca a lista de membros
      const { data: allMembers } = await supabase
        .from('user_league_members')
        .select(`
          id,
          user_id,
          role,
          users ( name, email )
        `)
        .eq('user_league_id', ligaId);

      setMembers(allMembers || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  // SALVAR NOVAS CONFIGURAÇÕES E VIRAR TEMPORADA
  const handleSaveSettings = async () => {
    if (!currentSeasonFilter.trim()) return alert("Insira a identificação da nova temporada (ex: 2026)!");
    
    const confirmChange = window.confirm(
      `Deseja iniciar uma nova temporada (${currentSeasonFilter})?\nOs palpites antigos e históricos serão mantidos e os novos jogos usarão este novo padrão de pontos.`
    );
    if (!confirmChange) return;

    setProcessing(true);
    try {
      // 1. Cria uma NOVA linha em leagues_config
      const { data: newConfig, error: configError } = await supabase
        .from('leagues_config')
        .insert({
          exact_score_points: Number(points.exact),
          winner_and_one_goal_points: Number(points.winnerOne),
          winner_only_points: Number(points.winnerOnly)
        })
        .select()
        .single();

      if (configError) throw configError;

      // 2. Atualiza o config_id da liga
      const { error: leagueError } = await supabase
        .from('user_leagues')
        .update({ config_id: newConfig.id })
        .eq('id', ligaId);

      if (leagueError) throw leagueError;

      alert(`Temporada configurada com sucesso!\nNova pontuação salva e vinculada à liga.`);
    } catch (err) {
      alert("Erro ao salvar configurações: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // REMOVER MEMBRO
  const handleRemoveMember = async (memberId, memberRole, memberName) => {
    if (memberRole === 'admin') return alert("O administrador não pode ser removido!");
    if (!window.confirm(`Remover ${memberName || 'este usuário'} da liga?`)) return;

    try {
      const { error } = await supabase.from('user_league_members').delete().eq('id', memberId);
      if (error) throw error;
      setMembers(members.filter(m => m.id !== memberId));
      alert("Membro removido com sucesso.");
    } catch (err) {
      alert("Erro ao remover: " + err.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0A0E2A] text-white flex items-center justify-center font-sans"><p className="text-xs font-black uppercase opacity-40">Carregando painel...</p></div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans pb-20">
      <header className="mb-10 mt-4 flex items-center gap-4 max-w-lg mx-auto">
        <Link to={`/predictions/${ligaId}`} className="bg-[#1A1C3A] px-4 py-2 rounded-xl text-[10px] font-black italic border border-[#26283A] hover:text-[#0077FF]">
          ← VOLTAR
        </Link>
        <Logo size="sm" />
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Configurações <span className="text-[#0077FF]">da Liga</span>
        </h1>
      </header>

      <div className="max-w-lg mx-auto space-y-6">
        {/* CARD DE PONTUAÇÃO E TEMPORADA */}
        <section className="bg-[#1A1C3A] p-8 rounded-[40px] border border-[#26283A] shadow-2xl">
          <h2 className="font-black italic uppercase text-sm text-[#0077FF] mb-2">Ajustar Pontuação & Temporada</h2>
          <p className="text-xs text-gray-400 mb-6 leading-relaxed">
            Caso queira mudar as regras de pontos para os próximos jogos da nova temporada, altere os valores abaixo. Os dados anteriores ficarão congelados no histórico.
          </p>

          <div className="mb-4">
            <label className="block text-[8px] font-black uppercase mb-2 opacity-50 text-left pl-1">Próxima Temporada (Filtro ID)</label>
            <input 
              type="text" 
              placeholder="Ex: 2026, TEMP_02, etc"
              value={currentSeasonFilter}
              onChange={e => setCurrentSeasonFilter(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-3 text-center font-bold text-white outline-none text-xs uppercase"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 py-4 border-y border-[#26283A] mb-6">
            {[
              { label: 'Placar Exato', key: 'exact' },
              { label: 'Venc +1 Gol', key: 'winnerOne' },
              { label: 'Só Vencedor', key: 'winnerOnly' }
            ].map((item) => (
              <div key={item.key} className="text-center">
                <p className="text-[7px] font-black uppercase mb-2 opacity-50">{item.label}</p>
                <input 
                  type="number" 
                  value={points[item.key]} 
                  onChange={e => setPoints({...points, [item.key]: e.target.value})}
                  className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-3 text-center font-black text-[#0077FF] outline-none" 
                />
              </div>
            ))}
          </div>

          <button 
            onClick={handleSaveSettings}
            disabled={processing}
            className="w-full bg-[#0077FF] hover:bg-[#0055CC] py-4 rounded-2xl font-black italic text-sm uppercase shadow-lg active:scale-95 transition-all"
          >
            {processing ? "SALVANDO..." : "💾 APLICAR REGRAS NA LIGA"}
          </button>
        </section>

        {/* CARD DE PARTICIPANTES */}
        <section className="bg-[#1A1C3A] p-6 rounded-[35px] border border-[#26283A] shadow-2xl">
          <h2 className="font-black italic uppercase text-sm mb-4 text-[#0077FF]">Gerenciar Participantes</h2>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="bg-[#0A0E2A] border border-[#26283A] p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="block font-bold text-xs uppercase">
                    {member.users?.name || "Sem Nome"} 
                    {member.role === 'admin' && <span className="text-[#0077FF] ml-2 text-[9px] font-black italic bg-[#1A1C3A] px-2 py-0.5 rounded-md border border-[#26283A]">ADMIN</span>}
                  </span>
                  <span className="text-[10px] text-gray-500">{member.users?.email}</span>
                </div>
                {member.role !== 'admin' && (
                  <button 
                    onClick={() => handleRemoveMember(member.id, member.role, member.users?.name)}
                    className="bg-[#1A1C3A] hover:bg-[#FF3333] hover:text-white text-gray-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border border-[#26283A]"
                  >
                    REMOVER
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}