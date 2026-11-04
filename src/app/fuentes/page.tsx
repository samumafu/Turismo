import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
export const metadata: Metadata = { title: "Datos, fuentes y privacidad" };
export default function Sources() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="sources-page shell">
        <header className="page-intro">
          <span className="section-kicker">Explorar con criterio</span>
          <h1>
            El territorio cambia.
            <br />
            La información también.
          </h1>
          <p>
            Los lugares se consultan en el proveedor seleccionado: Google Maps o
            los datos abiertos de OpenStreetMap. No mantenemos una lista manual
            de atractivos.
          </p>
        </header>
        <div className="sources-body">
          <section id="google-maps">
            <h2>Google Maps</h2>
            <p>
              Cuando está habilitado, Google Maps proporciona el mapa, los
              lugares y las rutas. Cada búsqueda solicita hasta 20 coincidencias
              dentro del radio seleccionado, verificando que correspondan a
              Nariño, Colombia. Las fotos se solicitan individualmente, al
              pulsar «Ver foto del lugar», y conservan la atribución a sus
              autores. La falta de una foto o de un resultado no implica que el
              lugar no exista.
            </p>
            <p>
              El contenido de Google permanece en la sesión activa. Al guardar o
              descargar el viaje conservamos sus identificadores y tus
              elecciones; los nombres, direcciones y fotos de Google se vuelven
              a consultar al abrirlo. Los precios, horarios y disponibilidad se
              confirman en la ficha del lugar. Las horas de tu agenda son
              orientativas.
            </p>
            <p>
              Las consultas y referencias de búsqueda se envían a Google. El
              mapa también conecta el navegador con Google; las rutas envían
              origen, destinos y modo de viaje. Consulta la{" "}
              <a href="https://policies.google.com/privacy">
                Política de Privacidad de Google
              </a>
              , incorporada a esta política, y los{" "}
              <a href="https://maps.google.com/help/terms_maps/">
                Términos de Servicio de Google Maps
              </a>
              , incorporados a las condiciones de uso de esta aplicación. El
              servicio se ofrece como herramienta de planificación orientativa;
              verifica accesos, horarios y condiciones antes de viajar.
            </p>
          </section>
          <section>
            <h2>Modo alternativo: OpenStreetMap</h2>
            <p>
              Los resultados provienen de{" "}
              <a href="https://www.openstreetmap.org/copyright">
                OpenStreetMap, © sus colaboradores, licencia ODbL
              </a>
              , consultado mediante{" "}
              <a href="https://overpass.private.coffee/">
                Overpass de Private.coffee
              </a>
              . Cuando Overpass no responde, una búsqueda interactiva puede
              utilizar el índice{" "}
              <a href="https://photon.komoot.io/">Photon de Komoot</a>, también
              basado en OSM. Sus resultados tienen menor cobertura y se
              identifican como búsqueda alternativa. Cada lugar conserva su
              identificador, enlace de origen, coordenadas y fecha de consulta.
              Las coordenadas de áreas y edificios son su centro cartográfico,
              no una entrada garantizada.
            </p>
            <p>
              OSM es un mapa comunitario: puede tener datos incompletos,
              desactualizados o erróneos. “Encontrado en OSM” no significa
              inspeccionado, abierto, seguro o disponible. La falta de
              resultados tampoco significa que no existan lugares en esa zona.
            </p>
            <p>
              La búsqueda cubre el área administrativa de Nariño, en radios de
              500 metros a 25 kilómetros. Los centros de municipios son
              referencias aproximadas para iniciar búsquedas; el mapa permite
              explorar otras zonas. No se descarga todo el departamento. Cada
              página muestra hasta 50 resultados, con un máximo de 500 por
              consulta; cambia de zona o filtro para continuar explorando.
              Photon devuelve como máximo 50 coincidencias por búsqueda y no
              permite recorrer todo el departamento por paginación. Sus
              resultados se filtran por radio, categoría, país y departamento
              declarado. No se deduce gastronomía regional sin evidencia.
            </p>
            <p>
              Las etiquetas usadas incluyen tourism, historic, leisure, natural,
              waterway, amenity y cuisine. Para “restaurantes típicos” se exigen
              etiquetas de cocina regional/local/colombiana; no se atribuye
              autenticidad gastronómica a sitios sin ese dato.
            </p>
            <Link href="/planificar">Volver al planificador</Link>
          </section>
          <section>
            <h2>Caché temporal, sin catálogo manual</h2>
            <p>
              El servidor mantiene por 15 minutos las respuestas de Overpass,
              por un minuto las de respaldo de Photon y durante un máximo de 24
              horas los registros ya consultados. Si Overpass falla y existe una
              respuesta anterior para la misma consulta, se identifica
              claramente como caché antigua. Sin datos consultados, se informa
              el error: no se crean lugares de relleno.
            </p>
            <p>
              La caché vive en memoria, está acotada y puede desaparecer al
              reiniciar. Sin cuenta el plan permanece en la sesión; con cuenta
              puede guardarse. Los registros consultados llevan una firma del
              servidor válida durante 24 horas para calcular rutas sin repetir
              la búsqueda. Las coordenadas alteradas se rechazan. El origen GPS
              procede del permiso del dispositivo; una referencia de salida
              escrita en el chat se consulta y pide confirmación.
            </p>
          </section>
          <section>
            <h2>La IA y los límites de la propuesta</h2>
            <p>
              Con una clave configurada, Gemini interpreta zona, categorías,
              elecciones y punto de partida. El itinerario contiene únicamente
              visitas aceptadas por el viajero; buscar opciones no las añade. La
              interfaz conserva las coordenadas y nombres del proveedor. Los
              datos de lugares y la conversación se tratan como datos, nunca
              como instrucciones del sistema.
            </p>
            <p>
              Sin clave de Gemini o si Gemini falla se usa el buscador
              configurado y planificación por reglas, señalada como “sin IA”.
              Elegir visitas no requiere completar presupuesto ni acompañantes.
              Las recomendaciones de IA y por reglas son orientativas, no
              reservas ni cotizaciones.
            </p>
            <p>
              No inventamos precios, teléfonos o disponibilidad. Un horario de
              OSM se presenta como declaración comunitaria por confirmar; la
              hora propuesta en la agenda no es un horario de apertura. El
              presupuesto declarado no garantiza tarifas ni disponibilidad.
              Confirma rutas y traslados reales; el margen entre visitas no
              representa un tiempo de viaje medido.
            </p>
            <p>
              No se programan ingresos a sitios marcados privados o
              restringidos, ni ascensos a volcanes. La Corota se excluye por la{" "}
              <a href="https://www.parquesnacionales.gov.co/sala-prensa/resolucion-590-de-31-de-diciembre-de-2025/">
                resolución 590 de 2025
              </a>
              ; confirma cualquier cambio con Parques Nacionales.
            </p>
          </section>
          <section>
            <h2>Mapas y proveedores</h2>
            <p>
              Leaflet visualiza las teselas de OpenStreetMap con atribución
              visible. Solo se piden las teselas necesarias para la vista, sin
              descarga masiva ni uso offline, siguiendo su{" "}
              <a href="https://operations.osmfoundation.org/policies/tiles/">
                política de uso
              </a>
              . Los grupos del mapa reúnen puntos cercanos; no representan
              rutas.
            </p>
            <p>
              Los recorridos se consultan a{" "}
              <a href="https://routing.openstreetmap.de/about.html">
                FOSSGIS / OSRM
              </a>
              , con perfiles separados para carro y caminata. Al activar tu
              ubicación se traza una ruta hacia el destino seleccionado o las
              paradas del día, en orden. Cambiar destino o modo actualiza la
              ruta con límites de frecuencia. Solo se dibuja la geometría
              devuelta por el proveedor; confirma accesos finales a sitios
              naturales. El transporte público y las rutas no disponibles tienen
              enlaces externos de Google Maps. Cuando se selecciona el modo
              Google, el mapa y las rutas se consultan directamente a Google
              Maps Platform.
            </p>
            <p>
              Overpass y OSRM son servicios compartidos sin garantía de
              disponibilidad. Las búsquedas se disparan con una acción tuya,
              nunca automáticamente en cada movimiento del mapa; se limitan por
              radio, cantidad, tiempo y frecuencia. El servicio es un prototipo
              de bajo tráfico. Consulta los{" "}
              <a href="https://overpass.private.coffee/#terms">
                términos de Overpass
              </a>
              .
            </p>
          </section>
          <section id="fotografias">
            <h2>Fotografías de los lugares</h2>
            <p>
              <a href="https://commons.wikimedia.org/wiki/File:Santuario_de_Las_Lajas,_Ipiales,_Colombia,_2015-07-21,_DD_01.JPG">
                Santuario de Las Lajas y sus alrededores
              </a>{" "}
              — Diego Delso,{" "}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/">
                CC BY-SA 4.0
              </a>
              . Redimensionada y encuadrada según pantalla; conserva su
              licencia.
            </p>
            <p>
              Las fotografías se consultan a petición en Wikimedia Commons, en
              el modo OSM, usando sus enlaces o una coincidencia de nombre y
              ubicación en Wikidata. Cada imagen muestra autor, licencia y
              enlace de origen. Solo se aceptan CC BY, CC BY-SA, CC0 y dominio
              público. Si no hay una foto verificada se ofrece Google Maps como
              enlace externo. No se usa una foto cercana como si fuera del lugar
              elegido. En modo Google, las fotos se solicitan a Places API y se
              muestran con la atribución de Google Maps y sus autores; no se
              guardan como archivos de la aplicación.
            </p>
          </section>
          <section id="privacidad">
            <h2>Tu información</h2>
            <p>
              La ubicación se solicita al pulsar “Usar mi ubicación y trazar
              ruta”, con el permiso del navegador. Solo permanece en memoria
              durante esta sesión: no se guarda en el itinerario ni se envía a
              Gemini. Puedes actualizarla o dejar de usarla. Al calcular un
              trayecto, el servidor envía el origen y los destinos al enrutador,
              que puede conservar registros conforme a su{" "}
              <a href="https://routing.openstreetmap.de/about.html">
                política de privacidad
              </a>
              . La aplicación no almacena en caché rutas que incluyen tu origen
              GPS.
            </p>
            <p>
              Sin cuenta, el plan y la conversación se pierden al cerrar o
              recargar la página. Si creas una cuenta y guardas tu viaje, se
              almacena en Supabase asociado a tu usuario. La conversación y tu
              ubicación no forman parte del viaje guardado. No envíes datos
              personales en búsquedas o conversaciones.
            </p>
            <p>
              Con Gemini, la conversación y los candidatos se envían a Google.
              El nivel gratuito puede utilizar datos para mejorar productos:
              revisa sus{" "}
              <a href="https://ai.google.dev/gemini-api/terms">condiciones</a>.
              Overpass recibe zona, categorías y nombres buscados; no recibe tu
              presupuesto ni la conversación. Consulta la{" "}
              <a href="https://overpass.private.coffee/#privacy">
                política de Private.coffee
              </a>
              . Si se utiliza Photon, Komoot recibe los filtros y el nombre
              buscado, sin presupuesto ni conversación. Su servicio público
              requiere{" "}
              <a href="https://photon.komoot.io/#terms-of-use">uso razonable</a>
              . Los mapas, OSRM y Google Maps tienen sus propias políticas.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
