#!/usr/bin/env python3
"""Importa el libro "Registro de horometros HEMCO v2.xlsx" a la base de datos.

Uso:
    python3 tools/import_excel.py <ruta al xlsx> [--dsn <cadena de conexión>] [--fecha-ref AAAA-MM-DD]

Carga en orden: planes_mp, equipos, componentes, cambios_horometro, lecturas,
registros_pm y registros manuales del Scooptram #4. Borra los datos previos de
esas tablas (carga total, pensada para la puesta en marcha).
"""
import argparse
import datetime as dt
import os
import sys

import openpyxl
import psycopg2
import psycopg2.extras

DSN_LOCAL = "host=/home/user/.pgrun port=5433 user=dev dbname=hemco"

TIPO_PM = {  # columna G de Registro PM -> tipo de horómetro
    "Diesel": "Diesel",
    "Eléctrico": "Motor Eléctrico",
    "Perf 1": "Percusión #1",
    "Perf 2": "Percusión #2",
    "Empernado": "Empernado",
}


def sap(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return str(int(round(v)))
    s = str(v).strip()
    return None if s in ("", "Sin SAP") else s


def fecha(v):
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    return None


def num(v):
    return float(v) if isinstance(v, (int, float)) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DSN_LOCAL))
    ap.add_argument("--fecha-ref", default=None,
                    help="Solo pruebas: fija el «hoy» de los controles")
    args = ap.parse_args()

    wb = openpyxl.load_workbook(args.xlsx, data_only=True)
    con = psycopg2.connect(args.dsn)
    cur = con.cursor()
    avisos = []

    cur.execute("""
        delete from registros_manuales; delete from lecturas;
        delete from registros_pm; delete from cambios_horometro;
        delete from componentes; delete from equipos; delete from planes_mp;
    """)

    # --- Plan MP (filas 6 a 13) ---
    ws = wb["Plan MP"]
    n = 0
    for r in range(6, 14):
        clave = ws.cell(r, 1).value
        if not clave:
            continue
        gamas = [num(ws.cell(r, c).value) for c in range(7, 15)]
        gamas = [g for g in gamas if g is not None]
        cur.execute(
            """insert into planes_mp (clave, sistema, componente_desc, aplica_a,
               tipo_horometro_desc, intervalo_h, ciclo_gamas, dias_programar,
               dias_verificar, base_sin_pm, kits_sap, observaciones, orden)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (clave.strip(), ws.cell(r, 2).value, ws.cell(r, 3).value,
             ws.cell(r, 4).value, ws.cell(r, 5).value, num(ws.cell(r, 6).value),
             gamas, int(ws.cell(r, 15).value), int(ws.cell(r, 16).value),
             num(ws.cell(r, 17).value), ws.cell(r, 18).value,
             ws.cell(r, 19).value, r - 5))
        n += 1
    print(f"planes_mp: {n}")

    # --- Equipos (Parametros F:I) + SAP equipo (Parametros AC:AE) ---
    ws = wb["Parametros"]
    sap_tabla = {}  # (equipo, tipo) -> sap   tipo: 'Equipo' o tipo de horómetro
    for r in range(2, ws.max_row + 1):
        eq, tipo, cod = ws.cell(r, 29).value, ws.cell(r, 30).value, ws.cell(r, 31).value
        if eq and tipo:
            sap_tabla[(str(eq).strip(), str(tipo).strip())] = sap(cod)
    equipos = {}
    n = 0
    for r in range(2, ws.max_row + 1):
        cod = ws.cell(r, 6).value
        if not cod:
            continue
        cod = str(cod).strip()
        cur.execute(
            """insert into equipos (cod_interno, cod_sap, modelo, fecha_inicio_operacion)
               values (%s,%s,%s,%s) returning id""",
            (cod, sap_tabla.get((cod, "Equipo")), str(ws.cell(r, 7).value).strip(),
             fecha(ws.cell(r, 8).value)))
        equipos[cod] = cur.fetchone()[0]
        n += 1
    print(f"equipos: {n}")

    # --- Componentes (filas de Control PM; 40h marca aplica_rutina40) ---
    rutina40 = set()
    ws = wb["Control MP 40h"]
    for r in range(7, ws.max_row + 1):
        a, tipo = ws.cell(r, 1).value, ws.cell(r, 24).value
        if a and tipo:
            rutina40.add((str(a).strip(), str(tipo).strip()))

    ws = wb["Control PM"]
    componentes = {}
    seccion = 0
    n = 0
    for r in range(1, ws.max_row + 1):
        a = ws.cell(r, 1).value
        if a is None:
            continue
        a = str(a).strip()
        if a.startswith("1."):
            seccion = 1
            continue
        if a.startswith("2."):
            seccion = 2
            continue
        if a.startswith("3."):
            seccion = 3
            continue
        if a in ("Cod. Interno", "Resumen al") or a.startswith("CONTROL"):
            continue
        clave = ws.cell(r, 21).value
        tipo = ws.cell(r, 22).value
        if not clave or not tipo or a not in equipos:
            avisos.append(f"Control PM fila {r}: no importada ({a})")
            continue
        tipo = str(tipo).strip()
        nombre = str(ws.cell(r, 4).value or "").strip()
        estado = ws.cell(r, 19).value
        sistema = {1: "Motor Diésel", 2: "Compresor"}.get(
            seccion, "Empernadora" if tipo == "Empernado" else "Perforadora")
        cod_sap = sap(ws.cell(r, 2).value)
        if seccion == 3:
            cod_sap = sap_tabla.get((a, tipo)) or cod_sap
        cur.execute(
            """insert into componentes (equipo_id, tipo_horometro, nombre, sistema,
               seccion, cod_sap, plan_clave, aplica_rutina40, lectura_manual, activo)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) returning id""",
            (equipos[a], tipo, nombre, sistema, seccion, cod_sap,
             str(clave).strip(), (a, tipo) in rutina40,
             a == "Scooptram #4" and tipo == "Diesel",
             estado is not None and str(estado).strip() != ""))
        componentes[(a, tipo)] = cur.fetchone()[0]
        n += 1
    print(f"componentes: {n}")

    # --- Cambios de horómetro (filas desde la 6) ---
    ws = wb["Cambios Horómetro"]
    n = 0
    for r in range(6, ws.max_row + 1):
        a = ws.cell(r, 1).value
        if not a:
            continue
        key = (str(a).strip(), str(ws.cell(r, 2).value or "").strip())
        if key not in componentes:
            avisos.append(f"Cambios Horómetro fila {r}: componente desconocido {key}")
            continue
        estado = str(ws.cell(r, 9).value or "").strip()
        cur.execute(
            """insert into cambios_horometro (componente_id, vigente_desde, offset_h,
               ultima_lectura_vieja, primera_lectura_nueva, metodo, fuente, estado)
               values (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (componentes[key], fecha(ws.cell(r, 3).value), num(ws.cell(r, 4).value),
             str(ws.cell(r, 5).value or ""), str(ws.cell(r, 6).value or ""),
             str(ws.cell(r, 7).value or ""), str(ws.cell(r, 8).value or ""),
             "Validado" if estado.startswith("Validado") else "Por validar"))
        n += 1
    print(f"cambios_horometro: {n}")

    # --- Lecturas de horómetro ---
    ws = wb["Horometros"]
    filas = []
    vistos = set()
    dup = 0
    for r in range(2, ws.max_row + 1):
        f, eq, turno, tipo, lect = (ws.cell(r, c).value for c in range(1, 6))
        if f is None and eq is None:
            continue
        f = fecha(f)
        lect = num(lect)
        if not (f and eq and turno and tipo and lect is not None):
            avisos.append(f"Horometros fila {r}: registro incompleto, no importada")
            continue
        key = (str(eq).strip(), str(tipo).strip())
        if key not in componentes:
            avisos.append(f"Horometros fila {r}: componente desconocido {key}")
            continue
        k2 = (key, f, str(turno).strip())
        if k2 in vistos:
            dup += 1
            avisos.append(f"Horometros fila {r}: duplicado {key} {f} {turno}, no importada")
            continue
        vistos.add(k2)
        filas.append((componentes[key], f, str(turno).strip(), lect, "import"))
    psycopg2.extras.execute_values(
        cur, "insert into lecturas (componente_id, fecha, turno, lectura, origen) values %s",
        filas)
    print(f"lecturas: {len(filas)} (duplicadas omitidas: {dup})")

    # --- Registro PM ---
    ws = wb["Registro PM"]
    n = 0
    for r in range(2, ws.max_row + 1):
        f, eq = fecha(ws.cell(r, 1).value), ws.cell(r, 2).value
        if not f or not eq:
            continue
        g = ws.cell(r, 7).value
        tipo = TIPO_PM.get(str(g).strip()) if g else None
        key = (str(eq).strip(), tipo)
        if tipo is None or key not in componentes:
            avisos.append(f"Registro PM fila {r}: componente desconocido ({eq}, {g})")
            continue
        cur.execute(
            """insert into registros_pm (componente_id, fecha, gama, lectura, responsable)
               values (%s,%s,%s,%s,%s)""",
            (componentes[key], f, num(ws.cell(r, 5).value), num(ws.cell(r, 6).value),
             str(ws.cell(r, 8).value or "") or None))
        n += 1
    print(f"registros_pm: {n}")

    # --- Registro manual Scooptram #4 ---
    ws = wb["ST1030 #4 Manual"]
    comp_st4 = componentes.get(("Scooptram #4", "Diesel"))
    n = 0
    for r in range(8, ws.max_row + 1):
        f = fecha(ws.cell(r, 1).value)
        if not f or comp_st4 is None:
            continue
        turno = str(ws.cell(r, 3).value or "").strip()
        ini, fin, acum = (num(ws.cell(r, c).value) for c in (4, 5, 7))
        if turno not in ("Dia", "Noche") or ini is None or fin is None:
            continue
        cur.execute(
            """insert into lecturas (componente_id, fecha, turno, lectura, origen)
               values (%s,%s,%s,%s,'manual')
               on conflict (componente_id, fecha, turno) where not anulada do nothing
               returning id""",
            (comp_st4, f, turno, acum if acum is not None else fin))
        row = cur.fetchone()
        cur.execute(
            """insert into registros_manuales (componente_id, fecha, turno, turno_texto,
               lectura_inicio, lectura_final, lectura_id)
               values (%s,%s,%s,%s,%s,%s,%s)""",
            (comp_st4, f, turno, str(ws.cell(r, 2).value or ""), ini, fin,
             row[0] if row else None))
        n += 1
    print(f"registros_manuales: {n}")

    if args.fecha_ref:
        cur.execute("update parametros set valor_texto=%s where clave='fecha_referencia'",
                    (args.fecha_ref,))
        print(f"fecha_referencia: {args.fecha_ref}")

    con.commit()
    if avisos:
        print(f"\nAvisos ({len(avisos)}):")
        for a in avisos:
            print(" -", a)


if __name__ == "__main__":
    sys.exit(main())
