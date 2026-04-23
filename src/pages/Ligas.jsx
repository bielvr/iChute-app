import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Ligas() {
  const { esporteId } = useParams();
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMinhasLigas() {
      setLoading(true);
      try {
        // 1. Pegamos o usuário de forma robusta
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        // LOG DE DEBUG PARA VOCÊ VER NO CONSOLE (F12)
        console.log("ID do Esporte na URL:", esporteId);
        console.log("Usuário logado:", user?.id);

        if (userError || !user) {
          console.error("Erro ao identificar usuário. Certifique-se de estar logado.");
          setLoading(false);
          return;
        }

        // 2. Busca direta simplificada para evitar problemas de Join complexo
        // Pegamos as participações do usuário logado
        const { data: membros, error: errMembros } = await supabase
          .from('user_league_members')
          .select('user_league_id')
          .eq('user_id', user.id);

        if (errMembros) throw errMembros;

        if (!membros || membros.length === 0) {
          console.warn("Usuário não é membro de nenhuma liga no banco.");
          setLigas([]);
          return;
        }

        const idsLigas = mambros.map(m => m.user_league_id);

        // 3. Busca os detalhes das ligas e o esporte correspondente
        // Usamos !official_league_id porque é o nome exato da sua FK no banco
        const { data: ligasNoBanco, error: errLigas } = await supabase
          .from('user_leagues')
          .select(`
            id,
            name,
            leagues!official_league_id (
              sport_id
            )
          `)
          .in('id', idsLigas);

        if (errLigas) throw errLigas;

        // 4. Filtragem manual ultra-segura
        const filtradas = ligasNoBanco.filter(item => {
          const sportIdDoBanco = item.leagues?.sport_id;
          // Compara como string para não ter erro de 2 ser diferente de "2"
          return String(sportIdDoBanco) === String(esporteId);
        });

        console.log("Ligas após filtro de esporte:", filtradas);
        setLigas(filtradas);

      } catch (err) {
        console.error("ERRO CRÍTICO:", err.message);
      } finally {
        setLoading(false);
      }
    }

    if (esporteId) fetchMinhasLigas();
  }, [esporteId]);

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-6">
      <header className="mb-10 flex items-center gap-4">
        <Link to="/" className="bg-[#1A1C3A] p-3 rounded-xl text-[10px] font-black italic uppercase">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-black italic uppercase italic">
          Minhas Ligas <span className="text-[#0077FF]">{esporteId === '2' ? 'HOCKEY' : 'FUTEBOL'}</span>
        </h1>
      </header>

      <div className="grid gap-4 max-w-md mx-auto">
        {loading ? (
          <div className="text-center font-black italic opacity-40 animate-pulse">CARREGANDO...</div>
        ) : ligas.length > 0 ? (
          ligas.map((liga) => (
            <Link 
              key={liga.id}
              to={`/palpites/${liga.id}`}
              className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[25px] flex justify-between items-center hover:border-[#0077FF] transition-all"
            >
              <span className="font-black italic uppercase">{liga.name}</span>
              <span className="text-[#0077FF] font-bold">→</span>
            </Link>
          ))
        ) : (
          <div className="text-center p-10 border-2 border-dashed border-[#1A1C3A] rounded-[30px] opacity-60">
            <p className="font-black italic uppercase text-sm">Nenhuma liga encontrada</p>
            <p className="text-[10px] mt-2">VERIFIQUE O RLS NO SUPABASE OU SE O USER_ID É 2</p>
          </div>
        )}
      </div>
    </div>
  );
}