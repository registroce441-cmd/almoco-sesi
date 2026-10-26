import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ANON,
  DONO,
  criarBancoDeTeste,
  segundaRelativa,
  somarDias,
  type BancoDeTeste,
  type Tx,
} from "./helpers";

let banco: BancoDeTeste;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco?.destruir();
});

interface Duplicacao {
  ok: boolean;
  copiados: number;
  mantidos: number;
  origem_vazia: boolean;
}

const duplicar = async (t: Tx, quem: Parameters<Tx["q"]>[0], origem: string, destino: string, substituir?: boolean) =>
  (
    await t.q<{ r: Duplicacao }>(quem, "select public.admin_duplicar_cardapio($1, $2, $3) as r", [
      origem,
      destino,
      substituir ?? null,
    ])
  ).rows[0]!.r;

/** Cadastra o dia como o dono do banco e devolve o id. */
const prato = (t: Tx, data: string, nome: string, extra: { acomp?: string; sobr?: string; tags?: string[]; foto?: string } = {}) =>
  t.q(
    DONO,
    "insert into public.cardapio (data, prato, acompanhamento, sobremesa, tags, foto_url) values ($1, $2, $3, $4, $5, $6)",
    [data, nome, extra.acomp ?? "", extra.sobr ?? "", extra.tags ?? [], extra.foto ?? null],
  );

