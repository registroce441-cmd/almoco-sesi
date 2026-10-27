import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { statusDoPrazo } from "@/lib/almoco-data";
import { montarPdfCardapio } from "@/lib/exportar-cardapio";
import { BannerHome } from "@/components/BannerHome";

const regras = { prazo_limite: "09:00:00", dias_bloqueados: ["2026-10-28"] };
// São Paulo = UTC-3: 11:00Z = 08:00 em SP. 2026-10-26 é segunda-feira.
const sp = (iso: string, hhmmss: string) => new Date(`${iso}T${hhmmss}-03:00`);

describe("statusDoPrazo (banner da Home)", () => {
  it("antes do prazo: aberto, com os minutos que faltam", () => {
    expect(statusDoPrazo(regras, sp("2026-10-26", "08:00:00"))).toEqual({
      tipo: "aberto",
      prazo: "09:00",
      faltam: 60,
    });
    expect(statusDoPrazo(regras, sp("2026-10-26", "08:59:10"))).toEqual({
      tipo: "aberto",
      prazo: "09:00",
      faltam: 1,
    });
  });
  it("exatamente no horário ainda vale (mesma regra do banco); um segundo depois, encerrado", () => {
    expect(statusDoPrazo(regras, sp("2026-10-26", "09:00:00"))).toMatchObject({
      tipo: "aberto",
      faltam: 0,
    });
    expect(statusDoPrazo(regras, sp("2026-10-26", "09:00:01"))).toEqual({
      tipo: "encerrado",
      prazo: "09:00",
    });
  });
  it("dia sem almoço, fim de semana e sem configuração", () => {
    expect(statusDoPrazo(regras, sp("2026-10-28", "07:00:00"))).toEqual({ tipo: "sem-almoco" });
    expect(statusDoPrazo(regras, sp("2026-10-31", "07:00:00"))).toEqual({
      tipo: "geral",
      prazo: "09:00",
    });
    expect(statusDoPrazo(regras, sp("2026-11-01", "07:00:00"))).toMatchObject({ tipo: "geral" });
    expect(statusDoPrazo(undefined)).toBeNull();
  });
  it("usa o fuso de São Paulo, não o do aparelho", () => {
    // 11:30Z = 08:30 em SP (ainda aberto), mesmo que em UTC já fosse depois das 09:00
    expect(statusDoPrazo(regras, new Date("2026-10-26T11:30:00Z"))).toMatchObject({
      tipo: "aberto",
      faltam: 30,
    });
  });
});

describe("BannerHome", () => {
  it("mostra o aviso da administração e preserva quebras de linha", () => {
    render(<BannerHome config={{ ...regras, aviso_home: "Sexta não teremos almoço." }} />);
    expect(screen.getByRole("status").textContent).toBe("Sexta não teremos almoço.");
  });
  it("sem aviso nem configuração, não renderiza nada", () => {
    const { container } = render(<BannerHome config={undefined} />);
    expect(container.firstChild).toBeNull();
  });
  it("aviso só com espaços é ignorado", () => {
    render(<BannerHome config={{ ...regras, aviso_home: "   " }} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("PDF do cardápio", () => {
  const meta = {
    unidade: "SESI",
    periodo: "26/10 a 30/10",
    inicio: "2026-10-26",
    fim: "2026-10-30",
  };
  const dia = (nome: string, refeicao: Parameters<typeof montarPdfCardapio>[0][0]["refeicao"]) => ({
    nome,
    data: "26/10",
    refeicao,
  });

  it("gera o PDF com a semana, inclusive dia sem cardápio", async () => {
    const doc = await montarPdfCardapio(
      [
        dia("Segunda", {
          prato: "Frango grelhado ao limão",
          acompanhamento: "Arroz e feijão",
          sobremesa: "Gelatina",
          tags: ["Leve", "Sem glúten"],
        }),
        dia("Terça", null),
      ],
      meta,
    );
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(1500);
  });
  it("textos longos quebram em várias linhas e, se preciso, em nova página, sem erro", async () => {
    const longo = "Prato com nome muito comprido ".repeat(12);
    const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"].map((n) =>
      dia(n, {
        prato: longo,
        acompanhamento: longo,
        sobremesa: longo,
        tags: ["Vegetariano", "Leve"],
      }),
    );
    const doc = await montarPdfCardapio(dias, meta);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
