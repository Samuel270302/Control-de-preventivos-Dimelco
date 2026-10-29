import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "./supabase";
import { reportarCanal } from "./conexion";
import type {
  CambioHorometro,
  ColumnaControl,
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

export const useColumnas = () =>
  useQuery({
    queryKey: ["columnas_control"],
    queryFn: () => todo<ColumnaControl>("columnas_control", "orden"),
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

export function useLecturasDesde(desde: string) {
  return useQuery({
    queryKey: ["v_lecturas_desde", desde],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("v_lecturas")
        .select("id,componente_id,fecha,turno,lectura,lectura_acum,num_turno")
        .gte("fecha", desde)
        .order("num_turno", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data as Pick<
        LecturaCalc,
        "id" | "componente_id" | "fecha" | "turno" | "lectura" | "lectura_acum" | "num_turno"
      >[];
    },
  });
}

export interface PmVentana {
  componente_id: string;
  fecha: string;
  gama: number | null;
  lectura_acum: number | null;
}

export function usePmDesde(desde: string) {
  return useQuery({
    queryKey: ["v_registros_pm_desde", desde],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("v_registros_pm")
        .select("componente_id,fecha,gama,lectura_acum")
        .gte("fecha", desde)
        .order("fecha", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data as PmVentana[];
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
  "columnas_control",
];

// Una pasada de captura llega como un aviso por fila; se agrupan para
// recargar una sola vez cuando dejan de llegar avisos.
const ESPERA_RECARGA_MS = 1500;

export function useTiempoReal() {
  const qc = useQueryClient();
  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    const canal = supabase()
      .channel("cambios-db")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        if (!TABLAS.includes(payload.table)) return;
        if (temporizador) clearTimeout(temporizador);
        temporizador = setTimeout(() => {
          temporizador = null;
          qc.invalidateQueries();
        }, ESPERA_RECARGA_MS);
      })
      .subscribe((estado) => reportarCanal(estado));
    return () => {
      if (temporizador) clearTimeout(temporizador);
      void supabase().removeChannel(canal);
    };
  }, [qc]);
}
