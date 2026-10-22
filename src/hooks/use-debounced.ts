import { useEffect, useState } from "react";

/** Devolve `valor` só depois de ficar `ms` sem mudar (evita uma consulta por tecla digitada). */
export function useDebounced<T>(valor: T, ms = 220): T {
  const [atual, setAtual] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtual(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atual;
}
