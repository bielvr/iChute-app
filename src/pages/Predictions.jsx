import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Predictions() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const [jogos, setJogos] = useState([]);
  const [palpites, setPalpites] = useState({}); // { matchId: { home: X, away: Y } }
  const [ligaNome, setLigaNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numericUserId, setNumericUserId] = useState(null);

  const [dataSelecionada, setDataSelecionada] = useState(new Date().toLocaleDateString('en-CA'));

  const proximosDias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });

  useEffect(() => {
    async function fetchData() {
      if (!ligaId || ligaId === "undefined") return;
      setLoading(true);
      try {
        // 1. Pega usuário e ID numérico (Crucial para o seu schema)
        const { data: { user } } = await supabase.auth.getUser();
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', user?.email)
          .single();
        
        setNumericUserId(userData?.id);

        // 2. Busca info da liga
        const { data: infoLiga } = await supabase
          .from('user_leagues')
          .select('name, official_league_id')
          .eq('id', ligaId)
          .single();

        setLigaNome(infoLiga.name);

        // 3. Busca jogos (Janela de 36h para fuso)
        const inicioBusca = new Date(`${dataSelecionada}T00:00:00Z`);
        const fimBusca = new Date(inicioBusca);
        fimBusca.setHours(fimBusca.getHours() + 36);

        const { data: matchesData } = await supabase
          .from('matches')
          .select(`*, home:home_team_id (name, url_logo), away:away_team_id (name, url_logo)`)
          .eq('league_id', infoLiga.official_league_id)
          .gte('date', inicioBusca.toISOString())
          .lte('date', fimBusca.toISOString())
          .order('date', { ascending: true });

        const filtrados = (matchesData || []).filter(j => 
          new Date(j.date).toLocaleDateString('en-CA') === dataSelecionada
        );
        setJogos(filtrados);

        // 4. Busca palpites já realizados para carregar nos inputs
        if (userData?.id && filtrados.length > 0) {
          const { data: existingPreds } = await supabase
            .from('predictions')
            .select('match_id, prediction_home, prediction_away')
            .eq('user_id', userData.id)
            .eq('user_league_id', ligaId)
            .in('match_id', filtrados.map(j => j.id));

          const mapaPalpites = {};
          existingPreds?.forEach(p => {
            mapaPalpites[p.match_id] = { home: p.prediction_home, away: p.prediction_away };
          });
          setPalpites(mapaPalpites);
        }

      } catch (error) {
        console.error("Erro iChute:", error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [ligaId, dataSelecionada]);

  // Função para lidar com a mudança nos inputs
  const handleInputChange = (matchId, side, value) => {
    setPalpites(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side]: value === "" ? "" : parseInt(value)
      }
    }));
  };

  // O "Coração" da gravação
  const handleConfirmar = async () => {
    if (!numericUserId) return alert("Erro: Usuário não identificado");
    setSaving(true);

    // Prepara o array para o Upsert
    const payloads = Object.keys(palpites).map(matchId => ({
      user_id: numericUserId,
      match_id: parseInt(matchId),
      user_league_id: parseInt(ligaId),
      prediction_home: palpites[matchId].home ?? 0,
      prediction_away: palpites[matchId].away ?? 0,
      points_earned: 0 // Valor padrão conforme seu schema
    }));

    try {
      const { error } = await supabase
        .from('predictions')
        .upsert(payloads, { onConflict: 'user_id,match_id,user_league_id' });

      if (error) throw error;
      alert("PALPITES REGISTRADOS NO GELO! ⚡");
    } catch (err) {
      console.error("Erro ao salvar:", err.message);
      alert("Erro ao salvar palpites.");
    } finally {
      setSaving(false);
    }
  };

  const formatarHoraLocal = (dateString) => {
    if (!dateString) return "--:--";
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (loading) return <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black italic animate-pulse">SINCRONIZANDO ICHUTE...</div>;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-40">
      {/* Header e Seleção de Data iguais ao seu original */}
      <header className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]">← VOLTAR</button>
          <h1 className="text-xl font-black italic text-[#0077FF] uppercase tracking-tighter text-right">
            iCHUTE <span className="text-white block text-sm">{ligaNome}</span>
          </h1>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
          {proximosDias.map((data) => {
            const isSelected = data === dataSelecionada;
            const [, mes, dia] = data.split('-');
            return (
              <button key={data} onClick={() => setDataSelecionada(data)} className={`flex-shrink-0 px-6 py-4 rounded-[20px] font-black text-xs uppercase italic border ${isSelected ? 'bg-[#0077FF] text-white' : 'bg-[#1A1C3A] text-gray-400'}`}>
                {isSelected ? 'HOJE' : `${dia}/${mes}`}
              </button>
            );
          })}
        </div>
      </header>

      {jogos.length === 0 ? (
        <div className="text-center p-20 border-2 border-dashed border-[#1A1C3A] rounded-[40px] max-w-2xl mx-auto text-gray-600 font-black italic uppercase text-[10px]">Sem jogos para esta data local</div>
      ) : (
        <div className="grid gap-6 max-w-2xl mx-auto">
          {jogos.map((jogo) => (
            <div key={jogo.id} className="relative bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[35px] shadow-2xl">
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1 flex flex-col items-center text-center gap-3">
                  <img src={jogo.home?.url_logo} className="w-14 h-14 object-contain" alt="" />
                  <span className="text-[11px] font-black uppercase">{jogo.home?.name}</span>
                </div>

                <div className="flex items-center gap-3 bg-[#0A0E2A] p-4 rounded-[25px] border border-[#26283A]">
                  <input 
                    type="number" 
                    value={palpites[jogo.id]?.home ?? ""}
                    onChange={(e) => handleInputChange(jogo.id, 'home', e.target.value)}
                    className="w-16 h-16 text-center bg-[#1A1C3A] rounded-2xl font-black text-3xl text-[#0077FF]" 
                    placeholder="0" 
                  />
                  <span className="text-[#26283A] font-black italic text-2xl">X</span>
                  <input 
                    type="number" 
                    value={palpites[jogo.id]?.away ?? ""}
                    onChange={(e) => handleInputChange(jogo.id, 'away', e.target.value)}
                    className="w-16 h-16 text-center bg-[#1A1C3A] rounded-2xl font-black text-3xl text-[#0077FF]" 
                    placeholder="0" 
                  />
                </div>

                <div className="flex-1 flex flex-col items-center text-center gap-3">
                  <img src={jogo.away?.url_logo} className="w-14 h-14 object-contain" alt="" />
                  <span className="text-[11px] font-black uppercase">{jogo.away?.name}</span>
                </div>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-black text-[#B0C4DE] uppercase italic">
                LOCAL: {formatarHoraLocal(jogo.date)}
              </div>
            </div>
          ))}
          
          <button 
            onClick={handleConfirmar}
            disabled={saving}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-xl font-black py-6 rounded-[25px] uppercase italic text-xl z-50 transition-all ${saving ? 'bg-gray-700 opacity-50' : 'bg-[#0077FF] hover:scale-105'}`}
          >
            {saving ? 'GRAVANDO...' : 'CONFIRMAR PALPITES'}
          </button>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }`}} />
    </div>
  );
}