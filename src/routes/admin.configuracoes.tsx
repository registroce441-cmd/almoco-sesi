import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarOff, Clock, Eye, EyeOff, KeyRound, Megaphone, Plus, Store, X } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Confirmar } from "@/components/admin/Folha";
import {
  Aviso,
  BarraSalvar,
  CLASSE_BOTAO_PRIMARIO,
  CLASSE_BOTAO_SECUNDARIO,
  CLASSE_CAMPO,
  Cartao,
  Girando,
  Rotulo,
} from "@/components/admin/ui";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDefinirCodigo,
  useSalvarConfiguracoes,
  useStatusCodigo,
  type ConfiguracoesParaSalvar,
} from "@/hooks/use-admin-config";
import { useConfiguracoes } from "@/hooks/use-configuracoes";
import { AVISO_MAXIMO, ehDiaUtil, horaCurta, UNIDADE_MAXIMO } from "@/lib/admin-data";
import { isoData } from "@/lib/almoco-data";
import { mensagemDeErro } from "@/lib/erros";
import { limparTexto } from "@/lib/importacao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/configuracoes")({ component: Configuracoes });

const fmtDia = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

function Configuracoes() {
  const config = useConfiguracoes();
  return (
    <div className="min-h-dvh-screen bg-background pb-40 md:pb-32">
      <AdminHeader title="Configurações">
        <p className="mt-2 text-sm opacity-80">
          Prazo, dias sem almoço, aviso da Home, nome da unidade e código da cozinha.
        </p>
      </AdminHeader>
      <main className="relative mx-auto max-w-3xl -mt-8 space-y-4 px-4 md:px-6">
        {config.isError ? (
          <EstadoErro erro={config.error} onTentar={() => config.refetch()} />
        ) : config.isLoading || !config.data ? (
          <div className="space-y-4" aria-busy="true" aria-label="Carregando as configurações">
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
          </div>
        ) : (
          <Formulario
            inicial={{
              prazo_limite: horaCurta(config.data.prazo_limite),
              dias_bloqueados: [...config.data.dias_bloqueados].sort(),
              aviso_home: config.data.aviso_home ?? "",
              nome_unidade: config.data.nome_unidade,
            }}
          />
        )}
        <CodigoCozinha />
      </main>
    </div>
  );
}

interface Form {
  prazo_limite: string;
  dias_bloqueados: string[];
  aviso_home: string;
  nome_unidade: string;
}

