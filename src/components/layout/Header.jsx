import Logo from './Logo';

export default function Header() {
  return (
    <div className="w-full bg-[#0A0E2A] border-b border-[#26283A] py-4 px-6 flex items-center justify-between sticky top-0 z-50">
      <Logo size="sm" />
      {/* Aqui você pode colocar um botão de perfil ou o nome do usuário no futuro */}
      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Sincronizado com Supabase" />
    </div>
  );
}