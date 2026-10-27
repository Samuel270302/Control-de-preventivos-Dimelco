#!/usr/bin/env python3
"""Compara v_control_pm y v_control_40 contra las hojas Control PM y Control MP 40h.

Uso: python3 tools/validate_control.py <ruta al xlsx> [--dsn <cadena>]
Requiere haber importado con --fecha-ref igual al corte del libro (celda C3).
"""
import argparse
import datetime as dt
import os

import openpyxl
import psycopg2
import psycopg2.extras

DSN_LOCAL = "host=/home/user/.pgrun port=5433 user=dev dbname=hemco"

CAMPOS = [  # (columna excel 1-based, campo vista, tipo)
    (5,  "fecha_ultimo_pm",         "fecha"),
    (6,  "gama_ultimo_pm",          "num"),
    (7,  "horometro_ultimo_pm",     "num"),
    (8,  "proxima_gama",            "texto_o_num"),
    (9,  "meta_acum",               "num"),
    (10, "meta_contador",           "num"),
    (11, "ultima_lectura_acum",     "num"),
    (12, "ultima_lectura_contador", "num"),
    (13, "fecha_ultima_lectura",    "fecha"),
    (14, "antiguedad_dias",         "num"),
    (15, "hrs_faltantes",           "num"),
    (16, "tendencia",               "num"),
    (17, "dias_restantes",          "num"),
    (18, "fecha_estimada",          "fecha"),
    (19, "estado",                  "texto"),
]


def norm(v, tipo):
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    if tipo == "fecha":
        if isinstance(v, dt.datetime):
            return v.date()
        return v
    if tipo == "num":
        if isinstance(v, str):
            return v.strip()  # "Sin gama" y similares
        return round(float(v), 2)
    if tipo == "texto_o_num":
        if isinstance(v, (int, float)):
            return round(float(v), 2)
        try:
            return round(float(str(v).strip()), 2)
        except ValueError:
            return str(v).strip()
    return str(v).strip()


def comparar(nombre, filas_excel, filas_db, campos):
    dif = 0
    db = {k: dict(r) for k, r in filas_db.items()}
    for key, exc in filas_excel.items():
        if key not in db:
            print(f"[{nombre}] {key}: está en el Excel y no en la vista")
            dif += 1
            continue
        fila = db.pop(key)
        for col, campo, tipo in campos:
            ve = norm(exc.get(col), tipo)
            vd = norm(fila.get(campo), tipo)
            if ve == "Sin gama" and vd is None:
                continue  # la vista deja la gama nula; la pantalla muestra «Sin gama»
            if isinstance(ve, float) and isinstance(vd, float):
                if abs(ve - vd) <= 0.015:
                    continue
            if ve != vd:
                if key == ("Scooptram #4", "Diesel") and nombre == "Control PM":
                    # Diferencia esperada: el libro no copia el registro manual del
                    # ST #4 a Horometros; la app sí lo integra al control.
                    print(f"[{nombre}] {key} · {campo}: excel={ve!r} app={vd!r} (esperada: registro manual integrado)")
                    continue
                print(f"[{nombre}] {key} · {campo}: excel={ve!r} app={vd!r}")
                dif += 1
    for key in db:
        print(f"[{nombre}] {key}: está en la vista y no en el Excel")
        dif += 1
    return dif


def leer_hoja(ws, col_tipo, fila_ini):
    filas = {}
    for r in range(fila_ini, ws.max_row + 1):
        a, tipo = ws.cell(r, 1).value, ws.cell(r, col_tipo).value
        estado = ws.cell(r, 19).value
        if not a or not tipo:
            continue
        a = str(a).strip()
        if a in ("Cod. Interno", "Resumen al") or a[0].isdigit():
            continue
        if estado is None or str(estado).strip() == "":
            continue  # componentes inactivos (compresores sin horómetro)
        filas[(a, str(tipo).strip())] = {c: ws.cell(r, c).value for c in range(1, 21)}
    return filas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DSN_LOCAL))
    args = ap.parse_args()

    wb = openpyxl.load_workbook(args.xlsx, data_only=True)
    con = psycopg2.connect(args.dsn)
    cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("select * from v_control_pm")
    db_pm = {(r["cod_interno"], r["tipo_horometro"]): r for r in cur.fetchall()}
    cur.execute("select * from v_control_40")
    db_40 = {(r["cod_interno"], r["tipo_horometro"]): r for r in cur.fetchall()}

    exc_pm = leer_hoja(wb["Control PM"], 22, 7)
    exc_40 = leer_hoja(wb["Control MP 40h"], 24, 7)

    dif = comparar("Control PM", exc_pm, db_pm, CAMPOS)
    dif += comparar("Control 40h", exc_40, db_40, CAMPOS)
    print(f"\nFilas comparadas: Control PM {len(exc_pm)}, Control 40h {len(exc_40)}. Diferencias: {dif}")
    return 1 if dif else 0


if __name__ == "__main__":
    raise SystemExit(main())
