import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { sportId } = useParams();
  const [ligasAtivas, setLigasAtivas] = useState([]);
  const [ligasReaisDisponiveis, setLigasReaisDisponiveis] = useState([]);
  const [nomeEsporte, setNomeEsporte] = useState("MODALIDADE"); 
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [newLeagueName, setNewLeagueName] = useState("");
  const [selectedOfficialLeague, setSelectedOfficialLeague] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [points, setPoints] = useState({ exact: 3, winnerOne: 2, winnerOnly: 1 });
  
  // Estado para controlar a visibilidade do modal de ajuda
  const [showHelpModal, setShowHelpModal] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
      if (!userData) return;

      const { data: sportData } = await supabase
        .from('sports')
        .select('name')
        .eq('id', sportId)
        .single();
      
      if (sportData) {
        const traducoes = {
          'Football': 'FUTEBOL',
          'Ice Hockey': 'HOCKEY',
          'Basketball': 'BASQUETE',
          'American Football': 'NFL / FUTEBOL AMERICANO',
          'Baseball': 'BEISEBOL'
        };
        setNomeEsporte(traducoes[sportData.name] || sportData.name.toUpperCase());
      }

      const { data: participacoes, error: partError } = await supabase
        .from('user_league_members')
        .select(`
          user_league_id,
          user_leagues (
            id, name, official_league_id,
            leagues!official_league_id ( sport_id )
          )
        `)
        .eq('user_id', userData.id);

      if (partError) throw partError;

      if (participacoes) {
        const filtradas = participacoes
          .map(p => p.user_leagues)
          .filter(l => l && String(l.leagues?.sport_id) === String(sportId));
        setLigasAtivas(filtradas);
      }

      const { data: reais, error: reaisError } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('sport_id', sportId)
        .eq('show', true);
      
      if (reaisError) throw reaisError;
      setLigasReaisDisponiveis(reais || []);

    } catch (err) {
      console.error("Erro ao carregar dados das ligas:", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    fetchData(); 
  }, [sportId]);

  const handleJoinLeague = async () => {
    if (!inviteCodeInput) return alert("Digite o código!");
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase.from('users').select('id').eq('email', user.email).single();
      const { data: league, error } = await supabase.from('user_leagues').select('id, name').eq('id', inviteCodeInput).single();
      if (error || !league) throw new Error("Liga não encontrada.");
      
      await supabase.from('user_league_members').insert({ 
        user_league_id: league.id, 
        user_id: userData.id, 
        role: 'member' 
      });
      
      setInviteCodeInput("");
      fetchData();
    } catch (err) { 
      alert(err.message); 
    } finally { 
      setProcessing(false); 
    }
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
      
      await supabase.from('user_league_members').insert({ 
        user_league_id: league.id, 
        user_id: userData.id, 
        role: 'admin' 
      });
      
      setNewLeagueName("");
      setSelectedOfficialLeague("");
      fetchData();
    } catch (err) { 
      alert(err.message); 
    } finally { 
      setProcessing(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans pb-20">
      {/* HEADER */}
      <header className="mb-10 mt-4 flex items-center gap-4 max-w-lg mx-auto">
        <Link to="/home" className="bg-[#1A1C3A] px-4 py-2 rounded-xl text-[10px] font-black italic border border-[#26283A] hover:text-[#0077FF] transition-colors">
          ← VOLTAR
        </Link>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Ligas <span className="text-[#0077FF]">{nomeEsporte}</span>
        </h1>
      </header>

      {/* SEÇÃO: LIGAS ATIVAS */}
      <div className="grid gap-4 max-w-lg mx-auto mb-12">
        <h2 className="text-xs font-black italic uppercase opacity-40 ml-2 tracking-wider">Suas Ligas Ativas</h2>
        {loading ? (
          <p className="text-xs opacity-30 font-bold uppercase ml-2 tracking-wide">Carregando ligas...</p>
        ) : ligasAtivas.length === 0 ? (
          <p className="text-xs opacity-30 font-bold uppercase ml-2 tracking-wide">Você não participa de nenhuma liga deste esporte.</p>
        ) : (
          ligasAtivas.map((liga) => (
            <div key={liga.id} className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[30px] flex justify-between items-center group shadow-lg">
              <div>
                <span className="block font-black italic uppercase group-hover:text-[#0077FF] transition-all">{liga.name}</span>
                <span className="text-[9px] font-bold opacity-40 uppercase">CÓDIGO: <span className="text-[#0077FF]">{liga.id}</span></span>
              </div>
              <Link to={`/predictions/${liga.id}`} className="bg-[#0A0E2A] p-3 rounded-full border border-[#26283A] hover:scale-110 transition-transform">
                <span className="text-[#0077FF] font-bold">→</span>
              </Link>
            </div>
          ))
        )}
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        {/* FORMULÁRIO: ENTRAR EM LIGA EXISTENTE */}
        <div className="bg-[#1A1C3A] p-6 rounded-[35px] border border-[#26283A] flex gap-3 items-center shadow-md">
          <input 
            type="number" 
            placeholder="CÓDIGO" 
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
            className="w-24 bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-[#0077FF] transition-colors" 
          />
          <button onClick={handleJoinLeague} className="flex-1 bg-transparent border-2 border-[#26283A] py-4 rounded-2xl font-black italic uppercase text-xs hover:border-[#0077FF] transition-all">
            Entrar em Liga
          </button>
        </div>

        {/* FORMULÁRIO: CRIAR NOVA LIGA PRIVADA */}
        <section className="bg-[#1A1C3A] p-8 rounded-[40px] border border-[#26283A] shadow-2xl">
          <h2 className="text-center font-black italic uppercase text-[#0077FF] mb-6 tracking-wide">Criar Nova Liga</h2>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="NOME DA LIGA" 
              value={newLeagueName} 
              onChange={(e) => setNewLeagueName(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none text-center focus:border-[#0077FF] transition-colors" 
            />
            
            <div className="relative">
              <select 
                value={selectedOfficialLeague} 
                onChange={(e) => setSelectedOfficialLeague(e.target.value)}
                className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none text-center text-gray-400 appearance-none cursor-pointer focus:border-[#0077FF] transition-colors"
              >
                <option value="">VINCULAR À LIGA REAL...</option>
                {ligasReaisDisponiveis.map(r => <option key={r.id} value={r.id} className="text-white">{r.name}</option>)}
              </select>
            </div>

            {/* SELEÇÃO E BOTÃO DE AJUDA DAS REGRAS */}
            <div className="flex justify-between items-center pt-4">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Regras de Pontuação</span>
              <button 
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="w-5 h-5 bg-[#0A0E2A] border border-[#26283A] rounded-full text-[10px] font-black text-[#0077FF] flex items-center justify-center hover:bg-[#0077FF] hover:text-white transition-all shadow-md"
              >
                ?
              </button>
            </div>

            {/* CARD INTERNO: REGRAS DE PONTUAÇÃO */}
            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-[#26283A]">
              {[
                { label: 'Placar Exato', key: 'exact' },
                { label: 'Venc +1 Gol', key: 'winnerOne' },
                { label: 'Só Vencedor', key: 'winnerOnly' }
              ].map((item) => (
                <div key={item.key} className="text-center">
                  <p className="text-[7px] font-black uppercase mb-2 opacity-50 tracking-wider">{item.label}</p>
                  <input 
                    type="number" 
                    value={points[item.key]} 
                    onChange={e => setPoints({...points, [item.key]: e.target.value})}
                    className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-xl p-3 text-center font-black text-[#0077FF] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-[#0077FF] transition-colors" 
                  />
                </div>
              ))}
            </div>

            <button 
              onClick={handleCreateLeague} 
              disabled={processing} 
              className="w-full bg-[#0077FF] py-4 rounded-2xl font-black italic text-lg uppercase shadow-lg active:scale-95 hover:bg-[#0066DD] transition-all disabled:opacity-50"
            >
              {processing ? "CRIANDO..." : "GERAR LIGA E CÓDIGO"}
            </button>
          </div>
        </section>
      </div>

      {/* MODAL DE AJUDA FLUTUANTE (BACKDROP EMBASSADO) */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-[#0A0E2A]/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[35px] max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="font-black italic text-base uppercase text-[#0077FF] mb-4 tracking-tight">Como funciona a pontuação?</h3>
            
            <div className="space-y-4 text-xs font-medium text-gray-300">
              <div>
                <h4 className="font-black text-white uppercase text-[10px] tracking-wide mb-1 text-[#55DD55]">1. Placar Exato</h4>
                <p>Você crava perfeitamente os gols dos dois times. Ex: Palpite 2x1 | Resultado 2x1.</p>
              </div>

              <div>
                <h4 className="font-black text-white uppercase text-[10px] tracking-wide mb-1 text-cyan-400">2. Vencedor + 1 Gol</h4>
                <p>Você acerta quem venceu e o número exato de gols de apenas um dos lados. Ex: Palpite 2x1 | Resultado 2x0.</p>
              </div>

              <div>
                <h4 className="font-black text-white uppercase text-[10px] tracking-wide mb-1 text-amber-400">3. Só Vencedor / Tendência</h4>
                <p>Você acerta apenas o ganhador ou empate, mas erra os placares. Ex: Palpite 2x1 | Resultado 1x0.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowHelpModal(false)}
              className="w-full mt-6 bg-[#0A0E2A] border border-[#26283A] py-3 rounded-xl font-black uppercase text-xs text-gray-400 hover:text-white hover:border-[#0077FF] transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}