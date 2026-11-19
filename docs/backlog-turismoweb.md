# TurismoWeb: épicas, historias, tareas y sprints

[Ver TurismoWeb en Jira](https://santiigetial.atlassian.net/jira/software/projects/TRSMWB/boards/74/backlog) · Proyecto **TRSMWB** · Tablero **74**.

Revisión: **11 de noviembre de 2026**. La organización se basa en los archivos de la aplicación web actual. El proyecto TUR se consultó para conservar el formato de épicas, historias, tareas y siete sprints; se mantuvo sin modificaciones.

## Organización verificada

- **9 épicas**, **24 historias** y **27 tareas técnicas**: 60 elementos.
- **7 sprints**, con sus objetivos y 51 historias o tareas asignadas exactamente una vez.
- Todas las historias y tareas tienen épica, criterios de aceptación y referencias al código.
- Los 60 elementos están **Por hacer** para su revisión y planificación; ninguno permanece cerrado.
- El alcance corresponde únicamente al proyecto actual. No se conserva una épica de evolución futura.

El [inventario JSON](backlog-turismoweb.json) recoge claves, criterios, fuentes, dependencias, IDs de sprints y resultados de la comprobación.

## Sprints

| Sprint | ID Jira | Objetivo | Historias y tareas |
|---|---|---|---:|
| 1: Base web y estructura de datos | 164 | Preparar Next.js, React, TypeScript, las pantallas base, los endpoints y la conexión inicial con Supabase. | 6 |
| 2: Base de datos, cuentas y viajes guardados | 165 | Implementar autenticación por correo, sesión y la lectura, escritura y restauración del viaje en Supabase. | 10 |
| 3: Búsqueda de lugares con Google Places | 166 | Implementar búsqueda por zona, categoría, nombre y distancia, referencias, paginación, fotografías y fichas. | 6 |
| 4: Modelo de IA Gemini y conversación | 167 | Conectar el SDK y el modelo Gemini con el chat, validar las respuestas y restringir el asistente a las funciones de la aplicación. | 6 |
| 5: Gestión de itinerarios | 168 | Organizar visitas elegidas, editar el orden y la agenda, y reiniciar o recuperar el viaje. | 5 |
| 6: Google Maps y trazado de rutas | 169 | Integrar el mapa, Google Routes, modos de recorrido, GPS, pin y referencias como puntos de salida. | 6 |
| 7: Navegación GPS, responsive y pruebas | 170 | Completar el avance automático a 20 metros, controles manuales, navegación móvil y comprobaciones de la aplicación. | 12 |

Los siete sprints se mantienen en estado **futuro**, como en el tablero original. No se inventaron fechas, responsables ni estimaciones. Su distribución organiza el trabajo del proyecto; no afirma que haya existido una ejecución histórica de esos sprints.

## Épicas

| Jira | Área | Entregables |
|---|---|---:|
| [TRSMWB-1](https://santiigetial.atlassian.net/browse/TRSMWB-1) | EP-01 — Desarrollo de la aplicación web con Next.js y React | 6 |
| [TRSMWB-2](https://santiigetial.atlassian.net/browse/TRSMWB-2) | EP-02 — Búsqueda y contenido con Google Places | 6 |
| [TRSMWB-3](https://santiigetial.atlassian.net/browse/TRSMWB-3) | EP-03 — Implementación del modelo de IA Gemini y chat | 6 |
| [TRSMWB-4](https://santiigetial.atlassian.net/browse/TRSMWB-4) | EP-04 — Gestión de itinerarios y visitas seleccionadas | 4 |
| [TRSMWB-5](https://santiigetial.atlassian.net/browse/TRSMWB-5) | EP-05 — Integración de Google Maps y trazado de rutas | 6 |
| [TRSMWB-6](https://santiigetial.atlassian.net/browse/TRSMWB-6) | EP-06 — Navegación GPS y avance automático entre destinos | 4 |
| [TRSMWB-7](https://santiigetial.atlassian.net/browse/TRSMWB-7) | EP-07 — Registro, autenticación y cuenta de usuario | 5 |
| [TRSMWB-8](https://santiigetial.atlassian.net/browse/TRSMWB-8) | EP-08 — Integración, pruebas y documentación de la web | 7 |
| [TRSMWB-9](https://santiigetial.atlassian.net/browse/TRSMWB-9) | EP-09 — Base de datos Supabase y persistencia de viajes | 7 |

## Historias y tareas por sprint

### TRSMWB Sprint 1 — Base web y estructura de datos

Preparar Next.js, React, TypeScript, las pantallas base, los endpoints y la conexión inicial con Supabase.

| Jira | Tipo | Entregable | Épica | Estado |
|---|---|---|---|---|
| [TRSMWB-10](https://santiigetial.atlassian.net/browse/TRSMWB-10) | Historia | Usar el planificador web como invitado | [TRSMWB-1](https://santiigetial.atlassian.net/browse/TRSMWB-1) | Por hacer |
| [TRSMWB-12](https://santiigetial.atlassian.net/browse/TRSMWB-12) | Historia | Usar controles, fichas y ventanas accesibles | [TRSMWB-1](https://santiigetial.atlassian.net/browse/TRSMWB-1) | Por hacer |
| [TRSMWB-52](https://santiigetial.atlassian.net/browse/TRSMWB-52) | Tarea | Implementar la base del proyecto web con Next.js, React y TypeScript | [TRSMWB-1](https://santiigetial.atlassian.net/browse/TRSMWB-1) | Por hacer |
| [TRSMWB-53](https://santiigetial.atlassian.net/browse/TRSMWB-53) | Tarea | Diseñar el modelo de datos de usuarios y viajes guardados en Supabase | [TRSMWB-9](https://santiigetial.atlassian.net/browse/TRSMWB-9) | Por hacer |
| [TRSMWB-54](https://santiigetial.atlassian.net/browse/TRSMWB-54) | Tarea | Integrar el cliente de Supabase y las variables de conexión | [TRSMWB-9](https://santiigetial.atlassian.net/browse/TRSMWB-9) | Por hacer |
| [TRSMWB-60](https://santiigetial.atlassian.net/browse/TRSMWB-60) | Tarea | Implementar los endpoints web de chat, lugares y rutas | [TRSMWB-1](https://santiigetial.atlassian.net/browse/TRSMWB-1) | Por hacer |

### TRSMWB Sprint 2 — Base de datos, cuentas y viajes guardados

Implementar autenticación por correo, sesión y la lectura, escritura y restauración del viaje en Supabase.

| Jira | Tipo | Entregable | Épica | Estado |
|---|---|---|---|---|
| [TRSMWB-38](https://santiigetial.atlassian.net/browse/TRSMWB-38) | Historia | Registrar una cuenta e iniciar sesión con correo y contraseña | [TRSMWB-7](https://santiigetial.atlassian.net/browse/TRSMWB-7) | Por hacer |
| [TRSMWB-39](https://santiigetial.atlassian.net/browse/TRSMWB-39) | Historia | Confirmar correo y procesar el retorno de autenticación | [TRSMWB-7](https://santiigetial.atlassian.net/browse/TRSMWB-7) | Por hacer |
| [TRSMWB-40](https://santiigetial.atlassian.net/browse/TRSMWB-40) | Historia | Recuperar la contraseña mediante un enlace de un solo uso | [TRSMWB-7](https://santiigetial.atlassian.net/browse/TRSMWB-7) | Por hacer |
| [TRSMWB-41](https://santiigetial.atlassian.net/browse/TRSMWB-41) | Historia | Mantener la sesión y limpiar datos al cerrar cuenta | [TRSMWB-7](https://santiigetial.atlassian.net/browse/TRSMWB-7) | Por hacer |
| [TRSMWB-42](https://santiigetial.atlassian.net/browse/TRSMWB-42) | Historia | Guardar, abrir y sincronizar un único viaje por cuenta | [TRSMWB-9](https://santiigetial.atlassian.net/browse/TRSMWB-9) | Por hacer |
| [TRSMWB-43](https://santiigetial.atlassian.net/browse/TRSMWB-43) | Tarea | Validar formatos de viajes guardados y migrar preferencias anteriores | [TRSMWB-9](https://santiigetial.atlassian.net/browse/TRSMWB-9) | Por hacer |
| [TRSMWB-44](https://santiigetial.atlassian.net/browse/TRSMWB-44) | Historia | Mostrar mensajes claros ante errores de autenticación y guardado | [TRSMWB-7](https://santiigetial.atlassian.net/browse/TRSMWB-7) | Por hacer |
| [TRSMWB-55](https://santiigetial.atlassian.net/browse/TRSMWB-55) | Tarea | Serializar el estado del viaje para guardarlo en la base de datos | [TRSMWB-9](https://santiigetial.atlassian.net/browse/TRSMWB-9) | Por hacer |
| [TRSMWB-56](https://santiigetial.atlassian.net/browse/TRSMWB-56) | Tarea | Implementar consultas y actualización del viaje guardado por usuario | [TRSMWB-9](https://santiigetial.atlassian.net/browse/TRSMWB-9) | Por hacer |
| [TRSMWB-57](https://santiigetial.atlassian.net/browse/TRSMWB-57) | Tarea | Restaurar el viaje y consultar de nuevo sus lugares en Google | [TRSMWB-9](https://santiigetial.atlassian.net/browse/TRSMWB-9) | Por hacer |

### TRSMWB Sprint 3 — Búsqueda de lugares con Google Places

Implementar búsqueda por zona, categoría, nombre y distancia, referencias, paginación, fotografías y fichas.

| Jira | Tipo | Entregable | Épica | Estado |
|---|---|---|---|---|
| [TRSMWB-14](https://santiigetial.atlassian.net/browse/TRSMWB-14) | Tarea | Implementar búsqueda de lugares con Google Places y filtros | [TRSMWB-2](https://santiigetial.atlassian.net/browse/TRSMWB-2) | Por hacer |
| [TRSMWB-15](https://santiigetial.atlassian.net/browse/TRSMWB-15) | Tarea | Resolver referencias geográficas con Google Places sin exigir GPS | [TRSMWB-2](https://santiigetial.atlassian.net/browse/TRSMWB-2) | Por hacer |
| [TRSMWB-16](https://santiigetial.atlassian.net/browse/TRSMWB-16) | Tarea | Calcular cercanía entre lugares mediante distancias por calles | [TRSMWB-2](https://santiigetial.atlassian.net/browse/TRSMWB-2) | Por hacer |
| [TRSMWB-17](https://santiigetial.atlassian.net/browse/TRSMWB-17) | Tarea | Implementar paginación y deduplicación de resultados de Google Places | [TRSMWB-2](https://santiigetial.atlassian.net/browse/TRSMWB-2) | Por hacer |
| [TRSMWB-18](https://santiigetial.atlassian.net/browse/TRSMWB-18) | Tarea | Integrar fotografías de Google Places con atribución | [TRSMWB-2](https://santiigetial.atlassian.net/browse/TRSMWB-2) | Por hacer |
| [TRSMWB-19](https://santiigetial.atlassian.net/browse/TRSMWB-19) | Historia | Mostrar fichas verificables y comunicar datos desconocidos | [TRSMWB-2](https://santiigetial.atlassian.net/browse/TRSMWB-2) | Por hacer |

### TRSMWB Sprint 4 — Modelo de IA Gemini y conversación

Conectar el SDK y el modelo Gemini con el chat, validar las respuestas y restringir el asistente a las funciones de la aplicación.

| Jira | Tipo | Entregable | Épica | Estado |
|---|---|---|---|---|
| [TRSMWB-20](https://santiigetial.atlassian.net/browse/TRSMWB-20) | Tarea | Implementar el chat web e interpretar solicitudes mediante IA | [TRSMWB-3](https://santiigetial.atlassian.net/browse/TRSMWB-3) | Por hacer |
| [TRSMWB-21](https://santiigetial.atlassian.net/browse/TRSMWB-21) | Tarea | Limitar el modelo de IA a las funciones de la aplicación | [TRSMWB-3](https://santiigetial.atlassian.net/browse/TRSMWB-3) | Por hacer |
| [TRSMWB-22](https://santiigetial.atlassian.net/browse/TRSMWB-22) | Tarea | Validar respuestas estructuradas de IA y usar solo lugares seleccionados | [TRSMWB-3](https://santiigetial.atlassian.net/browse/TRSMWB-3) | Por hacer |
| [TRSMWB-23](https://santiigetial.atlassian.net/browse/TRSMWB-23) | Historia | Reemplazar los resultados y la ruta visible al buscar otra cosa | [TRSMWB-3](https://santiigetial.atlassian.net/browse/TRSMWB-3) | Por hacer |
| [TRSMWB-24](https://santiigetial.atlassian.net/browse/TRSMWB-24) | Tarea | Implementar el asistente por reglas ante fallos o cuotas de Gemini | [TRSMWB-3](https://santiigetial.atlassian.net/browse/TRSMWB-3) | Por hacer |
| [TRSMWB-58](https://santiigetial.atlassian.net/browse/TRSMWB-58) | Tarea | Integrar el modelo Gemini con el SDK de Google y configuración del servidor | [TRSMWB-3](https://santiigetial.atlassian.net/browse/TRSMWB-3) | Por hacer |

### TRSMWB Sprint 5 — Gestión de itinerarios

Organizar visitas elegidas, editar el orden y la agenda, y reiniciar o recuperar el viaje.

| Jira | Tipo | Entregable | Épica | Estado |
|---|---|---|---|---|
| [TRSMWB-13](https://santiigetial.atlassian.net/browse/TRSMWB-13) | Historia | Reiniciar un viaje y deshacer el reinicio | [TRSMWB-1](https://santiigetial.atlassian.net/browse/TRSMWB-1) | Por hacer |
| [TRSMWB-25](https://santiigetial.atlassian.net/browse/TRSMWB-25) | Historia | Añadir únicamente las visitas elegidas al itinerario | [TRSMWB-4](https://santiigetial.atlassian.net/browse/TRSMWB-4) | Por hacer |
| [TRSMWB-26](https://santiigetial.atlassian.net/browse/TRSMWB-26) | Historia | Quitar y reordenar visitas conservando las demás | [TRSMWB-4](https://santiigetial.atlassian.net/browse/TRSMWB-4) | Por hacer |
| [TRSMWB-27](https://santiigetial.atlassian.net/browse/TRSMWB-27) | Historia | Consultar jornadas y una agenda orientativa | [TRSMWB-4](https://santiigetial.atlassian.net/browse/TRSMWB-4) | Por hacer |
| [TRSMWB-28](https://santiigetial.atlassian.net/browse/TRSMWB-28) | Historia | Ajustar preferencias y conservar una agenda válida | [TRSMWB-4](https://santiigetial.atlassian.net/browse/TRSMWB-4) | Por hacer |

### TRSMWB Sprint 6 — Google Maps y trazado de rutas

Integrar el mapa, Google Routes, modos de recorrido, GPS, pin y referencias como puntos de salida.

| Jira | Tipo | Entregable | Épica | Estado |
|---|---|---|---|---|
| [TRSMWB-29](https://santiigetial.atlassian.net/browse/TRSMWB-29) | Historia | Explorar marcadores y fichas en Google Maps | [TRSMWB-5](https://santiigetial.atlassian.net/browse/TRSMWB-5) | Por hacer |
| [TRSMWB-30](https://santiigetial.atlassian.net/browse/TRSMWB-30) | Tarea | Implementar el trazado de rutas con Google Routes API | [TRSMWB-5](https://santiigetial.atlassian.net/browse/TRSMWB-5) | Por hacer |
| [TRSMWB-31](https://santiigetial.atlassian.net/browse/TRSMWB-31) | Historia | Elegir salida con GPS o un pin en el mapa | [TRSMWB-5](https://santiigetial.atlassian.net/browse/TRSMWB-5) | Por hacer |
| [TRSMWB-32](https://santiigetial.atlassian.net/browse/TRSMWB-32) | Historia | Usar la referencia del mensaje como punto de partida | [TRSMWB-5](https://santiigetial.atlassian.net/browse/TRSMWB-5) | Por hacer |
| [TRSMWB-33](https://santiigetial.atlassian.net/browse/TRSMWB-33) | Historia | Abrir el recorrido en Google Maps y gestionar modos sin trazado interno | [TRSMWB-5](https://santiigetial.atlassian.net/browse/TRSMWB-5) | Por hacer |
| [TRSMWB-59](https://santiigetial.atlassian.net/browse/TRSMWB-59) | Tarea | Integrar Maps JavaScript API y configurar las claves de Google Maps | [TRSMWB-5](https://santiigetial.atlassian.net/browse/TRSMWB-5) | Por hacer |

### TRSMWB Sprint 7 — Navegación GPS, responsive y pruebas

Completar el avance automático a 20 metros, controles manuales, navegación móvil y comprobaciones de la aplicación.

| Jira | Tipo | Entregable | Épica | Estado |
|---|---|---|---|---|
| [TRSMWB-11](https://santiigetial.atlassian.net/browse/TRSMWB-11) | Historia | Navegar entre conversación, mapa e itinerario en teléfonos | [TRSMWB-1](https://santiigetial.atlassian.net/browse/TRSMWB-1) | Por hacer |
| [TRSMWB-34](https://santiigetial.atlassian.net/browse/TRSMWB-34) | Historia | Iniciar un recorrido del día y mostrar la parada activa | [TRSMWB-6](https://santiigetial.atlassian.net/browse/TRSMWB-6) | Por hacer |
| [TRSMWB-35](https://santiigetial.atlassian.net/browse/TRSMWB-35) | Historia | Avanzar automáticamente tras confirmar llegada dentro de 20 metros | [TRSMWB-6](https://santiigetial.atlassian.net/browse/TRSMWB-6) | Por hacer |
| [TRSMWB-36](https://santiigetial.atlassian.net/browse/TRSMWB-36) | Historia | Confirmar Ya llegué cuando no haya GPS fiable | [TRSMWB-6](https://santiigetial.atlassian.net/browse/TRSMWB-6) | Por hacer |
| [TRSMWB-37](https://santiigetial.atlassian.net/browse/TRSMWB-37) | Historia | Pausar, finalizar y cancelar el seguimiento sin consultas continuas | [TRSMWB-6](https://santiigetial.atlassian.net/browse/TRSMWB-6) | Por hacer |
| [TRSMWB-45](https://santiigetial.atlassian.net/browse/TRSMWB-45) | Tarea | Configurar compilación y cabeceras de la aplicación Next.js | [TRSMWB-8](https://santiigetial.atlassian.net/browse/TRSMWB-8) | Por hacer |
| [TRSMWB-46](https://santiigetial.atlassian.net/browse/TRSMWB-46) | Tarea | Validar solicitudes, firmar lugares y proteger claves y cuotas | [TRSMWB-8](https://santiigetial.atlassian.net/browse/TRSMWB-8) | Por hacer |
| [TRSMWB-47](https://santiigetial.atlassian.net/browse/TRSMWB-47) | Tarea | Ejecutar regresiones automáticas y comprobar tipos y compilación | [TRSMWB-8](https://santiigetial.atlassian.net/browse/TRSMWB-8) | Por hacer |
| [TRSMWB-48](https://santiigetial.atlassian.net/browse/TRSMWB-48) | Tarea | Actualizar la documentación de instalación y servicios de la web | [TRSMWB-8](https://santiigetial.atlassian.net/browse/TRSMWB-8) | Por hacer |
| [TRSMWB-49](https://santiigetial.atlassian.net/browse/TRSMWB-49) | Tarea | Verificar la integración de las API de chat, lugares y rutas | [TRSMWB-8](https://santiigetial.atlassian.net/browse/TRSMWB-8) | Por hacer |
| [TRSMWB-50](https://santiigetial.atlassian.net/browse/TRSMWB-50) | Tarea | Comprobar registro, recuperación y guardado con cuentas reales | [TRSMWB-8](https://santiigetial.atlassian.net/browse/TRSMWB-8) | Por hacer |
| [TRSMWB-51](https://santiigetial.atlassian.net/browse/TRSMWB-51) | Tarea | Comprobar navegación y llegada a 20 metros en teléfonos | [TRSMWB-8](https://santiigetial.atlassian.net/browse/TRSMWB-8) | Por hacer |

## Estados y comprobación

La consulta final de Jira confirmó **60 elementos Por hacer**, incluyendo las épicas. Se corrigió el cierre anticipado que dejaba sin trabajo pendiente los sprints 1, 3, 4, 5 y 6 en la vista de planificación. La presencia de código se conserva como referencia de implementación y no cierra automáticamente los elementos del backlog.

Se comprobaron las asignaciones y los elementos pendientes de cada sprint: **6, 10, 6, 6, 5, 6 y 12**, respectivamente. Los siete tienen trabajo abierto; no hay elementos Listo ni resoluciones pendientes de limpiar.

Se verificaron:

- Los 60 títulos, tipos, estados y vínculos con las épicas.
- Los objetivos y asignaciones reales de los 7 sprints, incluyendo la cantidad de trabajo abierto en cada uno.
- La asignación única de las 51 historias y tareas, sin elementos sueltos.
- La correspondencia de los entregables con los archivos del proyecto.
- La conservación de las 44 incidencias del proyecto histórico TUR.

Esta corrección modifica los estados de planificación en Jira y su inventario documental. Las asignaciones siguen distribuidas entre los siete sprints. La verificación se hizo mediante Jira; no hubo un navegador conectado para comprobar la pantalla.

