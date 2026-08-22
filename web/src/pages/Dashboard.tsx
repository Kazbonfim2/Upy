import { ActivityIcon } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { toastManager } from "@/components/ui/toast";
import { Logo } from "@/components/Logo";
import { api, type Monitor, type MonitorDetail } from "@/lib/api";

const METHODS = [
  { label: "GET", value: "GET" },
  { label: "HEAD", value: "HEAD" },
  { label: "POST", value: "POST" },
  { label: "PUT", value: "PUT" },
  { label: "PATCH", value: "PATCH" },
  { label: "DELETE", value: "DELETE" },
];

const CHANNELS = [
  { label: "E-mail", value: "email" },
  { label: "Discord", value: "discord" },
  { label: "Webhook", value: "webhook" },
];

function statusBadge(m: Monitor) {
  if (m.lastOk === null) return <Badge variant="secondary">aguardando</Badge>;
  if (m.lastOk) return <Badge variant="success">up</Badge>;
  return <Badge variant="error">down</Badge>;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function Dashboard() {
  const [list, setList] = useState<Monitor[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<MonitorDetail | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [channel, setChannel] = useState(CHANNELS[1]);

  const refresh = useCallback(async () => {
    const rows = await api.list();
    setList(rows);
    if (selectedId != null) setSelected(await api.get(selectedId));
  }, [selectedId]);

  useEffect(() => {
    refresh().catch((e) => toastManager.add({ title: "Erro", description: String(e), type: "error" }));
    const id = setInterval(() => refresh().catch(() => {}), 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api.create({
        name: fd.get("name"),
        url: fd.get("url"),
        method: method.value,
        intervalSeconds: Number(fd.get("intervalSeconds")),
        timeoutMs: Number(fd.get("timeoutMs")),
        expectedStatus: Number(fd.get("expectedStatus")),
      });
      setOpen(false);
      toastManager.add({ title: "Monitor criado", type: "success" });
      await refresh();
    } catch (err) {
      toastManager.add({ title: "Falha", description: String(err), type: "error" });
    }
  }

  async function onAddAlert(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    try {
      await api.addAlert(selected.id, { channel: channel.value, target: fd.get("target") });
      toastManager.add({ title: "Alerta salvo", type: "success" });
      e.currentTarget.reset();
      await refresh();
    } catch (err) {
      toastManager.add({ title: "Falha", description: String(err), type: "error" });
    }
  }

  return (
    <div className="mx-auto min-h-svh max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <a href="/" className="text-foreground no-underline">
            <Logo className="text-3xl" />
          </a>
          <p className="text-sm text-muted-foreground">API & Website Monitor</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button type="button" />}>Novo monitor</DialogTrigger>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>Cadastrar monitor</DialogTitle>
              <DialogDescription>URL, método, intervalo e status esperado.</DialogDescription>
            </DialogHeader>
            <Form className="contents" onSubmit={onCreate}>
              <DialogPanel className="grid gap-4">
                <Field>
                  <FieldLabel>Nome</FieldLabel>
                  <Input name="name" type="text" required placeholder="API produção" />
                </Field>
                <Field>
                  <FieldLabel>URL</FieldLabel>
                  <Input name="url" type="url" required placeholder="https://exemplo.com/health" />
                </Field>
                <Field>
                  <FieldLabel>Método</FieldLabel>
                  <Select
                    items={METHODS}
                    value={method}
                    onValueChange={(v) => {
                      if (v) setMethod(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {METHODS.map((item) => (
                        <SelectItem key={item.value} value={item}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field>
                    <FieldLabel>Intervalo (s)</FieldLabel>
                    <Input name="intervalSeconds" type="number" min={10} defaultValue={60} required />
                  </Field>
                  <Field>
                    <FieldLabel>Timeout (ms)</FieldLabel>
                    <Input name="timeoutMs" type="number" min={500} defaultValue={5000} required />
                  </Field>
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <Input name="expectedStatus" type="number" min={100} max={599} defaultValue={200} required />
                  </Field>
                </div>
              </DialogPanel>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="ghost" />}>Cancelar</DialogClose>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </Form>
          </DialogPopup>
        </Dialog>
      </header>

      {list.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ActivityIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum monitor</EmptyTitle>
            <EmptyDescription>Cadastre uma URL pra o worker começar a checar.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => setOpen(true)}>
              Novo monitor
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Monitores</CardTitle>
            <CardDescription>Status atual. Clique na linha pra histórico e incidentes.</CardDescription>
          </CardHeader>
          <CardPanel className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Latência</TableHead>
                  <TableHead>Último check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(m.id)}
                  >
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{m.url}</TableCell>
                    <TableCell>{statusBadge(m)}</TableCell>
                    <TableCell>{m.lastStatusCode ?? "—"}</TableCell>
                    <TableCell>{m.lastLatencyMs != null ? `${m.lastLatencyMs} ms` : "—"}</TableCell>
                    <TableCell>{fmt(m.lastCheckedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardPanel>
        </Card>
      )}

      {selected ? (
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl">{selected.name}</h2>
              <p className="text-sm text-muted-foreground">
                {selected.method} {selected.url} · uptime{" "}
                {selected.stats.pct == null ? "—" : `${selected.stats.pct}%`} · média{" "}
                {selected.stats.avgMs} ms
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await api.checkNow(selected.id);
                    toastManager.add({ title: "Check disparado", type: "success" });
                    await refresh();
                  } catch (e) {
                    toastManager.add({ title: "Erro", description: String(e), type: "error" });
                  }
                }}
              >
                Checar agora
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (!confirm(`Apagar ${selected.name}?`)) return;
                  await api.remove(selected.id);
                  setSelectedId(null);
                  setSelected(null);
                  await refresh();
                }}
              >
                Apagar
              </Button>
            </div>
          </div>

          <Tabs defaultValue="history">
            <TabsList>
              <TabsTab value="history">Histórico</TabsTab>
              <TabsTab value="incidents">Incidentes</TabsTab>
              <TabsTab value="alerts">Alertas</TabsTab>
            </TabsList>
            <TabsPanel value="history" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>OK</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>ms</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.checks.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{fmt(c.checkedAt)}</TableCell>
                      <TableCell>
                        {c.ok ? <Badge variant="success">sim</Badge> : <Badge variant="error">não</Badge>}
                      </TableCell>
                      <TableCell>{c.statusCode ?? "—"}</TableCell>
                      <TableCell>{c.latencyMs}</TableCell>
                      <TableCell className="max-w-sm truncate">{c.error ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsPanel>
            <TabsPanel value="incidents" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.incidents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>Nenhum incidente.</TableCell>
                    </TableRow>
                  ) : (
                    selected.incidents.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{fmt(i.startedAt)}</TableCell>
                        <TableCell>{i.endedAt ? fmt(i.endedAt) : "aberto"}</TableCell>
                        <TableCell>{i.lastError ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsPanel>
            <TabsPanel value="alerts" className="mt-4 space-y-4">
              <Form className="flex flex-wrap items-end gap-3" onSubmit={onAddAlert}>
                <Field className="min-w-40">
                  <FieldLabel>Canal</FieldLabel>
                  <Select
                    items={CHANNELS}
                    value={channel}
                    onValueChange={(v) => {
                      if (v) setChannel(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {CHANNELS.map((item) => (
                        <SelectItem key={item.value} value={item}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </Field>
                <Field className="min-w-64 flex-1">
                  <FieldLabel>Destino</FieldLabel>
                  <Input
                    name="target"
                    type="text"
                    required
                    placeholder="e-mail, URL do Discord ou webhook"
                  />
                </Field>
                <Button type="submit">Adicionar</Button>
              </Form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.alerts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.channel}</TableCell>
                      <TableCell className="max-w-md truncate">{a.target}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await api.removeAlert(selected.id, a.id);
                            await refresh();
                          }}
                        >
                          remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsPanel>
          </Tabs>
        </section>
      ) : null}
    </div>
  );
}
