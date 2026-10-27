import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EstadoErro } from "@/components/EstadoErro";
import { Aviso, CLASSE_CAMPO_GRANDE, Girando } from "@/components/admin/ui";
import { useAdminSessao, useEntrarAdmin } from "@/hooks/use-admin";
import { mensagemDeLogin } from "@/lib/erros";

// "admin_" (com sublinhado) faz esta tela NÃO ficar dentro do guarda de /admin.
export const Route = createFileRoute("/admin_/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Painel Almoço SESI" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Login,
});

function Login() {
  const sessao = useAdminSessao();
  const entrar = useEntrarAdmin();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);

  if (sessao.data?.status === "admin") return <Navigate to="/admin" replace />;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim() && senha) entrar.mutate({ email, senha });
  };

  return (
    <div className="min-h-dvh-screen bg-background pb-12">
      <PageHeader
        eyebrow={
          <>
            <Lock className="h-3.5 w-3.5 text-accent" /> Área restrita
          </>
        }
        title="Entrar no painel"
      />
      <main className="relative mx-auto -mt-8 max-w-md px-4">
        {sessao.isError ? (
          <EstadoErro erro={sessao.error} onTentar={() => sessao.refetch()} />
        ) : (
          <div className="flex flex-col items-center rounded-3xl border bg-card px-6 py-8 text-center shadow-glow animate-rise">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
              <Lock className="h-7 w-7" />
            </div>
            <p className="mt-4 text-lg font-bold">Administração</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Entre com o e-mail e a senha do administrador.
            </p>
            <form
              onSubmit={enviar}
              className="mt-5 flex w-full flex-col gap-3 text-left"
              noValidate
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                aria-label="E-mail"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                className={CLASSE_CAMPO_GRANDE}
              />
              <div className="relative">
                <input
                  type={ver ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Senha"
                  aria-label="Senha"
                  autoComplete="current-password"
                  className={`${CLASSE_CAMPO_GRANDE} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  aria-label={ver ? "Esconder a senha" : "Mostrar a senha"}
                  className="absolute right-1 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center text-muted-foreground"
                >
                  {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {entrar.isError && <Aviso>{mensagemDeLogin(entrar.error)}</Aviso>}
              <button
                type="submit"
                disabled={entrar.isPending || !email.trim() || !senha}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-on px-4 text-base font-bold text-primary-foreground shadow-glow transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-60"
              >
                {entrar.isPending ? (
                  <>
                    <Girando /> Entrando…
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
