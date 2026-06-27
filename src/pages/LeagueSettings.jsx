import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Logo from '../components/Logo';

export default function LeagueSettings() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserMemberId, setCurrentUserMemberId] = useState(null); 
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [leagueName, setLeagueName] = useState(""); // Guarda o nome original da liga
  const [confirmLeagueName, setConfirmLeagueName] = useState(""); // Input de segurança do Admin
  const [points, setPoints] = useState({ exact: 3, winnerOne: 2, winnerOnly: 1 });
  
  const [seasons, setSeasons] = useState([]);
  const [currentSeasonFilter, setCurrentSeasonFilter] = useState("");
  const [loadingSeasons, setLoadingSeasons] = useState(true);

  useEffect(() => {
    if (ligaId) {
      checkAccessAndFetchData();
    }
  }, [ligaId]);

  async function checkAccessAndFetchData() {
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

      // Buscando também o nome da liga para usar na exclusão de segurança
      const { data: leagueCheck } = await supabase
        .from('user_leagues')
        .select('name, owner_id')
        .eq('id', idDaLigaNum)
        .single();

      if (leagueCheck) {
        setLeagueName(leagueCheck.name);
      }

      const { data: memberCheck } = await supabase
        .from('user_league_members')
        .select('id, role')
        .eq('user_league_id', idDaLigaNum)
        .eq('user_id', userData.id)
        .maybeSingle();

      const ehDono = leagueCheck && leagueCheck.owner_id === userData.id;
      const ehAdminPorRole = memberCheck && memberCheck.role?.toLowerCase() === 'admin';
      
      if (!ehDono && !memberCheck) {
        alert("Você não faz parte desta liga.");
        return navigate('/home');
      }

      const temAcessoAdmin = ehDono || ehAdminPorRole;
      setIsAdmin(temAcessoAdmin);
      
      if (memberCheck) {
        setCurrentUserMemberId(memberCheck.id);
      }

      if (temAcessoAdmin) {
        const leagueData = await supabase
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

        if (leagueData.data && leagueData.data.leagues_config) {
          setPoints({
            exact: leagueData.data.leagues_config.exact_score_points,
            winnerOne: leagueData.data.leagues_config.winner_and_one_goal_points,
            winnerOnly: leagueData.data.leagues_config.winner_only_points,
          });
        }

        setLoadingSeasons(true);
        const { data: matchesData, error: seasonsError } = await supabase
          .from('matches')
          .select('season');

        if (!seasonsError && matchesData) {
          const uniqueSeasons = [
            ...new Set(matchesData.map(m => m.season).filter(Boolean))
          ].sort((a, b) => b.localeCompare(a));

          setSeasons(uniqueSeasons);
          if (uniqueSeasons.length > 0) {
            setCurrentSeasonFilter(uniqueSeasons[0]);
          }
        } else {
          console.error("Erro ao buscar temporadas:", seasonsError);
          setSeasons(["2026"]);
          setCurrentSeasonFilter("2026");
        }
        setLoadingSeasons(false);
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
      console.error("Erro ao processar dados de acesso:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveSettings = async () => {
    if (!currentSeasonFilter) return alert("Selecione uma temporada válida!");
    
    const confirmChange = window.confirm(
      `Deseja aplicar a temporada (${currentSeasonFilter})?\nOs palpites antigos serão mantidos e os novos jogos usarão este novo padrão de pontos.`
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
    if (memberRole?.toLowerCase() === 'admin') return alert("O administrador não pode ser removido por aqui!");
    if (!window.confirm(`Remover ${memberName || 'este usuário'} da liga?`)) return;

    try {
      const { error } = await supabase.from('user_league_members').delete().eq('id', memberId);
      if (error) throw error;
      setMembers(members.filter(m => m.id !== memberId));
      alert("Membro removido com sucesso.");
    } catch (err) {
      alert("Erro ao remover: " + err.message + "\nVerifique se as RLS de DELETE estão criadas.");
    }
  };

  const handleLeaveLeague = async () => {
    if (isAdmin) {
      return alert("Você é administrador/dono desta liga. Para sair, defina outro administrador ou encerre a liga.");
    }
    if (!currentUserMemberId) return alert("Erro ao identificar seu vínculo com a liga.");

    if (!window.confirm("Tem certeza de que deseja sair desta liga? Seu histórico de pontuação nela será removido.")) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('user_league_members')
        .delete()
        .eq('id', currentUserMemberId);

      if (error) throw error;

      alert("Você saiu da liga com sucesso.");
      navigate('/home');
    } catch (err) {
      alert("Erro ao tentar sair da liga: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!isAdmin) return alert("Apenas administradores podem deletar a liga.");
    if (confirmLeagueName !== leagueName) {
      return alert("O nome digitado não corresponde ao nome da liga!");
    }

    if (!window.confirm(`ATENÇÃO CRÍTICA:\nTem certeza absoluta que deseja EXCLUIR permanentemente a liga "${leagueName}"? Todos os palpites e pontuações dos membros serão apagados.`)) return;

    setProcessing(true);
    try {
      // Como user_league_members referencia user_leagues com chave estrangeira,
      // idealmente garanta que está em CASCADE no banco, senão apague os membros antes.
      const { error } = await supabase
        .from('user_leagues')
        .delete()
        .eq('id', Number(ligaId));

      if (error) throw error;

      alert("Liga excluída com sucesso.");
      navigate('/home');
    } catch (err) {
      alert("Erro ao deletar a liga: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E2A] text-white flex items-center justify-center font-sans">
        <p className="text-xs font-black uppercase opacity-40 tracking-widest animate-pulse">Carregando painel...</p>
      </div>
    );
  }

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
        {/* VIEW EXCLUSIVA DO ADMIN - AJUSTE DE REGRAS */}
        {isAdmin && (
          <section className="bg-[#1A1C3A] p-8 rounded-[40px] border border-[#26283A] shadow-2xl">
            <h2 className="font-black italic uppercase text-sm text-[#0077FF] mb-2">Ajustar Pontuação & Temporada</h2>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Caso queira mudar as regras de pontos para os próximos jogos da nova temporada, altere os valores abaixo. Os dados anteriores ficarão congelados no histórico.
            </p>

            <div className="mb-6">
              <label className="block text-[8px] font-black uppercase mb-2 opacity-50 text-left pl-1">Próxima Temporada (Filtro Ativo)</label>
              <div className="relative">
                <select 
                  value={currentSeasonFilter}
                  onChange={e => setCurrentSeasonFilter(e.target.value)}
                  disabled={loadingSeasons}
                  className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-3.5 text-center font-bold text-white outline-none text-xs uppercase focus:border-[#0077FF] appearance-none cursor-pointer"
                >
                  {loadingSeasons ? (
                    <option>Buscando temporadas no banco...</option>
                  ) : seasons.length === 0 ? (
                    <option value="2026">2026</option>
                  ) : (
                    seasons.map((season) => (
                      <option key={season} value={season} className="bg-[#0A0E2A] text-white">
                        {season}
                      </option>
                    ))
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#0077FF]">
                  <svg className="fill-currentColor h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
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
              className="w-full bg-[#0077FF] hover:bg-[#0055CC] py-4 rounded-2xl font-black text-sm uppercase shadow-lg active:scale-95 transition-all"
            >
              {processing ? "SALVANDO..." : "💾 APLICAR REGRAS NA LIGA"}
            </button>
          </section>
        )}

        {/* LISTA DE PARTICIPANTES - ACESSÍVEL PARA TODOS */}
        <section className="bg-[#1A1C3A] p-6 rounded-[35px] border border-[#26283A] shadow-2xl">
          <h2 className="font-black italic uppercase text-sm mb-4 text-[#0077FF]">
            {isAdmin ? "Gerenciar Participantes" : "Participantes da Liga"}
          </h2>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="bg-[#0A0E2A] border border-[#26283A] p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="block font-bold text-xs uppercase">
                    {member.users?.name || "Sem Nome"} 
                    {member.role?.toLowerCase() === 'admin' && (
                      <span className="text-[#0077FF] ml-2 text-[9px] font-black italic bg-[#1A1C3A] px-2 py-0.5 rounded-md border border-[#26283A]">
                        ADMIN
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-gray-500">{member.users?.email}</span>
                </div>
                
                {isAdmin && member.role?.toLowerCase() !== 'admin' && (
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

        {/* ZONA DE PERIGO DINÂMICA */}
        {isAdmin ? (
          /* SE FOR ADMIN: EXCLUIR A LIGA COPIANDO O NOME */
          <section className="bg-[#1A1C3A] p-6 rounded-[35px] border border-[#FF3333]/30 shadow-2xl text-center">
            <h2 className="font-black italic uppercase text-sm mb-2 text-[#FF3333]">Zona de Perigo (Admin)</h2>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Para excluir permanentemente a liga <span className="text-white font-bold">"{leagueName}"</span>, digite o nome dela exatamente igual abaixo:
            </p>
            <input 
              type="text" 
              value={confirmLeagueName}
              onChange={e => setConfirmLeagueName(e.target.value)}
              placeholder={leagueName || "Digite o nome da liga"}
              className="w-full bg-[#0A0E2A] border border-[#26283A] focus:border-[#FF3333] rounded-xl p-3 text-center font-bold text-white outline-none text-xs mb-3 transition-colors"
            />
            <button
              onClick={handleDeleteLeague}
              disabled={processing || confirmLeagueName !== leagueName}
              className="w-full bg-[#FF3333] hover:bg-[#CC2222] disabled:opacity-20 disabled:hover:bg-[#FF3333] text-white py-4 rounded-2xl font-black text-xs uppercase transition-all tracking-wider shadow-lg"
            >
              {processing ? "DELETANDO..." : "🚨 DELETAR LIGA DEFINITIVAMENTE"}
            </button>
          </section>
        ) : (
          /* SE FOR APENAS MEMBRO: OPÇÃO DE SAIR VOLUNTARIAMENTE */
          <section className="bg-[#1A1C3A] p-6 rounded-[35px] border border-[#FF3333]/30 shadow-2xl text-center">
            <h2 className="font-black italic uppercase text-sm mb-2 text-[#FF3333]">Zona de Perigo</h2>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Se você decidir sair desta liga, deixará de concorrer na tabela de classificação atual e perderá o acesso aos palpites do grupo.
            </p>
            <button
              onClick={handleLeaveLeague}
              disabled={processing}
              className="w-full border border-[#FF3333] text-[#FF3333] hover:bg-[#FF3333] hover:text-white py-3 rounded-2xl font-black italic text-xs uppercase transition-all duration-200"
            >
              {processing ? "SAINDO..." : "🏃 Sair da Liga"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}