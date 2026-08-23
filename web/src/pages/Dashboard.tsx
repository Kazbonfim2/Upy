import { ActivityIcon, ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { Navbar } from "@/components/Navbar";
import { api, type CardRow, type Monitor, type MonitorDetail } from "@/lib/api";

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

function groupCardsByStatus(cards: CardRow[]) {
  const order: string[] = [];
  const map = new Map<string, CardRow[]>();
  for (const card of cards) {
    if (!map.has(card.status)) {
      map.set(card.status, []);
      order.push(card.status);
    }
    map.get(card.status)!.push(card);
  }
  return order.map((status) => ({ status, cards: map.get(status)! }));
}

export default function Dashboard() {
  const [list, setList] = useState<Monitor[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<MonitorDetail | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [channel, setChannel] = useState(CHANNELS[1]);
  const [cardOpen, setCardOpen] = useState(false);
  const [viewingCard, setViewingCard] = useState<CardRow | null>(null);

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

  async function onSaveCard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    try {
      await api.addCard(selected.id, {
        name: fd.get("name"),
        status: fd.get("status"),
        description: fd.get("description"),
      });
      toastManager.add({ title: "Card criado", type: "success" });
      setCardOpen(false);
      await refresh();
    } catch (err) {
      toastManager.add({ title: "Falha", description: String(err), type: "error" });
    }
  }

  async function onToggleResolved(card: CardRow) {
    if (!selected) return;
    try {
      const updated = await api.patchCard(selected.id, card.id, { resolved: !card.resolved });
      toastManager.add({
        title: updated.resolved ? "Card resolvido" : "Card reaberto",
        type: "success",
      });
      await refresh();
      if (viewingCard?.id === card.id) setViewingCard(updated);
    } catch (err) {
      toastManager.add({ title: "Falha", description: String(err), type: "error" });
    }
  }

  const kanbanColumns = groupCardsByStatus(selected?.cards ?? []);

  return (
    <div className="min-h-svh">
      <Navbar>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" type="button" />}>Novo monitor</DialogTrigger>
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
      </Navbar>

      <main className="mx-auto max-w-6xl px-4 py-8">

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
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Monitores</CardTitle>
            <CardDescription>Status atual. Clique na linha pra histórico e incidentes.</CardDescription>
          </CardHeader>
          <CardPanel className="max-h-96 overflow-auto p-0">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-full max-w-0">URL</TableHead>
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
                    <TableCell className="w-full max-w-0 truncate">{m.url}</TableCell>
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
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-heading text-xl">{selected.name}</h2>
              <p className="mt-3 break-all text-sm text-muted-foreground">
                {selected.method} {selected.url} · uptime{" "}
                {selected.stats.pct == null ? "—" : `${selected.stats.pct}%`} · média{" "}
                {selected.stats.avgMs} ms
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
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
                className="w-full sm:w-auto"
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
            <Collapsible defaultOpen className="group">
              <div className="flex items-center gap-2">
                <TabsList className="min-w-0 flex-1 overflow-x-auto">
                  <TabsTab value="history" className="flex-1">
                    Histórico
                  </TabsTab>
                  <TabsTab value="incidents" className="flex-1">
                    Incidentes
                  </TabsTab>
                  <TabsTab value="alerts" className="flex-1">
                    Alertas
                  </TabsTab>
                  <TabsTab value="kanban" className="flex-1">
                    Kanban
                  </TabsTab>
                </TabsList>
                <CollapsibleTrigger
                  render={<Button type="button" variant="ghost" size="icon" />}
                  className="shrink-0 data-panel-open:*:data-[slot=collapsible-indicator]:rotate-180"
                  aria-label="Recolher painel"
                >
                  <ChevronDownIcon
                    className="size-4 transition-transform duration-200"
                    data-slot="collapsible-indicator"
                  />
                </CollapsibleTrigger>
              </div>
              <CollapsiblePanel>
                <TabsPanel value="history" className="mt-4 max-h-96 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead>Quando</TableHead>
                        <TableHead>OK</TableHead>
                        <TableHead>HTTP</TableHead>
                        <TableHead>ms</TableHead>
                        <TableHead className="w-full max-w-0">Erro</TableHead>
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
                          <TableCell className="w-full max-w-0 truncate">{c.error ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsPanel>
                <TabsPanel value="incidents" className="mt-4 max-h-96 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead className="w-full max-w-0">Erro</TableHead>
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
                            <TableCell className="w-full max-w-0 truncate">{i.lastError ?? "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsPanel>
                <TabsPanel value="alerts" className="mt-4 space-y-4">
                  <Form className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={onAddAlert}>
                    <Field className="min-w-0 sm:min-w-40">
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
                    <Field className="min-w-0 flex-1 sm:min-w-64">
                      <FieldLabel>Destino</FieldLabel>
                      <Input
                        name="target"
                        type="text"
                        required
                        placeholder="e-mail, URL do Discord ou webhook"
                      />
                    </Field>
                    <Button type="submit" className="w-full sm:w-auto">
                      Adicionar
                    </Button>
                  </Form>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Canal</TableHead>
                        <TableHead className="w-full max-w-0">Destino</TableHead>
                        <TableHead className="w-px" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.alerts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.channel}</TableCell>
                          <TableCell className="w-full max-w-0 truncate">{a.target}</TableCell>
                          <TableCell className="w-px">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
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
                <TabsPanel value="kanban" className="mt-4 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Cards por status. Colunas surgem ao criar.
                    </p>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={() => setCardOpen(true)}
                    >
                      Novo card
                    </Button>
                  </div>

                  {kanbanColumns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum card ainda.</p>
                  ) : (
                    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                      {kanbanColumns.map((col) => (
                        <div
                          key={col.status}
                          className="flex w-[85vw] max-w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/40 p-2 sm:w-72"
                        >
                          <div className="flex items-center justify-between gap-2 px-1 pt-1">
                            <h3 className="truncate text-sm font-medium">{col.status}</h3>
                            <Badge variant="secondary">{col.cards.length}</Badge>
                          </div>
                          <div className="flex flex-col gap-2">
                            {col.cards.map((card) => (
                              <article
                                key={card.id}
                                role="button"
                                tabIndex={0}
                                className={`cursor-pointer rounded-md border bg-background p-3 text-left shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  card.resolved ? "opacity-60" : ""
                                }`}
                                onClick={() => setViewingCard(card)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setViewingCard(card);
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <h4
                                    className={`break-words text-sm font-medium ${
                                      card.resolved ? "line-through" : ""
                                    }`}
                                  >
                                    {card.name}
                                  </h4>
                                  {card.resolved ? (
                                    <Badge variant="success" className="shrink-0">
                                      resolvido
                                    </Badge>
                                  ) : null}
                                </div>
                                {card.description ? (
                                  <p className="mt-2 line-clamp-3 break-words text-xs text-muted-foreground">
                                    {card.description}
                                  </p>
                                ) : null}
                                <div
                                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    onClick={() => onToggleResolved(card)}
                                  >
                                    {card.resolved ? "Reabrir" : "Resolver"}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    className="w-full sm:w-auto"
                                    onClick={async () => {
                                      if (!confirm(`Apagar card "${card.name}"?`)) return;
                                      try {
                                        await api.removeCard(selected.id, card.id);
                                        toastManager.add({ title: "Card removido", type: "success" });
                                        await refresh();
                                      } catch (err) {
                                        toastManager.add({
                                          title: "Falha",
                                          description: String(err),
                                          type: "error",
                                        });
                                      }
                                    }}
                                  >
                                    Apagar
                                  </Button>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Dialog
                    open={viewingCard != null}
                    onOpenChange={(next) => {
                      if (!next) setViewingCard(null);
                    }}
                  >
                    <DialogPopup>
                      <DialogHeader>
                        <DialogTitle>{viewingCard?.name}</DialogTitle>
                        <DialogDescription>Detalhes do card (somente leitura).</DialogDescription>
                      </DialogHeader>
                      {viewingCard ? (
                        <DialogPanel className="grid gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <p className="mt-1 break-words font-medium">{viewingCard.status}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Situação</p>
                            <p className="mt-1">
                              {viewingCard.resolved ? (
                                <Badge variant="success">resolvido</Badge>
                              ) : (
                                <Badge variant="secondary">aberto</Badge>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Descrição</p>
                            <p className="mt-1 break-words whitespace-pre-wrap">
                              {viewingCard.description || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Criado em</p>
                            <p className="mt-1">{fmt(viewingCard.createdAt)}</p>
                          </div>
                        </DialogPanel>
                      ) : null}
                      <DialogFooter className="flex-col gap-2 sm:flex-row">
                        {viewingCard ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => onToggleResolved(viewingCard)}
                          >
                            {viewingCard.resolved ? "Reabrir" : "Resolver"}
                          </Button>
                        ) : null}
                        <DialogClose render={<Button type="button" variant="ghost" className="w-full sm:w-auto" />}>
                          Fechar
                        </DialogClose>
                      </DialogFooter>
                    </DialogPopup>
                  </Dialog>

                  <Dialog open={cardOpen} onOpenChange={setCardOpen}>
                    <DialogPopup>
                      <DialogHeader>
                        <DialogTitle>Novo card</DialogTitle>
                        <DialogDescription>
                          Nome e status até 100 caracteres; descrição até 300.
                        </DialogDescription>
                      </DialogHeader>
                      <Form className="contents" onSubmit={onSaveCard}>
                        <DialogPanel className="grid gap-4">
                          <Field>
                            <FieldLabel>Nome</FieldLabel>
                            <Input
                              name="name"
                              type="text"
                              required
                              maxLength={100}
                              placeholder="Ex.: Latência alta"
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Status</FieldLabel>
                            <Input
                              name="status"
                              type="text"
                              required
                              maxLength={100}
                              placeholder="Ex.: 200, backlog, done"
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Descrição</FieldLabel>
                            <Textarea
                              name="description"
                              maxLength={300}
                              rows={4}
                              placeholder="Detalhe opcional"
                            />
                          </Field>
                        </DialogPanel>
                        <DialogFooter>
                          <DialogClose render={<Button type="button" variant="ghost" />}>
                            Cancelar
                          </DialogClose>
                          <Button type="submit">Salvar</Button>
                        </DialogFooter>
                      </Form>
                    </DialogPopup>
                  </Dialog>
                </TabsPanel>
              </CollapsiblePanel>
            </Collapsible>
          </Tabs>
        </section>
      ) : null}
      </main>
    </div>
  );
}
