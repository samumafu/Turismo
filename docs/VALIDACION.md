# Cambio a descubrimiento dinámico · 2 de noviembre de 2026

## Recuperación de búsquedas ante caída de Overpass · 3 de noviembre de 2026

Se confirmó el 503 del despliegue al consultar museos de Pasto sin Gemini. Una consulta directa pequeña a Private.coffee también agotó el tiempo de espera. El transporte ahora valida respuestas, aplica un circuito de un minuto y permite un segundo Overpass configurable solo ante caída de red/5xx; 401/403/406/429 detienen la operación sin cambiar de proveedor. Los registros de diagnóstico solo incluyen host y causa técnica, sin nombres buscados ni conversaciones.

Si Overpass está caído, las búsquedas interactivas consultan Photon de Komoot, con límites de frecuencia, radio, país, departamento, categoría, 50 resultados, 8 s y 1 MB. Se informa su cobertura limitada y se mantienen IDs OSM, fuentes y coordenadas del proveedor. No se atribuyen precios, horarios ni gastronomía regional. No se añadió un catálogo de destinos. Las rutas que necesitan volver a resolver IDs en una instancia fría aún dependen de Overpass y conservan el enlace externo.

Validación real local: `discoverPlaces` recuperó `osm:way:175637820`, Museo del Carnaval, mediante Photon tras el timeout de Overpass. En Chrome la búsqueda avanzada mostró ese lugar en el mapa y en Itinerario. `POST /api/chat` en modo por reglas devolvió 200 con una agenda de un día sobre ese registro real; no consumió Gemini. TypeScript, lint y build aprobados. Pruebas simuladas de transporte y normalización cubren caída, pausa de cuotas, rechazo de HTML, tamaño de respuesta y descarte de lugares fuera de Nariño/radio/categoría. Los cambios requieren desplegarse antes de comprobar el mismo flujo en Vercel.

## Itinerario, cuentas y recuperación · 3 de noviembre de 2026

La búsqueda avanzada ahora publica resultados y selección en el estado compartido, sin navegar a la misma ruta para transferirlos. Las respuestas de chat con lugares se representan aunque no incluyan metadatos `discovery`. La pestaña muestra la agenda por días cuando se genera; antes de eso muestra lugares consultados, progreso, datos pendientes o el error real. Se retiró la imagen del estado vacío. Si Gemini omite una agenda pese a tener perfil completo y candidatos, se usa el planificador por reglas con esos candidatos, identificado como tal.

Comprobaciones: TypeScript, lint y build aprobados; 10 resultados aprobados en `tests/gemini.test.ts`, incluidos agenda omitida y destinos inventados, con HTTP simulado. En navegador con Supabase simulado: recuperación oculta tras cero, uno y dos errores `invalid_credentials`, visible tras el tercero; chat sin `discovery` representa cuatro lugares; agenda de dos días representa cuatro paradas y activa Itinerario; la búsqueda avanzada representa sus cuatro lugares allí. No se enviaron contraseñas de prueba a Supabase real.

En `turismo-seven-mu.vercel.app` la página responde 200 y Supabase tiene correo habilitado y Google deshabilitado. La API de viajes devuelve 404/PGRST205: `public.saved_journeys` no aparece en su caché de esquema; falta ejecutar el SQL en el proyecto conectado. Una única solicitud real a `/api/chat` devolvió 503 por falta de respuesta de OpenStreetMap. Por eso no se certifica el flujo completo de guardado ni la entrega de correo Brevo. Los cambios locales necesitan desplegarse para actualizar Vercel.

## Mapa principal y origen GPS · 3 de noviembre de 2026

Se eliminó la pestaña “Lugares”. Mapa es la vista inicial y aparece antes del chat en móviles. La ubicación se pide mediante un botón y permiso del navegador; no se persiste ni se envía a Gemini. La política HTTP permite geolocalización solo al propio sitio. Se muestran precisión, denegación, errores y controles para actualizar o dejar de usar la posición.

Las rutas incluyen origen GPS y de 1 a 5 destinos resueltos por ID OSM. FOSSGIS / OSRM tiene perfiles separados de carro y caminata; transporte público usa un enlace externo. Hay una sola ruta seleccionada: recorrido del día o destino individual, también seleccionable desde el marcador. Los cambios se agrupan con una espera y se cancelan solicitudes anteriores, sin sondeo ni reintentos automáticos. Las rutas con GPS no se almacenan en caché.

Validación acotada: TypeScript y lint de los archivos modificados; 5 resultados aprobados del archivo `tests/routing.test.ts` (4 casos más el contenedor), con HTTP simulado, sobre validación de origen/modo, destinos autoritativos, ausencia de caché GPS, perfil peatonal y rechazo de destinos restringidos. No se repitió la batería completa ni el build.

El proveedor real devolvió 4 puntos de paso, 61 coordenadas de geometría y 3572,5 m para un origen de prueba en Pasto y los tres museos del itinerario previo. En Chrome se verificaron permiso denegado, marcador de posición, limpieza al desactivar ubicación, mapa principal y ancho móvil de 390 px sin desbordamiento. Para comprobar el dibujo se simuló el GPS y se interceptó la respuesta de `/api/route` con esa geometría real capturada: no es una prueba de GPS físico ni del endpoint completo en condiciones reales. El intento completo encontró un timeout de Overpass al volver a resolver los destinos y mostró el error. El enrutador respondió correctamente de manera independiente; la disponibilidad de Overpass sigue siendo una limitación externa.

