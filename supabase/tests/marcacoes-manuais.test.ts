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

const marcar = (t: Tx, quem: Parameters<Tx["q"]>[0], pessoa: string, marcas: unknown, motivo?: string | null) =>
  t.q<{ r: { ok: boolean; alteradas: number } }>(
    quem,
    "select public.admin_salvar_marcacoes($1, $2::jsonb, $3) as r",
    [pessoa, JSON.stringify(marcas), motivo ?? null],
  );

/** Uma segunda-feira que JÁ PASSOU (o público não consegue mais marcar nela). */
async function diaPassado(t: Tx) {
  return segundaRelativa(await t.hoje(), -2);
}

describe("admin_salvar_marcacoes", () => {
  it("o admin marca um dia que já passou e o log guarda o motivo", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = await diaPassado(t);

      const r = await marcar(t, adm, ana, [{ data: dia, vai: true }], "  Esqueceu   de marcar ");
      expect(r.rows[0]?.r).toEqual({ ok: true, alteradas: 1 });

      const m = await t.q(DONO, "select vai_almocar from public.marcacoes where pessoa_id = $1 and data = $2", [ana, dia]);
      expect(m.rows).toEqual([{ vai_almocar: true }]);

      const log = await t.q(DONO, "select anterior, novo, motivo, admin_id, data::text as data from public.marcacoes_manuais");
      expect(log.rows).toEqual([
        { anterior: null, novo: true, motivo: "Esqueceu de marcar", admin_id: (adm as { sub: string }).sub, data: dia },
      ]);
    });
  });

  it("o público continua sem conseguir marcar esse mesmo dia (o prazo vale para ele)", async () => {
    await banco.tx(async (t) => {
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = await diaPassado(t);
      await expect(
        t.q(ANON, "select public.salvar_marcacoes($1, $2::jsonb)", [ana, JSON.stringify([{ data: dia, vai: true }])]),
      ).rejects.toMatchObject({ message: "Esse dia já passou." });
    });
  });

  it("muda de 'vai' para 'não vai' e registra de/para", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = await diaPassado(t);
      await marcar(t, adm, ana, [{ data: dia, vai: true }]);
      const r = await marcar(t, adm, ana, [{ data: dia, vai: false }], "Atestado");
      expect(r.rows[0]?.r.alteradas).toBe(1);

      const log = await t.q(DONO, "select anterior, novo, motivo from public.marcacoes_manuais order by criado_em, id");
      expect(log.rows).toEqual([
        { anterior: null, novo: true, motivo: null },
        { anterior: true, novo: false, motivo: "Atestado" },
      ]);
    });
  });

  it("vai: null tira a marcação (volta a 'sem marcação') e registra", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = await diaPassado(t);
      await marcar(t, adm, ana, [{ data: dia, vai: false }]);
      await marcar(t, adm, ana, [{ data: dia, vai: null }], "Marcou sem querer");

      const n = await t.valor<number>(DONO, "select count(*)::int from public.marcacoes where pessoa_id = $1", [ana]);
      expect(n).toBe(0);
      const ultimo = await t.q(DONO, "select anterior, novo from public.marcacoes_manuais order by criado_em desc, id limit 1");
      expect(ultimo.rows).toEqual([{ anterior: false, novo: null }]);
    });
  });

  it("não registra nada quando o valor não muda", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = await diaPassado(t);
      await marcar(t, adm, ana, [{ data: dia, vai: true }]);
      const repetido = await marcar(t, adm, ana, [{ data: dia, vai: true }], "tanto faz");
      expect(repetido.rows[0]?.r.alteradas).toBe(0);
      // 'sem marcação' -> 'sem marcação' também não conta
      const outro = await marcar(t, adm, ana, [{ data: somarDias(dia, 1), vai: null }]);
      expect(outro.rows[0]?.r.alteradas).toBe(0);

      const n = await t.valor<number>(DONO, "select count(*)::int from public.marcacoes_manuais");
      expect(n).toBe(1);
    });
  });

  it("salva a semana toda de uma vez, com um único motivo", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const seg = await diaPassado(t);
      const semana = [0, 1, 2, 3, 4].map((i) => ({ data: somarDias(seg, i), vai: i % 2 === 0 }));
      const r = await marcar(t, adm, ana, semana, "Planilha em papel da portaria");
      expect(r.rows[0]?.r.alteradas).toBe(5);

      const motivos = await t.q(DONO, "select distinct motivo from public.marcacoes_manuais");
      expect(motivos.rows).toEqual([{ motivo: "Planilha em papel da portaria" }]);
      const totais = await t.q(DONO, "select count(*) filter (where vai_almocar)::int as vai, count(*)::int as todas from public.marcacoes where pessoa_id = $1", [ana]);
      expect(totais.rows).toEqual([{ vai: 3, todas: 5 }]);
    });
  });

  it("motivo em branco vira vazio; motivo com mais de 200 caracteres é recusado", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = await diaPassado(t);
      await marcar(t, adm, ana, [{ data: dia, vai: true }], "   ");
      expect(await t.valor(DONO, "select motivo from public.marcacoes_manuais")).toBeNull();

      await expect(marcar(t, adm, ana, [{ data: dia, vai: false }], "x".repeat(201))).rejects.toMatchObject({
        message: "O motivo pode ter no máximo 200 caracteres.",
      });
      await marcar(t, adm, ana, [{ data: dia, vai: false }], "x".repeat(200)); // no limite, passa
    });
  });

  it("é tudo ou nada: um dia inválido desfaz os outros", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const seg = await diaPassado(t);
      const sabado = somarDias(seg, 5);
      await expect(
        marcar(t, adm, ana, [
          { data: seg, vai: true },
          { data: sabado, vai: true },
        ]),
      ).rejects.toMatchObject({ message: "Esse dia não tem almoço (fim de semana)." });

      expect(await t.valor<number>(DONO, "select count(*)::int from public.marcacoes")).toBe(0);
      expect(await t.valor<number>(DONO, "select count(*)::int from public.marcacoes_manuais")).toBe(0);
    });
  });

  it("recusa dados malformados com mensagem clara", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = await diaPassado(t);
      const invalido = { message: "Dados inválidos." };
      await expect(marcar(t, adm, ana, { data: dia, vai: true })).rejects.toMatchObject(invalido); // não é lista
      await expect(marcar(t, adm, ana, [])).rejects.toMatchObject(invalido); // lista vazia
      await expect(marcar(t, adm, ana, [{ data: dia }])).rejects.toMatchObject(invalido); // sem "vai"
      await expect(marcar(t, adm, ana, [{ data: dia, vai: "true" }])).rejects.toMatchObject(invalido); // texto, não booleano
      await expect(marcar(t, adm, ana, [{ vai: true }])).rejects.toMatchObject(invalido); // sem data
      await expect(marcar(t, adm, ana, [{ data: null, vai: true }])).rejects.toMatchObject(invalido);
      await expect(marcar(t, adm, ana, Array.from({ length: 32 }, () => ({ data: dia, vai: true })))).rejects.toMatchObject(invalido);
    });
  });

  it("recusa pessoa inexistente ou inativa", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const inativa = await t.criarPessoa("Bia Inativa", "9002", false);
      const dia = await diaPassado(t);
      const msg = { message: "Pessoa não encontrada ou inativa." };
      await expect(marcar(t, adm, inativa, [{ data: dia, vai: true }])).rejects.toMatchObject(msg);
      await expect(marcar(t, adm, "00000000-0000-0000-0000-000000000000", [{ data: dia, vai: true }])).rejects.toMatchObject(msg);
    });
  });

  it("quem não é admin não consegue: nem o público, nem um usuário logado comum", async () => {
    await banco.tx(async (t) => {
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = await diaPassado(t);
      const comum = await t.criarUsuario(); // logado, mas fora da tabela admins

      await expect(marcar(t, ANON, ana, [{ data: dia, vai: true }])).rejects.toMatchObject({ code: "42501" }); // sem permissão para executar
      await expect(marcar(t, comum, ana, [{ data: dia, vai: true }])).rejects.toMatchObject({
        code: "42501",
        message: "Somente o administrador pode fazer isso.",
      });
      expect(await t.valor<number>(DONO, "select count(*)::int from public.marcacoes")).toBe(0);
    });
  });

  it("as marcações feitas pelo admin entram nos totais públicos", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const bia = await t.criarPessoa("Bia Lima", "9002");
      const seg = await diaPassado(t);
      await marcar(t, adm, ana, [{ data: seg, vai: true }]);
      await marcar(t, adm, bia, [{ data: seg, vai: true }]);
      const totais = await t.q<{ data: string; total: number }>(ANON, "select data::text, total from public.totais_por_dia($1)", [seg]);
      expect(totais.rows[0]).toEqual({ data: seg, total: 2 });
    });
  });
});

