const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const reais = (v: number) => brl.format(v);

/** Data local no formato AAAA-MM-DD (sem converter para UTC). */
export function hojeISO(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export const mesISO = (d = new Date()) => hojeISO(d).slice(0, 7);

export function dataCurta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}` : iso;
}

export function nomeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const s = new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function mesesParaTexto(n: number): string {
  if (n < 12) return `${n} ${n === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(n / 12);
  const resto = n % 12;
  const a = `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return resto ? `${a} e ${resto} ${resto === 1 ? "mês" : "meses"}` : a;
}
