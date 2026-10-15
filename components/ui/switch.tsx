"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Переключатель. Выключен — серый с рамкой, включён — зелёный с галочкой:
 * состояние видно на любом мониторе и в любом браузере (раньше выключенный
 * был почти белым и сливался с карточкой).
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer group inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=unchecked]:border-[#8a8178] data-[state=unchecked]:bg-[#a39b91]",
      "data-[state=checked]:border-[#2f6b35] data-[state=checked]:bg-[#3c8a43]",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none flex size-5 items-center justify-center rounded-full bg-white shadow-md ring-0 transition-transform",
        "data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-0.5"
      )}
    >
      <Check className="size-3.5 text-[#2f6b35] opacity-0 transition-opacity group-data-[state=checked]:opacity-100" strokeWidth={3} />
    </SwitchPrimitive.Thumb>
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