describe("admin_duplicar_cardapio", () => {
  it("copia segunda a sexta para a semana de destino, sem a foto", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const hoje = await t.hoje();
      const origem = segundaRelativa(hoje, 0);
      const destino = segundaRelativa(hoje, 1);
      await prato(t, origem, "Frango grelhado", { acomp: "Arroz e feijão", sobr: "Gelatina", tags: ["Leve"], foto: "https://x/frango.jpg" });
      await prato(t, somarDias(origem, 1), "Strogonoff", { tags: [] });
      await prato(t, somarDias(origem, 4), "Peixe assado", { tags: ["Sem glúten", "Sem lactose"] });

      const r = await duplicar(t, adm, origem, destino);
      expect(r).toEqual({ ok: true, copiados: 3, mantidos: 0, origem_vazia: false });

      const novos = await t.q(
        DONO,
        "select data::text, prato, acompanhamento, sobremesa, tags, foto_url from public.cardapio where data >= $1 order by data",
        [destino],
      );
      expect(novos.rows).toEqual([
        { data: destino, prato: "Frango grelhado", acompanhamento: "Arroz e feijão", sobremesa: "Gelatina", tags: ["Leve"], foto_url: null },
        { data: somarDias(destino, 1), prato: "Strogonoff", acompanhamento: "", sobremesa: "", tags: [], foto_url: null },
        { data: somarDias(destino, 4), prato: "Peixe assado", acompanhamento: "", sobremesa: "", tags: ["Sem glúten", "Sem lactose"], foto_url: null },
      ]);
      // a semana de origem continua intacta, com a foto
      expect(await t.valor(DONO, "select foto_url from public.cardapio where data = $1", [origem])).toBe("https://x/frango.jpg");
    });
  });

  it("por padrão só preenche os dias vazios e preserva o que já estava no destino", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const hoje = await t.hoje();
      const origem = segundaRelativa(hoje, 0);
      const destino = segundaRelativa(hoje, 1);
      await prato(t, origem, "Origem seg");
      await prato(t, somarDias(origem, 1), "Origem ter");
      await prato(t, destino, "Destino seg (já existia)", { foto: "https://x/destino.jpg" });

      const r = await duplicar(t, adm, origem, destino);
      expect(r).toEqual({ ok: true, copiados: 1, mantidos: 1, origem_vazia: false });
      const seg = await t.q(DONO, "select prato, foto_url from public.cardapio where data = $1", [destino]);
      expect(seg.rows).toEqual([{ prato: "Destino seg (já existia)", foto_url: "https://x/destino.jpg" }]);
      expect(await t.valor(DONO, "select prato from public.cardapio where data = $1", [somarDias(destino, 1)])).toBe("Origem ter");
    });
  });

  it("com substituir = true troca os dias já preenchidos (e limpa a foto antiga) mas não mexe nos outros dias", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const hoje = await t.hoje();
      const origem = segundaRelativa(hoje, 0);
      const destino = segundaRelativa(hoje, 1);
      await prato(t, origem, "Origem seg");
      await prato(t, destino, "Destino seg", { foto: "https://x/velha.jpg" });
      await prato(t, somarDias(destino, 3), "Destino qui (sem par na origem)");

      const r = await duplicar(t, adm, origem, destino, true);
      expect(r).toEqual({ ok: true, copiados: 1, mantidos: 0, origem_vazia: false });
      const seg = await t.q(DONO, "select prato, foto_url from public.cardapio where data = $1", [destino]);
      expect(seg.rows).toEqual([{ prato: "Origem seg", foto_url: null }]);
      expect(await t.valor(DONO, "select prato from public.cardapio where data = $1", [somarDias(destino, 3)])).toBe("Destino qui (sem par na origem)");
    });
  });

  it("origem sem cardápio não copia nada e avisa", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const hoje = await t.hoje();
      const r = await duplicar(t, adm, segundaRelativa(hoje, -3), segundaRelativa(hoje, 1));
      expect(r).toEqual({ ok: true, copiados: 0, mantidos: 0, origem_vazia: true });
    });
  });

  it("duplicar duas vezes seguidas não cria nada novo na segunda vez", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const hoje = await t.hoje();
      const origem = segundaRelativa(hoje, 0);
      const destino = segundaRelativa(hoje, 1);
      await prato(t, origem, "A");
      await prato(t, somarDias(origem, 2), "B");
      expect((await duplicar(t, adm, origem, destino)).copiados).toBe(2);
      expect(await duplicar(t, adm, origem, destino)).toEqual({ ok: true, copiados: 0, mantidos: 2, origem_vazia: false });
    });
  });

  it("recusa datas que não são segunda-feira e semana igual à de origem", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const seg = segundaRelativa(await t.hoje(), 0);
      const msgSegunda = { message: "As semanas precisam começar na segunda-feira." };
      await expect(duplicar(t, adm, somarDias(seg, 1), segundaRelativa(seg, 1))).rejects.toMatchObject(msgSegunda);
      await expect(duplicar(t, adm, seg, somarDias(seg, 8))).rejects.toMatchObject(msgSegunda);
      await expect(
        t.q(adm, "select public.admin_duplicar_cardapio(null, $1)", [seg]),
      ).rejects.toMatchObject(msgSegunda);
      await expect(duplicar(t, adm, seg, seg)).rejects.toMatchObject({
        message: "Escolha uma semana diferente da que será copiada.",
      });
    });
  });

  it("só o admin duplica", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      const seg = segundaRelativa(await t.hoje(), 0);
      await prato(t, seg, "A");
      await expect(duplicar(t, ANON, seg, somarDias(seg, 7))).rejects.toMatchObject({ code: "42501" });
      await expect(duplicar(t, comum, seg, somarDias(seg, 7))).rejects.toMatchObject({
        code: "42501",
        message: "Somente o administrador pode fazer isso.",
      });
      expect(await t.valor<number>(DONO, "select count(*)::int from public.cardapio")).toBe(1);
    });
  });

  it("o cardápio copiado já é visível para o público", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const seg = segundaRelativa(await t.hoje(), 0);
      await prato(t, seg, "Lasanha");
      await duplicar(t, adm, seg, somarDias(seg, 7));
      const r = await t.q(ANON, "select prato from public.cardapio where data = $1", [somarDias(seg, 7)]);
      expect(r.rows).toEqual([{ prato: "Lasanha" }]);
    });
  });
});

