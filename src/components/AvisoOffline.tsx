import { useEffect, useState } from "react";
import { CloudOff, Wifi } from "lucide-react";
import { useOnline } from "@/lib/pwa";

/** Faixa no topo quando falta internet; ao voltar, confirma por alguns segundos e some. */
export function AvisoOffline() {
  const online = useOnline();
  const [voltou, setVoltou] = useState(false);
  const [ficouOffline, setFicouOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setFicouOffline(true);
      setVoltou(false);
      return;
    }
    if (!ficouOffline) return;
    setVoltou(true);
    const t = setTimeout(() => {
      setVoltou(false);
      setFicouOffline(false);
    }, 3000);
    return () => clearTimeout(t);
  }, [online, ficouOffline]);

  if (online && !voltou) return null;
  return (
    <div
      role="status"
      className={`sticky top-0 z-[60] flex items-center justify-center gap-2 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-sm font-semibold ${
        online ? "bg-success text-success-foreground" : "bg-foreground text-background"
      }`}
    >
      {online ? (
        <>
          <Wifi className="h-4 w-4 shrink-0" /> Conexão restabelecida
        </>
      ) : (
        <>
          <CloudOff className="h-4 w-4 shrink-0" /> Você está sem internet. Marcar e consultar a
          Lista precisam de conexão.
        </>
      )}
    </div>
  );
}
