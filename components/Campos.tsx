"use client";

import { useEffect, useRef, useState } from "react";
import { lerNumero, paraCampo } from "@/lib/numero";

interface Props {
  valor: number | undefined;
  aoMudar: (n: number) => void;
  rotulo?: string;
  etiquetaAria?: string;
  prefixo?: string;
  sufixo?: string;
  placeholder?: string;
  dica?: string;
  erro?: string | null;
  autoFocus?: boolean;
  /** Avisa a cada tecla (para validação ao vivo), sem gravar. */
  aoDigitar?: (n: number) => void;
  /** Grava só quando o campo perde o foco (para valores que vão ao servidor). */
  gravarAoSair?: boolean;
  casas?: number;
}

/**
 * Campo numérico que aceita vírgula e ponto ("40,50", "1.234,56", "40.50").
 * É <input type="text"> de propósito: type="number" descarta a vírgula.
 */
export function CampoNumero({
  valor,
  aoMudar,
  rotulo,
  etiquetaAria,
  prefixo,
  sufixo,
  placeholder,
  dica,
  erro,
  autoFocus,
  aoDigitar,
  gravarAoSair,
  casas = 2,
}: Props) {
  const [texto, setTexto] = useState(() => paraCampo(valor, casas));
  const focado = useRef(false);

  // acompanha mudanças vindas de fora (carregamento, exemplo, outro aparelho)
  useEffect(() => {
    if (!focado.current) setTexto(paraCampo(valor, casas));
  }, [valor, casas]);

  function digitou(bruto: string) {
    setTexto(bruto);
    const n = lerNumero(bruto);
    const limpo = Number.isFinite(n) ? n : 0;
    aoDigitar?.(limpo);
    if (!gravarAoSair) aoMudar(limpo);
  }

  function saiu() {
    focado.current = false;
    const n = lerNumero(texto);
    const limpo = Number.isFinite(n) ? n : 0;
    setTexto(paraCampo(limpo, casas));
    if (gravarAoSair) aoMudar(limpo);
  }

  const campo = (
    <div className={`campo-numero ${erro ? "com-erro" : ""}`}>
      {prefixo && <span className="afixo">{prefixo}</span>}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        placeholder={placeholder}
        aria-label={etiquetaAria ?? (rotulo ? undefined : "Valor")}
        aria-invalid={erro ? true : undefined}
        autoFocus={autoFocus}
        onFocus={() => (focado.current = true)}
        onChange={(e) => digitou(e.target.value)}
        onBlur={saiu}
      />
      {sufixo && <span className="afixo">{sufixo}</span>}
    </div>
  );

  if (!rotulo) return campo;
  return (
    <label className="campo-rotulado">
      <span>{rotulo}</span>
      {campo}
      {erro ? <span className="msg-erro">{erro}</span> : dica ? <span className="msg-dica">{dica}</span> : null}
    </label>
  );
}
