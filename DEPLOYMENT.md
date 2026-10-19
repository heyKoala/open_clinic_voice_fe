# Deploying the Gunasheela front desk

How to put this app (`heyKoala/open_clinic_voice_fe_simple`, branch `dev`) online, and what the backend
(`heyKoala/open_clinic_voice_be`) needs for it to work.

## 1. Build

```
npm ci
npm run build        # type-checks, then writes static files to dist/
```

The output is a static single-page app; there is no server code. Node 20 or newer is needed only to build.

## 2. Host it on the same domain as the backend (recommended)

Serve `dist/` from nginx (or the same load balancer as the backend) and forward three paths to Django. This
mirrors the dev setup, so no frontend environment variables are needed and there is no CORS to configure.

```nginx
server {
    server_name desk.example.com;
    root /var/www/gunasheela/dist;

    location /api/   { proxy_pass http://backend:8001; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /media/ { proxy_pass http://backend:8001; proxy_set_header Host $host; }
    location /ws/    { proxy_pass http://backend:8001; proxy_http_version 1.1;
                       proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }

    location = /sw.js      { add_header Cache-Control "no-cache"; }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location /assets/      { add_header Cache-Control "public, max-age=31536000, immutable"; }
    location /             { try_files $uri /index.html; }   # app routes such as /app/visits
}
```

- **HTTPS is required.** The backend uses secure cookies and redirects to HTTPS when `DEBUG` is off.
- **`try_files ... /index.html` is required.** Without it, reloading any page inside the app returns 404.
- **`/ws/` needs the upgrade headers** for the dashboard's live updates.

## 3. If the frontend and backend must be on different hosts

- Keep both on the same parent domain, e.g. `desk.example.com` and `api.example.com`. Login uses
  `SameSite=Lax` cookies, which browsers do not send across unrelated domains, so e.g. `*.vercel.app` with a
  separate API domain will fail at login.
- Build with `VITE_API_BASE_URL=https://api.example.com/api/v1` (see `.env.example`).
- The backend's proxy must pass `/ws/` with the WebSocket upgrade headers.
- Never put secrets in `VITE_` variables: they are built into the public JavaScript.

## 4. Backend settings for this app

In the backend's `.env` or AWS Secrets Manager:

| Setting | Value |
| --- | --- |
| `DJANGO_DEBUG` | `0` |
| `DJANGO_ALLOWED_HOSTS` | the backend host(s) |
| `FRONTEND_URL` | `https://desk.example.com` |
| `CSRF_TRUSTED_ORIGINS` | `https://desk.example.com` |
| `CORS_ALLOWED_ORIGINS` | `https://desk.example.com` (must be HTTPS or the backend refuses to start) |
| `PUBLIC_BASE_URL` | the backend's public HTTPS address; the voice service calls it during calls |

## 5. Backend services the app depends on

- **Redis, a Celery worker and Celery beat.** They place the AI reminder and feedback calls on time and fetch
  call recordings. Without them nothing goes out automatically.
- **Channels (ASGI) with Redis** for live dashboard updates over `/ws/`.
- **The hospital number on the voice service** must point at the deployed `PUBLIC_BASE_URL`. Run once from the
  backend, then put the two printed IDs in the backend config as `ROCK8_INBOUND_TRUNK_ID` and
  `ROCK8_INBOUND_RULE_ID`:

  ```
  python manage.py register_inbound_number +918031150501 --remove-old
  ```

## 6. After deploying, check

- Log in as admin and reload a deep page such as `/app/visits`: it loads, no 404.
- The dashboard loads; the browser console shows no CORS errors and no 403 CSRF errors.
- One call to the hospital number appears in Call logs with its recording within a few minutes.
- Change the admin and front-desk passwords from the demo `password123`.

## Updates

Each deploy is just a new `dist/`. Pages are fetched network-first by the offline service worker (`public/sw.js`),
so staff get the new version on their next page load without clearing the cache.
