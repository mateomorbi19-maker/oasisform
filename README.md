# Formulario Oasis

Formulario web de iniciación del agente de WhatsApp de Piscinas Oasis LP: las 84 preguntas del
PDF más los documentos (D1–D7, C1–C2), con autoguardado en el servidor, archivos adjuntos y envío
por mail de todas las respuestas (HTML + `oasis-respuestas.md` + archivos).

Sin dependencias: Node 22.9 o posterior.

## En local

```bash
cp .env.example .env
npm run dev
```

Abre en http://localhost:3000 (o el `PORT` de `.env`). Sin variables SMTP el mail no sale: queda
en `data/correos/envio-N.html` para verlo. Las respuestas se guardan en `data/respuestas.json`.

## Cómo funciona

- Un solo formulario compartido: el mismo link sirve en el celular y en la compu, y lo pueden
  completar varias personas. Se guarda cada respuesta mientras escriben.
- Al enviar, el servidor manda el mail a `MAIL_AVISO`. Si falla, reintenta cada 10 minutos (hasta
  5 veces). Se puede volver a enviar después de cambiar algo.
- Estado del servidor y del correo: `/api/salud`.

## Deploy en Easypanel

1. **+ Service → App**, Source GitHub `mateomorbi19-maker/oasisform`, rama `main`, Build **Dockerfile**.
2. **Mounts → Volume** en `/app/data`.
3. **Domains**: tu dominio, puerto **3000**.
4. **Environment**:

| Variable | Valor |
|---|---|
| `CODIGO_ACCESO` | Un código largo inventado, sin espacios |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PUERTO` | `465` |
| `SMTP_USUARIO` | Tu Gmail |
| `SMTP_CLAVE` | Contraseña de aplicación (https://myaccount.google.com/apppasswords) |
| `SMTP_REMITENTE` | Tu Gmail |
| `MAIL_AVISO` | Dónde querés recibir las respuestas |

5. Deploy, y revisá que `https://tu-dominio/api/salud` diga `"correo": { "listo": true }`.
6. El link para el cliente: `https://tu-dominio/?c=<CODIGO_ACCESO>`.

Antes de mandárselo, hacé un envío de prueba y después borrá `respuestas.json` del volumen para
que el cliente arranque de cero.
