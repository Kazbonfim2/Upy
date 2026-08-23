import { useEffect, useState } from "react";
import { ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg bg-background/90 backdrop-blur-xs transition-opacity duration-200"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="Voltar ao topo"
      aria-label="Voltar ao topo"
    >
      <ArrowUpIcon className="size-4" />
    </Button>
  );
}
