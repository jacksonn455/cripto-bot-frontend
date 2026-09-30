"use client";

/**
 * Last-resort boundary (replaces the root layout), so even a layout crash shows something.
 * Inline styles only: globals.css may not be loaded here.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fff", color: "#111", padding: 32 }}>
        <main role="alert" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>O painel encontrou um erro inesperado</h1>
          <p style={{ color: "#555" }}>Nenhuma ação foi enviada ao bot. Tente recarregar a página.</p>
          <button
            onClick={reset}
            style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}
          >
            Tentar de novo
          </button>
          <p style={{ marginTop: 32, fontSize: 12, color: "#666" }}>
            Projeto educacional. Resultados passados, inclusive de backtest, não garantem resultados futuros.
          </p>
        </main>
      </body>
    </html>
  );
}
