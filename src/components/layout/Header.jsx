import { useTranslation } from 'react-i18next';
import Logo from './Logo';

export default function Header() {
  const { t } = useTranslation();

  return (
    <div className="w-full bg-[#0A0E2A] border-b border-[#26283A] py-4 px-6 flex items-center justify-between sticky top-0 z-50">
      <Logo size="sm" />
      <div 
        className="w-2 h-2 rounded-full bg-green-400 animate-pulse" 
        title={t('header.statusSynced')} 
      />
    </div>
  );
}