describe("editor semanal: o admin grava direto na tabela cardapio", () => {
  it("cria e atualiza o dia com um único upsert por data", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const seg = segundaRelativa(await t.hoje(), 1);
      const upsert =
        "insert into public.cardapio (data, prato, acompanhamento, sobremesa, tags, foto_url) values ($1, $2, $3, '', $4, $5) " +
        "on conflict (data) do update set prato = excluded.prato, acompanhamento = excluded.acompanhamento, tags = excluded.tags, foto_url = excluded.foto_url";
      await t.q(adm, upsert, [seg, "Feijoada", "Arroz", ["Sem lactose"], null]);
      await t.q(adm, upsert, [seg, "Feijoada light", "Arroz e couve", [], "https://x/f.jpg"]);
      const r = await t.q(DONO, "select count(*) over ()::int as n, prato, acompanhamento, tags, foto_url from public.cardapio");
      expect(r.rows).toEqual([{ n: 1, prato: "Feijoada light", acompanhamento: "Arroz e couve", tags: [], foto_url: "https://x/f.jpg" }]);
    });
  });

  it("apaga um dia", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const seg = segundaRelativa(await t.hoje(), 1);
      await prato(t, seg, "Qualquer");
      await t.q(adm, "delete from public.cardapio where data = $1", [seg]);
      expect(await t.valor<number>(DONO, "select count(*)::int from public.cardapio")).toBe(0);
    });
  });

  it("recusa prato vazio e fim de semana", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const seg = segundaRelativa(await t.hoje(), 1);
      await expect(t.q(adm, "insert into public.cardapio (data, prato) values ($1, '   ')", [seg])).rejects.toMatchObject({ code: "23514" });
      await expect(t.q(adm, "insert into public.cardapio (data, prato) values ($1, 'Sábado')", [somarDias(seg, 5)])).rejects.toMatchObject({ code: "23514" });
    });
  });

  it("público e usuário comum leem, mas não escrevem", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      const seg = segundaRelativa(await t.hoje(), 1);
      await prato(t, seg, "Visível");
      expect((await t.q(ANON, "select prato from public.cardapio")).rows).toEqual([{ prato: "Visível" }]);
      const ins = "insert into public.cardapio (data, prato) values ($1, 'Intruso')";
      await expect(t.q(ANON, ins, [somarDias(seg, 1)])).rejects.toMatchObject({ code: "42501" });
      await expect(t.q(comum, ins, [somarDias(seg, 1)])).rejects.toMatchObject({ code: "42501" });
      // update/delete por um usuário comum não afeta nenhuma linha (a RLS esconde)
      expect((await t.q(comum, "update public.cardapio set prato = 'Hackeado'")).rowCount).toBe(0);
      expect((await t.q(comum, "delete from public.cardapio")).rowCount).toBe(0);
      expect(await t.valor(DONO, "select prato from public.cardapio")).toBe("Visível");
    });
  });
});

describe("Storage: bucket cardapio-fotos (policies; o Storage de verdade está no checklist)", () => {
  const novoObjeto = "insert into storage.objects (bucket_id, name) values ($1, $2)";

  it("o bucket é público para leitura, limitado a 2 MB e só a imagens", async () => {
    await banco.tx(async (t) => {
      const b = await t.q(DONO, "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'cardapio-fotos'");
      expect(b.rows).toEqual([{ public: true, file_size_limit: "2097152", allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }]);
    });
  });

  it("o admin envia, lê e apaga fotos", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await t.q(adm, novoObjeto, ["cardapio-fotos", "2026-10-26/a.jpg"]);
      expect((await t.q(adm, "select name from storage.objects")).rows).toEqual([{ name: "2026-10-26/a.jpg" }]);
      expect((await t.q(adm, "delete from storage.objects where name = '2026-10-26/a.jpg'")).rowCount).toBe(1);
    });
  });

  it("público e usuário comum não conseguem enviar", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      await expect(t.q(ANON, novoObjeto, ["cardapio-fotos", "x.jpg"])).rejects.toMatchObject({ code: "42501" });
      await expect(t.q(comum, novoObjeto, ["cardapio-fotos", "x.jpg"])).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("usuário comum não apaga nem lista as fotos", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      await t.q(DONO, novoObjeto, ["cardapio-fotos", "y.jpg"]);
      expect((await t.q(comum, "delete from storage.objects")).rowCount).toBe(0);
      expect((await t.q(comum, "select * from storage.objects")).rows).toHaveLength(0);
      expect((await t.q(ANON, "select * from storage.objects")).rows).toHaveLength(0);
    });
  });

  it("a permissão do admin vale só para este bucket", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await t.q(DONO, "insert into storage.buckets (id, name) values ('outro', 'outro')");
      await expect(t.q(adm, novoObjeto, ["outro", "z.jpg"])).rejects.toMatchObject({ code: "42501" });
    });
  });
});
