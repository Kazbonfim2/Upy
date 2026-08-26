/**
 * Gráficos e Indicadores de Métricas
 * Exibe disponibilidade (Uptime), latência média, incidentes e taxa de sucesso do endpoint.
 */

import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Meter, MeterIndicator, MeterLabel, MeterTrack } from "@/components/ui/meter";
import type { MonitorDetail } from "@/lib/api";

interface MetricsPanelProps {
  selected: MonitorDetail;
}

export function MetricsPanel({ selected }: MetricsPanelProps) {
  return (
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
  );
}
