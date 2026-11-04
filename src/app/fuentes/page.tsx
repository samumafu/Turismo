import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
export const metadata: Metadata = { title: "Información y privacidad" };
export default function Sources() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="sources-page shell">
        <header className="page-intro">
          <span className="section-kicker">Explorar con criterio</span>
          <h1>Tu viaje, con información de lugares reales.</h1>
          <p>
            Google Maps proporciona los lugares, las fotos y las rutas. Tú
            eliges qué visitar.
          </p>
        </header>
        <div className="sources-body">
          <section>
            <h2>Lugares y fotografías</h2>
            <p>
              Las búsquedas se realizan en Google Maps por nombre, categoría o
              zona. Verificamos que los resultados correspondan a Nariño,
              Colombia, y al radio elegido. Cada página contiene hasta 20
              resultados; «Ver más lugares» consulta la siguiente página cuando
              está disponible, hasta 60 por búsqueda. Puedes cambiar los filtros
              o la zona para seguir explorando.
            </p>
            <p>
              Las fotos se solicitan al pulsar «Ver foto del lugar» y muestran
              el crédito de sus autores. Algunos lugares no tienen fotos
              disponibles. Los horarios, precios y disponibilidad se consultan
              en la ficha del lugar y deben confirmarse antes de viajar.
            </p>
            <p>
              El contenido de los lugares permanece en la sesión activa. Los
              viajes guardados y las descargas conservan identificadores,
              elecciones y agenda; los datos de los lugares se consultan de
              nuevo al abrirlos.
            </p>
          </section>
          <section>
            <h2>Rutas y tu ubicación</h2>
            <p>
              La ubicación se solicita con tu permiso al pulsar el botón de GPS.
              También puedes indicar una referencia de salida en el chat y
              confirmar el punto encontrado. Google calcula la ruta en carro o a
              pie entre las visitas aceptadas, en el orden que elegiste. El
              transporte público abre el recorrido en Google Maps.
            </p>
            <p>
              Tu posición GPS permanece en memoria durante la sesión y se envía
              a Google solo para calcular la ruta; no forma parte del viaje
              guardado ni se envía a Gemini. Puedes actualizarla o dejar de
              usarla. Las horas sugeridas en la agenda no son horarios de
              apertura ni tiempos de viaje medidos.
            </p>
          </section>
          <section>
            <h2>Planificación y cuentas</h2>
            <p>
              Gemini interpreta tus solicitudes cuando está configurado. Si no
              responde, la planificación por reglas sigue disponible con los
              mismos lugares de Google Maps. Solo se añaden las visitas que
              aceptas; buscar opciones no las incorpora al itinerario.
            </p>
            <p>
              No inventamos precios, disponibilidad ni fotografías. Confirma el
              acceso a los lugares naturales y evita ingresar a sitios cerrados
              o que requieren autorización.
            </p>
            <p>
              Sin cuenta, el plan y la conversación se pierden al cerrar o
              recargar la página. Si guardas tu viaje, tus elecciones se
              almacenan en Supabase asociadas a tu usuario. La conversación y la
              ubicación GPS no forman parte del viaje guardado.
            </p>
          </section>
          <section id="privacidad">
            <h2>Privacidad y condiciones</h2>
            <p>
              Google recibe las consultas de búsqueda, referencias y solicitudes
              de rutas y fotografías. El mapa conecta el navegador con Google.
              Esta aplicación incorpora la{" "}
              <a href="https://policies.google.com/privacy">
                Política de Privacidad de Google
              </a>{" "}
              y los{" "}
              <a href="https://maps.google.com/help/terms_maps/">
                Términos de Servicio de Google Maps
              </a>
              .
            </p>
            <p>
              Con Gemini, la conversación y los candidatos se envían a Google de
              acuerdo con sus{" "}
              <a href="https://ai.google.dev/gemini-api/terms">
                condiciones de uso
              </a>
              . Evita incluir información personal innecesaria en búsquedas o
              conversaciones.
            </p>
            <p>
              El servicio es una herramienta de planificación orientativa. Los
              resultados y rutas dependen de la cobertura y disponibilidad de
              Google Maps; no son reservas ni garantías de acceso.
            </p>
            <Link href="/planificar">Volver al planificador</Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
