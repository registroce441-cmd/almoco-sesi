import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ANON,
  DONO,
  arquivosDeMigration,
  criarBancoDeTeste,
  lerSql,
  segundaRelativa,
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

const definir = (t: Tx, quem: Parameters<Tx["q"]>[0], codigo: string) =>
  t.q(quem, "select public.definir_codigo_cozinha($1)", [codigo]);
const acesso = async (t: Tx, codigo: string | null) =>
  (await t.q<{ r: { ok: boolean; motivo?: string } }>(ANON, "select public.lista_cozinha(public.hoje_sp(), $1) as r", [codigo])).rows[0]!.r;

describe("definir_codigo_cozinha (tela Configurações) e admin_status_codigo_cozinha", () => {
  it("antes de definir, o status diz que não está configurado", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const r = await t.valor(adm, "select public.admin_status_codigo_cozinha()");
      expect(r).toEqual({ configurado: false, atualizado_em: null });
      expect((await acesso(t, "qualquer-um")).motivo).toBe("nao_configurado");
    });
  });

  it("o admin define o código e a cozinha entra com ele", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await definir(t, adm, "panela-quente-26");
      const st = await t.valor<{ configurado: boolean; atualizado_em: string }>(adm, "select public.admin_status_codigo_cozinha()");
      expect(st.configurado).toBe(true);
      expect(Date.now() - new Date(st.atualizado_em).getTime()).toBeLessThan(60_000);

      expect((await acesso(t, "panela-quente-26")).ok).toBe(true);
      expect(await acesso(t, "errado")).toEqual({ ok: false, motivo: "invalido" });
      expect(await acesso(t, null)).toEqual({ ok: false, motivo: "codigo_necessario" });
    });
  });

  it("trocar o código invalida o antigo na hora", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await definir(t, adm, "codigo-antigo");
      await definir(t, adm, "codigo-novo-2");
      expect(await acesso(t, "codigo-antigo")).toEqual({ ok: false, motivo: "invalido" });
      expect((await acesso(t, "codigo-novo-2")).ok).toBe(true);
    });
  });

  it("espaços nas pontas são ignorados; menos de 6 caracteres é recusado", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await definir(t, adm, "   abcdef   ");
      expect((await acesso(t, "abcdef")).ok).toBe(true);
      const curto = { message: "O código da cozinha precisa ter pelo menos 6 caracteres." };
      await expect(definir(t, adm, "12345")).rejects.toMatchObject(curto);
      await expect(definir(t, adm, "   12345   ")).rejects.toMatchObject(curto);
      expect((await acesso(t, "abcdef")).ok).toBe(true); // o código válido continua valendo
    });
  });

  it("trocar o código também libera o bloqueio por tentativas erradas", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await definir(t, adm, "codigo-certo");
      for (let i = 0; i < 10; i++) await acesso(t, `chute-${i}`);
      expect(await acesso(t, "codigo-certo")).toEqual({ ok: false, motivo: "bloqueado" });
      await definir(t, adm, "codigo-certo-2");
      expect((await acesso(t, "codigo-certo-2")).ok).toBe(true);
    });
  });

  it("o hash e o sal nunca saem pelo status; o público nem lê a tabela", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await definir(t, adm, "segredo-123");
      const st = await t.valor<Record<string, unknown>>(adm, "select public.admin_status_codigo_cozinha()");
      expect(Object.keys(st).sort()).toEqual(["atualizado_em", "configurado"]);
      await expect(t.q(ANON, "select * from public.acesso_cozinha")).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("público e usuário comum não conseguem definir nem consultar o status", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const comum = await t.criarUsuario();
      await definir(t, adm, "codigo-do-admin");

      await expect(definir(t, ANON, "invasor-123")).rejects.toMatchObject({ code: "42501" });
      await expect(definir(t, comum, "invasor-123")).rejects.toMatchObject({ code: "42501" }); // barrado pela RLS
      await expect(t.q(ANON, "select public.admin_status_codigo_cozinha()")).rejects.toMatchObject({ code: "42501" });
      await expect(t.q(comum, "select public.admin_status_codigo_cozinha()")).rejects.toMatchObject({
        message: "Somente o administrador pode fazer isso.",
      });
      expect((await acesso(t, "codigo-do-admin")).ok).toBe(true); // nada mudou
      expect(await acesso(t, "invasor-123")).toEqual({ ok: false, motivo: "invalido" });
    });
  });

  it("o admin logado vê a lista sem precisar do código", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await t.criarPessoa("Ana Souza", "9001");
      const r = await t.valor<{ ok: boolean; pessoas: { nome: string; nif: string }[] }>(adm, "select public.lista_cozinha(public.hoje_sp(), null)");
      expect(r.ok).toBe(true);
      expect(r.pessoas.map((p) => [p.nome, p.nif])).toEqual([["Ana Souza", "9001"]]);
    });
  });
});

