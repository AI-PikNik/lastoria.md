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
import { Button } from "@/components/ui/button";

const AGE_GATE_STORAGE_KEY = "lastoria:age-confirmed";

interface AgeGateContextValue {
  confirmed: boolean;
  requestConfirmation: () => Promise<boolean>;
}

const AgeGateContext = React.createContext<AgeGateContextValue | null>(null);

export function AgeGateProvider({ children }: { children: React.ReactNode }) {
  const [confirmed, setConfirmed] = React.useState(false);
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
    <AgeGateContext.Provider value={{ confirmed, requestConfirmation }}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && handleDecline()}>
        <DialogContent hideClose>
          <DialogHeader>
            <DialogTitle>Подтверждение возраста 18+</DialogTitle>
            <DialogDescription>
              Раздел содержит алкогольную продукцию. Продажа алкоголя лицам младше 18 лет
              запрещена. Подтвердите, что вам уже исполнилось 18 лет.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDecline}>
              Мне нет 18
            </Button>
            <Button onClick={handleConfirm}>Мне есть 18 лет</Button>
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
