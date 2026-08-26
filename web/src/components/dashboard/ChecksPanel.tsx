/**
 * Tabela de Histórico de Requisições
 * Exibe as últimas execuções de verificação (status HTTP, latência, erros) com modal de resposta.
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
import type { CheckRow } from "@/lib/api";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
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

interface ChecksPanelProps {
  checks: CheckRow[];
  onViewResponse: (title: string, body: string) => void;
}

export function ChecksPanel({ checks, onViewResponse }: ChecksPanelProps) {
  return (
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
          {checks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                Nenhum check registrado.
              </TableCell>
            </TableRow>
          ) : (
            checks.map((c) => (
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
                    onClick={() =>
                      onViewResponse(`Resposta do check (${fmt(c.checkedAt)})`, getCheckResponse(c))
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
