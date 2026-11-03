#!/usr/bin/env python3
"""Compara el Control PM diésel de Explotec en la base con la hoja Control PM de su libro.

Uso:
    python3 tools/validate_explotec.py <libro.xlsx> [--corte 2026-10-30] [--dsn ...]

Fija parametros.fecha_referencia en la fecha de corte del libro mientras compara y
la deja vacía al terminar.
"""
import argparse
import datetime as dt
import decimal
import os

import openpyxl
import psycopg2
import psycopg2.extras

DSN_LOCAL = "host=/home/user/.pgrun port=5433 user=dev dbname=hemco"
# columna del libro (0 = A) -> columna de v_control_pm
# Datos de base: deben coincidir.
CAMPOS = {
    3: "fecha_ultimo_pm", 4: "gama_ultimo_pm", 5: "horometro_ultimo_pm", 6: "proxima_gama",
    7: "meta_acum", 8: "ultima_lectura_acum", 9: "fecha_ultima_lectura", 11: "hrs_faltantes",
}
# Proyección: el libro de Explotec calcula las h/día con la ventana de 30 días de la flota y
# los días con cobertura; la app usa el método de HEMCO (30 días de cada horómetro, sin
# huecos largos). Se informan aparte.
PROYECCION = {12: "tendencia", 14: "fecha_estimada", 15: "estado"}


def normal(v):
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, (int, float, decimal.Decimal)):
        return round(float(v), 2)
    if isinstance(v, str):
        try:
            return round(float(v), 2)
        except ValueError:
            return v.strip()
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--corte", default="2026-10-30")
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DSN_LOCAL))
    args = ap.parse_args()

    ws = openpyxl.load_workbook(args.xlsx, data_only=True, read_only=True)["Control PM"]
    libro = {}
    for f in ws.iter_rows(min_row=5, max_col=16, values_only=True):
        if f[0] is None or f[2] != "Motor Diésel":
            if f[0] == "SISTEMA PERFORADORA":
                break
            continue
        libro[str(f[0]).strip().upper()] = f

    con = psycopg2.connect(args.dsn)
    cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("update parametros set valor_texto = %s where clave = 'fecha_referencia'", (args.corte,))
    try:
        cur.execute("""select * from v_control_pm where unidad = 'Explotec' and tipo_horometro = 'Diesel'""")
        app = {r["cod_interno"]: r for r in cur.fetchall()}
    finally:
        cur.execute("update parametros set valor_texto = null where clave = 'fecha_referencia'")
        con.commit()

    difs = 0
    proy = []
    for cod, f in sorted(libro.items()):
        r = app.get(cod)
        if r is None:
            print(f"{cod}: no está en la app")
            difs += 1
            continue
        for col, campo in CAMPOS.items():
            a, b = normal(f[col]), normal(r[campo])
            if isinstance(a, float) and isinstance(b, float) and abs(a - b) <= 0.05:
                continue
            if a != b:
                print(f"{cod} · {campo}: libro={a!r} app={b!r}")
                difs += 1
        if r is not None:
            a = [normal(f[c]) for c in PROYECCION]
            b = [normal(r[c]) for c in PROYECCION.values()]
            if a != b:
                proy.append(f"{cod}: libro {a[0]} h/día, {a[1]}, {a[2]} · app {b[0]} h/día, {b[1]}, {b[2]}")
    print(f"\nEquipos comparados: {len(libro)}. Diferencias en datos de base: {difs}")
    print(f"\nProyección distinta por método de tendencia ({len(proy)}):")
    for x in proy:
        print(" ", x)


if __name__ == "__main__":
    main()
