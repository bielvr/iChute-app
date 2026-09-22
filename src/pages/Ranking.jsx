import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BottomNav from '../components/layout/BottomNav';
import Logo from '../components/Logo';
import { getCurrentUser } from '../services/authService';
import { getUserLeagueDetails } from '../services/leagueService';
import { getGlobalRanking, getLeagueRanking, getAvailableSeasons } from '../services/rankingService';

export default function Ranking() {
  const { ligaId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [league, setLeague] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [leagueRanking, setLeagueRanking] = useState([]);
  const [globalRanking, setGlobalRanking] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [tab, setTab] = useState('league');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  // 1. Inicializa metadados, usuário e lista de temporadas
  useEffect(() => {
    if (!ligaId) return;
    const init = async () => {
      setLoading(true);
      setError(false);
      try {
        const [user, userLeague] = await Promise.all([
          getCurrentUser(),
          getUserLeagueDetails(ligaId),
        ]);
        setLeague(userLeague);
        setCurrentUserId(user?.id ?? null);

        const available = await getAvailableSeasons(userLeague.officialLeagueId);
        setSeasons(available);
        if (available.length > 0) {
          setSelectedSeason(available[0]); // Seleciona a mais recente
        }
      } catch (err) {
        console.error('Erro ao carregar dados do ranking:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [ligaId]);

  // 2. Busca pontuações sempre que a liga ou a temporada selecionada mudar
  useEffect(() => {
    if (!league) return;
    const loadRankings = async () => {
      try {
        const [leagueData, globalData] = await Promise.all([
          getLeagueRanking(league.id, selectedSeason),
          getGlobalRanking(league.officialLeagueId, selectedSeason),
        ]);
        setLeagueRanking(leagueData);
        setGlobalRanking(globalData);
      } catch (err) {
        console.error('Erro ao carregar rankings por temporada:', err);
      }
    };
    loadRankings();
  }, [selectedSeason, league]);

  const data = tab === 'league' ? leagueRanking : globalRanking;

  // Formata o texto simples para compartilhamento com medalhas e números
  const handleShare = async () => {
    if (!data.length || !league) return;

    const competitionName = league.officialLeagueName || 'Competição';
    const leagueName = league.name || 'Liga';
    const seasonLabel = selectedSeason ? ` (${selectedSeason})` : '';

    const lines = [
      `🏆 Classificação - ${competitionName}${seasonLabel}`,
      `👥 Liga: ${leagueName}`,
      '',
    ];

    data.forEach((user, index) => {
      let positionPrefix = '';
      if (index === 0) positionPrefix = '🥇';
      else if (index === 1) positionPrefix = '🥈';
      else if (index === 2) positionPrefix = '🥉';
      else positionPrefix = `${index + 1}.`;

      const score = tab === 'league' ? user.total_points : user.exact;
      const unit = tab === 'league' ? 'pts' : 'cravadas';
      lines.push(`${positionPrefix} ${user.user_name} - ${score} ${unit}`);
    });

    const shareText = lines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ranking - ${leagueName}`,
          text: shareText,
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Erro ao copiar para clipboard:', err);
    }
  };

  if (loading) return <Loading label={t('ranking.loading')} />;
  if (error || !league) return <ErrorState label={t('ranking.messages.loadError')} />;

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white p-4 pb-40 font-sans">
      <header className="max-w-2xl mx-auto flex justify-between items-center mb-6">
        <button
          onClick={() => navigate(league.sportId ? `/leagues/${league.sportId}` : '/home')}
          className="bg-[#1A1C3A] text-white px-5 py-2 rounded-2xl text-[10px] font-black border border-[#26283A]"
        >
          ← {t('common.back')}
        </button>
        <div className="text-right">
          <Link to="/" className="block">
            <Logo size="sm" />
          </Link>
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest italic">
            {t('ranking.title')}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2 mb-4 bg-[#1A1C3A] p-1.5 rounded-2xl border border-[#26283A]">
        <TabButton active={tab === 'league'} onClick={() => setTab('league')}>
          {t('ranking.tabs.league')}
        </TabButton>
        <TabButton active={tab === 'global'} onClick={() => setTab('global')}>
          {t('ranking.tabs.global')}
        </TabButton>
      </div>

      {/* Dropdown de Temporada e Botão Compartilhar */}
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 mb-6">
        {seasons.length > 0 ? (
          <div className="flex items-center gap-2 bg-[#1A1C3A] border border-[#26283A] px-3.5 py-2 rounded-2xl">
            <span className="text-[10px] font-black uppercase text-gray-400">Temporada:</span>
            <select
              value={selectedSeason || ''}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="bg-transparent text-xs font-black text-[#0077FF] outline-none cursor-pointer"
            >
              {seasons.map((s) => (
                <option key={s} value={s} className="bg-[#1A1C3A] text-white">
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : <div />}

        <button
          onClick={handleShare}
          className="flex items-center gap-2 bg-[#1A1C3A] hover:bg-[#26283A] text-white px-4 py-2 rounded-2xl border border-[#26283A] text-xs font-black transition-all"
        >
          <span>{copied ? '✓ Copiado!' : '↗ Compartilhar'}</span>
        </button>
      </div>

      <main className="max-w-2xl mx-auto grid gap-4">
        {tab === 'global' && (
          <p className="bg-[#1A1C3A]/40 border border-dashed border-[#26283A] p-4 rounded-2xl text-center text-[10px] font-bold text-gray-400 uppercase">
            {t('ranking.globalDescription')}
          </p>
        )}

        {data.length === 0 ? (
          <p className="text-center py-10 opacity-30 font-black uppercase italic">
            {t('ranking.empty')}
          </p>
        ) : (
          data.map((user, index) => (
            <RankingCard
              key={user.user_id}
              user={user}
              position={index + 1}
              isCurrentUser={String(user.user_id) === String(currentUserId)}
              global={tab === 'global'}
              t={t}
            />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3 rounded-xl font-black text-xs uppercase tracking-tight transition-all ${
        active ? 'bg-[#0077FF] text-white' : 'text-gray-400'
      }`}
    >
      {children}
    </button>
  );
}

function RankingCard({ user, position, isCurrentUser, global, t }) {
  const score = global ? user.exact : user.total_points;
  const outcome = global ? user.outcome : user.vencedor_only;
  const goals = global ? user.goals : user.vencedor_bonus;
  const matches = global ? user.total_matches : user.total_jogos;

  return (
    <div
      className={`relative overflow-hidden p-5 rounded-[30px] border ${
        isCurrentUser
          ? 'bg-[#0077FF] border-white shadow-[0_0_25px_rgba(0,119,255,0.3)] scale-[1.02]'
          : 'bg-[#1A1C3A] border-[#26283A]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <span className={`font-black italic text-xl ${isCurrentUser ? 'text-white' : 'text-[#0077FF]'} opacity-50`}>
            {position}º
          </span>
          <div>
            <span className="font-black uppercase text-sm italic text-white">{user.user_name}</span>
            {isCurrentUser && (
              <span className="block text-[7px] font-black uppercase text-white/70">{t('ranking.you')}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="block font-black text-2xl italic text-white">{score}</span>
          <span className="text-[8px] font-black uppercase text-white/80">
            {global ? t('ranking.metrics.exact') : t('ranking.metrics.points')}
          </span>
        </div>
      </div>
      <div
        className={`grid grid-cols-4 gap-2 pt-3 border-t ${
          isCurrentUser ? 'border-white/20' : 'border-white/5'
        } text-center`}
      >
        <Metric value={user.cravadas ?? user.exact} label={t('ranking.metrics.exact')} />
        <Metric value={outcome} label={t('ranking.metrics.outcome')} />
        <Metric value={goals} label={t('ranking.metrics.goals')} />
        <Metric value={matches} label={t('ranking.metrics.predictions')} />
      </div>
    </div>
  );
}

function Metric({ value, label }) {
  return (
    <div>
      <span className="block font-black text-xs italic text-white">{value}</span>
      <span className="block text-[7px] font-black uppercase tracking-tight text-gray-500">{label}</span>
    </div>
  );
}

function Loading({ label }) {
  return (
    <div className="min-h-screen bg-[#0A0E2A] text-[#0077FF] flex items-center justify-center font-black animate-pulse">
      {label}
    </div>
  );
}

function ErrorState({ label }) {
  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white flex items-center justify-center">
      {label}
    </div>
  );
}