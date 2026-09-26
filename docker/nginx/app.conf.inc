# Shared routing and security headers for the SPA edge.
#
# Included by both the plain-HTTP server (docker/nginx/default.conf, which the
# demo and local development use) and the TLS server (docker/nginx/tls.conf).
# Keeping one copy means the two cannot drift: a route added for the demo is
# automatically present in production, which is the failure mode worth
# designing against here.

root /usr/share/nginx/html;
index index.html;

# Content-Security-Policy. The SPA is built by Vite and serves its own bundled
# assets, so everything is same-origin except the inline styles Vue injects.
# 'unsafe-inline' is present for style-src only, not script-src -- the build
# emits no inline scripts, so scripts stay strictly same-origin.
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Same-origin access to Node-RED. This does NOT proxy straight to the gateway:
# it goes through the app server, which requires the session, attaches the API
# key and the session's own Alfresco ticket, and refuses writes outside the
# session's specialty scope. The path is passed through unchanged -- the app
# server strips the /nodered prefix.
location /nodered/ {
  proxy_pass http://backend:4000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/ {
  proxy_pass http://backend:4000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
  try_files $uri $uri/ /index.html;
}
