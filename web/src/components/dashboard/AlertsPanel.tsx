/**
 * Formulário e Listagem de Canais de Alerta
 * Permite cadastrar e remover destinatários de notificação (e-mail, Discord, webhook).
 */

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { TabsPanel } from "@/components/ui/tabs";
import type { MonitorDetail } from "@/lib/api";

export const CHANNELS = [
  { label: "E-mail", value: "email" },
  { label: "Discord", value: "discord" },
  { label: "Webhook", value: "webhook" },
];

interface AlertsPanelProps {
  alerts: MonitorDetail["alerts"];
  channel: (typeof CHANNELS)[number];
  onChannelChange: (channel: (typeof CHANNELS)[number]) => void;
  onAddAlert: (e: FormEvent<HTMLFormElement>) => void;
  onRemoveAlert: (alertId: number, channelName: string, target: string) => void;
}

export function AlertsPanel({
  alerts,
  channel,
  onChannelChange,
  onAddAlert,
  onRemoveAlert,
}: AlertsPanelProps) {
  return (
    <TabsPanel value="alerts" className="mt-4 h-96 overflow-auto space-y-4">
      <form className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={onAddAlert}>
        <Field className="min-w-0 sm:min-w-40">
          <FieldLabel>Canal</FieldLabel>
          <Select
            items={CHANNELS}
            value={channel}
            onValueChange={(v) => {
              if (v) onChannelChange(v);
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
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[20%]">Canal</TableHead>
            <TableHead className="w-[65%]">Destino</TableHead>
            <TableHead className="w-[15%] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.channel}</TableCell>
              <TableCell className="max-w-md truncate text-muted-foreground">{a.target}</TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onRemoveAlert(a.id, a.channel, a.target)}
                >
                  remover
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TabsPanel>
  );
}
