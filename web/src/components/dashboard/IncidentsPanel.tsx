/**
 * Tabela de Histórico de Incidentes
 * Exibe incidentes registrados (abertos e resolvidos), início, fim, erros e respostas.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsPanel } from "@/components/ui/tabs";
import type { Incident } from "@/lib/api";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
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

interface IncidentsPanelProps {
  incidents: Incident[];
  onViewResponse: (title: string, body: string) => void;
}

export function IncidentsPanel({ incidents, onViewResponse }: IncidentsPanelProps) {
  return (
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
          {incidents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                Nenhum incidente registrado.
              </TableCell>
            </TableRow>
          ) : (
            incidents.map((i) => (
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
                    onClick={() =>
                      onViewResponse(`Resposta do incidente (${fmt(i.startedAt)})`, getIncidentResponse(i))
                    }
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
  );
}
