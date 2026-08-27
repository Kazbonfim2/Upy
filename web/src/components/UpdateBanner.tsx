import { ArrowUpRight, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type SystemStatus } from "@/lib/api";

export function UpdateBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api
      .getSystemStatus()
      .then((data) => {
        if (data.hasUpdate) {
          const dismissedTag = sessionStorage.getItem("upy_dismissed_update");
          if (dismissedTag !== data.latestVersion) {
            setStatus(data);
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!status?.hasUpdate || dismissed) return null;

  function onDismiss() {
    if (status) {
      sessionStorage.setItem("upy_dismissed_update", status.latestVersion);
    }
    setDismissed(true);
  }

  return (
    <div className="relative border-b border-primary/20 bg-primary/5 px-4 py-2 text-xs text-foreground transition-all">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="gap-1 bg-primary text-[10px] text-primary-foreground">
            <Sparkles className="size-3" />
            Atualização disponível
          </Badge>
          <span>
            Uma nova versão (<span className="font-semibold">{status.latestVersion}</span>) está disponível.
            Atualize seu clone com <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">git pull</code>.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            className="h-6 gap-1 text-[11px]"
            render={
              <a href={status.releaseUrl} target="_blank" rel="noreferrer" />
            }
          >
            Ver no GitHub
            <ArrowUpRight className="size-3" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
            aria-label="Dispensar aviso de atualização"
          >
            <X className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
