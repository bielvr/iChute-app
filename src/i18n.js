import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Arquivos de tradução (pode criar separadamente em pastas src/locales/)
import translationPT from './locales/pt.json';
import translationEN from './locales/en.json';

const resources = {
  pt: { translation: translationPT },
  en: { translation: translationEN },
};

i18n
  .use(LanguageDetector) // Detecta o idioma do navegador do usuário
  .use(initReactI18next) // Integração com React
  .init({
    resources,
    fallbackLng: 'pt', // Idioma padrão caso o detectado não exista
    interpolation: {
      escapeValue: false, // React já faz escape contra XSS
    },
  });

export default i18n;