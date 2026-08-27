/**
 * Lista agrupada de Serviços e Tabela de Endpoints
 * Renderiza os cards de cada serviço com seus respectivos endpoints vinculados.
 */

import { GlobeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Monitor, Service } from "@/lib/api";

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

interface ServiceListProps {
  services: Service[];
  allMonitors: Monitor[];
  selectedId: number | null;
  onSelectEndpoint: (id: number) => void;
  onNewEndpoint: (serviceId: number) => void;
  onEditService: (service: Service) => void;
  onDeleteService: (service: Service, endpointsCount: number) => void;
}

export function ServiceList({
  services,
  allMonitors,
  selectedId,
  onSelectEndpoint,
  onNewEndpoint,
  onEditService,
  onDeleteService,
}: ServiceListProps) {
  return (
    <div className="space-y-6">
      {services.map((svc) => {
        const endpoints = svc.monitors ?? allMonitors.filter((m) => m.serviceId === svc.id);
        return (
          <Card key={svc.id} className="overflow-hidden">
            <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <GlobeIcon className="size-4 text-primary shrink-0" />
                  <CardTitle className="text-base font-semibold truncate">{svc.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {endpoints.length} {endpoints.length === 1 ? "endpoint" : "endpoints"}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground truncate">
                  {svc.baseUrl}
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNewEndpoint(svc.id)}
                >
                  <PlusIcon className="size-3.5" />
                  Endpoint
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditService(svc)}
                  title="Editar serviço"
                >
                  <PencilIcon className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => onDeleteService(svc, endpoints.length)}
                  title="Apagar serviço"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardPanel className="p-0">
              {endpoints.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum endpoint cadastrado neste serviço.{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => onNewEndpoint(svc.id)}
                  >
                    Adicionar endpoint
                  </button>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-[22%]">Nome</TableHead>
                      <TableHead className="w-[30%]">Endpoint / URL</TableHead>
                      <TableHead className="w-[10%]">Método</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className="w-[8%]">HTTP</TableHead>
                      <TableHead className="w-[8%]">Latência</TableHead>
                      <TableHead className="w-[12%] text-right">Último check</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpoints.map((m) => (
                      <TableRow
                        key={m.id}
                        className={`cursor-pointer transition-colors hover:bg-muted/30 dark:hover:bg-muted/20 ${selectedId === m.id ? "bg-muted/80 dark:bg-muted/30 font-medium" : ""
                          }`}
                        onClick={() => onSelectEndpoint(m.id)}
                      >
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground font-mono text-xs">
                          <span className="text-primary font-semibold">{m.path}</span>
                          <span className="text-muted-foreground/60 text-[11px] block truncate">
                            {m.url || `${svc.baseUrl}${m.path}`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {m.method}
                          </Badge>
                        </TableCell>
                        <TableCell>{statusBadge(m)}</TableCell>
                        <TableCell>{m.lastStatusCode ?? "—"}</TableCell>
                        <TableCell>{m.lastLatencyMs != null ? `${m.lastLatencyMs} ms` : "—"}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmt(m.lastCheckedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardPanel>
          </Card>
        );
      })}
    </div>
  );
}