describe("marcacoes_manuais (o log) é só do admin e só cresce", () => {
  it("o público e usuários comuns não leem; o admin lê", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const comum = await t.criarUsuario();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      await marcar(t, adm, ana, [{ data: await diaPassado(t), vai: true }], "motivo secreto");

      await expect(t.q(ANON, "select * from public.marcacoes_manuais")).rejects.toMatchObject({ code: "42501" });
      const doComum = await t.q(comum, "select * from public.marcacoes_manuais");
      expect(doComum.rows).toHaveLength(0); // RLS esconde tudo
      const doAdmin = await t.q(adm, "select motivo from public.marcacoes_manuais");
      expect(doAdmin.rows).toEqual([{ motivo: "motivo secreto" }]);
    });
  });

  it("ninguém grava direto no log pelo app: nem usuário comum, nem anon", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = await diaPassado(t);
      const ins = "insert into public.marcacoes_manuais (pessoa_id, data, anterior, novo) values ($1, $2, null, true)";
      await expect(t.q(ANON, ins, [ana, dia])).rejects.toMatchObject({ code: "42501" });
      await expect(t.q(comum, ins, [ana, dia])).rejects.toMatchObject({ code: "42501" }); // viola a policy de RLS
    });
  });

  it("nem o admin consegue editar ou apagar o histórico", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      await marcar(t, adm, ana, [{ data: await diaPassado(t), vai: true }], "original");
      await expect(t.q(adm, "update public.marcacoes_manuais set motivo = 'adulterado'")).rejects.toMatchObject({ code: "42501" });
      await expect(t.q(adm, "delete from public.marcacoes_manuais")).rejects.toMatchObject({ code: "42501" });
      expect(await t.valor(DONO, "select motivo from public.marcacoes_manuais")).toBe("original");
    });
  });

  it("o log some junto quando a pessoa é excluída (sem registros órfãos)", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      await marcar(t, adm, ana, [{ data: await diaPassado(t), vai: true }]);
      await t.q(DONO, "delete from public.pessoas where id = $1", [ana]);
      expect(await t.valor<number>(DONO, "select count(*)::int from public.marcacoes_manuais")).toBe(0);
    });
  });
});
