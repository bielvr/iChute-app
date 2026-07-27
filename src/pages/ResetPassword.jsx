import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { updateUserPassword } from '../services/authService';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isValidFlow, setIsValidFlow] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  useEffect(() => {
    const hasToken =
      window.location.hash.includes('access_token=') ||
      window.location.search.includes('type=recovery');

    if (hasToken) {
      setIsValidFlow(true);
    } else {
      setMessage(t('resetPassword.messages.invalidFlow'));
    }
    setCheckingToken(false);
  }, [t]);

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateUserPassword(password);
      setMessage(t('resetPassword.messages.success'));
      setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      setMessage(`${t('auth.messages.errorPrefix')}${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center p-4 text-white font-sans">
        <p className="text-[#0077FF] font-black animate-pulse text-xs uppercase tracking-widest">
          {t('resetPassword.checking')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E2A] flex items-center justify-center p-4 text-white font-sans">
      <div className="w-full max-w-md bg-[#1A1C3A] border border-[#26283A] p-8 rounded-[40px] shadow-2xl">
        
        <div className="flex justify-center mb-6">
          <Logo size="md" showText={true} />
        </div>

        <h2 className="text-xl font-black italic text-[#0077FF] uppercase mb-6 text-center tracking-tight">
          {t('resetPassword.title')}
        </h2>

        {isValidFlow ? (
          <form onSubmit={handleReset} className="space-y-4">
            <input
              type="password"
              placeholder={t('resetPassword.newPasswordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0A0E2A] border border-[#26283A] rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-[#0077FF] text-white"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0077FF] hover:bg-[#0066DD] py-4 rounded-2xl font-black italic uppercase shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 text-white"
            >
              {loading ? t('resetPassword.processing') : t('resetPassword.updateButton')}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <button
              onClick={() => navigate('/')}
              className="w-full bg-[#1A1C3A] border border-[#26283A] py-4 rounded-2xl font-black italic text-xs uppercase tracking-wider text-gray-400 hover:text-white hover:bg-[#0077FF] transition-all"
            >
              {t('resetPassword.backToLogin')}
            </button>
          </div>
        )}

        {message && (
          <p
            className={`mt-6 text-center text-[10px] font-black uppercase italic tracking-wide ${
              isValidFlow && !message.includes(t('auth.messages.errorPrefix'))
                ? 'text-green-400'
                : 'text-[#0077FF]'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}