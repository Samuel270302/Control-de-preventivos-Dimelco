import ExcelJS from "exceljs";
import type { ControlFila, LecturaCalc, RegistroPm } from "./types";
import { fFecha, gamaTexto } from "./fmt";

function descargar(buf: ArrayBuffer, nombre: string) {
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

const COLOR_ESTADO: Record<string, string> = {
  "🔴 Vencido": "FFFFC7CE",
  "📅 Programar": "FFBDD7EE",
  "🔧 Verificar repuestos": "FFFFE699",
  "🟢 Normal": "FFC6EFCE",
};

export async function exportarControl(
  filas: ControlFila[],
  titulo: string,
  nombreArchivo: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(titulo.slice(0, 31));
  ws.columns = [
    { header: "Cod. Interno", width: 16 },
    { header: "Cód. SAP", width: 10 },
    { header: "Modelo", width: 18 },
    { header: "Sistema / Componente", width: 30 },
    { header: "Fecha Último PM", width: 13 },
    { header: "Gama Último PM", width: 10 },
    { header: "Horómetro Último PM (acum.)", width: 14 },
    { header: "Próxima Gama", width: 11 },
    { header: "Meta (acum.)", width: 12 },
    { header: "Meta (contador)", width: 12 },
    { header: "Última Lectura (acum.)", width: 12 },
    { header: "Última Lectura (contador)", width: 12 },
    { header: "Fecha Última Lectura", width: 13 },
    { header: "Antigüedad (días)", width: 10 },
    { header: "Hrs Faltantes", width: 11 },
    { header: "Tendencia (h/día)", width: 10 },
    { header: "Días Restantes", width: 10 },
    { header: "Fecha Estimada", width: 13 },
    { header: "Estado", width: 20 },
    { header: "Observación", width: 42 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const f of filas) {
    const fila = ws.addRow([
      f.cod_interno,
      f.cod_sap ?? "Sin SAP",
      f.modelo,
      f.nombre,
      fFecha(f.fecha_ultimo_pm),
      f.gama_ultimo_pm ?? (f.fecha_ultimo_pm ? "Sin gama" : ""),
      f.horometro_ultimo_pm,
      gamaTexto(f.proxima_gama),
      f.meta_acum,
      f.meta_contador,
      f.ultima_lectura_acum,
      f.ultima_lectura_contador,
      fFecha(f.fecha_ultima_lectura),
      f.antiguedad_dias,
      f.hrs_faltantes,
      f.tendencia,
      f.dias_restantes,
      fFecha(f.fecha_estimada),
      f.estado,
      f.observacion,
    ]);
    const color = COLOR_ESTADO[f.estado];
    if (color) {
      fila.getCell(19).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: color },
      };
      fila.getCell(19).font = { color: { argb: "FF1F1F1F" } };
    }
  }
  descargar(await wb.xlsx.writeBuffer(), nombreArchivo);
}

export async function exportarLecturas(
  filas: (LecturaCalc & { equipo: string; tipo: string })[],
  nombreArchivo: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lecturas");
  ws.columns = [
    { header: "Fecha", width: 12 },
    { header: "Equipo", width: 16 },
    { header: "Turno", width: 8 },
    { header: "Tipo de Horómetro", width: 16 },
    { header: "Lectura", width: 11 },
    { header: "Acumulado", width: 11 },
    { header: "Horas del Intervalo", width: 11 },
    { header: "Control", width: 26 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const f of filas)
    ws.addRow([
      fFecha(f.fecha),
      f.equipo,
      f.turno,
      f.tipo,
      f.lectura,
      f.lectura_acum,
      f.horas_intervalo,
      f.control,
    ]);
  descargar(await wb.xlsx.writeBuffer(), nombreArchivo);
}

export async function exportarRegistrosPm(
  filas: (RegistroPm & { equipo: string; tipo: string; clase: string })[],
  nombreArchivo: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Registro PM");
  ws.columns = [
    { header: "Fecha", width: 12 },
    { header: "Equipo", width: 16 },
    { header: "Tipo de Horómetro", width: 16 },
    { header: "Gama", width: 8 },
    { header: "Lectura", width: 11 },
    { header: "Clase", width: 12 },
    { header: "Responsable", width: 22 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const f of filas)
    ws.addRow([fFecha(f.fecha), f.equipo, f.tipo, f.gama, f.lectura, f.clase, f.responsable]);
  descargar(await wb.xlsx.writeBuffer(), nombreArchivo);
}
