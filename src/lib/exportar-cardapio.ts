import type { Refeicao } from "./cardapio-data";

export interface DiaDoCardapio {
  nome: string; // "Segunda"
  data: string; // "26/10"
  refeicao: Refeicao | null;
}

export interface MetaCardapio {
  unidade: string;
  /** "26/10 a 30/10" */
  periodo: string;
  /** AAAA-MM-DD da segunda e da sexta (nome do arquivo). */
  inicio: string;
  fim: string;
}

const AZUL: [number, number, number] = [11, 46, 107];
const VERMELHO: [number, number, number] = [227, 6, 19];

/** Monta o PDF (uma página A4, com quebra automática se o texto crescer). Sem fotos: fica leve e imprime bem. */
export async function montarPdfCardapio(dias: DiaDoCardapio[], meta: MetaCardapio) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 14;
  const larguraTexto = largura - margem * 2 - 44;

  doc.setFillColor(...AZUL).rect(0, 0, largura, 34, "F");
  doc.setFillColor(...VERMELHO).rect(0, 34, largura, 1.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(18).text("Almoço SESI", margem, 15);
  doc.setFont("helvetica", "normal").setFontSize(12).text("Cardápio da semana", margem, 23);
  doc.setFontSize(10).text(`${meta.unidade}  ·  ${meta.periodo}`, margem, 29.5);

  let y = 46;
  for (const d of dias) {
    const r = d.refeicao;
    const linhas: { texto: string[]; estilo: "forte" | "normal" | "suave" }[] = [];
    if (r) {
      linhas.push({
        texto: doc
          .setFont("helvetica", "bold")
          .setFontSize(13)
          .splitTextToSize(r.prato, larguraTexto),
        estilo: "forte",
      });
      if (r.acompanhamento)
        linhas.push({
          texto: doc
            .setFont("helvetica", "normal")
            .setFontSize(10.5)
            .splitTextToSize(`Acompanhamento: ${r.acompanhamento}`, larguraTexto),
          estilo: "normal",
        });
      if (r.sobremesa)
        linhas.push({
          texto: doc
            .setFont("helvetica", "normal")
            .setFontSize(10.5)
            .splitTextToSize(`Sobremesa: ${r.sobremesa}`, larguraTexto),
          estilo: "normal",
        });
      if (r.tags.length)
        linhas.push({
          texto: doc
            .setFont("helvetica", "normal")
            .setFontSize(9)
            .splitTextToSize(r.tags.join("  ·  "), larguraTexto),
          estilo: "suave",
        });
    } else {
      linhas.push({ texto: ["Cardápio ainda não divulgado"], estilo: "suave" });
    }
    const alturaLinha = (e: string) => (e === "forte" ? 6 : e === "normal" ? 5.2 : 4.6);
    const h = 10 + linhas.reduce((s, l) => s + l.texto.length * alturaLinha(l.estilo), 0);

    if (y + h > altura - 18) {
      doc.addPage();
      y = 20;
    }
    doc
      .setDrawColor(210, 216, 228)
      .setFillColor(244, 247, 252)
      .roundedRect(margem, y, largura - margem * 2, h, 3, 3, "FD");
    doc.setFillColor(...AZUL).roundedRect(margem, y, 36, h, 3, 3, "F");
    doc
      .setTextColor(255, 255, 255)
      .setFont("helvetica", "bold")
      .setFontSize(13)
      .text(d.nome, margem + 4, y + 9);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(10)
      .text(d.data, margem + 4, y + 15);

    let ty = y + 8.5;
    for (const l of linhas) {
      if (l.estilo === "forte")
        doc
          .setFont("helvetica", "bold")
          .setFontSize(13)
          .setTextColor(...AZUL);
      else if (l.estilo === "normal")
        doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(40, 48, 66);
      else doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100, 110, 130);
      doc.text(l.texto, margem + 44, ty);
      ty += l.texto.length * alturaLinha(l.estilo);
    }
    y += h + 5;
  }

  doc.setTextColor(100, 110, 130).setFont("helvetica", "normal").setFontSize(8.5);
  doc.text(
    `Cardápio sujeito a alterações. Gerado em ${new Date().toLocaleDateString("pt-BR")}.`,
    margem,
    altura - 10,
  );
  return doc;
}

export async function exportarCardapioPdf(dias: DiaDoCardapio[], meta: MetaCardapio) {
  const doc = await montarPdfCardapio(dias, meta);
  doc.save(`cardapio_${meta.inicio}_a_${meta.fim}.pdf`);
}
