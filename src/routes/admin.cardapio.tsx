import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import { DiaEditor } from "@/components/admin/DiaEditor";
import { Confirmar } from "@/components/admin/Folha";
import {
  Aviso,
  BarraSalvar,
  CLASSE_BOTAO_PRIMARIO,
  CLASSE_BOTAO_SECUNDARIO,
  Cartao,
  Girando,
} from "@/components/admin/ui";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import {
  removerFotos,
  useCardapioAdmin,
  useDuplicarCardapio,
  useEnviarFoto,
  useSalvarCardapio,
  type AlteracaoDia,
} from "@/hooks/use-admin-cardapio";
import { useConfiguracoes } from "@/hooks/use-configuracoes";
import {
  DIA_VAZIO,
  diasIguais,
  limparDia,
  problemaDoDia,
  type DiaCardapio,
} from "@/lib/admin-data";
import { diasDaSemana, isoData, segundaDaSemana } from "@/lib/almoco-data";
import { mensagemDeErro } from "@/lib/erros";
import { ErroImagem } from "@/lib/imagem";

export const Route = createFileRoute("/admin/cardapio")({ component: CardapioAdmin });

const NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const fmtCurta = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const somarSemanas = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
};

function CardapioAdmin() {
  const base = useMemo(() => segundaDaSemana(), []);
  const [offset, setOffset] = useState(0);
  const [sujo, setSujo] = useState(false);
  const [destino, setDestino] = useState<number | null>(null); // semana pedida enquanto há alterações
  const [versao, setVersao] = useState(0); // muda quando o banco foi alterado por fora do editor (duplicar)
  const seg = somarSemanas(base, offset);
  const dias = diasDaSemana(seg);

  const tentarIr = (novo: number) => (sujo ? setDestino(novo) : setOffset(novo));
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
    <div className="min-h-dvh-screen bg-background pb-40 md:pb-32">
      <AdminHeader title="Cardápio">
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => tentarIr(offset - 1)}
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
            onClick={() => tentarIr(offset + 1)}
            aria-label="Próxima semana"
            className="grid h-12 w-12 place-items-center rounded-2xl border border-header-foreground/15 bg-header-foreground/10 backdrop-blur transition active:scale-95"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </AdminHeader>

      <main className="relative mx-auto -mt-8 max-w-5xl space-y-4 px-4 md:px-6">
        <Semana
          key={`${isoData(seg)}-${versao}`}
          seg={seg}
          onSujo={setSujo}
          sujo={sujo}
          onRecarregar={() => setVersao((v) => v + 1)}
        />
      </main>

      <Confirmar
        aberto={destino !== null}
        onFechar={() => setDestino(null)}
        titulo="Descartar as alterações?"
        descricao="Você mexeu no cardápio desta semana e ainda não salvou. Se continuar, o que foi alterado será perdido."
      >
        <button
          onClick={() => {
            setOffset(destino!);
            setDestino(null);
          }}
          className={CLASSE_BOTAO_PRIMARIO}
        >
          Descartar e mudar de semana
        </button>
        <button onClick={() => setDestino(null)} className={CLASSE_BOTAO_SECUNDARIO}>
          Continuar editando
        </button>
      </Confirmar>
    </div>
  );
}

/** Editor de UMA semana. Tem `key` na semana: trocar de semana recomeça o rascunho. */
function Semana({
  seg,
  onSujo,
  sujo,
  onRecarregar,
}: {
  seg: Date;
  onSujo: (s: boolean) => void;
  sujo: boolean;
  onRecarregar: () => void;
}) {
  const dias = useMemo(() => diasDaSemana(seg), [seg]);
  const isos = useMemo(() => dias.map(isoData), [dias]);
  const dados = useCardapioAdmin(seg);
  const config = useConfiguracoes();
  const bloqueados = new Set(config.data?.dias_bloqueados ?? []);

  if (dados.isError) return <EstadoErro erro={dados.error} onTentar={() => dados.refetch()} />;
  if (dados.isLoading || !dados.data) {
    return (
      <div
        className="grid gap-4 md:grid-cols-2"
        aria-busy="true"
        aria-label="Carregando o cardápio"
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72 rounded-3xl" />
        ))}
      </div>
    );
  }
  return (
    <Editor
      seg={seg}
      dias={dias}
      isos={isos}
      inicial={dados.data}
      bloqueados={bloqueados}
      onSujo={onSujo}
      sujo={sujo}
      onRecarregar={onRecarregar}
    />
  );
}

