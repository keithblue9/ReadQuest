"use client";

// Menggantikan root layout saat layout itu sendiri gagal; CSS global tidak dimuat, jadi gaya ditulis di sini.
const CSS = `
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px;
    font-family: system-ui, sans-serif; text-align: center; background: #f0f2f5; color: #1c1e21; }
  p.muted { color: #6b6480; }
  button { margin-top: 8px; border: 0; border-radius: 16px; padding: 12px 28px; font: 700 16px system-ui, sans-serif;
    background: #2563eb; color: #fff; cursor: pointer; }
  @media (prefers-color-scheme: dark) {
    body { background: #14111f; color: #f5f3ff; }
    p.muted { color: #a39cb8; }
    button { background: #8b73ff; color: #14111f; }
  }
`;

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="id">
      <body>
        <title>ReadQuest</title>
        <style>{CSS}</style>
        <div>
          <p style={{ fontSize: 56, margin: 0 }} aria-hidden>
            📚
          </p>
          <h1 style={{ fontSize: 22 }}>ReadQuest sedang bermasalah</h1>
          <p className="muted">Muat ulang aplikasi untuk mencoba lagi.</p>
          <button type="button" onClick={() => retry()}>
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
