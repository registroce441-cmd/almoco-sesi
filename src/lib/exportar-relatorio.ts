import {
  agruparPorSemana,
  formatarData,
  formatarDiaMes,
  nomeDoDia,
  totalDoPeriodo,
  type DiaTotal,
} from "./lista-data";

export interface MetaRelatorio {
  unidade: string;
  inicio: string; // AAAA-MM-DD
  fim: string;
}

const nomeBase = (m: MetaRelatorio) => `relatorio-refeicoes_${m.inicio}_a_${m.fim}`;
const rotuloSemana = (inicio: string, fim: string) => `${formatarDiaMes(inicio)} a ${formatarDiaMes(fim)}`;

function resumo(dias: DiaTotal[]) {
  const total = totalDoPeriodo(dias);
  const comAlmoco = dias.filter((d) => d.total > 0).length;
  // A média ignora dias sem nenhuma refeição (feriados e dias que ainda não chegaram), para não distorcer o gasto.
  return { total, diasUteis: dias.length, media: comAlmoco ? Math.round((total / comAlmoco) * 10) / 10 : 0, comAlmoco };
}

/** Excel com 3 abas: Resumo, Por dia e Por semana. */
export async function exportarRelatorioExcel(dias: DiaTotal[], meta: MetaRelatorio) {
  const XLSX = await import("xlsx");
  const r = resumo(dias);
  const semanas = agruparPorSemana(dias);

  const wsResumo = XLSX.utils.aoa_to_sheet([
    ["Relatório de refeições — Almoço SESI"],
    [],
    ["Unidade", meta.unidade],
    ["Período", `${formatarData(meta.inicio)} a ${formatarData(meta.fim)}`],
    ["Total de refeições no período", r.total],
    ["Dias úteis no período", r.diasUteis],
    ["Dias com refeições", r.comAlmoco],
    ["Média por dia com refeições", r.media],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
  ]);
  wsResumo["!cols"] = [{ wch: 34 }, { wch: 28 }];

  const wsDias = XLSX.utils.json_to_sheet(
    dias.map((d) => ({ Data: formatarData(d.data), "Dia da semana": nomeDoDia(d.data), Refeições: d.total })),
  );
  wsDias["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 11 }];

  const wsSemanas = XLSX.utils.json_to_sheet([
    ...semanas.map((s) => ({ Semana: rotuloSemana(s.inicio, s.fim), "Dias no período": s.dias.length, Refeições: s.total })),
    { Semana: "TOTAL", "Dias no período": r.diasUteis, Refeições: r.total },
  ]);
  wsSemanas["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 11 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
  XLSX.utils.book_append_sheet(wb, wsDias, "Por dia");
  XLSX.utils.book_append_sheet(wb, wsSemanas, "Por semana");
  XLSX.writeFile(wb, `${nomeBase(meta)}.xlsx`);
}

// Cores do app (mesmos tokens do tema): azul SESI e vermelho de destaque.
const AZUL: [number, number, number] = [11, 46, 107];
const VERMELHO: [number, number, number] = [227, 6, 19];

/** PDF (A4) com a identidade do app: resumo, tabela por dia e por semana. */
export async function exportarRelatorioPdf(dias: DiaTotal[], meta: MetaRelatorio) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const r = resumo(dias);
  const semanas = agruparPorSemana(dias);

  // Faixa de título
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, largura, 34, "F");
  doc.setFillColor(...VERMELHO);
  doc.rect(0, 34, largura, 1.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(18).text("Almoço SESI", 14, 15);
  doc.setFont("helvetica", "normal").setFontSize(12).text("Relatório de refeições", 14, 23);
  doc.setFontSize(10).text(`${meta.unidade}  ·  ${formatarData(meta.inicio)} a ${formatarData(meta.fim)}`, 14, 29.5);

  // Resumo
  const caixas = [
    ["Total no período", String(r.total)],
    ["Dias úteis", String(r.diasUteis)],
    ["Média por dia com refeições", String(r.media).replace(".", ",")],
  ] as const;
  const w = (largura - 28 - 8) / 3;
  caixas.forEach(([rotulo, valor], i) => {
    const x = 14 + i * (w + 4);
    doc.setDrawColor(210, 216, 228).setFillColor(244, 247, 252).roundedRect(x, 44, w, 22, 3, 3, "FD");
    doc.setTextColor(...AZUL).setFont("helvetica", "bold").setFontSize(20).text(valor, x + 5, 56);
    doc.setTextColor(100, 110, 130).setFont("helvetica", "normal").setFontSize(9).text(rotulo, x + 5, 62);
  });

  const estiloCabecalho = { fillColor: AZUL, textColor: 255, fontStyle: "bold" as const };

  doc.setTextColor(...AZUL).setFont("helvetica", "bold").setFontSize(12).text("Total por semana", 14, 78);
  autoTable(doc, {
    startY: 81,
    head: [["Semana", "Dias no período", "Refeições"]],
    body: [
      ...semanas.map((s) => [rotuloSemana(s.inicio, s.fim), String(s.dias.length), String(s.total)]),
      [{ content: "TOTAL", styles: { fontStyle: "bold" } }, { content: String(r.diasUteis), styles: { fontStyle: "bold" } }, { content: String(r.total), styles: { fontStyle: "bold" } }],
    ],
    headStyles: estiloCabecalho,
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
  });

  const yDias = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100) + 10;
  doc.setTextColor(...AZUL).setFont("helvetica", "bold").setFontSize(12).text("Total por dia", 14, yDias);
  autoTable(doc, {
    startY: yDias + 3,
    head: [["Data", "Dia da semana", "Refeições"]],
    body: dias.map((d) => [formatarData(d.data), nomeDoDia(d.data), String(d.total)]),
    headStyles: estiloCabecalho,
    columnStyles: { 2: { halign: "right" } },
    styles: { fontSize: 9.5 },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setTextColor(120, 128, 145).setFont("helvetica", "normal").setFontSize(8);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, h - 8);
    doc.text(`Página ${i} de ${paginas}`, largura - 14, h - 8, { align: "right" });
  }
  doc.save(`${nomeBase(meta)}.pdf`);
}
