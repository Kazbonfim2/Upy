import { ActivityIcon, ChevronDownIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Modal } from "@/components/Modal";
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
import { Meter, MeterIndicator, MeterLabel, MeterTrack } from "@/components/ui/meter";
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
import { ConfirmModal } from "@/components/ConfirmModal";
import { z } from "zod";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { api, type CardRow, type CheckRow, type Incident, type Monitor, type MonitorDetail } from "@/lib/api";

const METHODS = [
  { label: "GET", value: "GET" },
  { label: "HEAD", value: "HEAD" },
  { label: "POST", value: "POST" },
  { label: "PUT", value: "PUT" },
  { label: "PATCH", value: "PATCH" },
  { label: "DELETE", value: "DELETE" },
];

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const INTERVALS = [
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
  { label: "90s", value: 90 },
];

const CHANNELS = [
  { label: "E-mail", value: "email" },
  { label: "Discord", value: "discord" },
  { label: "Webhook", value: "webhook" },
];

const createMonitorSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  url: z
    .string()
    .trim()
    .min(1, "URL é obrigatória")
    .refine((val) => {
      try {
        const u = new URL(val);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL inválida (deve começar com http:// ou https://)"),
  method: z.string(),
  intervalSeconds: z.number().refine((n) => [30, 60, 90].includes(n), "Intervalo deve ser 30s, 60s ou 90s"),
  timeoutMs: z.coerce.number().int().min(500, "Timeout mínimo de 500ms").max(30000, "Timeout máximo de 30000ms"),
  expectedStatus: z.coerce.number().int().min(100, "Status mínimo 100").max(599, "Status máximo 599"),
  body: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || !val.trim()) return true;
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    }, "JSON do corpo inválido"),
});

