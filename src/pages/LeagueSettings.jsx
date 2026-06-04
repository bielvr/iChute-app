import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Logo from '../components/Logo';

export default function LeagueSettings() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [points, setPoints] = useState({ exact: 3, winnerOne: 2, winnerOnly: 1 });
  const [currentSeasonFilter, setCurrentSeasonFilter] = useState("2026");

  useEffect(() => {
    if (ligaId) {
      checkAdminAndFetchData();
    }
  }, [ligaId]);

  async function checkAdminAndFetchData() {
    setLoading(true);
    try {
      const idDaLigaNum = Number(ligaId);
      if (isNaN(idDaLigaNum)) {
        console.error("ID da liga inválido na URL.");
        return navigate('/home');
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return navigate('/');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single();

      if (userError || !userData) {
        console.error("Usuário não encontrado na tabela 'users':", userError);
        alert("Erro ao validar perfil de usuário.");
        return navigate('/home');
      }

      // DUPLA CHECAGEM: Dono da liga OU Admin na tabela de membros
      const { data: leagueCheck } = await supabase
        .from('user_leagues')
        .select('owner_id')
        .eq('id', idDaLigaNum)
        .single();

      let temAcessoAdmin = false;

      if (leagueCheck && leagueCheck.owner_id === userData.id) {
        temAcessoAdmin = true;
      } else {
        const { data: memberCheck } = await supabase
          .from('user_league_members')
          .select('role')
          .eq('user_league_id', idDaLigaNum)
          .eq('user_id', userData.id)
          .maybeSingle();

        if (memberCheck && memberCheck.role?.toLowerCase() === 'admin') {
          temAcessoAdmin = true;
        }
      }

      if (!temAcessoAdmin) {
        alert("Acesso negado. Apenas administradores acessam esta página.");
        return navigate(`/predictions/${ligaId}`);
      }

      setIsAdmin(true);

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
        .eq('id', idDaLigaNum)
        .single();

      if (leagueData && leagueData.leagues_config) {
        setPoints({
          exact: leagueData.leagues_config.exact_score_points,
          winnerOne: leagueData.leagues_config.winner_and_one_goal_points,
          winnerOnly: leagueData.leagues_config.winner_only_points,
        });
      }

      const { data: allMembers } = await supabase
        .from('user_league_members')
        .select(`
          id,
          user_id,
          role,
          users ( name, email )
        `)
        .eq('user_league_id', idDaLigaNum);

      setMembers(allMembers || []);
    } catch (err) {
      console.error("Erro no painel da liga:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveSettings = async () => {
    if (!currentSeasonFilter.trim()) return alert("Insira a identificação da nova temporada!");
    
    const confirmChange = window.confirm(
      `Deseja iniciar uma nova temporada (${currentSeasonFilter})?\nOs palpites antigos serão mantidos e os novos jogos usarão este novo padrão de pontos.`
    );
    if (!confirmChange) return;

    setProcessing(true);
    try {
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

      const { error: leagueError } = await supabase
        .from('user_leagues')
        .update({ config_id: newConfig.id })
        .eq('id', Number(ligaId));

      if (leagueError) throw leagueError;

      alert(`Temporada configurada com sucesso!\nNova pontuação salva e vinculada à liga.`);
    } catch (err) {
      alert("Erro ao salvar configurações: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveMember = async (memberId, memberRole, memberName) => {
    if (memberRole?.toLowerCase() === 'admin') return alert("O administrador não pode ser removido!");
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

  if (loading) return <div className="min-h-screen bg-[#0A0E2A] text-white flex items-center justify-center font-sans"><p className="text-xs font-black uppercase opacity-40 tracking-widest animate-pulse">Carregando painel...</p></div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans pb-20">
      <header className="mb-10 mt-4 flex items-center gap-4 max-w-lg mx-auto">
        <Link to={`/predictions/${ligaId}`} className="bg-[#1A1C3A] px-4 py-2 rounded-xl text-[10px] font-black italic border border-[#26283A] hover:text-[#0077FF] transition-colors">
          ← VOLTAR
        </Link>
        <Logo size="sm" />
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Configurações <span className="text-[#0077FF]">da Liga</span>
        </h1>
      </header>

      <div className="max-w-lg mx-auto space-y-6">
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
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-3 text-center font-bold text-white outline-none text-xs uppercase focus:border-[#0077FF]"
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

        <section className="bg-[#1A1C3A] p-6 rounded-[35px] border border-[#26283A] shadow-2xl">
          <h2 className="font-black italic uppercase text-sm mb-4 text-[#0077FF]">Gerenciar Participantes</h2>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="bg-[#0A0E2A] border border-[#26283A] p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="block font-bold text-xs uppercase">
                    {member.users?.name || "Sem Nome"} 
                    {member.role?.toLowerCase() === 'admin' && <span className="text-[#0077FF] ml-2 text-[9px] font-black italic bg-[#1A1C3A] px-2 py-0.5 rounded-md border border-[#26283A]">ADMIN</span>}
                  </span>
                  <span className="text-[10px] text-gray-500">{member.users?.email}</span>
                </div>
                {member.role?.toLowerCase() !== 'admin' && (
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