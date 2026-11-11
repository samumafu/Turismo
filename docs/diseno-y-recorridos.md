# Diseño y recorridos dentro de la app

La cabecera concentra la marca, el título y la cuenta. El planificador conserva un único mapa al cambiar entre mapa e itinerario. La búsqueda avanzada funciona como un panel de filtros de ese mapa.

## Criterios visuales

- Verde bosque `#26594b`, tinta `#1c2926`, fondo `#f5f7f6`, blanco `#ffffff` y bordes `#e1e7e3`.
- Manrope para la interfaz; Fraunces se conserva en la marca Nariño.
- Jerarquía clara entre acción principal, botones secundarios y enlaces externos. Bordes de 11 a 24 px según el componente, sin movimientos de entrada exagerados.
- Fotos con marcos fijos, recorte proporcional, esquinas redondeadas y espacio reservado para la atribución. Ampliación en una ventana dentro de la app.
- Diseño adaptable desde 320 px, controles de al menos 44 px en móvil, foco visible y respeto por movimiento reducido.

Referencias: [layout de Apple](https://developer.apple.com/design/human-interface-guidelines/layout) y [jerarquía de botones de Apple](https://developer.apple.com/design/human-interface-guidelines/buttons).

## Búsquedas y distancia

La distancia máxima admite de 100 a 25 000 metros y se comprueba con [Compute Route Matrix](https://developers.google.com/maps/documentation/routes/compute_route_matrix). Sin GPS o referencia concreta, el origen es el centro de la zona indicada; la interfaz lo identifica explícitamente.

Para una búsqueda combinada, como una cafetería y un parque, se consultan las categorías por separado. Se comparan candidatos mediante rutas por calles, se exige una combinación con todas las categorías y se limita la conexión entre ellas a la distancia elegida o a 1 km, lo que sea menor. La selección se limita a los candidatos recibidos de Google; no representa una búsqueda exhaustiva de toda la ciudad.

Las matrices están acotadas: como máximo 24 candidatos y 48 elementos en total por búsqueda combinada. Los errores no se sustituyen por distancias inventadas. Las fotos solo se solicitan al entrar en pantalla, con dos solicitudes simultáneas y deduplicación temporal durante la visita a la página. No se persisten fotos ni catálogos de Google en Supabase.

## Recorrido del día

1. Añade las visitas que quieras.
2. Abre **Itinerario** y ordénalas con los controles de subir y bajar.
3. Pulsa **Ver recorrido del día en el mapa**.
4. La app muestra el trazado, distancia, duración e indicaciones. Conserva el orden elegido.

Con dos o más visitas, el recorrido puede empezar en la primera. Para incluir el trayecto hasta la primera visita, usa GPS o indica una salida en el chat y confírmala. El transporte público mantiene el enlace a Google Maps.

## Cuenta y viajes anteriores

El login usa una ventana accesible con cierre por Escape, campos etiquetados, opción de mostrar contraseña y recuperación de acceso. El registro mantiene el envío de verificación de Supabase y muestra instrucciones para revisar Gmail u otro servicio de correo. El enlace de confirmar correo del login y el botón de Google aún no disponible se retiraron.

Los viajes se guardan con versión 2. El lector acepta formatos anteriores, conserva preferencias e identificadores Google compatibles y vuelve a consultar las fichas. Las visitas del proveedor anterior deben elegirse de nuevo; no se inventa una equivalencia entre identificadores. Un dato corrupto no sobrescribe el viaje abierto.

## Validación

Se verificaron búsquedas y fotos reales de Google, un límite personalizado de 250 m y el recorrido de dos visitas sin GPS. Se comprobó que el mismo mapa permanece montado al alternar pestañas y reordenar visitas. Las pruebas de migración, distancia por calles, combinación de categorías y aceptación de visitas usan respuestas sintéticas para evitar consumo de APIs.

Las capturas de revisión están en `artifacts/redesign-*.png`. La entrega real del correo y un guardado con una sesión personal no forman parte de la comprobación automatizada.
