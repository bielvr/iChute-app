import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import {
  getCurrentAuthUser,
  getUserSettingsDetails,
  saveEmailSubscription,
  savePushSubscription,
  updateUserProfile,
} from '../services/authService';

const VAPID_PUBLIC_KEY =
  'BBE0tYKOFBP49coEAMDUdrq6KYWU8mQZmdim8h42deKpgfTlaeZUHitlJ9KTcIFjMwR_xMSLcjAVdGBtvPr4wMo';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function UserSettings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Dados do Perfil
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState(i18n.language || 'pt');

  // Push
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [leadTime, setLeadTime] = useState(15);

  // E-mail
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [emailLeadTime, setEmailLeadTime] = useState(60);

  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadUserData() {
      try {
        const authUser = await getCurrentAuthUser();
        if (!authUser) return;

        const { userData, pushLeadTime, emailSub } = await getUserSettingsDetails(authUser.email);

        if (userData) {
          setUser(userData);
          setName(userData.name || '');
          setEmail(userData.email || '');

          if (userData.locale) {
            setLanguage(userData.locale);
            i18n.changeLanguage(userData.locale);
          }

          setLeadTime(pushLeadTime);
          setEmailNotificationsEnabled(emailSub.enabled);
          setEmailLeadTime(emailSub.lead_time_minutes);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }

    loadUserData();
  }, [i18n]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    setProfileLoading(true);
    setMessage('');

    try {
      await updateUserProfile(user.id, { name, email, locale: language });
      i18n.changeLanguage(language);
      setMessage(t('userSettings.messages.profileUpdated'));
    } catch (err) {
      console.error(err);
      setMessage(`${t('userSettings.messages.errorPrefix')}${err.message}`);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleLanguageChange = (e) => {
    const selectedLang = e.target.value;
    setLanguage(selectedLang);
    i18n.changeLanguage(selectedLang);
  };

  const handleSaveNotificationSettings = async (selectedTime = leadTime) => {
    if (!user?.id) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMessage(t('userSettings.messages.pushNotSupported'));
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(t('userSettings.messages.pushDenied'));
        setNotificationsEnabled(false);
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = subscription.toJSON();

      await savePushSubscription(user.id, {
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        leadTime: selectedTime,
      });

      setNotificationsEnabled(true);
      setMessage(t('userSettings.messages.pushSaved'));
    } catch (err) {
      console.error(err);
      setMessage(`${t('userSettings.messages.errorPrefix')}${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmailNotifications = async (newEnabled, newTime = emailLeadTime) => {
    if (!user?.id) return;
    setLoading(true);

    try {
      await saveEmailSubscription(user.id, {
        email: email || user.email,
        enabled: newEnabled,
        leadTime: newTime,
      });

      setEmailNotificationsEnabled(newEnabled);
      setEmailLeadTime(newTime);
      setMessage(t('userSettings.messages.emailSaved'));
    } catch (err) {
      console.error(err);
      setMessage(`${t('userSettings.messages.errorPrefix')}${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white font-sans pb-12">
      <header className="border-b border-[#26283A] bg-[#1A1C3A] py-4 px-6 flex items-center relative sticky top-0 z-10 min-h-[64px]">
        <button
          onClick={() => navigate('/home')}
          className="text-xs font-black uppercase italic text-gray-400 hover:text-white transition-colors z-20 absolute left-6"
        >
          ← {t('common.back')}
        </button>
        <div className="mx-auto flex justify-center items-center z-10 w-full">
          <Logo size="sm" showText={true} />
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        <h2 className="text-2xl font-black italic uppercase tracking-tight text-[#0077FF]">
          {t('userSettings.title')}
        </h2>

        {/* PERFIL DO USUÁRIO & IDIOMA */}
        <section className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[32px] shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-lg">👤</span>
            <h3 className="font-black italic text-sm uppercase tracking-wider text-white">
              {t('userSettings.profileTitle')}
            </h3>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                {t('userSettings.nameLabel')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0A0E2A] border border-[#26283A] px-4 py-2.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#0077FF]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                {t('userSettings.emailLabel')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0A0E2A] border border-[#26283A] px-4 py-2.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#0077FF]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                🌐 {t('userSettings.languageLabel')}
              </label>
              <select
                value={language}
                onChange={handleLanguageChange}
                className="w-full bg-[#0A0E2A] border border-[#26283A] px-4 py-2.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#0077FF] cursor-pointer"
              >
                <option value="pt">Português (Brasil)</option>
                <option value="en">English</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="w-full bg-[#0077FF] hover:bg-[#0066DD] text-white py-2.5 rounded-xl font-black italic text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all mt-2 disabled:opacity-50"
            >
              {profileLoading ? '...' : t('userSettings.saveProfile')}
            </button>
          </form>
        </section>

        {/* NOTIFICAÇÕES PUSH */}
        <section className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[32px] shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-lg">🔔</span>
            <div>
              <h3 className="font-black italic text-sm uppercase tracking-wider text-white">
                {t('userSettings.pushTitle')}
              </h3>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {t('userSettings.pushDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#0A0E2A] p-4 rounded-2xl border border-[#26283A]">
            <span className="text-xs font-bold text-gray-300">{t('userSettings.status')}</span>
            <button
              onClick={() => handleSaveNotificationSettings()}
              disabled={loading}
              className={`px-4 py-2 rounded-xl font-black italic text-xs uppercase tracking-wider transition-all ${
                notificationsEnabled
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-[#0077FF] hover:bg-[#0066DD] text-white shadow-lg active:scale-95'
              }`}
            >
              {loading
                ? '...'
                : notificationsEnabled
                ? `${t('userSettings.active')} ✓`
                : t('userSettings.enable')}
            </button>
          </div>

          <div className="flex items-center justify-between bg-[#0A0E2A] p-4 rounded-2xl border border-[#26283A]">
            <span className="text-xs font-bold text-gray-300">{t('userSettings.leadTime')}</span>
            <select
              value={leadTime}
              onChange={(e) => {
                const newTime = parseInt(e.target.value, 10);
                setLeadTime(newTime);
                if (notificationsEnabled) handleSaveNotificationSettings(newTime);
              }}
              className="text-xs bg-[#1A1C3A] border border-[#26283A] px-3 py-2 rounded-xl font-bold text-gray-300 outline-none cursor-pointer focus:border-[#0077FF]"
            >
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1h</option>
              <option value={120}>2h</option>
              <option value={720}>12h</option>
            </select>
          </div>
        </section>

        {/* NOTIFICAÇÕES POR E-MAIL */}
        <section className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[32px] shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-lg">✉️</span>
            <div>
              <h3 className="font-black italic text-sm uppercase tracking-wider text-white">
                {t('userSettings.emailTitle')}
              </h3>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {t('userSettings.emailDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#0A0E2A] p-4 rounded-2xl border border-[#26283A]">
            <span className="text-xs font-bold text-gray-300">{t('userSettings.status')}</span>
            <button
              onClick={() => handleToggleEmailNotifications(!emailNotificationsEnabled)}
              disabled={loading}
              className={`px-4 py-2 rounded-xl font-black italic text-xs uppercase tracking-wider transition-all ${
                emailNotificationsEnabled
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-[#0077FF] hover:bg-[#0066DD] text-white shadow-lg active:scale-95'
              }`}
            >
              {loading
                ? '...'
                : emailNotificationsEnabled
                ? `${t('userSettings.active')} ✓`
                : t('userSettings.enable')}
            </button>
          </div>

          <div className="flex items-center justify-between bg-[#0A0E2A] p-4 rounded-2xl border border-[#26283A]">
            <span className="text-xs font-bold text-gray-300">{t('userSettings.leadTime')}</span>
            <select
              value={emailLeadTime}
              onChange={(e) =>
                handleToggleEmailNotifications(emailNotificationsEnabled, e.target.value)
              }
              className="text-xs bg-[#1A1C3A] border border-[#26283A] px-3 py-2 rounded-xl font-bold text-gray-300 outline-none cursor-pointer focus:border-[#0077FF]"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1h</option>
              <option value={120}>2h</option>
              <option value={1440}>24h</option>
            </select>
          </div>
        </section>

        {/* FOOTER SOBRE */}
        <section className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[32px] shadow-xl text-center">
          <h4 className="font-black italic text-xs uppercase tracking-widest text-[#80B2FF] mb-1">
            iChute Engine v3.0
          </h4>
          <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
            {t('userSettings.footer.tagline')}
          </p>
          <p className="text-[10px] font-bold text-gray-500 mb-4 tracking-wide">
            {t('userSettings.footer.developedBy')}{' '}
            <span className="text-[#0077FF] font-black italic">Gabriel Vieira da Rocha</span>
          </p>
          <div className="text-[9px] font-mono text-gray-600 uppercase tracking-widest border-t border-[#26283A]/60 pt-3">
            {t('userSettings.footer.copyright')}
          </div>
        </section>

        {message && (
          <p className="text-center text-[10px] font-black uppercase italic tracking-wider p-3 rounded-xl bg-[#1A1C3A] border border-[#26283A] text-[#80B2FF]">
            {message}
          </p>
        )}
      </main>
    </div>
  );
}