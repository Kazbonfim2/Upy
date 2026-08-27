import {
  ActivityIcon,
  BellIcon,
  ClockIcon,
  DatabaseIcon,
  GitBranchIcon,
  ServerIcon,
  ShieldIcon,
  SparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BuyMeACoffee } from "@/components/BuyMeACoffee";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { GithubIcon } from "@/components/GithubIcon";
import { Logo } from "@/components/Logo";
import { Navbar } from "@/components/Navbar";

const features = [
  {
    icon: ActivityIcon,
    title: "Health checks",
    body: "Nome, URL, método HTTP, intervalo, timeout e status esperado. GET, HEAD, POST e o resto.",
  },
  {
    icon: ClockIcon,
    title: "Worker separado",
    body: "O processo que bate na URL não é a API. Timeout num site lento não trava o dashboard.",
  },
  {
    icon: ShieldIcon,
    title: "Incidentes",
    body: "Caiu: abre incidente e alerta. Voltou: fecha sozinho. Sem spam a cada check falho.",
  },
  {
    icon: BellIcon,
    title: "Alertas",
    body: "E-mail, webhook do Discord ou POST genérico. Só na abertura e na recuperação.",
  },
  {
    icon: DatabaseIcon,
    title: "Histórico no Postgres",
    body: "Status HTTP, latência, erro e horário. Uptime e média saem da mesma tabela.",
  },
  {
    icon: ServerIcon,
    title: "Self-hosted",
    body: "Docker Compose: banco, API, worker e UI. Os dados ficam na sua máquina, não num SaaS.",
  },
];

export default function Home() {
  return (
    <div className="min-h-svh">
      <Navbar />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            API & Website Monitor
          </p>
          <h1 className="mb-3">
            <Logo className="text-6xl sm:text-8xl animate-jiggle select-none" />
          </h1>
          <div className="mb-6 flex justify-center">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs sm:text-sm font-medium">
              <SparklesIcon className="size-3.5 text-amber-500" />
              Agora com IA!
            </Badge>
          </div>
          <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground text-pretty">
            Cadastre URLs. Um worker verifica disponibilidade e latência. O dashboard mostra o
            estado agora — e o incidente quando algo cai. Código aberto. Você hospeda.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="xl" render={<a href="/app" />}>
              Abrir dashboard
            </Button>
            <Button size="xl" variant="outline" render={<a href="#self-host" />}>
              Subir na sua máquina
            </Button>
            <Button
              size="xl"
              variant="outline"
              render={
                <a
                  href="https://github.com/Kazbonfim2/Upy"
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <GithubIcon className="size-5" />
              Veja no GitHub
            </Button>
            <BuyMeACoffee size="xl" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-heading text-2xl font-medium tracking-tight">O que o Upy faz</h2>
          <p className="mt-2 text-muted-foreground">
            Ferramenta no estilo UptimeRobot, sem conta na nuvem de terceiro. MVP enxuto: monitor,
            check, incidente, alerta.
          </p>
        </div>
        {/* Preciso de ajuda aqui, depois de montado, o componente nunca executa o estilo de animação -translate-y */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 hover:cursor-pointer">
          {features.map((f) => (
            <Card key={f.title} className="duration-200 hover:-translate-y-2 hover:border">
              <CardHeader>
                <f.icon className="mb-2 size-5 text-muted-foreground" aria-hidden />
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="self-host" className="scroll-mt-16 border-t bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="success">Open Source</Badge>
              <Badge variant="info">Self-hosted</Badge>
            </div>
            <h2 className="font-heading text-2xl font-medium tracking-tight">
              Seu Postgres. Seu worker. Sua regra.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Licença MIT. Sem telemetria, sem plano pago, sem Kubernetes. Compose sobe banco, API,
              worker e a UI. O código está no repositório — fork, patch, hospeda onde quiser.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <GitBranchIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                Código aberto, MIT, pra estudar ou rodar em produção pequena.
              </li>
              <li className="flex gap-2">
                <ServerIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                Self-hosted: os checks saem da sua rede, os dados não saem do seu disco.
              </li>
            </ul>
            <div className="mt-6">
              <Button
                variant="outline"
                render={
                  <a
                    href="https://github.com/Kazbonfim2/Upy"
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <GithubIcon className="size-4" />
                Ver repositório no GitHub
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Docker</CardTitle>
              <CardDescription>Na raiz do projeto.</CardDescription>
            </CardHeader>
            <CardPanel>
              <pre className="overflow-x-auto rounded-lg bg-background p-4 text-sm">
                <code>{`cp .env.example .env
docker compose up -d --build`}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground">
                Dashboard em localhost:5173 · API em :3000
              </p>
            </CardPanel>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
