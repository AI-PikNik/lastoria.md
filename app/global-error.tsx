"use client";

/** Ошибка в самом корневом лейауте — минимальная страница без зависимостей */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ro">
      <body style={{ fontFamily: "Georgia, serif", background: "#f6ebd8", color: "#2b2118", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 40, fontStyle: "italic", fontWeight: 700, color: "#7a1f1f", margin: 0 }}>La Storia</p>
          <p>Ceva nu a mers bine · Something went wrong</p>
          <button onClick={() => reset()} style={{ minHeight: 44, padding: "0 20px", background: "#7a1f1f", color: "#fff8ee", border: 0, borderRadius: 8, fontSize: 16 }}>
            ↻
          </button>
        </div>
      </body>
    </html>
  );
}
