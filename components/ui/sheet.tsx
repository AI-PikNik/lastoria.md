"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Выезжающая панель: side="right" — мобильное меню, side="bottom" — фильтры (bottom sheet) */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const SIDE_CLASSES = {
  right:
    "inset-y-0 right-0 h-full w-[88vw] max-w-sm border-l data-[state=open]:animate-[sheet-in-right_.22s_ease-out]",
  left: "inset-y-0 left-0 h-full w-[88vw] max-w-sm border-r data-[state=open]:animate-[sheet-in-left_.22s_ease-out]",
  bottom:
    "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border-t pb-[max(1rem,env(safe-area-inset-bottom))] data-[state=open]:animate-[sheet-in-bottom_.22s_ease-out]",
} as const;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: keyof typeof SIDE_CLASSES;
    closeLabel?: string;
  }
>(({ className, children, side = "right", closeLabel = "Close", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-charcoal/55 backdrop-blur-[1px]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col overflow-y-auto border-border-strong bg-background p-5 shadow-lift outline-none",
        SIDE_CLASSES[side],
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/70 hover:bg-surface hover:text-foreground"
        aria-label={closeLabel}
      >
        <X className="size-5" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("pr-12 font-display text-xl font-bold text-primary", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = DialogPrimitive.Description;

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