function statusBadge(m: Monitor) {
  if (!m.enabled) return <Badge variant="secondary">pausado</Badge>;
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

function formatResponseBody(raw: string | null): string {
  if (!raw || !raw.trim()) return "Sem corpo de resposta.";
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function getCheckResponse(c: CheckRow): string {
  if (c.responseBody && c.responseBody.trim()) return c.responseBody;
  return JSON.stringify(
    {
      statusCode: c.statusCode,
      ok: c.ok,
      latencyMs: c.latencyMs,
      error: c.error ?? (c.ok ? null : "Falha na requisição"),
    },
    null,
    2,
  );
}

function getIncidentResponse(i: Incident): string {
  if (i.responseBody && i.responseBody.trim()) return i.responseBody;
  return JSON.stringify(
    {
      status: i.endedAt ? "resolvido" : "aberto",
      startedAt: i.startedAt,
      endedAt: i.endedAt,
      error: i.lastError ?? "Sem detalhes de erro",
    },
    null,
    2,
  );
}

export default function Dashboard() {
  const [list, setList] = useState<Monitor[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<MonitorDetail | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [intervalOption, setIntervalOption] = useState(INTERVALS[1]);
  const [bodyJson, setBodyJson] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editMethod, setEditMethod] = useState(METHODS[0]);
  const [editInterval, setEditInterval] = useState(INTERVALS[1]);
  const [editBodyJson, setEditBodyJson] = useState("");
  const [channel, setChannel] = useState(CHANNELS[1]);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [viewingCard, setViewingCard] = useState<CardRow | null>(null);
  const [viewingResponse, setViewingResponse] = useState<{ title: string; body: string } | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description?: string;
    confirmText?: string;
    variant?: "destructive" | "default";
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  async function onCopyResponse(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedResponse(true);
      toastManager.add({ title: "Copiado para a área de transferência", type: "success" });
      setTimeout(() => setCopiedResponse(false), 2000);
    } catch (err) {
      toastManager.add({ title: "Falha ao copiar", description: String(err), type: "error" });
    }
  }

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

  function startEdit() {
    if (!selected) return;
    const foundMethod = METHODS.find((m) => m.value === selected.method) || METHODS[0];
    const foundInterval = INTERVALS.find((i) => i.value === selected.intervalSeconds) || INTERVALS[1];
    setEditMethod(foundMethod);
    setEditInterval(foundInterval);
    setEditBodyJson(selected.body ?? "");
    setEditOpen(true);
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const hasBody = METHODS_WITH_BODY.has(editMethod.value);
    const parsed = createMonitorSchema.safeParse({
      name: fd.get("name"),
      url: fd.get("url"),
      method: editMethod.value,
      intervalSeconds: editInterval.value,
      timeoutMs: fd.get("timeoutMs"),
      expectedStatus: fd.get("expectedStatus"),
      body: hasBody ? editBodyJson : undefined,
    });

    if (!parsed.success) {
      toastManager.add({
        title: "Erro de validação",
        description: parsed.error.issues[0]?.message || "Verifique os campos informados.",
        type: "error",
      });
      return;
    }

    try {
      await api.patch(selected.id, {
        name: parsed.data.name,
        url: parsed.data.url,
        method: parsed.data.method,
        intervalSeconds: parsed.data.intervalSeconds,
        timeoutMs: parsed.data.timeoutMs,
        expectedStatus: parsed.data.expectedStatus,
        body: hasBody && parsed.data.body?.trim() ? parsed.data.body.trim() : null,
      });
      setEditOpen(false);
      toastManager.add({ title: "Monitor atualizado", type: "success" });
      await refresh();
    } catch (err) {
      toastManager.add({ title: "Falha", description: String(err), type: "error" });
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const hasBody = METHODS_WITH_BODY.has(method.value);
    const parsed = createMonitorSchema.safeParse({
      name: fd.get("name"),
      url: fd.get("url"),
      method: method.value,
      intervalSeconds: intervalOption.value,
      timeoutMs: fd.get("timeoutMs"),
      expectedStatus: fd.get("expectedStatus"),
      body: hasBody ? bodyJson : undefined,
    });

    if (!parsed.success) {
      toastManager.add({
        title: "Erro de validação",
        description: parsed.error.issues[0]?.message || "Verifique os campos informados.",
        type: "error",
      });
      return;
    }

    try {
      await api.create({
        name: parsed.data.name,
        url: parsed.data.url,
        method: parsed.data.method,
        intervalSeconds: parsed.data.intervalSeconds,
        timeoutMs: parsed.data.timeoutMs,
        expectedStatus: parsed.data.expectedStatus,
        body: hasBody && parsed.data.body?.trim() ? parsed.data.body.trim() : null,
      });
      setOpen(false);
      setBodyJson("");
      setMethod(METHODS[0]);
      setIntervalOption(INTERVALS[1]);
      toastManager.add({ title: "Monitor criado", type: "success" });
      await refresh();
    } catch (err) {
      toastManager.add({ title: "Falha", description: String(err), type: "error" });
    }
  }

  async function onAddAlert(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await api.addAlert(selected.id, { channel: channel.value, target: fd.get("target") });
      toastManager.add({ title: "Alerta salvo", type: "success" });
      form.reset();
      await refresh();
    } catch (err) {
      toastManager.add({ title: "Falha", description: String(err), type: "error" });
    }
  }

  async function onSaveCard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    setIsCreatingCard(true);
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
    } finally {
      setIsCreatingCard(false);
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
    <div className="min-h-svh flex flex-col">
      <Navbar>
        <Modal
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setBodyJson("");
              setMethod(METHODS[0]);
              setIntervalOption(INTERVALS[1]);
            }
          }}
          trigger={<Button size="sm" type="button">Novo monitor</Button>}
          title="Cadastrar monitor"
          description="URL, método, intervalo e status esperado."
          onSubmit={onCreate}
        >
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
          {METHODS_WITH_BODY.has(method.value) ? (
            <Field>
              <FieldLabel>JSON (Body)</FieldLabel>
              <Textarea
                name="body"
                value={bodyJson}
                onChange={(e) => setBodyJson(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                placeholder={'{\n  "key": "value"\n}'}
              />
            </Field>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel>Intervalo</FieldLabel>
              <Select
                items={INTERVALS}
                value={intervalOption}
                onValueChange={(v) => {
                  if (v) setIntervalOption(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {INTERVALS.map((item) => (
                    <SelectItem key={item.value} value={item}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
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
        </Modal>
      </Navbar>

      <main className="mx-auto max-w-6xl px-4 py-8 flex-1 w-full">

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
                  <TableHead className="w-[25%]">Nome</TableHead>
                  <TableHead className="w-[30%]">URL</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                  <TableHead className="w-[10%]">HTTP</TableHead>
                  <TableHead className="w-[10%]">Latência</TableHead>
                  <TableHead className="w-[13%] text-right">Último check</TableHead>
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
                    <TableCell className="max-w-xs truncate text-muted-foreground">{m.url}</TableCell>
                    <TableCell>{statusBadge(m)}</TableCell>
                    <TableCell>{m.lastStatusCode ?? "—"}</TableCell>
                    <TableCell>{m.lastLatencyMs != null ? `${m.lastLatencyMs} ms` : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(m.lastCheckedAt)}</TableCell>
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
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl">{selected.name}</h2>
                {!selected.enabled ? <Badge variant="secondary">pausado</Badge> : null}
              </div>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {selected.method} {selected.url}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={async () => {
                  try {
                    const next = !selected.enabled;
                    await api.patch(selected.id, { enabled: next });
                    toastManager.add({
                      title: next ? "Verificações continuadas" : "Verificações pausadas",
                      type: "success",
                    });
                    await refresh();
                  } catch (err) {
                    toastManager.add({ title: "Falha", description: String(err), type: "error" });
                  }
                }}
              >
                {selected.enabled ? "Pausar" : "Continuar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={async () => {
                  try {
                    await api.checkNow(selected.id);
                    toastManager.add({ title: "Check disparado", type: "success" });
                    await refresh();
                  } catch (err) {
                    toastManager.add({ title: "Falha", description: String(err), type: "error" });
                  }
                }}
              >
                Checar agora
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={startEdit}
              >
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setConfirmState({
                    title: `Resetar histórico de "${selected.name}"?`,
                    description:
                      "Todas as requisições, respostas, incidentes e métricas acumuladas serão limpos. A configuração do monitor e os alertas cadastrados serão mantidos.",
                    confirmText: "Resetar",
                    variant: "destructive",
                    onConfirm: async () => {
                      await api.reset(selected.id);
                      toastManager.add({ title: "Histórico e métricas resetados", type: "success" });
                      await refresh();
                    },
                  });
                }}
              >
                Resetar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => {
                  setConfirmState({
                    title: `Apagar monitor "${selected.name}"?`,
                    description:
                      "Todos os checks, incidentes, alertas e cards vinculados a este monitor serão apagados.",
                    onConfirm: async () => {
                      await api.remove(selected.id);
                      setSelectedId(null);
                      setSelected(null);
                      toastManager.add({ title: "Monitor apagado", type: "success" });
                      await refresh();
                    },
                  });
                }}
              >
                Apagar
              </Button>
            </div>
          </div>

          <Collapsible defaultOpen className="group">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Métricas</span>
              <CollapsibleTrigger
                render={<Button type="button" variant="ghost" size="icon" />}
                className="shrink-0 data-panel-open:*:data-[slot=collapsible-indicator]:rotate-180"
                aria-label="Recolher métricas"
              >
                <ChevronDownIcon
                  className="size-4 transition-transform duration-200"
                  data-slot="collapsible-indicator"
                />
              </CollapsibleTrigger>
            </div>
            <CollapsiblePanel className="pt-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Disponibilidade e Latência
                    </CardTitle>
                  </CardHeader>
                  <CardPanel className="flex flex-1 flex-col justify-between gap-3 p-4 pt-0">
                    <Meter value={selected.stats.pct ?? 0}>
                      <div className="flex items-center justify-between text-xs">
                        <MeterLabel>Uptime</MeterLabel>
                        <span className="font-medium text-foreground">
                          {selected.stats.pct == null ? "—" : `${selected.stats.pct}%`}
                        </span>
                      </div>
                      <MeterTrack>
                        <MeterIndicator
                          className={
                            selected.stats.pct != null && selected.stats.pct >= 99
                              ? "bg-emerald-500"
                              : selected.stats.pct != null && selected.stats.pct >= 95
                                ? "bg-amber-500"
                                : "bg-primary"
                          }
                        />
                      </MeterTrack>
                    </Meter>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Média de resposta</p>
                        <p className="text-2xl font-bold tracking-tight sm:text-3xl">
                          {selected.stats.avgMs}{" "}
                          <span className="text-sm font-normal text-muted-foreground">ms</span>
                        </p>
                      </div>
                      {selected.stats.total > 0 && (
                        <Badge
                          variant={
                            selected.stats.avgMs <= 300
                              ? "success"
                              : selected.stats.avgMs <= 800
                                ? "warning"
                                : "error"
                          }
                        >
                          {selected.stats.avgMs <= 300
                            ? "Excelente!"
                            : selected.stats.avgMs <= 800
                              ? "Mediano"
                              : "Ruim"}
                        </Badge>
                      )}
                    </div>
                  </CardPanel>
                </Card>

                <Card className="flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Incidentes
                    </CardTitle>
                  </CardHeader>
                  <CardPanel className="flex flex-1 flex-col justify-between gap-3 p-4 pt-0">
                    <Meter value={selected.incidents.some((i) => !i.endedAt) ? 100 : 0}>
                      <div className="flex items-center justify-between text-xs">
                        <MeterLabel>Status</MeterLabel>
                        <span className="font-medium text-foreground">
                          {selected.incidents.some((i) => !i.endedAt) ? "Instável" : "Estável"}
                        </span>
                      </div>
                      <MeterTrack>
                        <MeterIndicator
                          className={
                            selected.incidents.some((i) => !i.endedAt)
                              ? "bg-rose-500"
                              : "bg-emerald-500"
                          }
                        />
                      </MeterTrack>
                    </Meter>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Total registrado</p>
                        <p className="text-2xl font-bold tracking-tight sm:text-3xl">
                          {selected.incidents.length}
                        </p>
                      </div>
                      <Badge
                        variant={
                          selected.incidents.some((i) => !i.endedAt) ? "error" : "success"
                        }
                      >
                        {selected.incidents.some((i) => !i.endedAt)
                          ? "Incidente aberto"
                          : "Sem incidentes"}
                      </Badge>
                    </div>
                  </CardPanel>
                </Card>

                <Card className="flex flex-col justify-between sm:col-span-2 lg:col-span-1">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Verificações
                    </CardTitle>
                  </CardHeader>
                  <CardPanel className="flex flex-1 flex-col justify-between gap-3 p-4 pt-0">
                    <Meter
                      value={
                        selected.stats.total > 0
                          ? Math.round((selected.stats.ok / selected.stats.total) * 100)
                          : 0
                      }
                    >
                      <div className="flex items-center justify-between text-xs">
                        <MeterLabel>Taxa de sucesso</MeterLabel>
                        <span className="font-medium text-foreground">
                          {selected.stats.total > 0
                            ? `${Math.round((selected.stats.ok / selected.stats.total) * 100)}%`
                            : "—"}
                        </span>
                      </div>
                      <MeterTrack>
                        <MeterIndicator className="bg-primary" />
                      </MeterTrack>
                    </Meter>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Total de checks</p>
                        <p className="text-2xl font-bold tracking-tight sm:text-3xl">
                          {selected.stats.total}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {selected.intervalSeconds}s intervalo
                      </Badge>
                    </div>
                  </CardPanel>
                </Card>
              </div>
            </CollapsiblePanel>
          </Collapsible>

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
                <TabsPanel value="history" className="mt-4 h-96 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="w-[22%]">Quando</TableHead>
                        <TableHead className="w-[10%]">OK</TableHead>
                        <TableHead className="w-[10%]">HTTP</TableHead>
                        <TableHead className="w-[12%]">Latência</TableHead>
                        <TableHead className="w-[32%]">Erro</TableHead>
                        <TableHead className="w-[14%] text-right">Resposta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.checks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            Nenhum check registrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selected.checks.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{fmt(c.checkedAt)}</TableCell>
                            <TableCell>
                              {c.ok ? <Badge variant="success">sim</Badge> : <Badge variant="error">não</Badge>}
                            </TableCell>
                            <TableCell>{c.statusCode ?? "—"}</TableCell>
                            <TableCell>{c.latencyMs} ms</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {c.error ? (
                                <span className="text-destructive font-mono text-xs">{c.error}</span>
                              ) : !c.ok ? (
                                <span className="text-destructive font-mono text-xs">
                                  {c.statusCode ? `HTTP ${c.statusCode}` : "Falha na conexão"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() => {
                                  setCopiedResponse(false);
                                  setViewingResponse({
                                    title: `Resposta do check (${fmt(c.checkedAt)})`,
                                    body: getCheckResponse(c),
                                  });
                                }}
                              >
                                Visualizar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsPanel>
                <TabsPanel value="incidents" className="mt-4 h-96 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="w-[14%]">Status</TableHead>
                        <TableHead className="w-[22%]">Início</TableHead>
                        <TableHead className="w-[22%]">Fim</TableHead>
                        <TableHead className="w-[28%]">Erro</TableHead>
                        <TableHead className="w-[14%] text-right">Resposta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.incidents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                            Nenhum incidente registrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selected.incidents.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell>
                              {i.endedAt ? (
                                <Badge variant="success">resolvido</Badge>
                              ) : (
                                <Badge variant="error">aberto</Badge>
                              )}
                            </TableCell>
                            <TableCell>{fmt(i.startedAt)}</TableCell>
                            <TableCell>{i.endedAt ? fmt(i.endedAt) : <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {i.lastError ? (
                                <span className="text-destructive font-mono text-xs">{i.lastError}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() => {
                                  setCopiedResponse(false);
                                  setViewingResponse({
                                    title: `Resposta do incidente (${fmt(i.startedAt)})`,
                                    body: getIncidentResponse(i),
                                  });
                                }}
                              >
                                Visualizar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsPanel>
                <TabsPanel value="alerts" className="mt-4 h-96 overflow-auto space-y-4">
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
                        <TableHead className="w-[20%]">Canal</TableHead>
                        <TableHead className="w-[65%]">Destino</TableHead>
                        <TableHead className="w-[15%] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.alerts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.channel}</TableCell>
                          <TableCell className="max-w-md truncate text-muted-foreground">{a.target}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setConfirmState({
                                  title: `Remover alerta (${a.channel})?`,
                                  description: `O destino "${a.target}" deixará de receber notificações.`,
                                  onConfirm: async () => {
                                    await api.removeAlert(selected.id, a.id);
                                    toastManager.add({ title: "Alerta removido", type: "success" });
                                    await refresh();
                                  },
                                });
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
                    <div>
                      <h3 className="text-sm font-medium">Quadro de Tarefas & Diagnósticos</h3>
                      <p className="text-xs text-muted-foreground">
                        Cards organizados por status. Colunas são criadas automaticamente.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setCardOpen(true)}
                    >
                      Novo card
                    </Button>
                  </div>

                  {kanbanColumns.length === 0 && !isCreatingCard ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 p-8 text-center">
                      <p className="text-sm font-medium text-foreground">Nenhum card cadastrado</p>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        Crie um card manual para organizar pendências ou aguarde diagnósticos automáticos gerados por IA quando ocorrerem incidentes.
                      </p>
                      <Button type="button" size="sm" className="mt-4" onClick={() => setCardOpen(true)}>
                        Criar primeiro card
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
                      {kanbanColumns.length === 0 && isCreatingCard ? (
                        <div className="flex flex-col gap-2.5 rounded-xl border bg-muted/30 p-3.5 shadow-2xs">
                          <div className="flex items-center justify-between gap-2 px-1">
                            <h3 className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">Criando...</h3>
                          </div>
                          <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4 text-xs text-muted-foreground animate-pulse">
                            <Loader2Icon className="size-4 animate-spin text-primary shrink-0" />
                            <span>Criando novo card...</span>
                          </div>
                        </div>
                      ) : null}
                      {kanbanColumns.map((col, idx) => (
                        <div
                          key={col.status}
                          className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2 px-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="size-2 rounded-full bg-primary/60" />
                              <h3 className="truncate text-xs font-semibold uppercase tracking-wider text-foreground">
                                {col.status}
                              </h3>
                            </div>
                            <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">
                              {col.cards.length}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-2.5">
                            {idx === 0 && isCreatingCard ? (
                              <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3 text-xs text-muted-foreground animate-pulse">
                                <Loader2Icon className="size-3.5 animate-spin text-primary shrink-0" />
                                <span>Criando novo card...</span>
                              </div>
                            ) : null}
                            {col.cards.map((card) => (
                              <article
                                key={card.id}
                                role="button"
                                tabIndex={0}
                                className={`group relative flex flex-col justify-between rounded-lg border bg-card p-3.5 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  card.resolved ? "opacity-65 bg-card/60 border-border/60" : ""
                                }`}
                                onClick={() => setViewingCard(card)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setViewingCard(card);
                                  }
                                }}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {card.source === "ai" ? (
                                        <span title="Diagnóstico gerado por IA" className="inline-flex shrink-0 text-amber-500">
                                          <SparklesIcon className="size-3.5" />
                                        </span>
                                      ) : null}
                                      <h4
                                        className={`break-words text-sm font-medium leading-snug ${
                                          card.resolved ? "line-through text-muted-foreground" : "text-foreground"
                                        }`}
                                      >
                                        {card.name}
                                      </h4>
                                    </div>
                                    {card.resolved ? (
                                      <Badge variant="success" className="shrink-0 text-[10px] px-1.5 py-0">
                                        resolvido
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {card.description ? (
                                    <p className="mt-2 line-clamp-3 break-words text-xs text-muted-foreground leading-relaxed">
                                      {card.description}
                                    </p>
                                  ) : null}
                                </div>
                                <div
                                  className="mt-3.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <span className="text-[11px] text-muted-foreground/80">
                                    {fmt(card.createdAt)}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      type="button"
                                      size="xs"
                                      variant="outline"
                                      onClick={() => onToggleResolved(card)}
                                    >
                                      {card.resolved ? "Reabrir" : "Resolver"}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="xs"
                                      variant="destructive-outline"
                                      onClick={() => {
                                        setConfirmState({
                                          title: `Apagar card "${card.name}"?`,
                                          description: "Esta ação não pode ser desfeita.",
                                          onConfirm: async () => {
                                            await api.removeCard(selected.id, card.id);
                                            toastManager.add({ title: "Card removido", type: "success" });
                                            await refresh();
                                          },
                                        });
                                      }}
                                    >
                                      Apagar
                                    </Button>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Modal
                    open={viewingCard != null}
                    onOpenChange={(next) => {
                      if (!next) setViewingCard(null);
                    }}
                    title={viewingCard?.name}
                    description="Detalhes do card (somente leitura)."
                    footer={
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
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
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full sm:w-auto"
                          onClick={() => setViewingCard(null)}
                        >
                          Fechar
                        </Button>
                      </div>
                    }
                  >
                    {viewingCard ? (
                      <div className="grid gap-4 text-sm">
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
                          <p className="text-muted-foreground">Origem</p>
                          <p className="mt-1 flex items-center gap-1.5 font-medium">
                            {viewingCard.source === "ai" ? (
                              <>
                                <SparklesIcon className="size-3.5 text-amber-500" />
                                IA (Automático)
                              </>
                            ) : (
                              "Manual"
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Criado em</p>
                          <p className="mt-1">{fmt(viewingCard.createdAt)}</p>
                        </div>
                      </div>
                    ) : null}
                  </Modal>

                  <Modal
                    open={cardOpen}
                    onOpenChange={setCardOpen}
                    title="Novo card"
                    description="Nome e status até 100 caracteres; descrição até 300."
                    onSubmit={onSaveCard}
                  >
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
                  </Modal>
                </TabsPanel>
              </CollapsiblePanel>
            </Collapsible>
          </Tabs>

          <Modal
            open={editOpen}
            onOpenChange={setEditOpen}
            title={`Editar monitor: ${selected.name}`}
            description="Altere nome, URL, método, intervalo ou status esperado."
            confirmText="Salvar alterações"
            onSubmit={onEdit}
          >
            <Field>
              <FieldLabel>Nome</FieldLabel>
              <Input name="name" type="text" defaultValue={selected.name} required />
            </Field>
            <Field>
              <FieldLabel>URL</FieldLabel>
              <Input name="url" type="url" defaultValue={selected.url} required />
            </Field>
            <Field>
              <FieldLabel>Método</FieldLabel>
              <Select
                items={METHODS}
                value={editMethod}
                onValueChange={(v) => {
                  if (v) setEditMethod(v);
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
            {METHODS_WITH_BODY.has(editMethod.value) ? (
              <Field>
                <FieldLabel>JSON (Body)</FieldLabel>
                <Textarea
                  name="body"
                  value={editBodyJson}
                  onChange={(e) => setEditBodyJson(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder={'{\n  "key": "value"\n}'}
                />
              </Field>
            ) : null}
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel>Intervalo</FieldLabel>
                <Select
                  items={INTERVALS}
                  value={editInterval}
                  onValueChange={(v) => {
                    if (v) setEditInterval(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {INTERVALS.map((item) => (
                      <SelectItem key={item.value} value={item}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Timeout (ms)</FieldLabel>
                <Input name="timeoutMs" type="number" min={500} defaultValue={selected.timeoutMs} required />
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Input name="expectedStatus" type="number" min={100} max={599} defaultValue={selected.expectedStatus} required />
              </Field>
            </div>
          </Modal>
        </section>
      ) : null}

      <ConfirmModal
        open={confirmState != null}
        onOpenChange={(next) => {
          if (!next) setConfirmState(null);
        }}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        confirmText={confirmState?.confirmText ?? "Apagar"}
        variant={confirmState?.variant ?? "destructive"}
        onConfirm={async () => {
          const action = confirmState?.onConfirm;
          setConfirmState(null);
          if (action) {
            try {
              await action();
            } catch (err) {
              toastManager.add({ title: "Falha", description: String(err), type: "error" });
            }
          }
        }}
      />

      <Modal
        open={viewingResponse !== null}
        onOpenChange={(next) => {
          if (!next) {
            setViewingResponse(null);
            setCopiedResponse(false);
          }
        }}
        title={viewingResponse?.title ?? "Resposta"}
        description="Corpo da resposta retornado pelo endpoint."
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            {viewingResponse?.body ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onCopyResponse(formatResponseBody(viewingResponse.body))}
              >
                {copiedResponse ? "Copiado!" : "Copiar"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => {
                setViewingResponse(null);
                setCopiedResponse(false);
              }}
            >
              Fechar
            </Button>
          </div>
        }
      >
        {viewingResponse ? (
          <pre className="max-h-96 overflow-auto rounded-md bg-muted/60 p-3.5 font-mono text-xs text-foreground whitespace-pre-wrap break-all select-all">
            {formatResponseBody(viewingResponse.body)}
          </pre>
        ) : null}
      </Modal>
      </main>
      <Footer className="mt-10" />
    </div>
  );
}
