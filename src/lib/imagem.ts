/** Foto do prato: reduzida no navegador antes de enviar (o celular tira fotos de vários MB). */

export const LADO_MAXIMO = 1280;
export const QUALIDADE_JPEG = 0.82;
export const TAMANHO_MAXIMO_ORIGINAL = 25 * 1024 * 1024;

export class ErroImagem extends Error {}

/** Mantém a proporção e nunca aumenta a imagem. */
export function dimensoesReduzidas(largura: number, altura: number, max = LADO_MAXIMO) {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura, altura };
  const fator = max / maior;
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

async function abrir(
  file: File,
): Promise<{ fonte: CanvasImageSource; largura: number; altura: number }> {
  // imageOrientation corrige fotos de celular "deitadas" (EXIF)
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { fonte: bmp, largura: bmp.width, altura: bmp.height };
    } catch {
      /* cai para o <img> abaixo */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Devolve um JPEG de, no máximo, 1280 px no maior lado. */
export async function reduzirImagem(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/"))
    throw new ErroImagem("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
  if (file.size > TAMANHO_MAXIMO_ORIGINAL)
    throw new ErroImagem("A foto é grande demais (máximo 25 MB).");
  let aberta;
  try {
    aberta = await abrir(file);
  } catch {
    throw new ErroImagem("Não consegui ler essa imagem. Tente outra foto (JPG, PNG ou WebP).");
  }
  const { largura, altura } = dimensoesReduzidas(aberta.largura, aberta.altura);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ErroImagem("Seu navegador não conseguiu preparar a foto.");
  ctx.fillStyle = "#ffffff"; // PNG com fundo transparente vira fundo branco no JPEG
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(aberta.fonte, 0, 0, largura, altura);
  const blob = await new Promise<Blob | null>((ok) =>
    canvas.toBlob(ok, "image/jpeg", QUALIDADE_JPEG),
  );
  if (!blob) throw new ErroImagem("Não consegui preparar a foto. Tente outra.");
  return blob;
}