describe("configuracoes (tela Configurações)", () => {
  const salvar = (t: Tx, quem: Parameters<Tx["q"]>[0], sets: string, params: unknown[] = []) =>
    t.q(quem, `update public.configuracoes set ${sets} where id = 1 returning prazo_limite, dias_bloqueados::text[] as dias_bloqueados, aviso_home, nome_unidade`, params);

  it("o admin muda prazo, dias sem almoço, aviso e nome da unidade", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const r = await salvar(t, adm, "prazo_limite = $1, dias_bloqueados = $2, aviso_home = $3, nome_unidade = $4", [
        "10:30",
        ["2026-11-02", "2026-11-15"],
        "Sexta não teremos almoço.",
        "SESI Barra do Turvo",
      ]);
      expect(r.rows[0]).toMatchObject({
        prazo_limite: "10:30:00",
        dias_bloqueados: ["2026-11-02", "2026-11-15"],
        aviso_home: "Sexta não teremos almoço.",
        nome_unidade: "SESI Barra do Turvo",
      });
    });
  });

  it("a linha de configuração é única e não pode ser apagada nem duplicada pelo app", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await expect(t.q(adm, "delete from public.configuracoes")).rejects.toMatchObject({ code: "42501" });
      await expect(t.q(adm, "insert into public.configuracoes (id) values (2)")).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("público e usuário comum leem, mas não alteram (a RLS não deixa nenhuma linha passar)", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      expect((await t.q(ANON, "select prazo_limite from public.configuracoes")).rows).toHaveLength(1);
      await expect(salvar(t, ANON, "prazo_limite = '23:00'")).rejects.toMatchObject({ code: "42501" });
      expect((await salvar(t, comum, "prazo_limite = '23:00'")).rowCount).toBe(0);
      expect(await t.valor(DONO, "select prazo_limite::text from public.configuracoes")).toBe("09:00:00");
    });
  });

  it("recusa nome da unidade vazio ou enorme, aviso vazio ou com mais de 280 caracteres", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      await expect(salvar(t, adm, "nome_unidade = '   '")).rejects.toMatchObject({ code: "23514" });
      await expect(salvar(t, adm, "nome_unidade = $1", ["x".repeat(81)])).rejects.toMatchObject({ code: "23514" });
      await expect(salvar(t, adm, "aviso_home = '  '")).rejects.toMatchObject({ code: "23514" });
      await expect(salvar(t, adm, "aviso_home = $1", ["x".repeat(281)])).rejects.toMatchObject({ code: "23514" });
      await salvar(t, adm, "aviso_home = $1, nome_unidade = $2", ["x".repeat(280), "y".repeat(80)]); // limites exatos passam
      await salvar(t, adm, "aviso_home = null"); // limpar o aviso é permitido
    });
  });

  it("um dia sem almoço configurado passa a bloquear a marcação do público", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const ana = await t.criarPessoa("Ana Souza", "9001");
      const dia = segundaRelativa(await t.hoje(), 3);
      const marcar = () => t.q(ANON, "select public.salvar_marcacoes($1, $2::jsonb)", [ana, JSON.stringify([{ data: dia, vai: true }])]);

      await marcar(); // antes: aberto
      await salvar(t, adm, "dias_bloqueados = $1", [[dia]]);
      await expect(marcar()).rejects.toMatchObject({ message: "Não haverá almoço nesse dia." });
      await salvar(t, adm, "dias_bloqueados = '{}'"); // desbloquear volta a aceitar
      await marcar();
    });
  });

  it("o novo prazo vale no banco: com prazo 00:00, marcar HOJE é recusado", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const hoje = await t.hoje();
      const dow = (new Date(`${hoje}T00:00:00Z`).getUTCDay() + 6) % 7;
      if (dow > 4) return; // fim de semana: não existe "hoje" útil para testar
      await salvar(t, adm, "prazo_limite = '00:00'");
      const horaSP = await t.valor<string>(DONO, "select (now() at time zone 'America/Sao_Paulo')::time::text");
      if (horaSP <= "00:00:00") return; // (exatamente à meia-noite não há como "já ter passado")
      const ana = await t.criarPessoa("Ana Souza", "9001");
      await expect(
        t.q(ANON, "select public.salvar_marcacoes($1, $2::jsonb)", [ana, JSON.stringify([{ data: hoje, vai: true }])]),
      ).rejects.toMatchObject({ message: "O prazo para marcar esse dia já encerrou." });
    });
  });
});

