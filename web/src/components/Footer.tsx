import { GithubIcon } from "@/components/GithubIcon";
import { Logo } from "@/components/Logo";

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={className}>
      <hr className="border-t border-border" />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
        <Logo className="text-lg text-foreground" />
        <div className="flex items-center gap-4">
          <span>Open source · Self-hosted · MIT</span>
          <a
            href="https://github.com/Kazbonfim2/Upy"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <GithubIcon className="size-4" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