function Editor({
  seg,
  dias,
  isos,
  inicial,
  bloqueados,
  onSujo,
  sujo,
  onRecarregar,
}: {
  seg: Date;
  dias: Date[];
  isos: string[];
  inicial: (DiaCardapio | null)[];
  bloqueados: Set<string>;
  onSujo: (s: boolean) => void;
  sujo: boolean;
  onRecarregar: () => void;
}) {
  const [salvo, setSalvo] = useState<DiaCardapio[]>(() => inicial.map((d) => d ?? DIA_VAZIO));
  const [rascunho, setRascunho] = useState<DiaCardapio[]>(salvo);
  const [erros, setErros] = useState<Record<number, string>>({});
  const [erroFoto, setErroFoto] = useState<Record<number, string>>({});
  const [subindo, setSubindo] = useState<number | null>(null);
  const [confirmarDuplicar, setConfirmarDuplicar] = useState(false);
  const [avisoDup, setAvisoDup] = useState<string | null>(null);
  const enviadas = useRef(new Set<string>()); // fotos enviadas nesta edição e ainda não salvas
  const salvar = useSalvarCardapio();
  const enviar = useEnviarFoto();
  const duplicar = useDuplicarCardapio();

  const alterados = rascunho.flatMap((d, i) => (diasIguais(d, salvo[i]!) ? [] : [i]));
  const haAlteracoes = alterados.length > 0;
  useEffect(() => onSujo(haAlteracoes), [haAlteracoes, onSujo]);
  // Saiu da semana/tela sem salvar: apaga do Storage as fotos que foram enviadas e ficaram sem uso.
  useEffect(() => {
    const pendentes = enviadas.current;
    return () => {
      if (pendentes.size > 0) void removerFotos([...pendentes]);
    };
  }, []);

  const mudar = (i: number, parcial: Partial<DiaCardapio>) => {
    setRascunho((r) => r.map((d, j) => (j === i ? { ...d, ...parcial } : d)));
    setErros((e) => {
      const { [i]: _, ...resto } = e;
      return resto;
    });
  };

  const trocarFoto = (i: number, arquivo: File) => {
    setErroFoto((e) => ({ ...e, [i]: "" }));
    setSubindo(i);
    enviar.mutate(
      { data: isos[i]!, arquivo },
      {
        onSuccess: (url) => {
          const antiga = rascunho[i]!.foto_url;
          // foto enviada agora e já substituída antes de salvar: não serve para nada
          if (antiga && enviadas.current.has(antiga)) {
            enviadas.current.delete(antiga);
            void removerFotos([antiga]);
          }
          enviadas.current.add(url);
          mudar(i, { foto_url: url });
        },
        onError: (e) =>
          setErroFoto((x) => ({
            ...x,
            [i]: e instanceof ErroImagem ? e.message : mensagemDeErro(e),
          })),
        onSettled: () => setSubindo(null),
      },
    );
  };

  const descartar = () => {
    if (enviadas.current.size > 0) void removerFotos([...enviadas.current]);
    enviadas.current.clear();
    setRascunho(salvo);
    setErros({});
    salvar.reset();
  };

  const gravar = () => {
    const novosErros: Record<number, string> = {};
    for (const i of alterados) {
      const p = problemaDoDia(rascunho[i]!);
      if (p) novosErros[i] = p;
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;
    const alteracoes: AlteracaoDia[] = alterados.map((i) => ({
      data: isos[i]!,
      dia: rascunho[i]!,
      fotoAnterior: salvo[i]!.foto_url,
    }));
    salvar.mutate(alteracoes, {
      onSuccess: () => {
        const limpo = rascunho.map(limparDia);
        // fotos enviadas e trocadas/removidas antes de salvar viram lixo no Storage
        const emUso = new Set(limpo.map((d) => d.foto_url));
        void removerFotos([...enviadas.current].filter((u) => !emUso.has(u)));
        enviadas.current.clear();
        setSalvo(limpo);
        setRascunho(limpo);
        toast.success(
          `Cardápio salvo (${alteracoes.length} dia${alteracoes.length !== 1 ? "s" : ""}).`,
        );
      },
    });
  };

  // Duplicar a semana anterior para esta
  const preenchidos = salvo.filter((d) => d.prato).length;
  const anterior = isoData(new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() - 7));
  const fazerDuplicacao = (substituir: boolean) => {
    setConfirmarDuplicar(false);
    setAvisoDup(null);
    duplicar.mutate(
      { origem: anterior, destino: isoData(seg), substituir },
      {
        onSuccess: (r) => {
          if (r.origem_vazia) setAvisoDup("A semana anterior não tem cardápio para copiar.");
          else if (r.copiados === 0)
            setAvisoDup("Nada foi copiado: todos os dias desta semana já estavam preenchidos.");
          else {
            toast.success(
              `${r.copiados} dia${r.copiados !== 1 ? "s" : ""} copiado${r.copiados !== 1 ? "s" : ""} da semana anterior. As fotos não são copiadas.`,
            );
            onRecarregar(); // recomeça o editor com o que ficou no banco
          }
        },
      },
    );
  };

  return (
    <>
      <Cartao
        icone={<Copy className="h-5 w-5" />}
        titulo="Duplicar a semana anterior"
        descricao="Copia pratos, acompanhamentos, sobremesas e tags. As fotos não são copiadas."
      >
        <button
          onClick={() => (preenchidos > 0 ? setConfirmarDuplicar(true) : fazerDuplicacao(false))}
          disabled={sujo || duplicar.isPending}
          className={`${CLASSE_BOTAO_SECUNDARIO} w-full md:w-auto`}
        >
          {duplicar.isPending ? (
            <>
              <Girando /> Copiando…
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copiar da semana anterior
            </>
          )}
        </button>
        {sujo && (
          <p className="mt-2 text-xs text-muted-foreground">
            Salve ou descarte as alterações antes de copiar.
          </p>
        )}
        {avisoDup && (
          <div className="mt-3">
            <Aviso tipo="info">{avisoDup}</Aviso>
          </div>
        )}
        {duplicar.isError && (
          <div className="mt-3">
            <Aviso>{mensagemDeErro(duplicar.error)}</Aviso>
          </div>
        )}
      </Cartao>

      <div className="grid gap-4 md:grid-cols-2">
        {dias.map((d, i) => (
          <DiaEditor
            key={isos[i]}
            nome={NOMES[i]!}
            dataCurta={fmtCurta(d)}
            dia={rascunho[i]!}
            alterado={alterados.includes(i)}
            semAlmoco={bloqueados.has(isos[i]!)}
            erro={erros[i] ?? null}
            enviandoFoto={subindo === i}
            erroFoto={erroFoto[i] || null}
            onChange={(p) => mudar(i, p)}
            onFoto={(f) => trocarFoto(i, f)}
            onLimpar={() => mudar(i, { ...DIA_VAZIO })}
          />
        ))}
      </div>

      <BarraSalvar
        visivel={haAlteracoes}
        resumo={`${alterados.length} dia${alterados.length !== 1 ? "s" : ""} alterado${alterados.length !== 1 ? "s" : ""}`}
        detalhe={
          Object.keys(erros).length > 0 ? "Corrija os dias marcados em vermelho" : "Ainda não salvo"
        }
        salvando={salvar.isPending}
        erro={salvar.isError ? mensagemDeErro(salvar.error) : null}
        onSalvar={gravar}
        onDescartar={descartar}
        rotulo="Salvar semana"
      />

      <Confirmar
        aberto={confirmarDuplicar}
        onFechar={() => setConfirmarDuplicar(false)}
        titulo="Esta semana já tem cardápio"
        descricao={`${preenchidos} dia${preenchidos !== 1 ? "s" : ""} desta semana já ${preenchidos !== 1 ? "estão preenchidos" : "está preenchido"}. O que você prefere?`}
      >
        <button onClick={() => fazerDuplicacao(false)} className={CLASSE_BOTAO_PRIMARIO}>
          Preencher só os dias vazios
        </button>
        <button onClick={() => fazerDuplicacao(true)} className={CLASSE_BOTAO_SECUNDARIO}>
          Substituir os dias preenchidos
        </button>
        <button
          onClick={() => setConfirmarDuplicar(false)}
          className="h-11 text-sm font-semibold text-muted-foreground"
        >
          Cancelar
        </button>
      </Confirmar>
    </>
  );
}
