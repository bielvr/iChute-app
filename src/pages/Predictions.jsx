import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Predictions() {
  const { ligaId } = useParams(); // ID da user_leagues (ex: 1)
  const [jogos, setJogos] = useState([]);
  const [ligaNome, setLigaNome] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Data local do usuário (YYYY-MM-DD)
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toLocaleDateString('en-CA'));

  const proximosDias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });

  useEffect(() => {
    async function fetchData() {
      if (!ligaId) return;
      setLoading(true);
      
      try {
        // 1. Busca info da Liga de Usuário e a chave para a liga oficial
        // No seu diagrama, user_leagues tem official_league_id
        const { data: infoLiga, error: ligaErr } = await supabase
          .from('user_leagues')
          .select('name, official_league_id')
          .eq('id', ligaId)
          .single();

        if (ligaErr || !infoLiga) {
          console.error("Liga não encontrada:", ligaErr);
          setLoading(false);
          return;
        }

        setLigaNome(infoLiga.name);

        // 2. Busca Jogos usando o ID da liga OFICIAL (ex: 14 para NHL)
        // Isso resolve o problema de retornar vazio e bugar a navegação
        const inicioDiaLocal = new Date(`${dataSelecionada}T00:00:00`);
        const fimDiaLocal = new Date(`${dataSelecionada}T23:59:59`);

        const { data: matchesData, error: matchesErr } = await supabase
          .from('matches')
          .select(`
            *,
            home:home_team_id (name, url_logo),
            away:away_team_id (name, url_logo)
          `)
          .eq('league_id', infoLiga.official_league_id) // FILTRO CORRETO
          .gte('date', inicioDiaLocal.toISOString())
          .lte('date', fimDiaLocal.toISOString())
          .order('date', { ascending: true });

        if (matchesErr) throw matchesErr;
        setJogos(matchesData || []);

      } catch (error) {
        console.error("Erro na busca de dados:", error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ligaId, dataSelecionada]);

  const formatarHoraLocal = (dateString) => {
    if (!dateString) return "--:--";
    return new Date(dateString).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', minute: '2-digit', hour12: false 
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0E2A] text-[#0077FF] font-black italic animate-pulse">
      CARREGANDO JOGOS...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 font-sans pb-32">
      <header className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-8">
          <Link to={`/ligas/hockey`} className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black uppercase italic border border-[#26283A] hover:bg-[#0077FF] transition-all">
            ← VOLTAR
          </Link>
          <h1 className="text-xl font-black italic text-[#0077FF] uppercase tracking-tighter text-right">
            iCHUTE <span className="text-white block text-sm">{ligaNome || 'LIGA'}</span>
          </h1>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
          {proximosDias.map((data) => {
            const isSelected = data === dataSelecionada;
            const [, mes, dia] = data.split('-');
            return (
              <button
                key={data}
                onClick={() => setDataSelecionada(data)}
                className={`flex-shrink-0 px-6 py-4 rounded-[20px] font-black text-xs uppercase italic transition-all border ${
                  isSelected 
                    ? 'bg-[#0077FF] border-[#0077FF] text-white shadow-[0_0_20px_rgba(0,119,255,0.5)]' 
                    : 'bg-[#1A1C3A] border-[#26283A] text-gray-400 hover:border-[#0077FF]'
                }`}
              >
                {isSelected ? 'HOJE' : `${dia}/${mes}`}
              </button>
            );
          })}
        </div>
      </header>

      {jogos.length === 0 ? (
        <div className="text-center p-20 border-2 border-dashed border-[#1A1C3A] rounded-[40px] max-w-2xl mx-auto">
          <p className="text-gray-600 font-black uppercase tracking-widest text-[10px] italic">Sem jogos oficiais para este dia</p>
          <span className="text-[9px] text-[#26283A] mt-2 block uppercase">Verifique a tabela matches no Supabase</span>
        </div>
      ) : (
        <div className="grid gap-6 max-w-2xl mx-auto">
          {jogos.map((jogo) => (
            <div key={jogo.id} className="relative bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[35px] shadow-2xl transition-all">
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1 flex flex-col items-center text-center gap-3">
                  <img src={jogo.home?.url_logo} className="w-14 h-14 object-contain" alt="" />
                  <span className="text-[11px] font-black uppercase leading-tight tracking-tight">{jogo.home?.name}</span>
                </div>

                <div className="flex items-center gap-3 bg-[#0A0E2A] p-4 rounded-[25px] border border-[#26283A]">
                  <input type="number" className="w-16 h-16 text-center bg-[#1A1C3A] rounded-2xl font-black text-3xl border-none focus:ring-2 focus:ring-[#0077FF] text-[#0077FF] appearance-none m-0" placeholder="0" />
                  <span className="text-[#26283A] font-black italic text-2xl">X</span>
                  <input type="number" className="w-16 h-16 text-center bg-[#1A1C3A] rounded-2xl font-black text-3xl border-none focus:ring-2 focus:ring-[#0077FF] text-[#0077FF] appearance-none m-0" placeholder="0" />
                </div>

                <div className="flex-1 flex flex-col items-center text-center gap-3">
                  <img src={jogo.away?.url_logo} className="w-14 h-14 object-contain" alt="" />
                  <span className="text-[11px] font-black uppercase leading-tight tracking-tight">{jogo.away?.name}</span>
                </div>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <span className="text-[10px] font-black text-[#26283A] uppercase tracking-[0.3em] italic">{formatarHoraLocal(jogo.date)}</span>
              </div>
            </div>
          ))}
          <button className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-xl bg-[#0077FF] text-white font-black py-6 rounded-[25px] shadow-[0_15px_40px_rgba(0,119,255,0.4)] uppercase italic text-xl z-50 hover:bg-blue-500 transition-all">
            CONFIRMAR PALPITES
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; text-align: center; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}