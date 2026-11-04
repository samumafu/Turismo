# Brevo + Supabase Auth

La aplicación usa Supabase Auth para generar y validar enlaces de confirmación y recuperación. Brevo entrega los correos mediante SMTP. Las claves de Brevo no se guardan en Next.js, Vercel ni el repositorio.

## 1. Preparar Brevo

1. En **Settings → Senders, Domains & Dedicated IPs**, crea y verifica el remitente que usará la aplicación. Para mejor entrega, autentica también su dominio.
2. En **Settings → SMTP & API → SMTP**, copia el **Login** y genera una **SMTP key**. No uses una API key `xkeysib-...`: Brevo no la acepta como contraseña SMTP.
3. Desactiva el seguimiento de enlaces para los correos de autenticación.

## 2. Conectar Supabase

En **Authentication → SMTP Settings**, activa Custom SMTP y usa:

- Host: `smtp-relay.brevo.com`
- Port: `587`
- Username: el **SMTP login** mostrado por Brevo
- Password: la **SMTP key** generada por Brevo
- Sender email: el remitente verificado
- Sender name: `Turismo Inteligente Pasto`

En **Authentication → Sign In / Providers → Email**:

- Email provider: activado
- Confirm email: activado
- Allow new users to sign up: activado

En **Authentication → Rate Limits**, conserva límites bajos para el prototipo. En **Authentication → Attack Protection**, activa CAPTCHA antes de abrir el registro a tráfico público.

## 3. Plantillas con botón

En **Authentication → Email Templates**:

1. En **Confirm signup**, usa el asunto `Confirma tu correo` y pega el contenido actualizado de `supabase/templates/confirmation.html`.
2. En **Reset password**, usa `Recupera tu acceso` y pega el contenido actualizado de `supabase/templates/recovery.html`.

Ambas plantillas deben conservar `{{ .ConfirmationURL }}` en el botón. Supabase verifica el enlace y devuelve la sesión al navegador. La aplicación comprueba el usuario con Supabase, elimina los tokens de la URL y abre el planificador o el formulario de nueva contraseña. Los errores y enlaces vencidos ofrecen volver a la cuenta para solicitar otro enlace. No hay campos ni lógica de códigos en la aplicación.

**Actualizar el HTML local y hacer push no cambia las plantillas alojadas en Supabase:** pega y guarda ambas en su panel. Desactiva el seguimiento de enlaces en Brevo. Si un filtro de correo consume el enlace antes de abrirlo, solicita otro desde «Confirmar mi correo»; es un enlace de un solo uso.

## 4. URL y despliegue

En **Authentication → URL Configuration**:

- Site URL: `https://turismo-seven-mu.vercel.app`
- Redirect URL permitida: `https://turismo-seven-mu.vercel.app/auth/confirmar`
- Redirect URL permitida: `https://turismo-seven-mu.vercel.app/auth/recuperar`
- Para desarrollo, añade `http://localhost:3000/auth/confirmar` y `http://localhost:3000/auth/recuperar`.

El registro y el reenvío usan `emailRedirectTo` con `/auth/confirmar`; la recuperación usa `redirectTo` con `/auth/recuperar`. Se toma el origen desde el que abres la app. Para otros dominios de Vercel, autoriza también esas dos rutas. Conserva Site URL apuntando a producción, no a localhost.

En Vercel deben seguir configuradas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La recuperación queda activa por defecto; `NEXT_PUBLIC_PASSWORD_RECOVERY_ENABLED=false` sirve únicamente como interruptor temporal.

## 5. Prueba mínima

1. Registra un correo real que no sea miembro del equipo de Supabase.
2. Comprueba en Brevo **Transactional → Logs** que el mensaje fue entregado.
3. Pulsa **Confirmar mi correo** en el email: Supabase confirma, la app comprueba la sesión y vuelve a `/planificar` con el acceso iniciado.
4. Falla la contraseña tres veces, abre recuperación y solicita el enlace. Pulsa **Crear nueva contraseña**, completa los dos campos y guarda. Volverás al planificador con tu sesión iniciada.
5. Un enlace vencido debe mostrar un error útil, sin afirmar que confirmó el correo. La página de recuperación sin enlace válido no muestra el formulario.

No desactives Confirm email para resolver errores SMTP. Revisa primero los Auth Logs de Supabase y los Transactional Logs de Brevo.

## Si el botón abre la app sin iniciar sesión

- `#error=access_denied&error_code=otp_expired` significa que Supabase rechazó un enlace usado o vencido. La app abre el acceso con el error real. Si ya confirmaste el correo, inicia sesión con tu contraseña; reenviar una confirmación de una cuenta ya confirmada no crea otra sesión.
- Un retorno a `localhost` se procesa en la app local, que necesita sus propias variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`. Las variables de Vercel no configuran tu computadora. La clave pública debe corresponder al mismo proyecto que emitió el correo.
- Si esperabas volver a Vercel, pon **Site URL** en `https://turismo-seven-mu.vercel.app` y autoriza sus dos callbacks. El origen donde queda guardada la sesión es el que abre el navegador; una sesión en localhost no inicia sesión en el dominio de Vercel.
- Tanto `/` como `/planificar` procesan retornos de sesión y errores. Si la sesión es válida, se conserva al recargar. Los retornos de recuperación a esas rutas se transfieren a `/auth/recuperar` antes de consumir el fragmento.
