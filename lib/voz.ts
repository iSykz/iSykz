"use client";

/* Reconhecimento de voz do próprio navegador (Chrome/Android/Edge/Safari). */

interface Reconhecedor {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Construtor = new () => Reconhecedor;

export function vozDisponivel(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function ouvir(opcoes: {
  aoParcial: (texto: string) => void;
  aoFinal: (texto: string) => void;
  aoErro: (msg: string) => void;
}): () => void {
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!C) {
    opcoes.aoErro("Seu navegador não suporta áudio. Use o Chrome ou digite o gasto.");
    return () => {};
  }
  const r = new C();
  r.lang = "pt-BR";
  r.interimResults = true;
  r.continuous = false;
  let texto = "";
  r.onresult = (e) => {
    texto = Array.from(e.results)
      .map((res) => res[0]?.transcript ?? "")
      .join(" ")
      .trim();
    opcoes.aoParcial(texto);
  };
  let falhou = false;
  r.onerror = (e) => {
    falhou = true;
    opcoes.aoErro(
      e.error === "not-allowed" ? "Permita o uso do microfone para falar seus gastos." : "Não entendi o áudio. Tente de novo.",
    );
  };
  r.onend = () => {
    if (texto) opcoes.aoFinal(texto);
    else if (!falhou) opcoes.aoErro("Não ouvi nada. Toque no microfone e fale o gasto.");
  };
  r.start();
  return () => r.stop();
}
