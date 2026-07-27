import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { getCurrentAuthUser } from '../services/authService';
import {
  createPrivateLeague,
  getLigasPageData,
  joinLeagueByCode,
} from '../services/leagueService';

export default function Ligas() {
  const { t } = useTranslation();
  const { sportId } = useParams();

  const [ligasAtivas, setLigasAtivas] = useState([]);
  const [ligasReaisDisponiveis, setLigasReaisDisponiveis] = useState([]);
  const [nomeEsporte, setNomeEsporte] = useState('MODALIDADE');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [newLeagueName, setNewLeagueName] = useState('');
  const [selectedOfficialLeague, setSelectedOfficialLeague] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [points, setPoints] = useState({ exact: 3, winnerOne: 2, winnerOnly: 1 });

  const [showHelpModal, setShowHelpModal] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const user = await getCurrentAuthUser();
      if (!user) return;

      const { sportName, ligasAtivas, ligasReaisDisponiveis } = await getLigasPageData(
        user.id,
        sportId
      );

      setNomeEsporte(sportName ? sportName.toUpperCase() : 'MODALIDADE');
      setLigasAtivas(ligasAtivas);
      setLigasReaisDisponiveis(ligasReaisDisponiveis);
    } catch (err) {
      console.error('Erro ao carregar dados das ligas:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [sportId]);

  const handleJoinLeague = async () => {
    if (!inviteCodeInput) return alert(t('ligas.alerts.fillCode'));
    setProcessing(true);
    try {
      const user = await getCurrentAuthUser();
      await joinLeagueByCode(user.id, inviteCodeInput);
      setInviteCodeInput('');
      fetchData();
    } catch (err) {
      const msg =
        err.message === 'leagueNotFound'
          ? t('ligas.alerts.leagueNotFound')
          : err.message;
      alert(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateLeague = async () => {
    if (!newLeagueName || !selectedOfficialLeague)
      return alert(t('ligas.alerts.fillAll'));
    setProcessing(true);
    try {
      const user = await getCurrentAuthUser();
      await createPrivateLeague(user.id, {
        name: newLeagueName,
        officialLeagueId: selectedOfficialLeague,
        points,
      });

      setNewLeagueName('');
      setSelectedOfficialLeague('');
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
        <Link
          to="/home"
          className="bg-[#1A1C3A] px-4 py-2 rounded-xl text-[10px] font-black italic border border-[#26283A] hover:text-[#0077FF] transition-colors"
        >
          ← {t('common.back')}
        </Link>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          {t('ligas.title')} <span className="text-[#0077FF]">{nomeEsporte}</span>
        </h1>
      </header>

      {/* SEÇÃO: LIGAS ATIVAS */}
      <div className="grid gap-4 max-w-lg mx-auto mb-12">
        <h2 className="text-xs font-black italic uppercase opacity-40 ml-2 tracking-wider">
          {t('ligas.activeLeagues')}
        </h2>
        {loading ? (
          <p className="text-xs opacity-30 font-bold uppercase ml-2 tracking-wide">
            {t('ligas.loading')}
          </p>
        ) : ligasAtivas.length === 0 ? (
          <p className="text-xs opacity-30 font-bold uppercase ml-2 tracking-wide">
            {t('ligas.empty')}
          </p>
        ) : (
          ligasAtivas.map((liga) => (
            <div
              key={liga.id}
              className="bg-[#1A1C3A] border border-[#26283A] p-5 rounded-[30px] flex justify-between items-center group shadow-lg"
            >
              <div>
                <span className="block font-black italic uppercase group-hover:text-[#0077FF] transition-all">
                  {liga.name}
                </span>
                <span className="text-[9px] font-bold opacity-40 uppercase">
                  {t('ligas.code')} <span className="text-[#0077FF]">{liga.id}</span>
                </span>
              </div>
              <Link
                to={`/predictions/${liga.id}`}
                className="bg-[#0A0E2A] p-3 rounded-full border border-[#26283A] hover:scale-110 transition-transform"
              >
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
            placeholder={t('ligas.enterCode')}
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
            className="w-24 bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-[#0077FF] transition-colors"
          />
          <button
            onClick={handleJoinLeague}
            disabled={processing}
            className="flex-1 bg-transparent border-2 border-[#26283A] py-4 rounded-2xl font-black italic uppercase text-xs hover:border-[#0077FF] transition-all disabled:opacity-50"
          >
            {t('ligas.joinButton')}
          </button>
        </div>

        {/* FORMULÁRIO: CRIAR NOVA LIGA PRIVADA */}
        <section className="bg-[#1A1C3A] p-8 rounded-[40px] border border-[#26283A] shadow-2xl">
          <h2 className="text-center font-black italic uppercase text-[#0077FF] mb-6 tracking-wide">
            {t('ligas.createNew')}
          </h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder={t('ligas.leagueNamePlaceholder')}
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
                <option value="">{t('ligas.selectOfficialLeague')}</option>
                {ligasReaisDisponiveis.map((r) => (
                  <option key={r.id} value={r.id} className="text-white">
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* SELEÇÃO E BOTÃO DE AJUDA DAS REGRAS */}
            <div className="flex justify-between items-center pt-4">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">
                {t('ligas.scoringRules')}
              </span>
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
                { label: t('ligas.exactScore'), key: 'exact' },
                { label: t('ligas.winnerPlusOne'), key: 'winnerOne' },
                { label: t('ligas.winnerOnly'), key: 'winnerOnly' },
              ].map((item) => (
                <div key={item.key} className="text-center">
                  <p className="text-[7px] font-black uppercase mb-2 opacity-50 tracking-wider">
                    {item.label}
                  </p>
                  <input
                    type="number"
                    value={points[item.key]}
                    onChange={(e) => setPoints({ ...points, [item.key]: e.target.value })}
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
              {processing ? t('ligas.creating') : t('ligas.createButton')}
            </button>
          </div>
        </section>
      </div>

      {/* MODAL DE AJUDA FLUTUANTE */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-[#0A0E2A]/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[35px] max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="font-black italic text-base uppercase text-[#0077FF] mb-4 tracking-tight">
              {t('ligas.helpModal.title')}
            </h3>

            <div className="space-y-4 text-xs font-medium text-gray-300">
              <div>
                <h4 className="font-black text-white uppercase text-[10px] tracking-wide mb-1 text-[#55DD55]">
                  {t('ligas.helpModal.exactTitle')}
                </h4>
                <p>{t('ligas.helpModal.exactDesc')}</p>
              </div>

              <div>
                <h4 className="font-black text-white uppercase text-[10px] tracking-wide mb-1 text-cyan-400">
                  {t('ligas.helpModal.winnerOneTitle')}
                </h4>
                <p>{t('ligas.helpModal.winnerOneDesc')}</p>
              </div>

              <div>
                <h4 className="font-black text-white uppercase text-[10px] tracking-wide mb-1 text-amber-400">
                  {t('ligas.helpModal.winnerOnlyTitle')}
                </h4>
                <p>{t('ligas.helpModal.winnerOnlyDesc')}</p>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full mt-6 bg-[#0A0E2A] border border-[#26283A] py-3 rounded-xl font-black uppercase text-xs text-gray-400 hover:text-white hover:border-[#0077FF] transition-all"
            >
              {t('ligas.helpModal.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}