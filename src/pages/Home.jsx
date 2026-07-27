import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import { signOut } from '../services/authService';
import { getVisibleSports } from '../services/sportService';
import { getSportMetadata } from '../config/sports';

export default function Home() {
  const navigate = useNavigate(); const { t } = useTranslation();
  const [sports, setSports] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  useEffect(() => { const load = async () => { try { setSports(await getVisibleSports()); } catch (loadError) { console.error('Unable to load sports', loadError); setError(true); } finally { setLoading(false); } }; load(); }, []);
  const logout = async () => { try { await signOut(); navigate('/'); } catch (logoutError) { console.error('Unable to sign out', logoutError); } };
  return <div className="min-h-screen bg-[#0A0E2A] text-white p-6 font-sans flex flex-col items-center justify-center relative"><button type="button" onClick={() => navigate('/settings')} aria-label={t('home.settings')} className="absolute top-6 left-6 bg-[#1A1C3A] text-gray-400 p-2.5 rounded-xl text-xs font-black border border-[#26283A] hover:text-white">⚙️</button><button type="button" onClick={logout} className="absolute top-6 right-6 bg-[#1A1C3A] text-gray-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase italic border border-[#26283A] hover:text-white">{t('home.logout')}</button><header className="flex flex-col items-center text-center mb-12 select-none"><div className="flex items-center gap-3"><Logo size="md" showText={false} /><h1 className="text-4xl font-black italic uppercase tracking-tighter">iChute</h1></div><p className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em] mt-3 italic">{t('home.chooseSport')}</p></header><main className="grid gap-6 w-full max-w-md">{loading ? <State label={t('home.loading')} /> : error ? <State label={t('home.loadError')} /> : sports.length === 0 ? <State label={t('home.empty')} /> : sports.map((sport) => <SportCard key={sport.id} sport={sport} onClick={() => navigate(`/leagues/${sport.id}`)} t={t} />)}</main><footer className="mt-20 opacity-20"><span className="font-black italic uppercase text-[10px] tracking-[0.5em]">iChute Engine v3.0</span></footer></div>;
}
function SportCard({ sport, onClick, t }) { const metadata = getSportMetadata(sport); const label = metadata.translationKey ? t(`sports.${metadata.translationKey}`, { defaultValue: sport.name }) : sport.name; return <button type="button" onClick={onClick} className="group relative bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[30px] flex items-center justify-between overflow-hidden transition-all hover:border-[#0077FF] hover:shadow-[0_0_30px_rgba(0,119,255,0.2)] active:scale-95"><h2 className="relative z-10 text-2xl font-black italic uppercase tracking-tight group-hover:text-[#0077FF]">{label}</h2><span className="text-4xl grayscale group-hover:grayscale-0 transition-all">{metadata.icon}</span><div className="absolute inset-0 bg-gradient-to-r from-[#0077FF] to-transparent opacity-0 group-hover:opacity-5" /></button>; }
function State({ label }) { return <p className="text-center text-xs opacity-40 font-bold uppercase tracking-wider">{label}</p>; }
