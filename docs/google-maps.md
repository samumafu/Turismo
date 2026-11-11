# Google Maps: configuración y funcionamiento

La aplicación utiliza Google Maps como único proveedor de lugares, fotografías y rutas. Gemini interpreta la conversación y Supabase gestiona las cuentas y los viajes guardados; son integraciones independientes.

## APIs y claves

En Google Cloud Console, selecciona el proyecto y habilita **Maps JavaScript API**, **Places API (New)** y **Routes API**. No hacen falta las APIs Legacy, Geocoding ni Route Matrix.

Crea dos claves en **APIs y servicios → Credenciales**:

- **Navegador**: restringida a sitios web y exclusivamente a Maps JavaScript API. Autoriza `http://localhost:3000/*`, `http://127.0.0.1:3000/*` y el dominio publicado exacto.
- **Servidor**: restringida exclusivamente a Places API (New) y Routes API. No uses restricciones de referentes HTTP. Si tu alojamiento tiene salida por IP fija, puedes restringirla a esa IP; Vercel normalmente tiene salida variable.

Configura en `.env.local`:

```dotenv
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=clave_del_navegador
GOOGLE_MAPS_SERVER_API_KEY=clave_secreta_del_servidor
# Opcional: ID de mapa JavaScript. El prototipo usa DEMO_MAP_ID por defecto.
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
```

No se necesita selector de proveedor. Conserva tus claves de Gemini y Supabase. La clave del servidor nunca debe aparecer en variables públicas, capturas, Git o mensajes.

Reinicia `npm run dev`. En Vercel agrega las mismas variables y vuelve a desplegar; las variables públicas se incorporan al compilar.

## Lugares, fotos y rutas

Las búsquedas usan Text Search de Places API (New). Cada página solicita hasta 20 registros. **Ver más lugares** consulta la página siguiente únicamente cuando lo pides, hasta 60 resultados por búsqueda si Google los proporciona. Cambiar zona, categoría, radio o nombre inicia una búsqueda nueva. Los resultados se filtran por Nariño, Colombia, radio e intereses solicitados; por eso una página puede mostrar menos de 20.

Se muestran todas las opciones recibidas, sin el antiguo recorte visual de tres por categoría. Cada lugar permite abrir su foto. Las fotografías se solicitan individualmente con sus créditos; algunos lugares no tienen imágenes disponibles. No hay descarga automática de galerías ni consultas periódicas al mover el mapa.

El itinerario contiene únicamente visitas aceptadas, con hasta cinco paradas por jornada. Google calcula rutas reales en carro o a pie desde el GPS o un origen confirmado. El transporte público conserva el enlace externo. Las horas de la agenda son orientativas; la duración y distancia de la ruta provienen de Google.

Los lugares no se guardan como catálogo. Los viajes guardados conservan identificadores, elecciones y agenda. Al abrirlos, se vuelven a consultar las fichas. Las fotografías y las rutas no se almacenan en caché del servidor. Los registros firmados tienen una vigencia de 30 minutos para evitar consultas repetidas durante la sesión.

La distancia de búsqueda es personalizable entre 100 y 25 000 metros. Routes API Compute Route Matrix mide los trayectos por calles y filtra los resultados según esa distancia. Las búsquedas combinadas consultan cada categoría por separado y verifican conexiones cortas entre ellas; no se inventan distancias si Google no encuentra una ruta. Los puntos sin una referencia concreta usan el centro de la zona, claramente indicado en la interfaz.

Las fotos se solicitan solo cuando entran en pantalla, con dos descargas simultáneas como máximo. Durante esa visita a la página se deduplican las solicitudes de una misma imagen durante cinco minutos. No hay catálogo ni caché persistente de fotografías. En la ficha del marcador y en las tarjetas se conservan las atribuciones.

## Verificación

Una búsqueda real, sin fotos ni rutas:

```powershell
npm run check:maps
```

Para probar el recorrido completo, abre `/planificar`, busca lugares, pulsa **Ver más lugares**, abre una foto y añade visitas al itinerario. Usa el GPS o confirma un punto de partida y elige carro o caminata. Comprueba las métricas de las APIs en Cloud Console.

## Uso gratuito y cuotas

Los USD 200 mensuales recurrentes fueron sustituidos por cupos gratuitos por SKU desde el 1 de marzo de 2025. Referencia comprobada el 4 de noviembre de 2026:

| Operación utilizada       | Cupo gratuito mensual publicado |
| ------------------------- | ------------------------------: |
| Mapa dinámico             |                   10.000 cargas |
| Text Search Pro           |               5.000 solicitudes |
| Place Details Pro         |               5.000 solicitudes |
| Place Photos              |               1.000 solicitudes |
| Compute Routes Essentials |              10.000 solicitudes |

Pro es el nombre de un SKU, no una suscripción contratada por la aplicación. Cada página adicional, foto, ficha reabierta y nueva ruta consume su respectiva solicitud. Los cupos se agregan por cuenta de facturación.

La app pide nombre, dirección, coordenadas, categorías, estado y referencias de fotos. No solicita automáticamente reseñas, valoraciones, horarios o teléfonos, que activarían otros SKUs. Esa información se puede consultar en el enlace a la ficha del lugar.

La app limita por instancia a 10 búsquedas, 10 fotos, 15 rutas y 30 fichas por minuto, además de sus límites por cliente. Estos contadores están en memoria y no son topes mensuales compartidos.

Configura cuotas conservadoras y alertas en Cloud Console. Si la consola ofrece cuota diaria, 20 búsquedas, 20 fotos y 20 rutas al día son un punto de partida para un grupo pequeño; contempla también las fichas reabiertas. Una cuota por minuto no equivale a un tope mensual. Las alertas de presupuesto no detienen cobros.

Si eres elegible para la prueba gratuita, puedes mantener la cuenta como Free Trial sin convertirla en paga: al agotarse la prueba se interrumpe el servicio. En una cuenta paga, exceder los cupos puede generar cobros. Para dejar de usar Maps al terminar el mes, deshabilita las APIs o el despliegue.

## Errores habituales

- **RefererNotAllowedMapError**: comprueba el dominio y puerto de la clave del navegador.
- **ApiNotActivatedMapError**: habilita Maps JavaScript API.
- **BillingNotEnabledMapError**: revisa la facturación del proyecto.
- **Búsquedas/rutas rechazadas**: comprueba la clave del servidor, Places API (New), Routes API y sus restricciones.
- **Cuota alcanzada**: revisa consumo y límites antes de aumentarlos.

Fuentes: [precios](https://developers.google.com/maps/billing-and-pricing/pricing), [paginación](https://developers.google.com/maps/documentation/places/web-service/text-search), [cambios de 2025](https://developers.google.com/maps/billing-and-pricing/overview), [prueba gratuita](https://cloud.google.com/signup-faqs), [control de costos](https://developers.google.com/maps/billing-and-pricing/manage-costs), [políticas de Places](https://developers.google.com/maps/documentation/places/web-service/policies).
