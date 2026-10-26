import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, DONO, criarBancoDeTeste, type BancoDeTeste, type Tx } from "./helpers";

let banco: BancoDeTeste;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco?.destruir();
});

interface Resultado {
  ok: boolean;
  inseridas: number;
  vazias: number;
  rejeitadas: { linha: number; nome: string; nif: string; motivo: string }[];
}

const importar = async (t: Tx, quem: Parameters<Tx["q"]>[0], linhas: unknown) =>
  (
    await t.q<{ r: Resultado }>(quem, "select public.admin_importar_pessoas($1::jsonb) as r", [
      JSON.stringify(linhas),
    ])
  ).rows[0]!.r;

describe("admin_importar_pessoas", () => {
  it("importa as linhas válidas no grupo único 'Colaboradores', ativas", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const r = await importar(t, adm, [
        { linha: 2, nome: "Ana Paula Souza", nif: "1040210" },
        { linha: 3, nome: "Bruno Lima", nif: "1040247" },
      ]);
      expect(r).toEqual({ ok: true, inseridas: 2, vazias: 0, rejeitadas: [] });

      const ps = await t.q(
        DONO,
        "select p.nome, p.nif, p.ativo, g.nome as grupo from public.pessoas p join public.grupos g on g.id = p.grupo_id order by p.nif",
      );
      expect(ps.rows).toEqual([
        { nome: "Ana Paula Souza", nif: "1040210", ativo: true, grupo: "Colaboradores" },
        { nome: "Bruno Lima", nif: "1040247", ativo: true, grupo: "Colaboradores" },
      ]);
    });
  });

  it("limpa espaços sobrando (inclusive o espaço 'duro' do Excel) no nome e no NIF", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const r = await importar(t, adm, [
        { linha: 2, nome: "  Carla\u00a0\u00a0 Mendes  ", nif: " 1040284\u00a0" },
        { linha: 3, nome: "Daniel\t Ferreira", nif: "1040321\n" },
      ]);
      expect(r.inseridas).toBe(2);
      const ps = await t.q(DONO, "select nome, nif from public.pessoas order by nif");
      expect(ps.rows).toEqual([
        { nome: "Carla Mendes", nif: "1040284" },
        { nome: "Daniel Ferreira", nif: "1040321" },
      ]);
    });
  });

  it("linhas totalmente vazias são ignoradas (e contadas), sem virar erro", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const r = await importar(t, adm, [
        { linha: 2, nome: "", nif: "" },
        { linha: 3, nome: "   ", nif: "\u00a0" },
        { linha: 4, nome: "Eduarda Rocha", nif: "1040358" },
      ]);
      expect(r).toEqual({ ok: true, inseridas: 1, vazias: 2, rejeitadas: [] });
    });
  });

  it("rejeita NIF ausente, nome ausente, NIF com espaço e textos grandes demais — só essas linhas", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const r = await importar(t, adm, [
        { linha: 2, nome: "Sem Nif", nif: "" },
        { linha: 3, nome: "", nif: "777" },
        { linha: 4, nome: "Nif Com Espaço", nif: "10 20" },
        { linha: 5, nome: "Nome Enorme " + "x".repeat(120), nif: "888" },
        { linha: 6, nome: "Nif Enorme", nif: "9".repeat(31) },
        { linha: 7, nome: "Fábio Martins", nif: "1040395" },
      ]);
      expect(r.inseridas).toBe(1);
      expect(r.rejeitadas.map((x) => [x.linha, x.motivo])).toEqual([
        [2, "NIF ausente"],
        [3, "Nome ausente"],
        [4, "NIF não pode ter espaços"],
        [5, "Nome muito longo (máximo 120 caracteres)"],
        [6, "NIF muito longo (máximo 30 caracteres)"],
      ]);
      expect(await t.valor<number>(DONO, "select count(*)::int from public.pessoas")).toBe(1);
    });
  });

  it("NIF que já existe no banco é rejeitado e NÃO altera quem já estava cadastrado", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await t.criarPessoa("Gabriela Nunes", "1040432");
      await t.criarPessoa("Helena Carvalho (inativa)", "1040469", false); // inativa também ocupa o NIF
      const r = await importar(t, adm, [
        { linha: 2, nome: "Outra Pessoa", nif: "1040432" },
        { linha: 3, nome: "Mais Uma", nif: "1040469" },
        { linha: 4, nome: "Igor Santos", nif: "1040506" },
      ]);
      expect(r.inseridas).toBe(1);
      expect(r.rejeitadas.map((x) => [x.linha, x.motivo])).toEqual([
        [2, "NIF já cadastrado"],
        [3, "NIF já cadastrado"],
      ]);
      const nome = await t.valor(DONO, "select nome from public.pessoas where nif = '1040432'");
      expect(nome).toBe("Gabriela Nunes");
    });
  });

  it("NIF repetido dentro da planilha: a primeira entra, as repetidas são rejeitadas", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const r = await importar(t, adm, [
        { linha: 2, nome: "Juliana Alves", nif: "1040543" },
        { linha: 3, nome: "Juliana A.", nif: "1040543" },
        { linha: 4, nome: "Leonardo Costa", nif: "1040580" },
        { linha: 5, nome: "Juliana Alves", nif: " 1040543 " },
      ]);
      expect(r.inseridas).toBe(2);
      expect(r.rejeitadas.map((x) => [x.linha, x.motivo])).toEqual([
        [3, "NIF repetido na planilha"],
        [5, "NIF repetido na planilha"],
      ]);
      expect(await t.valor(DONO, "select nome from public.pessoas where nif = '1040543'")).toBe("Juliana Alves");
    });
  });

  it("se a linha não traz número, usa a posição na lista", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const r = await importar(t, adm, [{ nome: "Sem Nif", nif: "" }]);
      expect(r.rejeitadas[0]?.linha).toBe(1);
    });
  });

  it("aceita NIF alfanumérico e mantém zeros à esquerda", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await importar(t, adm, [
        { linha: 2, nome: "Marina Oliveira", nif: "0012345" },
        { linha: 3, nome: "Natália Ribeiro", nif: "AB-77" },
      ]);
      const nifs = await t.q(DONO, "select nif from public.pessoas order by nif");
      expect(nifs.rows.map((x) => x.nif)).toEqual(["0012345", "AB-77"]);
    });
  });

  it("recusa mais de 2000 linhas e dados que não são uma lista", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const muitas = Array.from({ length: 2001 }, (_, i) => ({ linha: i + 2, nome: `P ${i}`, nif: `${i}` }));
      await expect(importar(t, adm, muitas)).rejects.toMatchObject({ message: "Importe no máximo 2000 pessoas por vez." });
      await expect(importar(t, adm, { nome: "x", nif: "1" })).rejects.toMatchObject({ message: "Dados inválidos." });
      expect(await t.valor<number>(DONO, "select count(*)::int from public.pessoas")).toBe(0);
    });
  });

  it("aguenta 2000 linhas de uma vez, em poucos segundos", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const linhas = Array.from({ length: 2000 }, (_, i) => ({ linha: i + 2, nome: `Pessoa ${i}`, nif: `${5000000 + i}` }));
      const ini = Date.now();
      const r = await importar(t, adm, linhas);
      expect(r.inseridas).toBe(2000);
      expect(Date.now() - ini).toBeLessThan(10_000);
    });
  });

  it("só o admin importa: público e usuário comum são barrados e nada é gravado", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      const lote = [{ linha: 2, nome: "Intruso", nif: "666" }];
      await expect(importar(t, ANON, lote)).rejects.toMatchObject({ code: "42501" });
      await expect(importar(t, comum, lote)).rejects.toMatchObject({ code: "42501", message: "Somente o administrador pode fazer isso." });
      expect(await t.valor<number>(DONO, "select count(*)::int from public.pessoas")).toBe(0);
    });
  });

  it("quem foi importado já aparece na busca pública, com o NIF mascarado", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await importar(t, adm, [{ linha: 2, nome: "Patrícia Gomes", nif: "1040728" }]);
      const busca = await t.q(ANON, "select nome, nif_mascarado from public.buscar_pessoas('patricia')");
      expect(busca.rows).toEqual([{ nome: "Patrícia Gomes", nif_mascarado: "***728" }]);
    });
  });

  it("o público continua sem ler a tabela de pessoas", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await importar(t, adm, [{ linha: 2, nome: "Rafael Barbosa", nif: "1040765" }]);
      await expect(t.q(ANON, "select * from public.pessoas")).rejects.toMatchObject({ code: "42501" });
    });
  });
});

