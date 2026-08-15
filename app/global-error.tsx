"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  function reload() {
    window.location.reload();
  }

  return (
    <html lang="es">
      <body>
        <main className="login-page">
          <section className="login-form-wrap">
            <div className="login-form">
              <span className="eyebrow">INDEX ONE</span>
              <h2>No pudimos cargar la aplicación.</h2>
              <p>La sesión o los archivos del navegador pudieron quedar desactualizados después de una actualización.</p>
              <button className="button button-primary login-button" type="button" onClick={reload}>Recargar INDEX ONE</button>
              <button className="button" type="button" onClick={reset}>Intentar nuevamente</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
