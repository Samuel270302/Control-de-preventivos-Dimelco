import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import type { Perfil } from "./lib/types";

interface Auth {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  esAdmin: boolean;
}

const Ctx = createContext<Auth>({ session: null, perfil: null, cargando: true, esAdmin: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargando(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_ev, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setPerfil(null);
      return;
    }
    supabase()
      .from("perfiles")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setPerfil((data as Perfil) ?? null));
  }, [session]);

  return (
    <Ctx.Provider
      value={{ session, perfil, cargando, esAdmin: perfil?.rol === "admin" }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
