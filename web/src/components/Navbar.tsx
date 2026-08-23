import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar({ children }: { children?: ReactNode }) {
  const isApp =
    typeof window !== "undefined" &&
    (window.location.pathname === "/app" || window.location.pathname.startsWith("/app/"));

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <a href="/" className="text-foreground no-underline">
          <Logo className="text-2xl" />
        </a>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="outline">Open Source</Badge>
            <Badge variant="outline">Self-hosted</Badge>
            <Badge variant="secondary">MIT</Badge>
          </div>
          <ThemeToggle />
          {children ??
            (isApp ? (
              <Button size="sm" variant="outline" render={<a href="/" />}>
                Início
              </Button>
            ) : (
              <Button size="sm" render={<a href="/app" />}>
                Dashboard
              </Button>
            ))}
        </div>
      </nav>
    </header>
  );
}
