import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Search, Users, X } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Folha } from "@/components/admin/Folha";
import { ImportarPlanilha } from "@/components/admin/ImportarPlanilha";
import {
  Aviso,
  CLASSE_BOTAO_PRIMARIO,
  CLASSE_BOTAO_SECUNDARIO,
  CLASSE_CAMPO,
  Girando,
  Rotulo,
} from "@/components/admin/ui";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAlternarAtiva,
  usePessoasAdmin,
  useSalvarPessoa,
  type PessoaAdmin,
} from "@/hooks/use-admin-pessoas";
import { combinaBusca } from "@/lib/admin-data";
import { mensagemDeErro } from "@/lib/erros";
import { limparTexto, NIF_MAXIMO, NOME_MAXIMO } from "@/lib/importacao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/pessoas")({ component: Pessoas });

type Filtro = "todas" | "ativas" | "inativas";
const POR_VEZ = 100;
function Pessoas() {
  const pessoas = usePessoasAdmin();
  const alternar = useAlternarAtiva();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [limite, setLimite] = useState(POR_VEZ);
  const [edicao, setEdicao] = useState<PessoaAdmin | "nova" | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const todas = useMemo(() => pessoas.data ?? [], [pessoas.data]);
  const contagens = {
    todas: todas.length,
    ativas: todas.filter((p) => p.ativo).length,
    inativas: todas.filter((p) => !p.ativo).length,
  };
  const filtradas = useMemo(() => {
    const termo = q.trim();
    return todas.filter((p) => {
      if (filtro === "ativas" && !p.ativo) return false;
      if (filtro === "inativas" && p.ativo) return false;
      return combinaBusca(`${p.nome} ${p.nif}`, q);
    });
  }, [todas, q, filtro]);
  const visiveis = filtradas.slice(0, limite);

  const trocarAtiva = (p: PessoaAdmin) => {
    setErroAcao(null);
    alternar.mutate(
      { id: p.id, ativo: !p.ativo },
      {
        onSuccess: () =>
          toast.success(
            p.ativo
              ? `${p.nome} foi desativado(a). O histórico foi mantido.`
              : `${p.nome} voltou a aparecer na busca.`,
          ),
        onError: (e) => setErroAcao(mensagemDeErro(e)),
      },
    );
  };

  return (
    <div className="min-h-dvh-screen bg-background pb-28 md:pb-12">
      <AdminHeader title="Pessoas">
        <p className="mt-2 text-sm opacity-80">
          {pessoas.isSuccess
            ? `${contagens.ativas} ativas · ${contagens.todas} cadastradas`
            : "Colaboradores do SESI"}
        </p>
      </AdminHeader>

      <main className="relative mx-auto -mt-8 max-w-5xl space-y-4 px-4 md:px-6">
        <ImportarPlanilha pessoas={pessoas.data} carregando={pessoas.isLoading} />

        <section className="space-y-3 animate-rise">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimite(POR_VEZ);
                }}
                placeholder="Buscar nome ou NIF"
                aria-label="Buscar nome ou NIF"
                className={cn(CLASSE_CAMPO, "pl-12 pr-12")}
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="Limpar busca"
                  className="absolute right-0 top-0 grid h-12 w-12 place-items-center text-muted-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <button onClick={() => setEdicao("nova")} className={CLASSE_BOTAO_PRIMARIO}>
              <Plus className="h-4 w-4" /> Nova pessoa
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["todas", "ativas", "inativas"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFiltro(f);
                  setLimite(POR_VEZ);
                }}
                aria-pressed={filtro === f}
                className={cn(
                  "h-11 rounded-xl px-4 text-sm font-semibold capitalize transition",
                  filtro === f
                    ? "bg-on text-primary-foreground"
                    : "border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {f} <span className="opacity-70">{contagens[f]}</span>
              </button>
            ))}
          </div>

          {erroAcao && <Aviso>{erroAcao}</Aviso>}

          {pessoas.isError ? (
            <EstadoErro erro={pessoas.error} onTentar={() => pessoas.refetch()} />
          ) : pessoas.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Carregando as pessoas">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl border bg-card px-6 py-10 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="h-7 w-7" />
              </div>
              <p className="mt-4 text-lg font-bold">
                {todas.length === 0 ? "Nenhuma pessoa cadastrada" : "Ninguém encontrado"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {todas.length === 0
                  ? "Importe a planilha acima ou cadastre uma pessoa."
                  : "Tente outro nome ou NIF, ou mude o filtro."}
              </p>
            </div>
          ) : (
            <>
              {/* Celular: cartões */}
              <ul className="space-y-2 md:hidden">
                {visiveis.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border bg-card p-3",
                      !p.ativo && "opacity-70",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">NIF {p.nif}</p>
                    </div>
                    <BotaoAtiva
                      p={p}
                      onClick={() => trocarAtiva(p)}
                      ocupado={alternar.isPending && alternar.variables?.id === p.id}
                    />
                    <button
                      onClick={() => setEdicao(p)}
                      aria-label={`Editar ${p.nome}`}
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border bg-card transition hover:bg-muted active:scale-95"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {/* PC: tabela */}
              <div className="hidden overflow-hidden rounded-3xl border bg-card md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Nome</th>
                      <th className="px-5 py-3">NIF</th>
                      <th className="px-5 py-3">Situação</th>
                      <th className="px-5 py-3 text-right">Editar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((p) => (
                      <tr
                        key={p.id}
                        className={cn(
                          "border-t transition hover:bg-muted/50",
                          !p.ativo && "text-muted-foreground",
                        )}
                      >
                        <td className="px-5 py-2 font-semibold">{p.nome}</td>
                        <td className="px-5 py-2 tabular-nums">{p.nif}</td>
                        <td className="px-5 py-2">
                          <BotaoAtiva
                            p={p}
                            onClick={() => trocarAtiva(p)}
                            ocupado={alternar.isPending && alternar.variables?.id === p.id}
                          />
                        </td>
                        <td className="px-5 py-2 text-right">
                          <button
                            onClick={() => setEdicao(p)}
                            aria-label={`Editar ${p.nome}`}
                            className="inline-grid h-11 w-11 place-items-center rounded-2xl transition hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtradas.length > limite && (
                <button
                  onClick={() => setLimite((l) => l + POR_VEZ)}
                  className={cn(CLASSE_BOTAO_SECUNDARIO, "w-full")}
                >
                  Mostrar mais ({filtradas.length - limite} restantes)
                </button>
              )}
            </>
          )}
        </section>
      </main>

      <FormPessoa pessoa={edicao} onFechar={() => setEdicao(null)} />
    </div>
  );
}

