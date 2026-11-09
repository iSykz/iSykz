"use client";

/**
 * Reduz a foto no próprio celular antes de enviar (recibos ficam legíveis em
 * 1600px e o envio fica bem mais rápido em 4G).
 */
export async function prepararImagem(arquivo: File, ladoMax = 1600): Promise<{ dados: string; tipo: "image/jpeg" }> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("Não consegui abrir a imagem."));
      i.src = url;
    });
    const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { dados: dataUrl.split(",")[1] ?? "", tipo: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
