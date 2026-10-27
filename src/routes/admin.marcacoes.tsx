import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, ChevronLeft, ChevronRight, History, Search, X } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Folha } from "@/components/admin/Folha";
import {
  Aviso,
  CLASSE_BOTAO_PRIMARIO,
  CLASSE_BOTAO_SECUNDARIO,
  CLASSE_CAMPO,
  Cartao,
  Girando,
  Rotulo,
} from "@/components/admin/ui";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import { useListaAdmin } from "@/hooks/use-admin-pessoas";
import {
  useHistoricoManual,
  useSalvarMarcacoesAdmin,
  type RegistroManual,
} from "@/hooks/use-admin-marcacoes";
import { combinaBusca, estadoDe, marcasAlteradas, type Estado } from "@/lib/admin-data";
import { diasDaSemana, isoData, segundaDaSemana } from "@/lib/almoco-data";
import { mensagemDeErro } from "@/lib/erros";
import type { PessoaDaLista } from "@/lib/lista-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/marcacoes")({ component: Marcacoes });

const NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const INICIAIS = ["S", "T", "Q", "Q", "S"];
const fmtCurta = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const somarSemanas = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
};
const ROTULO_ESTADO: Record<Estado, string> = { vai: "Vai", nao: "Não vai", sem: "Sem marcação" };
const POR_VEZ = 60;