describe("cadastro direto de pessoas pelo admin (usado pela tela Pessoas)", () => {
  it("o admin cria, edita e desativa; o grupo vem sozinho", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const id = await t.valor<string>(adm, "insert into public.pessoas (nome, nif) values ('Sandra Dias', '1040802') returning id");
      await t.q(adm, "update public.pessoas set nome = 'Sandra M. Dias' where id = $1", [id]);
      await t.q(adm, "update public.pessoas set ativo = false where id = $1", [id]);
      const p = await t.q(DONO, "select nome, ativo, grupo_id is not null as tem_grupo from public.pessoas where id = $1", [id]);
      expect(p.rows).toEqual([{ nome: "Sandra M. Dias", ativo: false, tem_grupo: true }]);
    });
  });

  it("NIF repetido dá erro 23505 na constraint pessoas_nif_key (a tela usa isso para avisar)", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await t.criarPessoa("Thiago Araújo", "1040839");
      await expect(t.q(adm, "insert into public.pessoas (nome, nif) values ('Outro', '1040839')")).rejects.toMatchObject({
        code: "23505",
        constraint: "pessoas_nif_key",
      });
    });
  });

  it("NIF vazio ou com espaço nas pontas é recusado pelo banco (23514)", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await expect(t.q(adm, "insert into public.pessoas (nome, nif) values ('X', '')")).rejects.toMatchObject({ code: "23514" });
      await expect(t.q(adm, "insert into public.pessoas (nome, nif) values ('X', ' 123')")).rejects.toMatchObject({ code: "23514" });
    });
  });

  it("usuário comum e público não conseguem cadastrar", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      const ins = "insert into public.pessoas (nome, nif) values ('Intruso', '666')";
      await expect(t.q(ANON, ins)).rejects.toMatchObject({ code: "42501" });
      await expect(t.q(comum, ins)).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("o admin enxerga também as pessoas inativas (o público não)", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await t.criarPessoa("Ativa", "1");
      await t.criarPessoa("Inativa", "2", false);
      expect((await t.q(adm, "select 1 from public.pessoas")).rows).toHaveLength(2);
      expect((await t.q(ANON, "select * from public.buscar_pessoas('inativa')")).rows).toHaveLength(0);
    });
  });
});
