/**
 * Números digitados em português do Brasil.
 *
 * Campos <input type="number"> descartam a vírgula: quem digita "40,50" no
 * teclado do celular acaba gravando 4050. Por isso os campos de dinheiro do
 * app são de texto e passam por aqui.
 */

/** Lê "1.234,56", "40,50", "40.50", "R$ 90" ou "1234". Devolve NaN se não houver número. */
export function lerNumero(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").trim();
  if (!limpo || !/\d/.test(limpo)) return NaN;

  let normalizado: string;
  if (limpo.includes(",")) {
    // vírgula é sempre o separator decimal; pontos são de milhar
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = limpo.split(".");
    // "40.50" = decimal; "1.234" e "1.234.567" = milhar (como se escreve aqui)
    const ultimo = partes[partes.length - 1] ?? "";
    normalizado = partes.length === 2 && ultimo.length !== 3 ? limpo : partes.join("");
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}

/** Como lerNumero, mas devolve 0 no lugar de NaN. */
export const lerNumeroOuZero = (texto: string): number => {
  const n = lerNumero(texto);
  return Number.isFinite(n) ? n : 0;
};

/** Mostra o número para edição: 40.5 -> "40,50"; 1500 -> "1500". */
export function paraCampo(n: number | undefined, casas = 2): string {
  if (n === undefined || !Number.isFinite(n) || n === 0) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(casas).replace(".", ",");
}

/** Taxa ao mês -> taxa ao ano equivalente, em %. 14 -> 380,8 */
export const jurosAoAno = (aoMes: number): number => ((1 + aoMes / 100) ** 12 - 1) * 100;

/** 380.8 -> "381%"; 42.4 -> "42,4%" */
export function porcento(n: number): string {
  const casas = n >= 100 ? 0 : 1;
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}
