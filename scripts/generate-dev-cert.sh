#!/usr/bin/env bash
# Generate a self-signed certificate for verifying the TLS edge locally.
#
#   ./scripts/generate-dev-cert.sh [hostname]   # default: localhost
#
# NOT FOR PRODUCTION. A self-signed certificate proves the nginx TLS
# configuration is correct -- ciphers, protocol versions, HSTS, the
# certificate chain wiring -- and nothing about identity. A real deployment
# uses an enterprise CA or the ACME/Let's Encrypt configuration already
# written at atrocore-docker/traefik/traefik.yml.example.
#
# The output directory is gitignored: a private key must never be committed,
# even a throwaway one, because a committed key trains people to expect keys
# in the repository.
set -euo pipefail

HOST="${1:-localhost}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docker/nginx/certs"
mkdir -p "$DIR"

if [ -f "$DIR/server.crt" ] && [ -f "$DIR/server.key" ]; then
  echo "Certificate already present at $DIR — delete it to regenerate."
  exit 0
fi

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$DIR/server.key" -out "$DIR/server.crt" \
  -days 365 -subj "/CN=${HOST}" \
  -addext "subjectAltName=DNS:${HOST},DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1

chmod 640 "$DIR/server.key"
chmod 644 "$DIR/server.crt"

# The edge runs nginx as the unprivileged `nginx` user (uid 101), so the key
# has to be readable by *that* uid -- not by the host user who generated it.
# The fix is ownership, not a looser mode: a private key should stay
# group-readable at most, and `chmod 644` on a key is a habit worth not
# teaching even for a throwaway one.
#
# chown needs root, which is why this runs in a container rather than asking
# for sudo. The same pattern the bootstrap scripts use for bind mounts, and
# the same thing a real deployment does when it installs a certificate for a
# service account.
if command -v docker >/dev/null 2>&1; then
  docker run --rm -v "$DIR:/certs" alpine:latest \
    sh -c 'chown 101:101 /certs/server.key /certs/server.crt' >/dev/null 2>&1 \
    && echo "Key ownership set to uid 101 (the nginx user in the container)." \
    || echo "WARNING: could not chown the key to uid 101; nginx will fail to read it."
else
  echo "WARNING: docker not found — chown the key to uid 101 before starting the TLS edge."
fi

echo "Self-signed certificate written to $DIR (CN=${HOST}, 365 days)."
echo "Start the TLS edge with:  docker compose --profile tls up -d"
echo "Expect a browser warning — that is the point of a self-signed certificate."
