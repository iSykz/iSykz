"use client";
/* Voz pela capacidade "dictation" do claude.ai (o Web Speech fica bloqueado na página publicada). */
import { ditadoP, type Ditado } from "./claude";

let ditado: Ditado | null = null;
void ditadoP.then((d) => (ditado = d));

export function vozDisponivel(): boolean {
  return ditado !== null;
}

export function ouvir(o: { aoParcial: (t: string) => void; aoFinal: (t: string) => void; aoErro: (m: string) => void }) {
  const d = ditado;
  if (!d) {
    o.aoErro("O microfone não está disponível aqui. Use o Chrome no computador ou digite o gasto.");
    return () => {};
  }
  let texto = "";
  let comecou = false;
  let acabou = false;
  const subs: (() => void)[] = [];
  const terminar = (erro?: string) => {
    if (acabou) return;
    acabou = true;
    subs.forEach((s) => s());
    if (texto) o.aoFinal(texto);
    else o.aoErro(erro ?? "Não ouvi nada. Toque no microfone e fale o gasto.");
  };
  subs.push(
    d.onPartial(({ text }) => o.aoParcial(`${texto} ${text}`.trim())),
    d.onFinal(({ text }) => {
      texto = `${texto} ${text}`.trim();
      o.aoParcial(texto);
    }),
    d.onState(({ state }) => {
      if (state !== "idle") comecou = true;
      else if (comecou) terminar();
    }),
  );
  // chamado direto do toque no botão, como a capacidade exige
  d.start().catch((e: { code?: string }) => {
    terminar(
      e?.code === "not_granted"
        ? "Permita o uso do microfone para falar seus gastos."
        : e?.code === "stopped"
          ? undefined
          : "Não consegui ouvir agora. Tente de novo ou digite o gasto.",
    );
  });
  return () => void d.stop().catch(() => {});
}
