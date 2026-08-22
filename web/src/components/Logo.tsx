import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return <span className={cn("font-logo", className)}>Upy</span>;
}