function BotaoAtiva({
  p,
  onClick,
  ocupado,
}: {
  p: PessoaAdmin;
  onClick: () => void;
  ocupado: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={ocupado}
      aria-label={p.ativo ? `Desativar ${p.nome}` : `Ativar ${p.nome}`}
      title={p.ativo ? "Clique para desativar" : "Clique para ativar"}
      className={cn(
        "h-11 shrink-0 rounded-full px-3.5 text-xs font-semibold transition active:scale-95 disabled:opacity-60",
        p.ativo
          ? "bg-success/15 text-success hover:bg-success/25"
          : "bg-muted text-muted-foreground hover:bg-muted/70",
      )}
    >
      {ocupado ? <Girando className="mx-3" /> : p.ativo ? "Ativa" : "Inativa"}
    </button>
  );
}

function FormPessoa({
  pessoa,
  onFechar,
}: {
  pessoa: PessoaAdmin | "nova" | null;
  onFechar: () => void;
}) {
  return (
    <Folha
      aberto={pessoa !== null}
      onFechar={onFechar}
      titulo={pessoa === "nova" ? "Nova pessoa" : "Editar pessoa"}
      descricao="O NIF identifica a pessoa e não pode se repetir."
    >
      {/* key: reinicia o formulário a cada pessoa */}
      {pessoa !== null && (
        <Campos
          key={pessoa === "nova" ? "nova" : pessoa.id}
          pessoa={pessoa === "nova" ? null : pessoa}
          onFechar={onFechar}
        />
      )}
    </Folha>
  );
}

function Campos({ pessoa, onFechar }: { pessoa: PessoaAdmin | null; onFechar: () => void }) {
  const salvar = useSalvarPessoa();
  const [nome, setNome] = useState(pessoa?.nome ?? "");
  const [nif, setNif] = useState(pessoa?.nif ?? "");
  const [aviso, setAviso] = useState<string | null>(null);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const n = limparTexto(nome);
    const f = limparTexto(nif);
    if (!n) return setAviso("Informe o nome.");
    if (!f) return setAviso("Informe o NIF.");
    if (f.includes(" ")) return setAviso("O NIF não pode ter espaços.");
    if (n.length > NOME_MAXIMO)
      return setAviso(`O nome pode ter no máximo ${NOME_MAXIMO} caracteres.`);
    if (f.length > NIF_MAXIMO)
      return setAviso(`O NIF pode ter no máximo ${NIF_MAXIMO} caracteres.`);
    setAviso(null);
    salvar.mutate(
      { ...(pessoa ? { id: pessoa.id } : {}), nome: n, nif: f },
      {
        onSuccess: () => {
          toast.success(pessoa ? "Dados atualizados." : "Pessoa cadastrada.");
          onFechar();
        },
      },
    );
  };
  const erro = aviso ?? (salvar.isError ? mensagemDeErro(salvar.error) : null);

  return (
    <form
      onSubmit={enviar}
      className="space-y-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      noValidate
    >
      <div className="space-y-1">
        <Rotulo htmlFor="pessoa-nome">Nome</Rotulo>
        <input
          id="pessoa-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="off"
          className={CLASSE_CAMPO}
          placeholder="Nome completo"
        />
      </div>
      <div className="space-y-1">
        <Rotulo htmlFor="pessoa-nif">NIF</Rotulo>
        <input
          id="pessoa-nif"
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          autoComplete="off"
          inputMode="text"
          className={CLASSE_CAMPO}
          placeholder="Ex.: 1040210"
        />
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={onFechar} className={CLASSE_BOTAO_SECUNDARIO}>
          Cancelar
        </button>
        <button type="submit" disabled={salvar.isPending} className={CLASSE_BOTAO_PRIMARIO}>
          {salvar.isPending ? (
            <>
              <Girando /> Salvando…
            </>
          ) : (
            "Salvar"
          )}
        </button>
      </div>
    </form>
  );
}
