"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative inline-flex size-11 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 shadow-none transition-shadow outline-none after:absolute after:inset-0 after:m-auto after:size-5 after:rounded-[4px] after:border after:border-input after:bg-background after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20 aria-invalid:after:border-destructive data-[state=checked]:text-primary-foreground data-[state=checked]:after:border-primary data-[state=checked]:after:bg-primary dark:bg-transparent dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:after:bg-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="relative z-10 grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
