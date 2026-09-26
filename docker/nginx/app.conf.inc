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

# ---------------------------------------------------------------------------
# Field-app routes (compliance_checklist).
#
# The desktop app is not a browser session: it authenticates to the gateway
# and the import service with the shared X-API-Key, and to Alfresco with the
# inspector's own credentials at upload time. So it cannot use /api/ or
# /nodered/ above, both of which require a compliance_web session.
#
# Today the app talks to :1880, :8000 and :8080 directly. That works, and it
# means the API key and the inspector's Alfresco password cross the network
# in clear text. Routing them through this edge puts them inside TLS, and
# lets a production deployment bind those three services to the loopback
# interface (BIND_IP=127.0.0.1) so the edge is the only way in.
#
# These are plain reverse proxies, deliberately: the authentication that
# applies is the gateway's own API key and Alfresco's own login, unchanged.
# The edge adds transport security and a single ingress point, not a new
# authorisation layer -- adding one here would silently diverge from what
# the services themselves enforce.
#
# Each of these three resolves its upstream through Docker's embedded DNS at
# REQUEST time, via a variable, rather than at startup. nginx normally
# resolves a literal proxy_pass host when it loads the config and refuses to
# start if it cannot -- which would tie this edge's startup to three services
# in three other compose projects. `backend` below stays a literal on
# purpose: it is in this project and already a depends_on, so failing fast
# there is correct.
resolver 127.0.0.11 valid=30s ipv6=off;

location /gateway/ {
  set $upstream_gateway http://node-red:1880;
  rewrite ^/gateway/(.*)$ /$1 break;
  proxy_pass $upstream_gateway;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /upload/ {
  set $upstream_import http://compliance-import:8000;
  rewrite ^/upload/(.*)$ /$1 break;
  proxy_pass $upstream_import;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  # Inspection payloads are ZIPs of evidence; the import service caps them at
  # MAX_UPLOAD_SIZE_BYTES (400 MB default). nginx defaults to 1 MB and would
  # reject them with a 413 before the service ever saw the request.
  client_max_body_size 512m;
  proxy_request_buffering off;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
}

location /alfresco/ {
  # Operator sign-in at upload time, and the ticket-authenticated reads that
  # follow. Alfresco is behind compliance_cmis's Traefik, which production
  # binds to the loopback interface.
  set $upstream_alfresco http://proxy:8080;
  rewrite ^/alfresco/(.*)$ /alfresco/$1 break;
  proxy_pass $upstream_alfresco;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 512m;
  proxy_read_timeout 300s;
}

location / {
  try_files $uri $uri/ /index.html;
}