describe("auditoria de permissões das funções", () => {
  const podeExecutar = (t: Tx, papel: string, assinatura: string) =>
    t.valor<boolean>(DONO, `select has_function_privilege('${papel}', '${assinatura}', 'execute')`);

  it("funções do painel: só usuário logado (nunca o público)", async () => {
    await banco.tx(async (t) => {
      for (const f of [
        "public.admin_salvar_marcacoes(uuid, jsonb, text)",
        "public.admin_importar_pessoas(jsonb)",
        "public.admin_duplicar_cardapio(date, date, boolean)",
        "public.admin_status_codigo_cozinha()",
        "public.definir_codigo_cozinha(text)",
        "public.remover_codigo_cozinha()",
      ]) {
        expect(await podeExecutar(t, "anon", f), `anon em ${f}`).toBe(false);
        expect(await podeExecutar(t, "authenticated", f), `authenticated em ${f}`).toBe(true);
      }
    });
  });

  it("função interna de verificação do código não é chamável de fora", async () => {
    await banco.tx(async (t) => {
      for (const papel of ["anon", "authenticated"]) {
        expect(await podeExecutar(t, papel, "public.verificar_acesso(text)"), papel).toBe(false);
      }
    });
  });

  it("as funções públicas do app continuam abertas ao público", async () => {
    await banco.tx(async (t) => {
      for (const f of [
        "public.buscar_pessoas(text)",
        "public.marcacoes_da_pessoa(uuid, date)",
        "public.salvar_marcacoes(uuid, jsonb)",
        "public.totais_por_dia(date)",
        "public.lista_cozinha(date, text)",
        "public.relatorio_totais(date, date, text)",
      ]) {
        expect(await podeExecutar(t, "anon", f), f).toBe(true);
      }
    });
  });

  it("o público não lê nenhuma tabela com dados pessoais", async () => {
    await banco.tx(async (t) => {
      for (const tabela of ["pessoas", "marcacoes", "marcacoes_manuais", "acesso_cozinha", "tentativas_cozinha", "admins", "grupos"]) {
        await expect(t.q(ANON, `select * from public.${tabela}`), tabela).rejects.toMatchObject({ code: "42501" });
      }
    });
  });

  it("um usuário logado que não é admin não vê dado pessoal algum", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      await t.criarPessoa("Ana Souza", "9001");
      for (const tabela of ["pessoas", "marcacoes", "marcacoes_manuais", "acesso_cozinha", "tentativas_cozinha", "grupos"]) {
        expect((await t.q(comum, `select * from public.${tabela}`)).rows, tabela).toHaveLength(0);
      }
      // nem a lista da cozinha, sem o código
      const r = await t.valor<{ ok: boolean }>(comum, "select public.lista_cozinha(public.hoje_sp(), null)");
      expect(r.ok).toBe(false);
    });
  });

  it("ninguém se torna admin pelo app: a tabela admins só tem leitura do próprio registro", async () => {
    await banco.tx(async (t) => {
      const comum = await t.criarUsuario();
      if (comum.role !== "authenticated") throw new Error("inesperado");
      await expect(t.q(comum, "insert into public.admins (user_id) values ($1)", [comum.sub])).rejects.toMatchObject({ code: "42501" });
      expect(await t.valor<boolean>(comum, "select public.is_admin()")).toBe(false);
      const adm = await t.criarAdmin();
      expect(await t.valor<boolean>(adm, "select public.is_admin()")).toBe(true);
      expect(await t.valor<boolean>(ANON, "select public.is_admin()")).toBe(false);
    });
  });
});

describe("migrations", () => {
  it("existem 6 migrations e a última (painel) pode ser executada de novo sem erro", async () => {
    const arquivos = arquivosDeMigration();
    expect(arquivos).toHaveLength(6);
    const ultima = arquivos[arquivos.length - 1]!;
    expect(ultima).toMatch(/painel_admin\.sql$/);
    await banco.cliente.query(lerSql(ultima));
    await banco.cliente.query(lerSql(ultima));
  });

  it("depois de rodar de novo, as funções do painel continuam funcionando", async () => {
    await banco.tx(async (t) => {
      const adm = await t.criarAdmin();
      const r = await t.valor<{ ok: boolean }>(adm, "select public.admin_importar_pessoas('[{\"linha\":2,\"nome\":\"Ana\",\"nif\":\"1\"}]'::jsonb)");
      expect(r.ok).toBe(true);
    });
  });
});
