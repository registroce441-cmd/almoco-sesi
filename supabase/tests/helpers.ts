/**
 * Ajudantes dos testes de banco (rodam contra um Postgres local, NÃO contra o Supabase real).
 *
 *   npm run test:db
 *
 * Cada arquivo de teste cria um banco novo e descartável, aplica o stub do Supabase
 * (roles, auth.uid(), storage) + TODAS as migrations em ordem, e apaga o banco no final.
 * Cada teste roda dentro de uma transação que é desfeita (rollback), então um não interfere no outro.
 *
 * Por padrão conecta em postgres://postgres:postgres@localhost:5432/postgres.
 * Para usar outro servidor:  TEST_DATABASE_URL=postgres://usuario:senha@host:5432/postgres npm run test:db
 */
import { Client, type QueryResult, type QueryResultRow } from "pg";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_SUPABASE = path.resolve(AQUI, "..");

export const URL_BASE =
  process.env["TEST_DATABASE_URL"] ?? "postgres://postgres:postgres@localhost:5432/postgres";

/** Quem está "chamando": o público (anon), um usuário logado comum, o admin ou o dono do banco (SQL Editor). */
export type Papel =
  { role: "anon" } | { role: "authenticated"; sub: string } | { role: "postgres" };

export const ANON: Papel = { role: "anon" };
export const DONO: Papel = { role: "postgres" };

/** Arquivos .sql das migrations, na ordem em que o usuário roda no SQL Editor. */
export function arquivosDeMigration(): string[] {
  const pasta = path.join(RAIZ_SUPABASE, "migrations");
  return readdirSync(pasta)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(pasta, f));
}

export const lerSql = (arquivo: string) => readFileSync(arquivo, "utf8");

function urlDoBanco(nome: string): string {
  const u = new URL(URL_BASE);
  u.pathname = `/${nome}`;
  return u.toString();
}

export class Tx {
  constructor(private readonly c: Client) {}

  /** Executa `sql` com o papel indicado. Se der erro, a transação continua usável. */
  async q<R extends QueryResultRow = QueryResultRow>(
    papel: Papel,
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<R>> {
    await this.c.query("savepoint t");
    try {
      if (papel.role !== "postgres") await this.c.query(`set local role ${papel.role}`);
      const claims =
        papel.role === "authenticated"
          ? { sub: papel.sub, role: "authenticated" }
          : papel.role === "anon"
            ? { role: "anon" }
            : {};
      await this.c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(claims),
      ]);
      const r = await this.c.query<R>(sql, params);
      await this.c.query("release savepoint t");
      return r;
    } catch (e) {
      await this.c.query("rollback to savepoint t");
      throw e;
    } finally {
      await this.c.query("reset role");
    }
  }

  /** Atalho: primeira coluna da primeira linha. */
  async valor<T = unknown>(papel: Papel, sql: string, params: unknown[] = []): Promise<T> {
    const r = await this.q(papel, sql, params);
    return Object.values(r.rows[0] ?? {})[0] as T;
  }

  async criarUsuario(email = `u${randomBytes(4).toString("hex")}@teste.local`): Promise<Papel> {
    const id = await this.valor<string>(
      DONO,
      "insert into auth.users (email) values ($1) returning id",
      [email],
    );
    return { role: "authenticated", sub: id };
  }

  async criarAdmin(): Promise<Papel> {
    const u = await this.criarUsuario();
    if (u.role !== "authenticated") throw new Error("inesperado");
    await this.q(DONO, "insert into public.admins (user_id) values ($1)", [u.sub]);
    return u;
  }

  async criarPessoa(nome: string, nif: string, ativo = true): Promise<string> {
    return this.valor<string>(
      DONO,
      "insert into public.pessoas (nome, nif, ativo) values ($1, $2, $3) returning id",
      [nome, nif, ativo],
    );
  }

  /** Data de hoje no fuso de São Paulo (AAAA-MM-DD), como o banco enxerga. */
  hoje(): Promise<string> {
    return this.valor<string>(DONO, "select public.hoje_sp()::text");
  }
}

export class BancoDeTeste {
  constructor(
    private readonly c: Client,
    private readonly nome: string,
    private readonly admin: Client,
  ) {}

  /** Roda `fn` numa transação e SEMPRE desfaz no final. */
  async tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
    await this.c.query("begin");
    try {
      return await fn(new Tx(this.c));
    } finally {
      await this.c.query("rollback");
    }
  }

  /** Para o que precisa persistir fora de transação (ex.: rodar uma migration de novo). */
  get cliente(): Client {
    return this.c;
  }

  async destruir() {
    await this.c.end();
    await this.admin.query(`drop database if exists ${this.nome} with (force)`);
    await this.admin.end();
  }
}

export async function criarBancoDeTeste(): Promise<BancoDeTeste> {
  const admin = new Client({ connectionString: URL_BASE });
  try {
    await admin.connect();
  } catch (e) {
    throw new Error(
      `Não consegui conectar no Postgres de teste (${new URL(URL_BASE).host}). ` +
        `Suba um Postgres 15+ local (ex.: docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16) ` +
        `ou defina TEST_DATABASE_URL. Detalhe: ${(e as Error).message}`,
    );
  }
  const nome = `almoco_test_${randomBytes(5).toString("hex")}`;
  await admin.query(`create database ${nome}`);
  const c = new Client({ connectionString: urlDoBanco(nome) });
  await c.connect();
  await c.query(lerSql(path.join(AQUI, "stub-supabase.sql")));
  for (const arq of arquivosDeMigration()) {
    try {
      await c.query(lerSql(arq));
    } catch (e) {
      await c.end();
      await admin.query(`drop database if exists ${nome} with (force)`);
      await admin.end();
      throw new Error(`Falhou ao aplicar ${path.basename(arq)}: ${(e as Error).message}`);
    }
  }
  return new BancoDeTeste(c, nome, admin);
}

// ---------------------------------------------------------------------------
// Datas (aritmética em UTC para não depender do fuso da máquina que roda os testes)
// ---------------------------------------------------------------------------
const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);
const paraISO = (d: Date) => d.toISOString().slice(0, 10);

export function somarDias(iso: string, n: number): string {
  const d = paraData(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return paraISO(d);
}

/** Segunda-feira da semana de `iso` (sábado/domingo caem na segunda anterior). */
export function segundaDe(iso: string): string {
  const dow = (paraData(iso).getUTCDay() + 6) % 7; // 0 = segunda
  return somarDias(iso, -dow);
}

/** Segunda-feira `semanas` semanas a partir da desta (negativo = passado). */
export const segundaRelativa = (hoje: string, semanas: number) =>
  somarDias(segundaDe(hoje), semanas * 7);
