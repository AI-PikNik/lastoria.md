"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAgeGate } from "./age-gate-context";

export function AlcoholGuard({ children }: { children: React.ReactNode }) {
  const { confirmed, requestConfirmation } = useAgeGate();
  const router = useRouter();
  const [confirmedByDialog, setConfirmedByDialog] = React.useState(false);
  const asked = React.useRef(false);

  React.useEffect(() => {
    if (confirmed || asked.current) return;
    asked.current = true;
    requestConfirmation().then((ok) => {
      if (ok) {
        setConfirmedByDialog(true);
      } else {
        router.replace("/menu");
      }
    });
  }, [confirmed, requestConfirmation, router]);

  if (!confirmed && !confirmedByDialog) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Требуется подтверждение возраста…
      </div>
    );
  }

  return <>{children}</>;
}
