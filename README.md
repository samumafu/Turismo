# Turismo Nariño · Turismo Inteligente Pasto

Planificador turístico en Next.js, TypeScript, Tailwind y shadcn/ui. **Google Maps es el único proveedor de mapas, lugares, fotografías y rutas.** No hay un catálogo manual de destinos ni resultados de relleno.

## Ejecutar

Requiere Node.js 22 o 24 y npm. Desde esta carpeta:

```powershell
npm install
npm run dev
```

Copia `.env.example` a `.env.local` y configura `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y `GOOGLE_MAPS_SERVER_API_KEY`. Habilita Maps JavaScript API, Places API (New) y Routes API. Sigue [la guía de consola y cuotas](docs/google-maps.md). No se necesita un selector de proveedor.

## Descubrimiento y planificación

El chat y la búsqueda avanzada consultan Google Places por zona, nombre, referencia y categorías. Se comprueban país, departamento y radio. Cada página contiene hasta 20 resultados y **Ver más lugares** carga otra página disponible, hasta 60 por búsqueda. Las fotos se abren a petición con sus autores y atribución de Google Maps.

Añade solo los destinos que quieras visitar; buscar opciones no los incorpora al itinerario. Google Routes devuelve la geometría, distancia y duración de las rutas en carro o a pie desde GPS o un origen confirmado. El transporte público abre Google Maps.

Los horarios de agenda son orientativos. Tarifas, apertura y disponibilidad se confirman en la ficha del lugar. La app no inventa esos datos ni calcula rutas con líneas rectas.

Los viajes guardados conservan IDs, elecciones y agenda; los datos de los lugares se vuelven a consultar al abrirlos. No se guardan fotos, fichas ni rutas de Google como catálogo del servidor.

## Gemini opcional

Configura `GEMINI_API_KEY` y `GEMINI_MODEL` para interpretar la conversación. Es preferible conservar Gemini en un proyecto separado si utilizas su nivel gratuito sin facturación. Sin clave o ante un fallo, la planificación por reglas sigue disponible usando los mismos lugares de Google Maps.

```powershell
npm run check:gemini
```

## Cuentas y viaje guardado

Una vez configurado Maps, la aplicación puede usarse como invitado. Para activar cuentas y guardar un viaje por usuario:

1. Crea un proyecto **Free** en [Supabase](https://supabase.com/pricing) y ejecuta el archivo `supabase/schema.sql` en su SQL Editor. Sus políticas RLS restringen cada registro al dueño.
2. Copia la URL del proyecto y su clave **publishable** (o anon) a `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`; reinicia Next.js. Configura las mismas variables en Vercel y vuelve a desplegar. Son valores públicos: nunca uses la clave `service_role` en el navegador.
3. En Authentication → Sign In / Providers → Email habilita correo/contraseña y **Confirm email**. El registro envía un enlace con el botón «Confirmar mi correo»; al abrirlo, Supabase confirma y la app inicia sesión en el planificador.
4. Conecta Brevo en Authentication → SMTP usando el login y la **SMTP key** de Brevo, no una API key `xkeysib-...`. Pega las plantillas `supabase/templates/confirmation.html` y `supabase/templates/recovery.html` en Confirm signup y Reset password. La guía completa está en [`docs/BREVO_SUPABASE.md`](docs/BREVO_SUPABASE.md).

El botón de Google está deshabilitado hasta implementar el acceso OAuth y configurar el proveedor. Las credenciales de Google y Brevo se configuran en Supabase, no en el navegador, Vercel ni este repositorio. La confirmación y recuperación usan enlaces de un solo uso, sin campos de códigos. Autoriza `/auth/confirmar` y `/auth/recuperar` tanto en el dominio de producción como en localhost en **Authentication → URL Configuration → Redirect URLs**. Site URL debe apuntar a producción. «¿Olvidaste tu contraseña?» aparece después de tres respuestas `invalid_credentials`; los fallos de red y configuración no cuentan. La recuperación está activa por defecto y puede pausarse con `NEXT_PUBLIC_PASSWORD_RECOVERY_ENABLED=false`. El enlace de recuperación abre una página con dos campos para la contraseña nueva y vuelve al planificador tras guardarla.

Si el guardado devuelve `PGRST205` o «Could not find the table public.saved_journeys», ejecuta `supabase/schema.sql` en el **mismo proyecto** al que apunta la URL configurada en Vercel. Configurar Auth no crea automáticamente la tabla de viajes.

Tras iniciar sesión, el viaje guardado se abre si la sesión está vacía. Si hay dos viajes (uno abierto y otro guardado), usa «Guardar viaje actual» o «Abrir viaje guardado» para elegir cuál conservar. Si aún no hay un registro guardado, el viaje abierto se guarda automáticamente. Después de guardar o abrir, los cambios se sincronizan automáticamente; la cuenta conserva un solo viaje. Durante el registro, una copia temporal en `sessionStorage` intenta conservar el viaje al confirmar el correo en la misma pestaña; si el navegador bloquea ese almacenamiento o abre otra pestaña, no está garantizado. El chat y la posición GPS no se guardan. La sesión de Supabase se conserva en el navegador hasta cerrar sesión.

## Validación

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Comprobación explícita con una búsqueda real, sin fotos ni rutas:

```powershell
npm run check:maps
```

Con el servidor activo, `npm run test:api` realiza una búsqueda y genera un itinerario con un destino aceptado. Estas comprobaciones reales consumen solicitudes de Google.

## Vercel

Configura las claves de Maps y las variables opcionales de Gemini/Supabase en Settings → Environment Variables y despliega de nuevo. Autoriza el dominio exacto en la clave del navegador. La clave del servidor se limita a Places API (New) y Routes API y nunca se expone al cliente.

## Archivos importantes

- `src/lib/server/google-maps.ts`: búsqueda paginada, referencias, fichas y fotografías.
- `src/lib/server/google-routes.ts`: rutas reales y decodificación de geometría.
- `src/lib/server/discovery.ts`: validación y firma de los lugares recibidos.
- `src/components/discovery/`: mapa, búsqueda y fotos.
- `src/components/planner/`: chat, elecciones, itinerario y cuentas.
- `docs/google-maps.md`: claves, uso y cuotas.
- `docs/BREVO_SUPABASE.md`: configuración de correo de las cuentas.
