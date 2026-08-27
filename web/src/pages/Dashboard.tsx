/**
 * Orquestrador do Dashboard
 * Gerencia o estado global, polling da API e conecta os componentes de exibição e modais.
 */

import { ChevronDownIcon, PlusIcon, ServerIcon } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { toastManager } from "@/components/ui/toast";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { z } from "zod";
import {
  api,
  type CardRow,
  type Monitor,
  type MonitorDetail,
  type Service,
} from "@/lib/api";

import { ServiceList } from "@/components/dashboard/ServiceList";
import { EndpointHeader } from "@/components/dashboard/EndpointHeader";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { ChecksPanel } from "@/components/dashboard/ChecksPanel";
import { IncidentsPanel } from "@/components/dashboard/IncidentsPanel";
import { AlertsPanel, CHANNELS } from "@/components/dashboard/AlertsPanel";
import { KanbanPanel } from "@/components/dashboard/KanbanPanel";
import {
  DashboardModals,
  INTERVALS,
  METHODS,
  METHODS_WITH_BODY,
  type ConfirmState,
} from "@/components/dashboard/DashboardModals";

const createServiceSchema = z.object({
  name: z.string().trim().min(1, "Nome do serviço é obrigatório"),
  baseUrl: z
    .string()
    .trim()
    .min(1, "URL Base é obrigatória")
    .refine((val) => {
      try {
        const u = new URL(val);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL Base inválida (deve começar com http:// ou https://)"),
});

const createMonitorSchema = z.object({
  serviceId: z.coerce.number().int().min(1, "Selecione um serviço"),
  name: z.string().trim().min(1, "Nome é obrigatório"),
  path: z.string().trim().min(1, "Caminho/rota é obrigatório"),
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

export default function Dashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [list, setList] = useState<Monitor[]>([]);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [editServiceOpen, setEditServiceOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [open, setOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [newPath, setNewPath] = useState("/");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<MonitorDetail | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [intervalOption, setIntervalOption] = useState(INTERVALS[1]);
  const [bodyJson, setBodyJson] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editPath, setEditPath] = useState("/");
  const [editMethod, setEditMethod] = useState(METHODS[0]);
  const [editInterval, setEditInterval] = useState(INTERVALS[1]);
  const [editBodyJson, setEditBodyJson] = useState("");

  const [channel, setChannel] = useState(CHANNELS[1]);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [viewingCard, setViewingCard] = useState<CardRow | null>(null);
  const [viewingResponse, setViewingResponse] = useState<{ title: string; body: string } | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

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
    const [svcs, rows] = await Promise.all([
      api.listServices(),
      api.list(),
    ]);
    setServices(svcs);
    setList(rows);
    if (selectedId != null) setSelected(await api.get(selectedId));
  }, [selectedId]);

  useEffect(() => {
    refresh().catch((e) => toastManager.add({ title: "Erro", description: String(e), type: "error" }));
    const id = setInterval(() => refresh().catch(() => { }), 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function onCreateService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = createServiceSchema.safeParse({
      name: fd.get("name"),
      baseUrl: fd.get("baseUrl"),
    });

    if (!parsed.success) {
      toastManager.add({
        title: "Erro de validação",
        description: parsed.error.issues[0]?.message || "Verifique os dados do serviço.",
        type: "error",
      });
      return;
    }

    try {
      const created = await api.createService({
        name: parsed.data.name,
        baseUrl: parsed.data.baseUrl,
      });
      setServiceOpen(false);
      toastManager.add({ title: "Serviço criado com sucesso", type: "success" });
      await refresh();
      setSelectedServiceId(created.id);
      setNewPath("/");
      setOpen(true);
    } catch (err) {
      toastManager.add({ title: "Falha ao criar serviço", description: String(err), type: "error" });
    }
  }

  async function onEditService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingService) return;
    const fd = new FormData(e.currentTarget);
    const parsed = createServiceSchema.safeParse({
      name: fd.get("name"),
      baseUrl: fd.get("baseUrl"),
    });

    if (!parsed.success) {
      toastManager.add({
        title: "Erro de validação",
        description: parsed.error.issues[0]?.message || "Verifique os dados do serviço.",
        type: "error",
      });
      return;
    }

    try {
      await api.patchService(editingService.id, {
        name: parsed.data.name,
        baseUrl: parsed.data.baseUrl,
      });
      setEditServiceOpen(false);
      setEditingService(null);
      toastManager.add({ title: "Serviço atualizado com sucesso", type: "success" });
      await refresh();
    } catch (err) {
      toastManager.add({ title: "Falha ao atualizar serviço", description: String(err), type: "error" });
    }
  }

  function startEditEndpoint() {
    if (!selected) return;
    const foundMethod = METHODS.find((m) => m.value === selected.method) || METHODS[0];
    const foundInterval = INTERVALS.find((i) => i.value === selected.intervalSeconds) || INTERVALS[1];
    setEditMethod(foundMethod);
    setEditInterval(foundInterval);
    setEditPath(selected.path ?? "/");
    setEditBodyJson(selected.body ?? "");
    setEditOpen(true);
  }

  async function onEditEndpoint(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const hasBody = METHODS_WITH_BODY.has(editMethod.value);
    const parsed = createMonitorSchema.safeParse({
      serviceId: selected.serviceId,
      name: fd.get("name"),
      path: fd.get("path"),
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
        path: parsed.data.path.startsWith("/") ? parsed.data.path : `/${parsed.data.path}`,
        method: parsed.data.method,
        intervalSeconds: parsed.data.intervalSeconds,
        timeoutMs: parsed.data.timeoutMs,
        expectedStatus: parsed.data.expectedStatus,
        body: hasBody && parsed.data.body?.trim() ? parsed.data.body.trim() : null,
      });
      setEditOpen(false);
      toastManager.add({ title: "Endpoint atualizado", type: "success" });
      await refresh();
    } catch (err) {
      toastManager.add({ title: "Falha", description: String(err), type: "error" });
    }
  }

  async function onCreateEndpoint(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const targetServiceId = selectedServiceId ?? services[0]?.id;
    const hasBody = METHODS_WITH_BODY.has(method.value);
    const parsed = createMonitorSchema.safeParse({
      serviceId: targetServiceId,
      name: fd.get("name"),
      path: fd.get("path"),
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
      const created = await api.create({
        serviceId: parsed.data.serviceId,
        name: parsed.data.name,
        path: parsed.data.path.startsWith("/") ? parsed.data.path : `/${parsed.data.path}`,
        method: parsed.data.method,
        intervalSeconds: parsed.data.intervalSeconds,
        timeoutMs: parsed.data.timeoutMs,
        expectedStatus: parsed.data.expectedStatus,
        body: hasBody && parsed.data.body?.trim() ? parsed.data.body.trim() : null,
      });
      setOpen(false);
      setNewPath("/");
      setBodyJson("");
      setMethod(METHODS[0]);
      setIntervalOption(INTERVALS[1]);
      toastManager.add({ title: "Endpoint criado", type: "success" });
      await refresh();
      setSelectedId(created.id);
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

  async function onToggleResolvedCard(card: CardRow) {
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

  return (
    <div className="min-h-svh flex flex-col">
      <Navbar>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => setServiceOpen(true)}
          >
            <PlusIcon className="size-3.5" />
            Novo serviço
          </Button>

          <Button
            size="sm"
            type="button"
            onClick={() => {
              if (services.length === 0) {
                toastManager.add({
                  title: "Nenhum serviço cadastrado",
                  description: "Cadastre um serviço primeiro para vincular seus endpoints.",
                  type: "info",
                });
                setServiceOpen(true);
                return;
              }
              if (!selectedServiceId) setSelectedServiceId(services[0].id);
              setNewPath("/");
              setOpen(true);
            }}
          >
            <PlusIcon className="size-3.5" />
            Novo endpoint
          </Button>
        </div>
      </Navbar>

      <main className="mx-auto max-w-6xl px-4 py-8 flex-1 w-full">
        {services.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ServerIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum serviço cadastrado</EmptyTitle>
              <EmptyDescription>
                Cadastre um serviço com a sua URL Base para gerenciar e monitorar endpoints.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => setServiceOpen(true)}>
                <PlusIcon className="size-4" />
                Novo serviço
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ServiceList
            services={services}
            allMonitors={list}
            selectedId={selectedId}
            onSelectEndpoint={(id) => {
              if (selectedId === id) {
                setSelectedId(null);
                setSelected(null);
              } else {
                setSelectedId(id);
              }
            }}
            onNewEndpoint={(svcId) => {
              setSelectedServiceId(svcId);
              setNewPath("/");
              setOpen(true);
            }}
            onEditService={(svc) => {
              setEditingService(svc);
              setEditServiceOpen(true);
            }}
            onDeleteService={(svc, count) => {
              setConfirmState({
                title: `Apagar serviço "${svc.name}"?`,
                description: `Todos os ${count} endpoints vinculados a este serviço serão excluídos permanentemente.`,
                confirmText: "Apagar Serviço",
                variant: "destructive",
                onConfirm: async () => {
                  await api.removeService(svc.id);
                  if (selected?.serviceId === svc.id) {
                    setSelectedId(null);
                    setSelected(null);
                  }
                  toastManager.add({ title: "Serviço excluído", type: "success" });
                  await refresh();
                },
              });
            }}
          />
        )}

        {selected ? (
          <section className="mt-8 space-y-4">
            <EndpointHeader
              selected={selected}
              onToggleEnabled={async () => {
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
              onReset={() => {
                setConfirmState({
                  title: `Resetar histórico de "${selected.name}"?`,
                  description:
                    "Todas as requisições, respostas, incidentes e métricas acumuladas serão limpos. A configuração do endpoint e os alertas cadastrados serão mantidos.",
                  confirmText: "Resetar",
                  variant: "destructive",
                  onConfirm: async () => {
                    await api.reset(selected.id);
                    toastManager.add({ title: "Histórico e métricas resetados", type: "success" });
                    await refresh();
                  },
                });
              }}
              onCheckNow={async () => {
                try {
                  await api.checkNow(selected.id);
                  toastManager.add({ title: "Check disparado", type: "success" });
                  await refresh();
                } catch (err) {
                  toastManager.add({ title: "Falha", description: String(err), type: "error" });
                }
              }}
              onEdit={startEditEndpoint}
              onDelete={() => {
                setConfirmState({
                  title: `Apagar endpoint "${selected.name}"?`,
                  description:
                    "Todos os checks, incidentes, alertas e cards vinculados a este endpoint serão apagados.",
                  onConfirm: async () => {
                    await api.remove(selected.id);
                    setSelectedId(null);
                    setSelected(null);
                    toastManager.add({ title: "Endpoint apagado", type: "success" });
                    await refresh();
                  },
                });
              }}
            />

            <MetricsPanel selected={selected} />

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
                  <ChecksPanel
                    checks={selected.checks}
                    onViewResponse={(title, body) => {
                      setCopiedResponse(false);
                      setViewingResponse({ title, body });
                    }}
                  />
                  <IncidentsPanel
                    incidents={selected.incidents}
                    onViewResponse={(title, body) => {
                      setCopiedResponse(false);
                      setViewingResponse({ title, body });
                    }}
                  />
                  <AlertsPanel
                    alerts={selected.alerts}
                    channel={channel}
                    onChannelChange={setChannel}
                    onAddAlert={onAddAlert}
                    onRemoveAlert={(alertId, channelName, target) => {
                      setConfirmState({
                        title: `Remover alerta (${channelName})?`,
                        description: `O destino "${target}" deixará de receber notificações.`,
                        onConfirm: async () => {
                          await api.removeAlert(selected.id, alertId);
                          toastManager.add({ title: "Alerta removido", type: "success" });
                          await refresh();
                        },
                      });
                    }}
                  />
                  <KanbanPanel
                    cards={selected.cards}
                    isCreatingCard={isCreatingCard}
                    onOpenNewCard={() => setCardOpen(true)}
                    onViewCard={(card) => setViewingCard(card)}
                    onToggleResolved={(card) => onToggleResolvedCard(card)}
                    onDeleteCard={(card) => {
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
                  />
                </CollapsiblePanel>
              </Collapsible>
            </Tabs>
          </section>
        ) : null}

        <DashboardModals
          serviceOpen={serviceOpen}
          onServiceOpenChange={setServiceOpen}
          onCreateService={onCreateService}
          editServiceOpen={editServiceOpen}
          onEditServiceOpenChange={(next) => {
            setEditServiceOpen(next);
            if (!next) setEditingService(null);
          }}
          editingService={editingService}
          onEditService={onEditService}

          endpointOpen={open}
          onEndpointOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setBodyJson("");
              setNewPath("/");
              setMethod(METHODS[0]);
              setIntervalOption(INTERVALS[1]);
            }
          }}
          onCreateEndpoint={onCreateEndpoint}
          services={services}
          selectedServiceId={selectedServiceId}
          onSelectServiceId={setSelectedServiceId}
          newPath={newPath}
          onNewPathChange={setNewPath}
          method={method}
          onMethodChange={setMethod}
          intervalOption={intervalOption}
          onIntervalOptionChange={setIntervalOption}
          bodyJson={bodyJson}
          onBodyJsonChange={setBodyJson}

          editEndpointOpen={editOpen}
          onEditEndpointOpenChange={setEditOpen}
          editingEndpoint={selected}
          onEditEndpoint={onEditEndpoint}
          editPath={editPath}
          onEditPathChange={setEditPath}
          editMethod={editMethod}
          onEditMethodChange={setEditMethod}
          editInterval={editInterval}
          onEditIntervalChange={setEditInterval}
          editBodyJson={editBodyJson}
          onEditBodyJsonChange={setEditBodyJson}

          cardOpen={cardOpen}
          onCardOpenChange={setCardOpen}
          onSaveCard={onSaveCard}
          viewingCard={viewingCard}
          onViewingCardChange={setViewingCard}
          onToggleResolvedCard={onToggleResolvedCard}

          viewingResponse={viewingResponse}
          onViewingResponseChange={setViewingResponse}
          copiedResponse={copiedResponse}
          onCopyResponse={onCopyResponse}

          confirmState={confirmState}
          onConfirmStateChange={setConfirmState}
        />
      </main>
      <Footer className="mt-10" />
    </div>
  );
}
