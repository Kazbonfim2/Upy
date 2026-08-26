/**
 * Quadro de Tarefas e Diagnósticos (Kanban)
 * Organiza cards por status com suporte a diagnósticos automáticos por IA e marcação de resolução.
 */

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsPanel } from "@/components/ui/tabs";
import type { CardRow } from "@/lib/api";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export function groupCardsByStatus(cards: CardRow[]) {
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

interface KanbanPanelProps {
  cards: CardRow[];
  isCreatingCard: boolean;
  onOpenNewCard: () => void;
  onViewCard: (card: CardRow) => void;
  onToggleResolved: (card: CardRow) => void;
  onDeleteCard: (card: CardRow) => void;
}

export function KanbanPanel({
  cards,
  isCreatingCard,
  onOpenNewCard,
  onViewCard,
  onToggleResolved,
  onDeleteCard,
}: KanbanPanelProps) {
  const kanbanColumns = groupCardsByStatus(cards);

  return (
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
          onClick={onOpenNewCard}
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
          <Button type="button" size="sm" className="mt-4" onClick={onOpenNewCard}>
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
                    onClick={() => onViewCard(card)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onViewCard(card);
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
                          onClick={() => onDeleteCard(card)}
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
    </TabsPanel>
  );
}
