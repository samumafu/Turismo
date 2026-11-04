# Configurar Google Maps

Implementado: mapa interactivo, búsqueda por zona/nombre/categoría o referencia, fotos bajo demanda, rutas reales en carro y a pie desde GPS o un origen confirmado, e itinerarios con las visitas aceptadas. El transporte público conserva el enlace externo. Gemini y las cuentas siguen siendo independientes del mapa.

## Proyecto y APIs

1. Selecciona o crea un proyecto en Google Cloud Console. Es preferible separar Maps del proyecto gratuito de Gemini: habilitar facturación para Maps no cambiará así la facturación de Gemini.
2. Vincula una cuenta de facturación. Si eres elegible, usa la prueba gratuita sin convertirla en cuenta paga. Revisa estado y crédito en **Facturación**.
3. En **APIs y servicios → Biblioteca**, habilita **Maps JavaScript API**, **Places API (New)** y **Routes API**. No necesitas las APIs Legacy, Geocoding ni Route Matrix.

## Dos claves

En **APIs y servicios → Credenciales → Crear credenciales → Clave de API**, crea:

**Clave del navegador** (`turismo-maps-browser`):

- Restricciones de aplicaciones: **Sitios web / referentes HTTP**.
- Autoriza `http://localhost:3000/*`, `http://127.0.0.1:3000/*` y el dominio real publicado, por ejemplo `https://tu-sitio.vercel.app/*`. Agrega otros puertos solo si los usas. No autorices todos los dominios de Vercel.
- Restricciones de API: únicamente **Maps JavaScript API**.
- Variable: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Es visible en el navegador por diseño; restringirla es necesario.

**Clave del servidor** (`turismo-maps-server`):

- Restricciones de API: únicamente **Places API (New)** y **Routes API**.
- No apliques restricciones de sitios web: las consultas salen del servidor. Restringe por IP si tienes salida fija; Vercel normalmente tiene IP de salida variable sin configuración específica.
- Variable secreta: `GOOGLE_MAPS_SERVER_API_KEY`. Nunca la escribas en una variable `NEXT_PUBLIC_`, Git, capturas o mensajes.

## Variables y prueba

En `.env.local`, junto a `package.json`, completa:

```dotenv
NEXT_PUBLIC_PLACES_PROVIDER=google
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_clave_restringida_del_navegador
GOOGLE_MAPS_SERVER_API_KEY=tu_clave_secreta_del_servidor
```

Conserva las claves existentes de Gemini y Supabase. No reutilices la clave de Gemini para Maps. Opcionalmente configura un ID de mapa JavaScript con `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`; el prototipo utiliza por defecto el ID oficial `DEMO_MAP_ID`.

Reinicia desde esta carpeta:

```powershell
npm run dev
```

En Vercel agrega las tres variables en **Settings → Environment Variables** y vuelve a desplegar. Las variables públicas se incorporan al compilar; cambiar variables sin desplegar no actualiza el mapa. Autoriza el dominio publicado en la clave del navegador.

Este comando hace **una búsqueda real**, sin solicitar fotos ni rutas:

```powershell
npm run check:maps
```

Abre `/planificar`, busca un museo o cafetería en Pasto, añade una visita, pulsa **Ver foto del lugar** y prueba la ruta con GPS. Comprueba las métricas de las tres APIs en la consola.

## Consumo y cuotas

Los USD 200 mensuales recurrentes fueron sustituidos por cupos gratuitos por SKU el 1 de marzo de 2025. Referencia comprobada el 4 de noviembre de 2026:

| Operación usada           | Cupo gratuito mensual publicado |
| ------------------------- | ------------------------------: |
| Mapa dinámico             |                   10.000 cargas |
| Nearby Search Pro         |               5.000 solicitudes |
| Text Search Pro           |               5.000 solicitudes |
| Place Details Pro         |               5.000 solicitudes |
| Place Photos              |               1.000 solicitudes |
| Compute Routes Essentials |              10.000 solicitudes |

Son cupos independientes y agregados por cuenta de facturación, no por usuario. Pro es el nombre de un SKU; no implica contratar una suscripción. La app solicita nombre, dirección, coordenadas, categoría, estado y referencias de fotos. No solicita automáticamente reseñas, valoraciones, horarios ni teléfonos, que activarían otros SKUs; conserva un enlace a la ficha de Google Maps para consultarlos.

Cada búsqueda hace una solicitud. Resolver una referencia puede requerir otra búsqueda. Cada foto se pide al pulsar el botón. Abrir un viaje guardado requiere una consulta de detalles por lugar Google elegido. Cambiar origen, destino o modo solicita otra ruta, tras una espera breve para agrupar cambios rápidos. El mapa carga al mostrarlo. No hay consultas periódicas, búsquedas al mover el mapa ni descarga de galerías.

La app limita por instancia a 10 búsquedas/minuto, 10 fotos/minuto, 15 rutas/minuto y 30 fichas/minuto, además de sus límites por cliente. Estas protecciones están en memoria: no son contadores mensuales compartidos ni garantizan costo cero.

En **Google Maps Platform → Cuotas**, reduce los límites disponibles. Si existe cuota diaria, 20 búsquedas, 20 fotos y 20 rutas por día son un punto de partida conservador para este grupo pequeño; contempla también las fichas al reabrir viajes. Si una API solo ofrece límites por minuto, estos no equivalen a un tope mensual. La consola es la autoridad sobre las cuotas disponibles.

Configura presupuesto y alertas en **Facturación → Presupuestos y alertas**. Una alerta no detiene llamadas ni cobros. Durante una prueba elegible, mantén la cuenta como **Free Trial** sin actualizarla a paga: al agotarse la prueba se interrumpe el servicio. En una cuenta paga, los excesos pueden cobrarse. Al terminar el mes puedes deshabilitar las APIs o volver a `NEXT_PUBLIC_PLACES_PROVIDER=osm` y desplegar otra vez.

## Datos y errores

Los resultados de Google no se guardan en caché del servidor ni se persisten como catálogo. Permanecen en la sesión activa; las fichas firmadas se vuelven a consultar tras 30 minutos. Los viajes guardados y las descargas conservan IDs, elecciones y agenda; los datos de los lugares se recuperan de nuevo al abrirlos. Las fotos no se descargan al servidor y muestran sus autores y atribución.

El modo OSM y su caché siguen disponibles con `NEXT_PUBLIC_PLACES_PROVIDER=osm`. Un error de Google no cambia automáticamente a Leaflet: el contenido Google se muestra sobre un mapa Google. Los errores de configuración/cuota/conexión son visibles; no se sustituyen con lugares inventados.

- **RefererNotAllowedMapError**: revisa dominio y puerto autorizados en la clave del navegador.
- **ApiNotActivatedMapError**: habilita Maps JavaScript API.
- **BillingNotEnabledMapError**: revisa facturación del proyecto.
- **Búsquedas o rutas rechazadas**: revisa la clave del servidor, Places API (New), Routes API y sus restricciones.
- **Cuota alcanzada**: comprueba el consumo; no aumentes cuotas sin revisar costos.

Fuentes: [precios](https://developers.google.com/maps/billing-and-pricing/pricing), [cambio de 2025](https://developers.google.com/maps/billing-and-pricing/overview), [prueba gratuita](https://cloud.google.com/signup-faqs), [control de costos](https://developers.google.com/maps/billing-and-pricing/manage-costs), [políticas de Places](https://developers.google.com/maps/documentation/places/web-service/policies).