## Chat como entrada principal · 3 de noviembre de 2026

Gemini interpreta intención (`explore`, `plan`, `clarify`), perfil y filtros en una llamada. Buscar lugares no requiere completar presupuesto o duración. `/planificar` concentra el chat, el mapa y el itinerario; `/` redirige allí y `/destinos` ya no existe. Los controles manuales se montan al abrir “Búsqueda avanzada”. La planificación añade una segunda llamada con candidatos OSM.

Controles de esta etapa: TypeScript y lint de los archivos modificados; comprobación puntual en Chrome del botón avanzado y ancho móvil, y una llamada real de interpretación que devolvió `explore`, zona `ipiales`, categoría `restaurantes` y `regionalFood=true` sin presupuesto. Una búsqueda de museos encontró un timeout de Overpass y mostró el error. No se atribuye éxito a ese intento. A petición del usuario se posponen la batería completa, el build y otras pruebas de integración de esta etapa; los resultados posteriores de esta página corresponden a la etapa anterior.

El catálogo manual se eliminó. La aplicación usa registros obtenidos de Overpass, con IDs OSM, normalización, deduplicación, paginación y caché temporal. Los datos sintéticos de pruebas están aislados en `tests/` y no son un respaldo de la aplicación.

## Comprobaciones

- Pruebas de servidor con HTTP simulado: búsqueda y paginación de 125 registros en páginas de 50; normalización de nodos y centros; filtro administrativo/radio/categorías; escape de nombres; duplicados; datos desconocidos; restricciones; resolución por lotes; caché, coalescencia y cooldown.
- Gemini simulado: interpretación geográfica antes de planificar, candidatos limitados a 50, rechazo de un destino inventado y fallback por reglas ante cuota 429.
- API y navegador: se revisan aparte de TypeScript, lint y build con `/_next/mcp` y Chrome. La búsqueda real está disponible en `npm run test:api`, sin fixtures de sustitución.

Resultado de los controles: **33 pruebas aprobadas**, TypeScript y ESLint sin errores, build de producción aprobado y auditoría de dependencias de producción sin vulnerabilidades conocidas. Las pruebas nuevas cubren preguntas sin consultar Overpass, funcionamiento sin clave y mensajes de diagnóstico que no exponen errores crudos del proveedor.

En Chrome se comprobó el error real de búsqueda y, con respuestas HTTP sintéticas identificadas, se verificaron resultados, agrupación de marcadores y selección. No hubo desbordamiento horizontal a 390 px. Axe no encontró infracciones en el planificador; en el explorador quedaron comprobaciones de contraste manual sobre controles/teselas de Leaflet. `/_next/mcp` no reportó errores de compilación ni ejecución. Esta simulación no valida cobertura ni conectividad real de OSM/Gemini.

## Disponibilidad externa observada

Durante la implementación inicial, `overpass-api.de` respondió HTTP 406 y las consultas a Private.coffee y otras instancias probadas agotaron el timeout. Se verificó entonces el error visible de la aplicación. En la comprobación posterior con Gemini configurado, **Private.coffee sí respondió**: `npm run test:api` obtuvo 5 museos reales en un radio de 3 km de Pasto y generó un plan por reglas. Esto confirma conectividad en esa prueba, no disponibilidad permanente del proveedor compartido. No se hicieron reintentos automáticos ni rotación de instancias en el código para eludir cuotas.

No se desplegó en Vercel. Los límites de caché y frecuencia son por instancia, no distribuidos. El mapa de OSM no es una lista exhaustiva de los lugares existentes ni garantía de apertura o calidad.

## Activación de Gemini real

Se configuró `GEMINI_API_KEY` únicamente en `.env.local`, ignorado por Git. Se comprobó acceso al modelo `gemini-3.5-flash-lite` con el SDK oficial y respuestas JSON reales para interpretar una búsqueda y preguntar datos faltantes.

`npm run check:gemini` aprobó una llamada real sin consultar Overpass ni imprimir la clave. En Chrome, el chat respondió HTTP 200 y mostró “Conversando con Gemini” al pedir museos en Pasto sin haber completado duración, presupuesto o transporte. No se usaron respuestas simuladas para esa conversación.

Después se completaron los datos en el chat real: 1 día de museos en Pasto, 2 personas, 150000 COP para el grupo y carro. **Gemini generó y el servidor validó** “Recorrido por los museos de Pasto”, con Pinacoteca Departamental (`osm:way:115238858`), Museo del Oro (`osm:node:1999514293`) y Museo Taminango (`osm:way:115238095`). Chrome confirmó `mode=gemini`, un día de itinerario y persistencia de esos registros OSM. No se sustituyeron por fixtures.

El chat pregunta los datos faltantes antes de descubrir lugares. La planificación completa con destinos requiere que responda OSM; Gemini y Overpass pueden fallar de forma independiente. Se verificó además que `.env.local` está ignorado por Git y que la clave no aparece en los archivos publicables ni en los recursos estáticos de producción.

## Referencias

- [Private.coffee: endpoint, términos y uso responsable](https://overpass.private.coffee/).
- [Overpass: recursos compartidos](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).
- [Overpass QL: consultas geográficas y centros](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL).
- [OSM: cuisine](https://wiki.openstreetmap.org/wiki/Key:cuisine).
- [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster).
