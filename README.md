# Turismo Nariño · Turismo Inteligente Pasto

Aplicación Next.js App Router, TypeScript, Tailwind y shadcn/ui con búsqueda turística dinámica en **OpenStreetMap / Overpass**, mapa Leaflet con agrupación y planificación con Gemini opcional.

**No contiene un catálogo manual de lugares ni un respaldo de 14 destinos.** Los puntos se obtienen de OSM al buscar; las respuestas consultadas usan una caché temporal del servidor. Los viajeros con cuenta pueden guardar su plan.

## Ejecutar

Node.js 22 o 24 y npm. Desde `turismo-inteligente-pasto`:

```powershell
npm install
npm run dev
```

Abre http://localhost:3000/planificar. Copia solo los comandos, sin `PS ...>`. No hace falta una clave para buscar o planificar por reglas, pero sí conexión a Overpass.

La única experiencia principal está en `/planificar`; `/` redirige allí y la antigua página `/destinos` fue eliminada. Gemini decide si explorar, pedir información o planificar, y traduce la conversación a filtros permitidos y datos del viaje. Puedes cambiar zona, categoría, radio, presupuesto, días, acompañantes o transporte conversando. Buscar lugares no exige completar un itinerario.

Los filtros manuales y la exploración del mapa se cargan únicamente al abrir **Búsqueda avanzada**. Allí puedes elegir zona, categoría y radio, paginar o pulsar **Buscar en esta zona del mapa**. No se consulta al escribir ni al arrastrar.

En la búsqueda avanzada puedes seleccionar hasta 5 lugares como candidatos. Sin cuenta, el plan se mantiene solo en memoria durante la sesión. Con cuenta puedes guardar un viaje en Supabase y recuperarlo después. Al editar o calcular una ruta, el servidor resuelve los identificadores OSM y no confía en coordenadas de destinos enviadas por el navegador.

## Cuentas y viaje guardado

La aplicación funciona sin configuración adicional como invitado. Para activar cuentas y guardar un viaje por usuario:

1. Crea un proyecto **Free** en [Supabase](https://supabase.com/pricing) y ejecuta el archivo `supabase/schema.sql` en su SQL Editor. Sus políticas RLS restringen cada registro al dueño.
2. Copia la URL del proyecto y su clave **publishable** (o anon) a `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`; reinicia Next.js. Configura las mismas variables en Vercel y vuelve a desplegar. Son valores públicos: nunca uses la clave `service_role` en el navegador.
3. En Authentication habilita correo y contraseña. Si mantienes la confirmación de correo, configura Site URL y Redirect URLs para tus direcciones local y desplegada. Sin SMTP externo, Supabase limita los destinatarios y la frecuencia de correo.
4. En Authentication → SMTP configura Brevo con sus credenciales **SMTP**, remitente verificado y el host/puerto indicados en Brevo. En Authentication → Email Templates → Reset Password incluye `{{ .Token }}` para enviar el código; sin ese cambio el correo predeterminado puede contener un enlace en lugar del código que solicita la interfaz.

El botón de Google está deshabilitado hasta configurar el proveedor. Las credenciales de Google y Brevo se configuran en Supabase, no en el navegador ni en este repositorio. La recuperación usa el código de un solo uso de Supabase y Brevo actúa como proveedor de envío SMTP.

Tras iniciar sesión, el viaje guardado se abre si la sesión está vacía. Si ya hay un viaje abierto, usa «Guardar viaje actual» o «Abrir viaje guardado» para elegir cuál conservar. Después de guardar o abrir, los cambios se sincronizan automáticamente; la cuenta conserva un solo viaje. Durante el registro, una copia temporal en `sessionStorage` intenta conservar el viaje al confirmar el correo en la misma pestaña; si el navegador bloquea ese almacenamiento o abre otra pestaña, no está garantizado. El chat y la posición GPS no se guardan. La sesión de Supabase se conserva en el navegador hasta cerrar sesión.

## Búsqueda, cobertura y límites

- Endpoint `POST /api/places/search`, JSON validado; consulta por zona o centro del mapa, categoría, nombre y radio de **500 m a 25 km**.
- La selección se intersecta con el área administrativa `ISO3166-2=CO-NAR`. Los centros iniciales de municipios son anclas aproximadas de búsqueda, **no una base de atractivos**. El mapa permite explorar otras zonas del departamento.
- Categorías: atractivos, museos, monumentos/templos, parques, miradores, naturaleza, cascadas, restaurantes, cafeterías, alojamiento y cultura. Etiquetas OSM: tourism, historic, leisure, natural, waterway, amenity, landuse y cuisine.
- Se consultan nodos, vías y relaciones. Se conserva `osm:<tipo>:<id>`. Los nodos tienen su coordenada; las vías/relaciones usan el centro cartográfico declarado por Overpass, que **no garantiza un acceso o entrada**.
- Máximo **500 registros por consulta** en servidor; se muestra un aviso si se alcanza el límite. El navegador recibe **hasta 50 por página**. Para ampliar la cobertura se cambia de zona, radio o filtro: no se descarga todo Nariño ni se presentan 500 resultados como el total del departamento.
- Marcadores agrupados con Leaflet.markercluster. Se muestran solo los de la página actual o los del itinerario, y los grupos fuera de la vista se retiran del render.
- Duplicados: ID canónico y mismo nombre/categoría a menos de 40 m. No se fusionan indiscriminadamente lugares vecinos distintos.
- “Típico” se filtra por `cuisine=regional/local/colombian`; si faltan etiquetas no se atribuye gastronomía local por suposición. OSM no garantiza cobertura, autenticidad, calidad, apertura ni actualización; ausencia de resultados no demuestra ausencia de lugares.
- Horarios de OSM se muestran como datos declarados por la comunidad, por confirmar. Precios y disponibilidad permanecen desconocidos. Las duraciones/horas del itinerario son sugerencias, y el reparto del presupuesto es una provisión, no una cotización.

## Proveedores gratuitos

### Mapa principal, ubicación y rutas

La vista inicial es **Mapa**; se eliminó la pestaña “Lugares”. En móviles el mapa aparece antes del chat. Los destinos del chat se muestran como marcadores, con detalles y acceso a rutas desde cada marcador.

Pulsa **Usar mi ubicación y trazar ruta** y concede permiso. Se muestra tu posición con su precisión aproximada; si ya hay recomendaciones, se calcula un recorrido desde ese origen. En una búsqueda se parte hacia el primer destino y puedes elegir otro en el selector o su marcador. Para un itinerario puedes recorrer las paradas del día en orden o elegir un destino individual. Actualiza tu ubicación si te desplazas: no hay seguimiento GPS continuo.

Las rutas en carro y a pie usan perfiles reales distintos de [FOSSGIS / OSRM](https://routing.openstreetmap.de/about.html), sin cuenta ni clave. Se respeta un máximo de una solicitud por segundo por instancia, sin reintentos automáticos, con cancelación y espera ante cambios rápidos. No se generan líneas rectas para sustituir rutas. Si falla el proveedor, se muestra el error y un enlace a Google Maps **con el origen GPS**. El transporte público usa ese enlace externo; no se simula su ruta como si fuera de carro.

La ubicación solo vive en memoria del navegador, no se persiste con el itinerario ni se envía a Gemini. Se transmite al servidor y al enrutador al calcular un trayecto; el proveedor puede registrar solicitudes según su política. Las rutas con GPS no entran en la caché del servidor. El origen se valida como coordenada WGS84; las coordenadas de los destinos se obtienen exclusivamente resolviendo IDs OSM en el servidor. La red puede comenzar hasta 500 m del origen y terminar hasta 100 m de un marcador: confirma entradas, especialmente en centros de áreas naturales. Los destinos restringidos se rechazan.

**Permisos:** geolocalización habilitada con `Permissions-Policy: geolocation=(self)`. Funciona en HTTPS (Vercel) o `localhost`; abrir `http://192.168...` en un teléfono normalmente no permite GPS. El navegador maneja el permiso y la precisión. Si deniegas el acceso, hay un aviso para reactivarlo y puedes seguir viendo el mapa.

### Descubrimiento

El proveedor predeterminado es [Overpass de Private.coffee](https://overpass.private.coffee/), que publica acceso gratuito sin registro y pide uso responsable. Es configurable en el servidor:

```dotenv
OVERPASS_API_URL=https://overpass.private.coffee/api/interpreter
# Para identificar el proyecto al proveedor; Vercel también aporta VERCEL_URL.
APP_PUBLIC_URL=https://tu-proyecto.vercel.app
```

El servidor envía un User-Agent identificable. Una consulta está limitada a 12 s de ejecución en Overpass, 15 s de red, 16 MiB de memoria remota declarada y 3 MB de respuesta descargada. No hay reintentos automáticos ni rotación de proveedores para evadir cuotas. Se espacia el inicio de solicitudes al menos 1,6 s, se limita a 15/minuto y se pausa un minuto ante 406/429/503/504. Solicitudes simultáneas idénticas comparten la misma consulta.

Caché de búsqueda: 15 minutos, hasta 40 consultas; registro temporal: hasta 2000 lugares y 24 horas. Si falla el proveedor y existe una respuesta para **esa misma búsqueda** de menos de 24 horas, se devuelve etiquetada como caché anterior. Sin datos consultados, se muestra un error con opción de reintento. **No se generan destinos de relleno.** La caché está en memoria, se puede perder al reiniciar y no está compartida entre instancias de Vercel; este prototipo está dimensionado para bajo tráfico universitario.

Overpass es compartido y puede rechazar peticiones o estar inaccesible desde determinadas redes. Un 406/429 requiere esperar; un timeout puede ser del proveedor o de conectividad. Puedes cambiar `OVERPASS_API_URL` a una instancia compatible cuyos términos hayas revisado. No se configura ningún servicio de pago como fallback.

Mapa: OpenStreetMap con [atribución y política de teselas](https://operations.osmfoundation.org/policies/tiles/), sin descarga offline ni precarga masiva. FOSSGIS / OSRM proporciona geometría real en carro o a pie desde la ubicación permitida del usuario. Si no se puede calcular un trayecto o se elige transporte público, se ofrece Google Maps mediante URLs externas sin API key. Nunca se representa una recta como ruta transitable.

## Gemini opcional y costo cero

Copia `.env.example` a `.env.local`, agrega una clave de un proyecto **Free tier sin facturación habilitada** y reinicia:

```dotenv
GEMINI_API_KEY=tu_clave_solo_en_servidor
GEMINI_MODEL=gemini-3.5-flash-lite
```

La clave se coloca en **`turismo-inteligente-pasto/.env.local`**, junto a `package.json`, nunca dentro de `src/`. El archivo está excluido de Git. Si cambias la clave o el modelo, reinicia `npm run dev`.

Para verificar la clave con **una llamada real**, sin depender de Overpass:

```powershell
npm run check:gemini
```

El comando verifica JSON estructurado y preguntas de seguimiento con el mismo SDK y validación del servidor. No imprime la clave, no inventa destinos y no sustituye la prueba de un itinerario completo con OSM. No forma parte de `npm test` ni del build, para evitar consumir cuota sin intención.

Gemini puede pedir datos faltantes para un itinerario sin consultar Overpass. Una búsqueda directa de lugares consulta OSM sin exigir presupuesto ni duración. Tanto la búsqueda como un itinerario con destinos requieren que responda OSM.

SDK oficial `@google/genai`, Interactions API y JSON validado con Zod. Flujo:

1. Gemini interpreta intención (`explore`, `plan`, `clarify`), perfil, zona, categorías y nombre mediante un contrato permitido. No genera Overpass QL ni coordenadas.
2. El servidor construye la consulta, obtiene registros OSM, normaliza, deduplica y selecciona candidatos relevantes.
3. Gemini recibe **hasta 50 candidatos**, incluyendo visitas anteriores pertinentes. Solo puede devolver sus IDs. El cliente representa nombres y coordenadas originales.
4. El servidor rechaza IDs inventados/restringidos, jornadas incoherentes y paradas incompatibles por distancia/tiempo orientativo. Si falla Gemini se planifica por reglas **sobre los mismos resultados OSM**, sin catálogo local.

Las etiquetas OSM y los mensajes se tratan como datos no confiables para instrucciones. No se añaden fotos externas sin licencia revisada. La fotografía incluida tiene atribución en `/fuentes`.

Gemini: sin reintentos ni continuaciones automáticas, hasta 6 llamadas/minuto y 60 por ventana de 24 horas por instancia. Explorar o pedir aclaraciones consume una llamada; planificar normalmente usa dos (interpretación y agenda). El código no puede comprobar la facturación de tu clave: conserva el proyecto de Google sin billing para que exceder la cuota no implique cobros. No se usa Google Places, grounding de pago ni pagos. Evita datos personales: el nivel gratuito de Google puede usar mensajes para mejorar productos. Condiciones y privacidad en `/fuentes`.

### Modelo, versión y continuidad gratuita

El modelo fijado es **`gemini-3.5-flash-lite`**, seleccionado por `GEMINI_MODEL` en `.env.local` y leído en `src/lib/server/gemini.ts`. El SDK que lo invoca es `@google/genai` (versión instalada en `package-lock.json`); SDK y modelo son versiones distintas. No se usa un alias `latest` ni se cambia automáticamente a otro modelo.

La [tarifa oficial de Gemini 3.5 Flash-Lite](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite) publica entrada y salida gratuitas en Free tier. Revisa que el proyecto asociado a tu clave figure como **Free** en [Google AI Studio](https://aistudio.google.com/api-keys) y no habilites una cuenta de facturación. Los límites internos no son una garantía de costo si activas billing. Las [cuotas reales](https://aistudio.google.com/rate-limit) dependen de tu proyecto y pueden ser menores que las del código. Ante cuota agotada se muestran avisos y se usan reglas sobre OSM; no se contrata una alternativa de pago. Google puede cambiar cuotas, precios o retirar modelos: no se puede garantizar disponibilidad o gratuidad indefinida. Si ocurre, revisa los términos, actualiza `GEMINI_MODEL` y comprueba con `npm run check:gemini`.

## Validación

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` usa HTTP simulado con datos sintéticos **solo en `tests/`**, nunca importados por la aplicación. Comprueba consultas acotadas, nombres escapados, paginación 125→50, normalización y fuentes, caché/coalescencia, fallos/429 sin respaldo inventado, interpretación Gemini y selección fundamentada.

Con `next dev` activo, `npm run test:api` hace una consulta **real** a Overpass y genera un plan por reglas. No la ejecutes de manera repetitiva en un servicio público. Si falla la conexión, el test falla explícitamente; no sustituye esa verificación por un fixture.

Para construir mientras `next dev` sigue activo:

```powershell
$env:NEXT_BUILD_DIR='.next-production'
npm run build
Remove-Item Env:NEXT_BUILD_DIR
```

## Vercel

Importa el repositorio y selecciona `turismo-inteligente-pasto` como Root Directory, Next.js y Node 24. Usa `npm run build`, salida predeterminada y un plan Hobby elegible para uso académico no comercial. En Settings → Environment Variables agrega `GEMINI_API_KEY` con tu clave y `GEMINI_MODEL=gemini-3.5-flash-lite` para los entornos que usarás; vuelve a desplegar. `.env.local` permanece en tu computador y no se sube a Vercel. `OVERPASS_API_URL` y Gemini son variables de servidor; no antepongas `NEXT_PUBLIC_` a la clave. No configures `NEXT_BUILD_DIR` en Vercel. No se necesitan add-ons ni facturación de Google para el modo OSM sin IA.

## Archivos importantes

- `src/lib/places.ts`: contratos de lugares/búsqueda y anclas geográficas.
- `src/lib/osm.ts`: consultas permitidas, normalización y deduplicación.
- `src/lib/server/discovery.ts`: Overpass, paginación y caché temporal.
- `src/app/api/places/search/route.ts`: endpoint de descubrimiento.
- `src/lib/server/gemini.ts` y `src/app/api/chat/route.ts`: interpretar → buscar → planificar.
- `src/components/discovery/`: búsqueda, filtros, selección, mapa agrupado.
- `src/components/planner/`: conversación y plan dinámico con registros OSM.

La lista manual anterior y `src/data/places.json` se eliminaron. El viaje solo se guarda en la base de datos cuando se usa una cuenta; no hay persistencia local del itinerario.
