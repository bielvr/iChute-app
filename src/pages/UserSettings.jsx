import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";

const VAPID_PUBLIC_KEY = "BBE0tYKOFBP49coEAMDUdrq6KYWU8mQZmdim8h42deKpgfTlaeZUHitlJ9KTcIFjMwR_xMSLcjAVdGBtvPr4wMo";

export default function UserSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [leadTime, setLeadTime] = useState(15);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function loadUserData() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("email", authUser.email)
          .single();
          
        setUser(userData);

        if (userData) {
          const { data: subData } = await supabase
            .from("user_push_subscriptions")
            .select("lead_time_minutes")
            .eq("user_id", userData.id)
            .limit(1)
            .maybeSingle();

          if (subData) {
            setLeadTime(subData.lead_time_minutes);
          }
        }
      }

      if ("Notification" in window && Notification.permission === "granted") {
        setNotificationsEnabled(true);
      }
    }
    loadUserData();
  }, []);

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const handleSaveNotificationSettings = async (selectedTime = leadTime) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("Seu dispositivo não suporta notificações Push.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Permissão de notificação negada pelo navegador.");
        setNotificationsEnabled(false);
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const subJson = subscription.toJSON();

      const { error } = await supabase
        .from("user_push_subscriptions")
        .upsert({
          user_id: user?.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          lead_time_minutes: parseInt(selectedTime)
        }, { onConflict: "user_id, endpoint" });

      if (error) throw error;

      setNotificationsEnabled(true);
      setMessage("Preferências de notificação salvas!");
    } catch (err) {
      console.error(err);
      setMessage("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (e) => {
    const newTime = parseInt(e.target.value);
    setLeadTime(newTime);
    if (notificationsEnabled) {
      handleSaveNotificationSettings(newTime);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E2A] text-white font-sans pb-12">
      {/* HEADER CORRIGIDO: Alinhamento absoluto central para a Logo */}
      <header className="border-b border-[#26283A] bg-[#1A1C3A] py-4 px-6 flex items-center relative sticky top-0 z-10 min-h-[64px]">
        {/* Botão posicionado de forma isolada na esquerda */}
        <button 
          onClick={() => navigate("/home")} 
          className="text-xs font-black uppercase italic text-gray-400 hover:text-white transition-colors z-20 absolute left-6"
        >
          ← Voltar
        </button>
        
        {/* Container da Logo forçado no centro exato da tela */}
        <div className="mx-auto flex justify-center items-center z-10 w-full">
          <Logo size="sm" showText={true} />
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        <h2 className="text-2xl font-black italic uppercase tracking-tight text-[#0077FF]">Configurações</h2>

        {/* CARD PRINCIPAL: NOTIFICAÇÕES GLOBAIS */}
        <section className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[32px] shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-lg">🔔</span>
            <div>
              <h3 className="font-black italic text-sm uppercase tracking-wider text-white">Alertas de Rodada</h3>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Avise-me se eu esquecer de salvar o palpite para um jogo.
              </p>
            </div>
          </div>

          {/* Ativação do dispositivo */}
          <div className="flex items-center justify-between bg-[#0A0E2A] p-4 rounded-2xl border border-[#26283A]">
            <span className="text-xs font-bold text-gray-300">Status das Notificações</span>
            <button
              onClick={() => handleSaveNotificationSettings()}
              disabled={loading}
              className={`px-4 py-2 rounded-xl font-black italic text-xs uppercase tracking-wider transition-all ${
                notificationsEnabled 
                  ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                  : "bg-[#0077FF] text-white shadow-lg active:scale-95"
              }`}
            >
              {loading ? "..." : notificationsEnabled ? "Ativo ✓" : "Ativar"}
            </button>
          </div>

          {/* Configuração de tempo de antecedência */}
          <div className="flex items-center justify-between bg-[#0A0E2A] p-4 rounded-2xl border border-[#26283A]">
            <span className="text-xs font-bold text-gray-300">Antecedência do aviso</span>
            <select
              value={leadTime}
              onChange={handleTimeChange}
              className="text-xs bg-[#1A1C3A] border border-[#26283A] px-3 py-2 rounded-xl font-bold text-gray-300 outline-none cursor-pointer focus:border-[#0077FF]"
            >
              <option value={5}>5 minutos antes</option>
              <option value={10}>10 minutos antes</option>
              <option value={15}>15 minutos antes</option>
              <option value={30}>30 minutos antes</option>
              <option value={60}>1 hora antes</option>
              <option value={120}>2 horas antes</option>
            </select>
          </div>
        </section>

        {/* SEÇÃO SOBRE UNIFICADA */}
        <section className="bg-[#1A1C3A] border border-[#26283A] p-6 rounded-[32px] shadow-xl text-center">
            <h4 className="font-black italic text-xs uppercase tracking-widest text-[#80B2FF] mb-1">iChute Engine v3.0</h4>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                Plataforma otimizada para monitoramento de dados e palpites de ligas privadas competitivas.
            </p>
            <p className="text-[10px] font-bold text-gray-500 mb-4 tracking-wide">
                Desenvolvido por <span className="text-[#0077FF] font-black italic">Gabriel Vieira da Rocha</span>
            </p>
            <div className="text-[9px] font-mono text-gray-600 uppercase tracking-widest border-t border-[#26283A]/60 pt-3">
                © 2026 iChute • Porto Alegre / Edmonton
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