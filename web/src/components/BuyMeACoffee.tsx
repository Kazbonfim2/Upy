import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BuyMeACoffee({
  size = "sm",
  variant = "outline",
  className,
}: {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  return (
    <Button
      size={size}
      variant={variant}
      className={cn(
        "border-yellow-500/80 hover:border-yellow-500 hover:bg-yellow-500/10",
        className,
      )}
      render={
        <a
          href="https://www.buymeacoffee.com/zcrygamesm"
          target="_blank"
          rel="noreferrer"
        />
      }
    >
      Me paga um café ☕
    </Button>
  );
}
