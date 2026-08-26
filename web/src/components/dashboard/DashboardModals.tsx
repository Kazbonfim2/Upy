/**
 * Modais do Dashboard
 * Reúne os modais de criação/edição de serviços, endpoints, cards manuais e visualização de respostas JSON.
 */

import { SparklesIcon } from "lucide-react";
import type { FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CardRow, MonitorDetail, Service } from "@/lib/api";

export const METHODS = [
  { label: "GET", value: "GET" },
  { label: "HEAD", value: "HEAD" },
  { label: "POST", value: "POST" },
  { label: "PUT", value: "PUT" },
  { label: "PATCH", value: "PATCH" },
  { label: "DELETE", value: "DELETE" },
];

export const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const INTERVALS = [
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
  { label: "90s", value: 90 },
];

export function formatEndpointUrl(baseUrl?: string, path?: string): string {
  if (!baseUrl) return path || "/";
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const trimmed = (path || "/").trim();
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${cleanBase}${cleanPath}`;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
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

export interface ConfirmState {
  title: string;
  description?: string;
  confirmText?: string;
  variant?: "destructive" | "default";
  onConfirm: () => void | Promise<void>;
}

interface DashboardModalsProps {
  // Service Modals
  serviceOpen: boolean;
  onServiceOpenChange: (open: boolean) => void;
  onCreateService: (e: FormEvent<HTMLFormElement>) => void;
  editServiceOpen: boolean;
  onEditServiceOpenChange: (open: boolean) => void;
  editingService: Service | null;
  onEditService: (e: FormEvent<HTMLFormElement>) => void;

  // Endpoint Modals
  endpointOpen: boolean;
  onEndpointOpenChange: (open: boolean) => void;
  onCreateEndpoint: (e: FormEvent<HTMLFormElement>) => void;
  services: Service[];
  selectedServiceId: number | null;
  onSelectServiceId: (id: number) => void;
  newPath: string;
  onNewPathChange: (path: string) => void;
  method: (typeof METHODS)[number];
  onMethodChange: (m: (typeof METHODS)[number]) => void;
  intervalOption: (typeof INTERVALS)[number];
  onIntervalOptionChange: (i: (typeof INTERVALS)[number]) => void;
  bodyJson: string;
  onBodyJsonChange: (body: string) => void;

  editEndpointOpen: boolean;
  onEditEndpointOpenChange: (open: boolean) => void;
  editingEndpoint: MonitorDetail | null;
  onEditEndpoint: (e: FormEvent<HTMLFormElement>) => void;
  editPath: string;
  onEditPathChange: (path: string) => void;
  editMethod: (typeof METHODS)[number];
  onEditMethodChange: (m: (typeof METHODS)[number]) => void;
  editInterval: (typeof INTERVALS)[number];
  onEditIntervalChange: (i: (typeof INTERVALS)[number]) => void;
  editBodyJson: string;
  onEditBodyJsonChange: (body: string) => void;

  // Card Modals
  cardOpen: boolean;
  onCardOpenChange: (open: boolean) => void;
  onSaveCard: (e: FormEvent<HTMLFormElement>) => void;
  viewingCard: CardRow | null;
  onViewingCardChange: (card: CardRow | null) => void;
  onToggleResolvedCard: (card: CardRow) => void;

  // Response Viewer Modal
  viewingResponse: { title: string; body: string } | null;
  onViewingResponseChange: (res: { title: string; body: string } | null) => void;
  copiedResponse: boolean;
  onCopyResponse: (text: string) => void;

  // Confirm Modal
  confirmState: ConfirmState | null;
  onConfirmStateChange: (state: ConfirmState | null) => void;
}

export function DashboardModals({
  serviceOpen,
  onServiceOpenChange,
  onCreateService,
  editServiceOpen,
  onEditServiceOpenChange,
  editingService,
  onEditService,

  endpointOpen,
  onEndpointOpenChange,
  onCreateEndpoint,
  services,
  selectedServiceId,
  onSelectServiceId,
  newPath,
  onNewPathChange,
  method,
  onMethodChange,
  intervalOption,
  onIntervalOptionChange,
  bodyJson,
  onBodyJsonChange,

  editEndpointOpen,
  onEditEndpointOpenChange,
  editingEndpoint,
  onEditEndpoint,
  editPath,
  onEditPathChange,
  editMethod,
  onEditMethodChange,
  editInterval,
  onEditIntervalChange,
  editBodyJson,
  onEditBodyJsonChange,

  cardOpen,
  onCardOpenChange,
  onSaveCard,
  viewingCard,
  onViewingCardChange,
  onToggleResolvedCard,

  viewingResponse,
  onViewingResponseChange,
  copiedResponse,
  onCopyResponse,

  confirmState,
  onConfirmStateChange,
}: DashboardModalsProps) {
  const serviceSelectItems = services.map((s) => ({
    label: `${s.name} (${s.baseUrl})`,
    value: s,
  }));
  const currentServiceItem =
    serviceSelectItems.find((item) => item.value.id === selectedServiceId) ||
    serviceSelectItems[0];
  const currentServiceForNew = currentServiceItem?.value;

  return (
    <>
      {/* Modal: Novo Serviço */}
      <Modal
        open={serviceOpen}
        onOpenChange={onServiceOpenChange}
        title="Cadastrar serviço"
        description="Nome e URL Base para agrupar múltiplos endpoints."
        confirmText="Criar serviço"
        onSubmit={onCreateService}
      >
        <Field>
          <FieldLabel>Nome do Serviço</FieldLabel>
          <Input name="name" type="text" required placeholder="Minha API" />
        </Field>
        <Field>
          <FieldLabel>URL Base</FieldLabel>
          <Input name="baseUrl" type="url" required placeholder="https://api.exemplo.com.br" />
          <p className="mt-1 text-xs text-muted-foreground">
            A URL final de cada endpoint será montada como: URL Base + Caminho.
          </p>
        </Field>
      </Modal>

      {/* Modal: Editar Serviço */}
      <Modal
        open={editServiceOpen}
        onOpenChange={onEditServiceOpenChange}
        title={`Editar serviço: ${editingService?.name ?? ""}`}
        description="Alterar a URL Base atualiza automaticamente todos os endpoints vinculados."
        confirmText="Salvar alterações"
        onSubmit={onEditService}
      >
        <Field>
          <FieldLabel>Nome do Serviço</FieldLabel>
          <Input name="name" type="text" defaultValue={editingService?.name} required />
        </Field>
        <Field>
          <FieldLabel>URL Base</FieldLabel>
          <Input name="baseUrl" type="url" defaultValue={editingService?.baseUrl} required />
        </Field>
      </Modal>

      {/* Modal: Novo Endpoint */}
      <Modal
        open={endpointOpen}
        onOpenChange={onEndpointOpenChange}
        title="Cadastrar endpoint"
        description="Vincule ao serviço e defina a rota, método, intervalo e status esperado."
        confirmText="Criar endpoint"
        onSubmit={onCreateEndpoint}
      >
        <Field>
          <FieldLabel>Serviço</FieldLabel>
          <Select
            items={serviceSelectItems}
            value={currentServiceItem}
            onValueChange={(v) => {
              if (v) onSelectServiceId(v.value.id);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {serviceSelectItems.map((item) => (
                <SelectItem key={item.value.id} value={item}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Nome do Endpoint</FieldLabel>
          <Input name="name" type="text" required placeholder="Health Check / Login" />
        </Field>
        <Field>
          <FieldLabel>Caminho / Rota</FieldLabel>
          <Input
            name="path"
            type="text"
            required
            value={newPath}
            onChange={(e) => onNewPathChange(e.target.value)}
            placeholder="/v1/health"
          />
          <div className="mx-auto mt-1 rounded bg-muted/50 p-2 text-xs font-mono text-muted-foreground break-all">
            URL monitorada:{" "}
            <span className="text-foreground font-semibold">
              {formatEndpointUrl(currentServiceForNew?.baseUrl, newPath)}
            </span>
          </div>
        </Field>
        <Field>
          <FieldLabel>Método</FieldLabel>
          <Select
            items={METHODS}
            value={method}
            onValueChange={(v) => {
              if (v) onMethodChange(v);
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
              onChange={(e) => onBodyJsonChange(e.target.value)}
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
                if (v) onIntervalOptionChange(v);
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

      {/* Modal: Editar Endpoint */}
      {editingEndpoint ? (
        <Modal
          open={editEndpointOpen}
          onOpenChange={onEditEndpointOpenChange}
          title={`Editar endpoint: ${editingEndpoint.name}`}
          description="Altere nome, caminho, método, intervalo ou status esperado."
          confirmText="Salvar alterações"
          onSubmit={onEditEndpoint}
        >
          <Field>
            <FieldLabel>Nome</FieldLabel>
            <Input name="name" type="text" defaultValue={editingEndpoint.name} required />
          </Field>
          <Field>
            <FieldLabel>Caminho / Rota</FieldLabel>
            <Input
              name="path"
              type="text"
              value={editPath}
              onChange={(e) => onEditPathChange(e.target.value)}
              required
              placeholder="/v1/login"
            />
            <div className="mx-auto mt-1 rounded bg-muted/50 p-2 text-xs font-mono text-muted-foreground break-all">
              URL monitorada:{" "}
              <span className="text-foreground font-semibold">
                {formatEndpointUrl(editingEndpoint.baseUrl, editPath)}
              </span>
            </div>
          </Field>
          <Field>
            <FieldLabel>Método</FieldLabel>
            <Select
              items={METHODS}
              value={editMethod}
              onValueChange={(v) => {
                if (v) onEditMethodChange(v);
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
                onChange={(e) => onEditBodyJsonChange(e.target.value)}
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
                  if (v) onEditIntervalChange(v);
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
              <Input name="timeoutMs" type="number" min={500} defaultValue={editingEndpoint.timeoutMs} required />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Input name="expectedStatus" type="number" min={100} max={599} defaultValue={editingEndpoint.expectedStatus} required />
            </Field>
          </div>
        </Modal>
      ) : null}

      {/* Modal: Novo Card */}
      <Modal
        open={cardOpen}
        onOpenChange={onCardOpenChange}
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

      {/* Modal: Visualizar Card */}
      <Modal
        open={viewingCard != null}
        onOpenChange={(next) => {
          if (!next) onViewingCardChange(null);
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
                onClick={() => onToggleResolvedCard(viewingCard)}
              >
                {viewingCard.resolved ? "Reabrir" : "Resolver"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => onViewingCardChange(null)}
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

      {/* Modal: Visualizar Resposta */}
      <Modal
        open={viewingResponse !== null}
        onOpenChange={(next) => {
          if (!next) onViewingResponseChange(null);
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
              onClick={() => onViewingResponseChange(null)}
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

      {/* Modal: Confirmação */}
      <ConfirmModal
        open={confirmState != null}
        onOpenChange={(next) => {
          if (!next) onConfirmStateChange(null);
        }}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        confirmText={confirmState?.confirmText ?? "Apagar"}
        variant={confirmState?.variant ?? "destructive"}
        onConfirm={async () => {
          const action = confirmState?.onConfirm;
          onConfirmStateChange(null);
          if (action) await action();
        }}
      />
    </>
  );
}
