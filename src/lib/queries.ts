import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "./supabase";
import type {
  CambioHorometro,
  Componente,
  ControlFila,
  Equipo,
  LecturaCalc,
  Perfil,
  PlanMp,
  RegistroPm,
} from "./types";

async function todo<T>(tabla: string, orden?: string): Promise<T[]> {
  let q = supabase().from(tabla).select("*");
  if (orden) q = q.order(orden);
  const { data, error } = await q;
  if (error) throw error;
  return data as T[];
}

export const useControlPm = () =>
  useQuery({
    queryKey: ["v_control_pm"],
    queryFn: () => todo<ControlFila>("v_control_pm"),
  });

export const useControl40 = () =>
  useQuery({
    queryKey: ["v_control_40"],
    queryFn: () => todo<ControlFila>("v_control_40"),
  });

export const useEquipos = () =>
  useQuery({ queryKey: ["equipos"], queryFn: () => todo<Equipo>("equipos", "cod_interno") });

export const useComponentes = () =>
  useQuery({
    queryKey: ["componentes"],
    queryFn: () => todo<Componente>("componentes"),
  });

export const usePlanes = () =>
  useQuery({ queryKey: ["planes_mp"], queryFn: () => todo<PlanMp>("planes_mp", "orden") });

export const useCambios = () =>
  useQuery({
    queryKey: ["cambios_horometro"],
    queryFn: () => todo<CambioHorometro>("cambios_horometro", "vigente_desde"),
  });

export const usePerfiles = () =>
  useQuery({ queryKey: ["perfiles"], queryFn: () => todo<Perfil>("perfiles", "nombre") });

export function useLecturasRecientes(limite = 400) {
  return useQuery({
    queryKey: ["v_lecturas", limite],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("v_lecturas")
        .select("*")
        .order("num_turno", { ascending: false })
        .limit(limite);
      if (error) throw error;
      return data as LecturaCalc[];
    },
  });
}

export function useRegistrosPm(limite = 300) {
  return useQuery({
    queryKey: ["registros_pm", limite],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("registros_pm")
        .select("*")
        .eq("anulado", false)
        .order("fecha", { ascending: false })
        .limit(limite);
      if (error) throw error;
      return data as RegistroPm[];
    },
  });
}

export function useParametros() {
  return useQuery({
    queryKey: ["parametros"],
    queryFn: () =>
      todo<{
        clave: string;
        valor: number | null;
        valor_texto: string | null;
        descripcion: string | null;
      }>("parametros"),
  });
}

// Tiempo real: cualquier cambio en las tablas base refresca las consultas.
const TABLAS = [
  "lecturas",
  "registros_pm",
  "cambios_horometro",
  "equipos",
  "componentes",
  "planes_mp",
  "parametros",
  "registros_manuales",
  "perfiles",
];

export function useTiempoReal() {
  const qc = useQueryClient();
  useEffect(() => {
    const canal = supabase()
      .channel("cambios-db")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        const t = payload.table;
        if (TABLAS.includes(t)) qc.invalidateQueries();
      })
      .subscribe();
    return () => {
      void supabase().removeChannel(canal);
    };
  }, [qc]);
}
