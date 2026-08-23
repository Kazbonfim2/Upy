"use client";

import { Meter as MeterPrimitive } from "@base-ui/react/meter";
import type React from "react";
import { cn } from "@/lib/utils";

export function Meter({
  className,
  ...props
}: MeterPrimitive.Root.Props): React.ReactElement {
  return (
    <MeterPrimitive.Root
      className={cn("flex flex-col gap-1.5", className)}
      data-slot="meter"
      {...props}
    />
  );
}

export function MeterTrack({
  className,
  ...props
}: MeterPrimitive.Track.Props): React.ReactElement {
  return (
    <MeterPrimitive.Track
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      data-slot="meter-track"
      {...props}
    />
  );
}

export function MeterIndicator({
  className,
  ...props
}: MeterPrimitive.Indicator.Props): React.ReactElement {
  return (
    <MeterPrimitive.Indicator
      className={cn(
        "h-full rounded-full bg-primary transition-all duration-300",
        className,
      )}
      data-slot="meter-indicator"
      {...props}
    />
  );
}

export function MeterLabel({
  className,
  ...props
}: MeterPrimitive.Label.Props): React.ReactElement {
  return (
    <MeterPrimitive.Label
      className={cn("text-xs font-medium text-muted-foreground", className)}
      data-slot="meter-label"
      {...props}
    />
  );
}

export function MeterValue({
  className,
  ...props
}: MeterPrimitive.Value.Props): React.ReactElement {
  return (
    <MeterPrimitive.Value
      className={cn("text-xs font-medium text-foreground", className)}
      data-slot="meter-value"
      {...props}
    />
  );
}

export { MeterPrimitive };
