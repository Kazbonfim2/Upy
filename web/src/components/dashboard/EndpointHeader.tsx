/**
 * Card de Ações do Endpoint Selecionado
 * Exibe detalhes do endpoint e ações rápidas (Pausar/Continuar, Resetar, Checar Agora, Editar, Apagar).
 */

import {
  ChevronDownIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
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
        <div className="flex items-center gap-2">
          <Menu>
            <MenuTrigger
              render={
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  Ações
                  <ChevronDownIcon className="size-4 opacity-80" />
                </Button>
              }
            />
            <MenuPopup align="end" className="min-w-44">
              <MenuItem onClick={onToggleEnabled}>
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
              </MenuItem>
              <MenuItem onClick={onReset}>
                <RotateCcwIcon className="size-4" />
                Resetar
              </MenuItem>
              <MenuItem onClick={onCheckNow}>
                <RefreshCwIcon className="size-4" />
                Checar agora
              </MenuItem>
              <MenuItem onClick={onEdit}>
                <PencilIcon className="size-4" />
                Editar
              </MenuItem>
              <MenuSeparator />
              <MenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon className="size-4" />
                Apagar
              </MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </div>
    </Card>
  );
}
