/**
 * Card de Ações do Endpoint Selecionado
 * Exibe detalhes do endpoint e ações rápidas (Pausar/Continuar, Resetar, Checar Agora, Editar, Apagar).
 */

import { PauseIcon, PencilIcon, PlayIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MonitorDetail } from "@/lib/api";

interface EndpointHeaderProps {
  selected: MonitorDetail;
  onToggleEnabled: () => void;
  onReset: () => void;
  onCheckNow: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function EndpointHeader({
  selected,
  onToggleEnabled,
  onReset,
  onCheckNow,
  onEdit,
  onDelete,
}: EndpointHeaderProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl">{selected.name}</h2>
            {selected.serviceName ? (
              <Badge variant="outline" className="text-xs">
                {selected.serviceName}
              </Badge>
            ) : null}
            {!selected.enabled ? <Badge variant="secondary">pausado</Badge> : null}
          </div>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            <span className="font-mono font-medium">{selected.method}</span>{" "}
            <span className="font-mono">{selected.url}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onToggleEnabled}
          >
            {selected.enabled ? (
              <>
                <PauseIcon className="size-4" />
                Pausar
              </>
            ) : (
              <>
                <PlayIcon className="size-4" />
                Continuar
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onReset}
          >
            <RotateCcwIcon className="size-4" />
            Resetar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onCheckNow}
          >
            <RefreshCwIcon className="size-4" />
            Checar agora
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onEdit}
          >
            <PencilIcon className="size-4" />
            Editar
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onDelete}
          >
            Apagar
          </Button>
        </div>
      </div>
    </Card>
  );
}