function Marcacoes() {
  const base = useMemo(() => segundaDaSemana(), []);
  const [offset, setOffset] = useState(0);
  const seg = somarSemanas(base, offset);
  const dias = diasDaSemana(seg);
  const isos = dias.map(isoData);
  const lista = useListaAdmin(seg);
  const [q, setQ] = useState("");
  const [limite, setLimite] = useState(POR_VEZ);
  const [escolhida, setEscolhida] = useState<PessoaDaLista | null>(null);

  const filtradas = useMemo(() => {
    const todas = lista.data ?? [];
    return todas.filter((p) => combinaBusca(`${p.nome} ${p.nif}`, q));
  }, [lista.data, q]);
  const rotulo =
    offset === 0
      ? "Semana atual"
      : offset === 1
        ? "Próxima semana"
        : offset === -1
          ? "Semana passada"
          : offset > 1
            ? `Daqui a ${offset} semanas`
            : `${-offset} semanas atrás`;

  return (
    <div className="min-h-dvh-screen bg-background pb-28 md:pb-12">
      <AdminHeader title="Marcações manuais">
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Semana anterior"
            className="grid h-12 w-12 place-items-center rounded-2xl border border-header-foreground/15 bg-header-foreground/10 backdrop-blur transition active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-lg font-extrabold leading-tight">
              {fmtCurta(dias[0]!)} – {fmtCurta(dias[4]!)}
            </p>
            <p className="text-xs opacity-75">{rotulo}</p>
          </div>
          <button
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Próxima semana"
            className="grid h-12 w-12 place-items-center rounded-2xl border border-header-foreground/15 bg-header-foreground/10 backdrop-blur transition active:scale-95"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </AdminHeader>

      <main className="relative mx-auto -mt-8 max-w-5xl space-y-4 px-4 md:px-6">
        <Cartao
          icone={<CalendarCheck className="h-5 w-5" />}
          titulo="Marcar ou desmarcar uma pessoa"
          descricao="Vale a qualquer hora, inclusive depois do prazo. O motivo (opcional) fica no histórico, visível só para o administrador."
        >
          <div className="relative">
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

          <div className="mt-3">
            {lista.isError ? (
              <EstadoErro erro={lista.error} onTentar={() => lista.refetch()} />
            ) : lista.isLoading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Carregando as pessoas">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-2xl" />
                ))}
              </div>
            ) : filtradas.length === 0 ? (
              <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                {(lista.data ?? []).length === 0
                  ? "Nenhuma pessoa ativa cadastrada."
                  : "Ninguém encontrado com essa busca."}
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {filtradas.slice(0, limite).map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => setEscolhida(p)}
                        className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:bg-muted active:scale-[.99]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{p.nome}</span>
                          <span className="block text-xs text-muted-foreground">NIF {p.nif}</span>
                        </span>
                        <span
                          className="flex shrink-0 gap-1"
                          role="img"
                          aria-label={isos
                            .map((d, i) => `${NOMES[i]}: ${ROTULO_ESTADO[estadoDe(p.marcas[d])]}`)
                            .join(", ")}
                        >
                          {isos.map((d, i) => {
                            const e = estadoDe(p.marcas[d]);
                            return (
                              <span
                                key={d}
                                className={cn(
                                  "grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold",
                                  e === "vai" && "bg-success text-success-foreground",
                                  e === "nao" && "bg-muted text-muted-foreground line-through",
                                  e === "sem" && "border border-dashed text-muted-foreground",
                                )}
                              >
                                {INICIAIS[i]}
                              </span>
                            );
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {filtradas.length > limite && (
                  <button
                    onClick={() => setLimite((l) => l + POR_VEZ)}
                    className={cn(CLASSE_BOTAO_SECUNDARIO, "mt-3 w-full")}
                  >
                    Mostrar mais ({filtradas.length - limite} restantes)
                  </button>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Legenda: verde = vai almoçar · cinza riscado = não vai · tracejado = sem marcação.
                </p>
              </>
            )}
          </div>
        </Cartao>

        <Historico />
      </main>

      <Folha
        aberto={escolhida !== null}
        onFechar={() => setEscolhida(null)}
        titulo={escolhida?.nome ?? ""}
        descricao={`NIF ${escolhida?.nif ?? ""} · semana ${fmtCurta(dias[0]!)} a ${fmtCurta(dias[4]!)}`}
      >
        {escolhida && (
          <Edicao
            key={`${escolhida.id}-${isos[0]}`}
            pessoa={escolhida}
            dias={dias}
            isos={isos}
            onFechar={() => setEscolhida(null)}
          />
        )}
      </Folha>
    </div>
  );
}

function Edicao({
  pessoa,
  dias,
  isos,
  onFechar,
}: {
  pessoa: PessoaDaLista;
  dias: Date[];
  isos: string[];
  onFechar: () => void;
}) {
  const salvar = useSalvarMarcacoesAdmin();
  const [estados, setEstados] = useState<Record<string, Estado>>(() =>
    Object.fromEntries(isos.map((d) => [d, estadoDe(pessoa.marcas[d])])),
  );
  const [motivo, setMotivo] = useState("");
  const mudancas = marcasAlteradas(pessoa.marcas, estados);

  const gravar = () =>
    salvar.mutate(
      { pessoaId: pessoa.id, marcas: mudancas, motivo },
      {
        onSuccess: (r) => {
          toast.success(
            `${r.alteradas} marcaç${r.alteradas === 1 ? "ão atualizada" : "ões atualizadas"} para ${pessoa.nome.split(" ")[0]}.`,
          );
          onFechar();
        },
      },
    );

  return (
    <div className="space-y-3">
      {isos.map((d, i) => {
        const atual = estados[d]!;
        const mudou = atual !== estadoDe(pessoa.marcas[d]);
        return (
          <fieldset
            key={d}
            className={cn("rounded-2xl border p-3", mudou && "border-primary/50 bg-primary/5")}
          >
            <legend className="px-1 text-sm font-bold">
              {NOMES[i]}{" "}
              <span className="font-medium text-muted-foreground">{fmtCurta(dias[i]!)}</span>
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {(["vai", "nao", "sem"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={atual === e}
                  onClick={() => setEstados((s) => ({ ...s, [d]: e }))}
                  className={cn(
                    "h-12 rounded-xl px-1 text-sm font-semibold transition active:scale-95",
                    atual === e
                      ? e === "vai"
                        ? "bg-success text-success-foreground"
                        : e === "nao"
                          ? "bg-on text-primary-foreground"
                          : "bg-foreground text-background"
                      : "border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {e === "sem" ? "Sem marcação" : ROTULO_ESTADO[e]}
                </button>
              ))}
            </div>
          </fieldset>
        );
      })}

      <div className="space-y-1">
        <Rotulo htmlFor="motivo" dica="(opcional)">
          Motivo
        </Rotulo>
        <textarea
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="Ex.: esqueceu de marcar, atestado, evento…"
          className="w-full resize-none rounded-2xl border bg-card px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />
        <p className="text-right text-xs text-muted-foreground">{motivo.length}/200</p>
      </div>

      {salvar.isError && <Aviso>{mensagemDeErro(salvar.error)}</Aviso>}
      <div className="sticky bottom-0 -mx-5 grid grid-cols-[1fr_1.5fr] gap-3 border-t bg-background px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={onFechar} className={CLASSE_BOTAO_SECUNDARIO}>
          Cancelar
        </button>
        <button
          onClick={gravar}
          disabled={mudancas.length === 0 || salvar.isPending}
          className={CLASSE_BOTAO_PRIMARIO}
        >
          {salvar.isPending ? (
            <>
              <Girando /> Salvando…
            </>
          ) : mudancas.length === 0 ? (
            "Nenhuma alteração"
          ) : (
            `Salvar ${mudancas.length} alteraç${mudancas.length === 1 ? "ão" : "ões"}`
          )}
        </button>
      </div>
    </div>
  );
}

const rotuloValor = (v: boolean | null) => (v === null ? "Sem marcação" : v ? "Vai" : "Não vai");

function Historico() {
  const h = useHistoricoManual();
  const [todos, setTodos] = useState(false);
  const itens = h.data ?? [];
  const visiveis = todos ? itens : itens.slice(0, 8);
  return (
    <Cartao
      icone={<History className="h-5 w-5" />}
      titulo="Histórico de marcações manuais"
      descricao="As últimas alterações feitas por administradores"
    >
      {h.isError ? (
        <EstadoErro erro={h.error} onTentar={() => h.refetch()} />
      ) : h.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : itens.length === 0 ? (
        <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma marcação manual ainda.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {visiveis.map((r) => (
              <Registro key={r.id} r={r} />
            ))}
          </ul>
          {itens.length > 8 && (
            <button
              onClick={() => setTodos((t) => !t)}
              className="mt-3 flex h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              {todos ? "Mostrar menos" : `Ver mais (${itens.length - 8})`}
            </button>
          )}
        </>
      )}
    </Cartao>
  );
}

function Registro({ r }: { r: RegistroManual }) {
  const dia = new Date(`${r.data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const quando = new Date(r.criado_em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <li className="rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-semibold">{r.nome}</p>
        <span className="shrink-0 text-xs text-muted-foreground">{quando}</span>
      </div>
      <p className="mt-0.5 text-sm">
        <span className="capitalize">{dia}</span>:{" "}
        <span className="text-muted-foreground">{rotuloValor(r.anterior)}</span> →{" "}
        <strong>{rotuloValor(r.novo)}</strong>
      </p>
      {r.motivo && <p className="mt-1 text-xs text-muted-foreground">Motivo: {r.motivo}</p>}
    </li>
  );
}
