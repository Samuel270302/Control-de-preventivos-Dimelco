import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "../auth";
import type { Unidad } from "./types";

// Unidad que se está mirando. El admin elige una o "Todas" (null) en el menú. Un
// capturador o invitado con varias unidades elige una de las suyas o "Mis unidades" (null);
// con una sola queda fijo en ella. La base solo le entrega lo de sus unidades.
const CLAVE = "preventivos.unidad";

interface ContextoUnidad {
  unidadId: string | null;
  setUnidadId: (id: string | null) => void;
  puedeElegir: boolean;
  // Unidades que el usuario puede mirar; null = todas (admin).
  propias: string[] | null;
}

const Contexto = createContext<ContextoUnidad>({ unidadId: null, setUnidadId: () => {}, puedeElegir: false, propias: null });

export function unidadesDe(p: { unidades?: string[] | null; unidad_id: string | null } | null): string[] {
  if (!p) return [];
  if (p.unidades && p.unidades.length) return p.unidades;
  return p.unidad_id ? [p.unidad_id] : [];
}

function leer(): string | null {
  try {
    return localStorage.getItem(CLAVE) || null;
  } catch {
    return null;
  }
}

export function UnidadProvider({ children }: { children: React.ReactNode }) {
  const { perfil, esAdmin } = useAuth();
  const [elegida, setElegida] = useState<string | null>(leer);
  const propias = esAdmin ? null : unidadesDe(perfil);
  const puedeElegir = esAdmin || (propias?.length ?? 0) > 1;
  const unidadId = esAdmin
    ? elegida
    : puedeElegir
      ? (elegida && propias!.includes(elegida) ? elegida : null)
      : (propias?.[0] ?? null);

  useEffect(() => {
    if (!puedeElegir) return;
    try {
      if (elegida) localStorage.setItem(CLAVE, elegida);
      else localStorage.removeItem(CLAVE);
    } catch {
      // sin almacenamiento: la elección dura la sesión
    }
  }, [elegida, puedeElegir]);

  return (
    <Contexto.Provider value={{ unidadId, setUnidadId: setElegida, puedeElegir, propias }}>
      {children}
    </Contexto.Provider>
  );
}

export const useUnidad = () => useContext(Contexto);

export const useUnidades = () =>
  useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data, error } = await supabase().from("unidades").select("*").order("orden");
      if (error) throw error;
      return data as Unidad[];
    },
  });

// Nombre de la unidad en vista, para títulos y nombres de archivo.
export function useNombreUnidad(): string | null {
  const { unidadId } = useUnidad();
  const { data } = useUnidades();
  return unidadId ? (data?.find((u) => u.id === unidadId)?.nombre ?? null) : null;
}

export function SelectorUnidad() {
  const { unidadId, setUnidadId, puedeElegir, propias } = useUnidad();
  const { data: unidades } = useUnidades();
  const nombre = useNombreUnidad();
  if (!puedeElegir) return nombre ? <div className="unidad-fija">Unidad {nombre}</div> : null;
  return (
    <label className="selector-unidad">
      <span>Unidad</span>
      <select value={unidadId ?? ""} onChange={(e) => setUnidadId(e.target.value || null)}>
        <option value="">{propias ? "Mis unidades" : "Todas las unidades"}</option>
        {(unidades ?? []).filter((u) => u.activo && (!propias || propias.includes(u.id))).map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
