"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const AGE_GATE_STORAGE_KEY = "lastoria:age-confirmed";

interface AgeGateContextValue {
  confirmed: boolean;
  /** sessionStorage уже прочитан */
  ready: boolean;
  requestConfirmation: () => Promise<boolean>;
}

const AgeGateContext = React.createContext<AgeGateContextValue | null>(null);

export function AgeGateProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("ageGate");
  const [confirmed, setConfirmed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  React.useEffect(() => {
    // Читаем sessionStorage асинхронно, чтобы не вызывать setState синхронно в эффекте.
    queueMicrotask(() => {
      try {
        if (window.sessionStorage.getItem(AGE_GATE_STORAGE_KEY) === "1") {
          setConfirmed(true);
        }
      } catch {
        // ignore
      }
      setReady(true);
    });
  }, []);

  const requestConfirmation = React.useCallback((): Promise<boolean> => {
    if (confirmed) return Promise.resolve(true);
    setOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, [confirmed]);

  const handleConfirm = () => {
    setConfirmed(true);
    try {
      window.sessionStorage.setItem(AGE_GATE_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  };

  const handleDecline = () => {
    setOpen(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  };

  return (
    <AgeGateContext.Provider value={{ confirmed, ready, requestConfirmation }}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && handleDecline()}>
        <DialogContent hideClose className="plaque max-w-md border-border-strong">
          <DialogHeader>
            <p aria-hidden="true" className="mx-auto flex size-14 items-center justify-center rounded-full bg-charcoal font-display text-xl font-bold text-cream">
              18+
            </p>
            <DialogTitle className="text-center font-display text-xl text-primary">{t("title")}</DialogTitle>
            <DialogDescription className="text-center text-base">{t("text")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={handleDecline}>
              {t("decline")}
            </Button>
            <Button onClick={handleConfirm}>{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AgeGateContext.Provider>
  );
}

export function useAgeGate() {
  const ctx = React.useContext(AgeGateContext);
  if (!ctx) throw new Error("useAgeGate должен использоваться внутри AgeGateProvider");
  return ctx;
}
