export function fFecha(v: string | null | undefined): string {
  if (!v) return "";
  const [a, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function fNum(v: number | null | undefined, dec = 1): string {
  if (v === null || v === undefined) return "";
  return Number(v).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: dec,
  });
}

export function hoyISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
