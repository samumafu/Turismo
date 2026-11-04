# Brevo + Supabase Auth

La aplicación usa Supabase Auth para crear y validar códigos de un solo uso. Brevo solo entrega los correos mediante SMTP. Las claves de Brevo no se guardan en Next.js, Vercel ni el repositorio.

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

## 3. Plantillas con código

En **Authentication → Email Templates**:

1. En **Confirm signup**, usa un asunto como `Tu código para verificar el correo` y pega `supabase/templates/confirmation.html`.
2. En **Reset password**, usa `Tu código para recuperar el acceso` y pega `supabase/templates/recovery.html`.

Ambas plantillas deben conservar `{{ .Token }}`. La interfaz espera seis dígitos y los valida directamente con Supabase. No agregues enlaces rastreados al correo.

## 4. URL y despliegue

En **Authentication → URL Configuration**:

- Site URL: `https://turismo-seven-mu.vercel.app`
- Redirect URL permitida: `https://turismo-seven-mu.vercel.app/planificar`
- Para desarrollo: `http://localhost:3000/planificar`

En Vercel deben seguir configuradas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La recuperación queda activa por defecto; `NEXT_PUBLIC_PASSWORD_RECOVERY_ENABLED=false` sirve únicamente como interruptor temporal.

## 5. Prueba mínima

1. Registra un correo real que no sea miembro del equipo de Supabase.
2. Comprueba en Brevo **Transactional → Logs** que el mensaje fue entregado.
3. Ingresa el código en la app e inicia sesión.
4. Falla la contraseña tres veces, abre recuperación, solicita el código y define una contraseña nueva.

No desactives Confirm email para resolver errores SMTP. Revisa primero los Auth Logs de Supabase y los Transactional Logs de Brevo.