function Formulario({ inicial }: { inicial: Form }) {
  const [salvo, setSalvo] = useState<Form>(inicial);
  const [f, setF] = useState<Form>(inicial);
  const [novoDia, setNovoDia] = useState("");
  const [avisoDia, setAvisoDia] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useSalvarConfiguracoes();
  const hoje = isoData(new Date());

  const alterado = JSON.stringify(f) !== JSON.stringify(salvo);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErro(null);
  };

  const adicionarDia = () => {
    if (!novoDia) return;
    if (!ehDiaUtil(novoDia)) return setAvisoDia("Esse dia é fim de semana: já não tem almoço.");
    if (f.dias_bloqueados.includes(novoDia)) return setAvisoDia("Esse dia já está na lista.");
    setAvisoDia(null);
    set("dias_bloqueados", [...f.dias_bloqueados, novoDia].sort());
    setNovoDia("");
  };
  const passados = f.dias_bloqueados.filter((d) => d < hoje);

  const gravar = () => {
    const nome = limparTexto(f.nome_unidade);
    if (!nome) return setErro("Informe o nome da unidade.");
    if (!/^\d{2}:\d{2}$/.test(f.prazo_limite)) return setErro("Informe o horário do prazo.");
    if (f.aviso_home.length > AVISO_MAXIMO)
      return setErro(`O aviso pode ter no máximo ${AVISO_MAXIMO} caracteres.`);
    const aviso = f.aviso_home.replace(/[ \t]+/g, " ").trim();
    const cfg: ConfiguracoesParaSalvar = {
      prazo_limite: f.prazo_limite,
      dias_bloqueados: f.dias_bloqueados,
      aviso_home: aviso || null,
      nome_unidade: nome,
    };
    salvar.mutate(cfg, {
      onSuccess: () => {
        const novo = { ...f, nome_unidade: nome, aviso_home: aviso };
        setSalvo(novo);
        setF(novo);
        toast.success("Configurações salvas.");
      },
    });
  };

  return (
    <>
      <Cartao
        icone={<Store className="h-5 w-5" />}
        titulo="Unidade"
        descricao="Aparece no relatório e nos arquivos exportados."
      >
        <Rotulo htmlFor="cfg-nome">Nome da unidade</Rotulo>
        <input
          id="cfg-nome"
          value={f.nome_unidade}
          onChange={(e) => set("nome_unidade", e.target.value)}
          maxLength={UNIDADE_MAXIMO}
          className={cn(CLASSE_CAMPO, "mt-1")}
          placeholder="Ex.: SESI Barra do Turvo"
        />
      </Cartao>

      <Cartao
        icone={<Megaphone className="h-5 w-5" />}
        titulo="Aviso da Home"
        descricao="Recado curto para quem vai marcar o almoço. Deixe em branco para não mostrar nada."
      >
        <Rotulo htmlFor="cfg-aviso">Texto do aviso</Rotulo>
        <textarea
          id="cfg-aviso"
          value={f.aviso_home}
          onChange={(e) => set("aviso_home", e.target.value)}
          maxLength={AVISO_MAXIMO}
          rows={3}
          placeholder="Ex.: Sexta-feira não teremos almoço por causa do feriado."
          className="mt-1 w-full resize-none rounded-2xl border bg-card px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />
        <p className="text-right text-xs text-muted-foreground">
          {f.aviso_home.length}/{AVISO_MAXIMO}
        </p>
      </Cartao>

      <Cartao
        icone={<Clock className="h-5 w-5" />}
        titulo="Prazo para marcar"
        descricao="Horário limite, no próprio dia do almoço (horário de Brasília). Depois dele, só o administrador altera."
      >
        <Rotulo htmlFor="cfg-prazo">Horário limite</Rotulo>
        <input
          id="cfg-prazo"
          type="time"
          value={f.prazo_limite}
          onChange={(e) => set("prazo_limite", e.target.value)}
          className={cn(CLASSE_CAMPO, "mt-1 md:max-w-48")}
        />
      </Cartao>

      <Cartao
        icone={<CalendarOff className="h-5 w-5" />}
        titulo="Dias sem almoço"
        descricao="Feriados e recessos. Nesses dias ninguém consegue marcar."
      >
        <div className="flex gap-2">
          <input
            type="date"
            value={novoDia}
            onChange={(e) => setNovoDia(e.target.value)}
            aria-label="Dia sem almoço"
            className={cn(CLASSE_CAMPO, "flex-1")}
          />
          <button
            onClick={adicionarDia}
            disabled={!novoDia}
            className={cn(CLASSE_BOTAO_SECUNDARIO, "shrink-0 px-4")}
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
        {avisoDia && (
          <div className="mt-2">
            <Aviso>{avisoDia}</Aviso>
          </div>
        )}
        {f.dias_bloqueados.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
            Nenhum dia cadastrado.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {f.dias_bloqueados.map((d) => (
              <li key={d}>
                <button
                  onClick={() =>
                    set(
                      "dias_bloqueados",
                      f.dias_bloqueados.filter((x) => x !== d),
                    )
                  }
                  aria-label={`Remover ${fmtDia(d)}`}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold capitalize transition active:scale-95",
                    d < hoje ? "bg-muted text-muted-foreground" : "bg-card",
                  )}
                >
                  {fmtDia(d)} <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {passados.length > 0 && (
          <button
            onClick={() =>
              set(
                "dias_bloqueados",
                f.dias_bloqueados.filter((d) => d >= hoje),
              )
            }
            className="mt-2 flex h-11 items-center text-sm font-semibold text-primary hover:underline"
          >
            Limpar {passados.length} data{passados.length !== 1 ? "s" : ""} que já passou
            {passados.length !== 1 ? "ram" : ""}
          </button>
        )}
      </Cartao>

      <BarraSalvar
        visivel={alterado}
        resumo="Configurações alteradas"
        detalhe="Ainda não salvo"
        salvando={salvar.isPending}
        erro={erro ?? (salvar.isError ? mensagemDeErro(salvar.error) : null)}
        onSalvar={gravar}
        onDescartar={() => {
          setF(salvo);
          setErro(null);
          setAvisoDia(null);
          salvar.reset();
        }}
        rotulo="Salvar"
      />
    </>
  );
}

function CodigoCozinha() {
  const status = useStatusCodigo();
  const definir = useDefinirCodigo();
  const [codigo, setCodigo] = useState("");
  const [ver, setVer] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [feito, setFeito] = useState(false);

  const gravar = () => {
    setConfirmar(false);
    definir.mutate(codigo.trim(), {
      onSuccess: () => {
        setCodigo("");
        setFeito(true);
        toast.success("Código da cozinha atualizado.");
      },
    });
  };
  const pedir = () => {
    setFeito(false);
    const c = codigo.trim();
    if (c.length < 6) return setAviso("O código precisa ter pelo menos 6 caracteres.");
    setAviso(null);
    if (status.data?.configurado) setConfirmar(true);
    else gravar();
  };
  const quando = status.data?.atualizado_em
    ? new Date(status.data.atualizado_em).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Cartao
      icone={<KeyRound className="h-5 w-5" />}
      titulo="Código de acesso da cozinha"
      descricao="A cozinha usa este código para abrir a Lista de Almoço e o relatório."
    >
      {status.isError ? (
        <EstadoErro erro={status.error} onTentar={() => status.refetch()} />
      ) : (
        <>
          {status.isLoading ? (
            <Skeleton className="h-12 rounded-2xl" />
          ) : status.data?.configurado ? (
            <p className="rounded-2xl bg-success/15 px-4 py-3 text-sm font-semibold text-success">
              Código definido{quando ? ` · trocado em ${quando}` : ""}
            </p>
          ) : (
            <Aviso>
              Nenhum código definido: ninguém na cozinha consegue entrar. Defina um abaixo.
            </Aviso>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              pedir();
            }}
            className="mt-4 space-y-3"
            noValidate
          >
            <div>
              <Rotulo htmlFor="cfg-codigo">
                {status.data?.configurado ? "Novo código" : "Código"}
              </Rotulo>
              <div className="relative mt-1">
                <input
                  id="cfg-codigo"
                  type={ver ? "text" : "password"}
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value);
                    setAviso(null);
                    setFeito(false);
                  }}
                  placeholder="Mínimo de 6 caracteres"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={cn(CLASSE_CAMPO, "pr-14")}
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  aria-label={ver ? "Esconder o código" : "Mostrar o código"}
                  className="absolute right-0 top-0 grid h-12 w-12 place-items-center text-muted-foreground"
                >
                  {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                É um código compartilhado pela equipe da cozinha (não é a senha de ninguém). Anote e
                combine com eles.
              </p>
            </div>
            {(aviso || definir.isError) && <Aviso>{aviso ?? mensagemDeErro(definir.error)}</Aviso>}
            {feito && <Aviso tipo="ok">Pronto! Passe o novo código para a cozinha.</Aviso>}
            <button
              type="submit"
              disabled={definir.isPending || codigo.trim().length === 0}
              className={cn(CLASSE_BOTAO_PRIMARIO, "w-full md:w-auto")}
            >
              {definir.isPending ? (
                <>
                  <Girando /> Salvando…
                </>
              ) : status.data?.configurado ? (
                "Trocar o código"
              ) : (
                "Definir o código"
              )}
            </button>
          </form>
        </>
      )}

      <Confirmar
        aberto={confirmar}
        onFechar={() => setConfirmar(false)}
        titulo="Trocar o código agora?"
        descricao="O código antigo deixa de valer imediatamente. Quem está na cozinha vai precisar do novo código para entrar de novo."
      >
        <button onClick={gravar} className={CLASSE_BOTAO_PRIMARIO}>
          Sim, trocar o código
        </button>
        <button onClick={() => setConfirmar(false)} className={CLASSE_BOTAO_SECUNDARIO}>
          Cancelar
        </button>
      </Confirmar>
    </Cartao>
  );
}
