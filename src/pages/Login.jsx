import { useState } from 'react';
import { Trans, useTranslation as useI18n } from 'react-i18next';
import Logo from '../components/Logo';
import { resetPassword, signInWithPassword, signUp } from '../services/authService';

export default function Login() {
  const { t } = useI18n();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        await signUp({ email, password, fullName });
        setMessage(t('auth.messages.signUpSuccess'));
      } else {
        await signInWithPassword({ email, password });
      }
    } catch (error) {
      setMessage(`${t('auth.messages.errorPrefix')}${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage(t('auth.messages.emailRequired'));
      return;
    }
    setLoading(true);
    setMessage('');

    try {
      await resetPassword(email);
      setMessage(t('auth.messages.resetSuccess'));
    } catch (error) {
      setMessage(`${t('auth.messages.errorPrefix')}${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center p-4 md:p-8 font-sans text-white">
      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8 items-center justify-between">
        
        {/* LANDING / APRESENTAÇÃO */}
        <div className="w-full md:w-1/2 flex flex-col space-y-6 text-center md:text-left px-4">
          <div className="hidden md:flex justify-start transform scale-125 origin-left mb-4">
            <Logo size="lg" showText={true} />
          </div>

          <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tight leading-none">
            <Trans
              i18nKey="auth.tagline"
              defaults="A emoção de acertar o placar, <1>apenas pela diversão.</1>"
              components={{ 1: <span className="text-[#0077FF]" /> }}
            />
          </h1>

          <p className="text-gray-400 text-sm md:text-base max-w-md">
            {t('auth.description')}
          </p>

          {/* LISTA DE BENEFÍCIOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
            <BenefitCard
              title={t('auth.benefits.competitionTitle')}
              description={t('auth.benefits.competitionDesc')}
            />
            <BenefitCard
              title={t('auth.benefits.rankingTitle')}
              description={t('auth.benefits.rankingDesc')}
            />
          </div>

          {/* GALERIA DE PRINTS */}
          <div className="pt-4 text-left">
            <span className="text-xs font-black uppercase italic text-gray-500 tracking-widest block mb-3">
              {t('auth.gallery.title')}
            </span>

            <div className="flex overflow-x-auto pb-4 pt-1 md:pb-0 gap-3 md:grid md:grid-cols-2 max-h-[480px] md:overflow-y-auto pr-1 custom-scrollbar snap-x">
              <GalleryCard title={t('auth.gallery.rankings')} src="/Ranking.jpeg" alt="Ranking" />
              <GalleryCard title={t('auth.gallery.calendar')} src="/Palpites - calendário.jpeg" alt="Calendário" />
              <GalleryCard title={t('auth.gallery.friends')} src="/Resultados.jpeg" alt="Resultados" />
              <GalleryCard title={t('auth.gallery.sports')} src="/Home.jpeg" alt="Modalidades" />
            </div>
          </div>
        </div>

        {/* FORMULÁRIO DE LOGIN / CADASTRO */}
        <div className="w-full max-w-md bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[40px] shadow-2xl">
          <div className="flex justify-center mb-8 md:hidden">
            <Logo size="lg" showText={true} />
          </div>

          {/* TAB SWITCHER */}
          <div className="flex bg-[#0A0E2A] rounded-2xl p-1 mb-8 border border-[#26283A]">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 rounded-xl font-black italic text-xs uppercase transition-all ${
                !isSignUp ? 'bg-[#0077FF]' : 'text-gray-500'
              }`}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 rounded-xl font-black italic text-xs uppercase transition-all ${
                isSignUp ? 'bg-[#0077FF]' : 'text-gray-500'
              }`}
            >
              {t('auth.signUp')}
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <input
                type="text"
                placeholder={t('auth.fullName')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF] text-white"
                required
              />
            )}

            <input
              type="email"
              placeholder={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF] text-white"
              required
            />
            <input
              type="password"
              placeholder={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF] text-white"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0077FF] hover:bg-[#0066DD] py-4 rounded-2xl font-black italic text-lg uppercase shadow-lg disabled:opacity-50 text-white transition-all"
            >
              {loading ? t('auth.processing') : isSignUp ? t('auth.createAccount') : t('auth.login')}
            </button>
          </form>

          {!isSignUp && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full mt-4 text-[10px] font-black uppercase italic text-gray-500 hover:text-[#0077FF] transition-all"
            >
              {t('auth.forgotPassword')}
            </button>
          )}

          {message && (
            <p className="mt-4 text-center text-[10px] font-black uppercase italic text-[#0077FF]">
              {message}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

function BenefitCard({ title, description }) {
  return (
    <div className="bg-[#1A1C3A] border border-[#26283A] p-4 rounded-2xl">
      <h3 className="font-bold text-[#0077FF] uppercase italic text-xs mb-1">{title}</h3>
      <p className="text-gray-400 text-xs">{description}</p>
    </div>
  );
}

function GalleryCard({ title, src, alt }) {
  return (
    <div className="flex-shrink-0 w-[200px] md:w-auto bg-[#1A1C3A] border border-[#26283A] rounded-xl p-2 flex flex-col group shadow-lg snap-start">
      <p className="text-[10px] font-bold text-gray-400 uppercase italic mb-2 px-1">{title}</p>
      <div className="bg-[#0A0E2A] rounded-lg p-1 flex items-center justify-center h-64 md:h-72 overflow-hidden">
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"
        />
      </div>
    </div>
  );
}