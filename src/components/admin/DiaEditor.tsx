import { useRef, useState } from "react";
import { Camera, Eraser, Image as ImagemIcon, Plus, Trash2, X } from "lucide-react";
import { Girando, CLASSE_CAMPO } from "@/components/admin/ui";
import {
  adicionarTag,
  diaEstaVazio,
  TAG_MAXIMO,
  TAGS_PADRAO,
  TAGS_POR_DIA,
  type DiaCardapio,
} from "@/lib/admin-data";
import { cn } from "@/lib/utils";

/** Um dia da semana no editor do cardápio: pratos, tags e foto. */
export function DiaEditor({
  nome,
  dataCurta,
  dia,
  alterado,
  semAlmoco,
  erro,
  enviandoFoto,
  erroFoto,
  onChange,
  onFoto,
  onLimpar,
}: {
  nome: string;
  dataCurta: string;
  dia: DiaCardapio;
  alterado: boolean;
  /** O dia está nos "dias sem almoço" das Configurações. */
  semAlmoco: boolean;
  erro: string | null;
  enviandoFoto: boolean;
  erroFoto: string | null;
  onChange: (parcial: Partial<DiaCardapio>) => void;
  onFoto: (arquivo: File) => void;
  onLimpar: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [novaTag, setNovaTag] = useState("");
  const vazio = diaEstaVazio(dia);
  const personalizadas = dia.tags.filter(
    (t) => !TAGS_PADRAO.some((p) => p.toLowerCase() === t.toLowerCase()),
  );
  const id = `dia-${dataCurta.replace("/", "-")}`;

  const alternar = (tag: string) => {
    const existe = dia.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
    onChange({
      tags: existe
        ? dia.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : adicionarTag(dia.tags, tag),
    });
  };
  const acrescentar = () => {
    if (!novaTag.trim()) return;
    onChange({ tags: adicionarTag(dia.tags, novaTag) });
    setNovaTag("");
  };
  const escolheu = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (f) onFoto(f);
  };

  return (
    <section
      className={cn(
        "rounded-3xl border bg-card p-4 animate-rise md:p-5",
        alterado && "ring-2 ring-primary/40",
      )}
      aria-labelledby={`${id}-t`}
    >
      <header className="flex items-center gap-2">
        <h3 id={`${id}-t`} className="text-lg font-extrabold">
          {nome} <span className="text-sm font-semibold text-muted-foreground">{dataCurta}</span>
        </h3>
        <span className="flex-1" />
        {semAlmoco && (
          <span className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">
            Sem almoço
          </span>
        )}
        {alterado ? (
          <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
            Alterado
          </span>
        ) : (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              vazio ? "bg-muted text-muted-foreground" : "bg-success/15 text-success",
            )}
          >
            {vazio ? "Vazio" : "Publicado"}
          </span>
        )}
      </header>

      <div className="mt-3 space-y-2.5">
        <input
          id={`${id}-prato`}
          value={dia.prato}
          onChange={(e) => onChange({ prato: e.target.value })}
          maxLength={120}
          placeholder="Prato principal"
          aria-label={`Prato principal de ${nome}`}
          aria-invalid={Boolean(erro)}
          className={cn(CLASSE_CAMPO, erro && "border-accent")}
        />
        <input
          value={dia.acompanhamento}
          onChange={(e) => onChange({ acompanhamento: e.target.value })}
          maxLength={120}
          placeholder="Acompanhamento"
          aria-label={`Acompanhamento de ${nome}`}
          className={CLASSE_CAMPO}
        />
        <input
          value={dia.sobremesa}
          onChange={(e) => onChange({ sobremesa: e.target.value })}
          maxLength={120}
          placeholder="Sobremesa"
          aria-label={`Sobremesa de ${nome}`}
          className={CLASSE_CAMPO}
        />
        {erro && (
          <p role="alert" className="text-sm font-semibold text-accent">
            {erro}
          </p>
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold text-muted-foreground">Tags</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {TAGS_PADRAO.map((t) => {
            const on = dia.tags.some((x) => x.toLowerCase() === t.toLowerCase());
            return (
              <button
                key={t}
                onClick={() => alternar(t)}
                aria-pressed={on}
                className={cn(
                  "h-11 rounded-xl px-3.5 text-sm font-semibold transition active:scale-95",
                  on
                    ? "bg-on text-primary-foreground"
                    : "border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {t}
              </button>
            );
          })}
          {personalizadas.map((t) => (
            <button
              key={t}
              onClick={() => alternar(t)}
              aria-label={`Remover a tag ${t}`}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-on px-3.5 text-sm font-semibold text-primary-foreground transition active:scale-95"
            >
              {t} <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        {dia.tags.length < TAGS_POR_DIA && (
          <div className="mt-2 flex gap-2">
            <input
              value={novaTag}
              onChange={(e) => setNovaTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  acrescentar();
                }
              }}
              maxLength={TAG_MAXIMO}
              placeholder="Outra tag (ex.: Sem ovo)"
              aria-label="Nova tag"
              className={cn(CLASSE_CAMPO, "flex-1")}
            />
            <button
              onClick={acrescentar}
              disabled={!novaTag.trim()}
              aria-label="Adicionar tag"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border bg-card transition hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-muted-foreground">Foto do prato</p>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label={`Tirar foto do prato de ${nome}`}
          onChange={escolheu}
        />
        <input
          ref={galeria}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="sr-only"
          aria-label={`Escolher foto do prato de ${nome}`}
          onChange={escolheu}
        />
        {dia.foto_url ? (
          <div className="relative mt-1.5 overflow-hidden rounded-2xl border">
            <img
              src={dia.foto_url}
              alt={`Foto do prato de ${nome}: ${dia.prato || "sem nome"}`}
              loading="lazy"
              className="aspect-video w-full object-cover"
            />
            {enviandoFoto && (
              <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
                <Girando className="h-6 w-6" />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1.5 grid aspect-video w-full place-items-center rounded-2xl border-2 border-dashed bg-muted/40 text-sm text-muted-foreground">
            {enviandoFoto ? (
              <Girando className="h-6 w-6" />
            ) : (
              <span className="flex items-center gap-2">
                <ImagemIcon className="h-5 w-5" /> Sem foto
              </span>
            )}
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => camera.current?.click()}
            disabled={enviandoFoto}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border bg-card text-sm font-semibold transition hover:bg-muted active:scale-[.97] disabled:opacity-60"
          >
            <Camera className="h-4 w-4" /> Tirar foto
          </button>
          <button
            onClick={() => galeria.current?.click()}
            disabled={enviandoFoto}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border bg-card text-sm font-semibold transition hover:bg-muted active:scale-[.97] disabled:opacity-60"
          >
            <ImagemIcon className="h-4 w-4" /> {dia.foto_url ? "Trocar" : "Da galeria"}
          </button>
        </div>
        {dia.foto_url && (
          <button
            onClick={() => onChange({ foto_url: null })}
            disabled={enviandoFoto}
            className="mt-1 flex h-11 items-center gap-2 text-sm font-semibold text-accent hover:underline disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" /> Remover foto
          </button>
        )}
        {erroFoto && (
          <p role="alert" className="mt-1 text-sm font-semibold text-accent">
            {erroFoto}
          </p>
        )}
      </div>

      <button
        onClick={onLimpar}
        disabled={vazio}
        className="mt-3 flex h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <Eraser className="h-4 w-4" /> Limpar o dia (sem cardápio)
      </button>
    </section>
  );
}
