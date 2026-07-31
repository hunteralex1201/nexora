# VPS TLS Decision — 2026-08-01

**Author:** Manus AI

## Decision context

The current Next.js authentication bridge sets its session cookie with the `Secure` attribute whenever the production runtime is used. A public deployment therefore requires HTTPS for browser login to work safely. The user supplied a VPS IP but did not supply DNS-provider credentials or a custom domain.

## Verified temporary hostname option

The official sslip.io site states that hostnames containing an IPv4 address resolve to that address, including both dotted and dash-separated forms. It also states that externally accessible sslip.io or nip.io hostnames can receive publicly trusted certificates through an HTTP-01 challenge and specifically cites Caddy as a compatible web server. For this VPS, the temporary hostname selected for deployment is `46-250-242-20.sslip.io`, subject to a live DNS check before certificate issuance.

Source: [sslip.io official service documentation](https://sslip.io/)

## Verified HTTPS behavior

Caddy’s official automatic-HTTPS documentation states that public DNS names can receive and renew certificates automatically and that Caddy redirects HTTP to HTTPS. It requires the hostname to resolve to the server, ports 80 and 443 to be externally reachable, Caddy to bind those ports, persistent writable certificate storage, and the hostname to appear in configuration. The HTTP-01 challenge requires public port 80; TLS-ALPN requires public port 443.

Source: [Caddy Automatic HTTPS documentation](https://caddyserver.com/docs/automatic-https)

## Safety boundary

This is a credential-free temporary hostname, not a substitute for a user-owned production domain. The deployment will keep PostgreSQL, Redis, MinIO, Qdrant, API, and administrative interfaces bound to loopback or the private Compose network. Only SSH, HTTP, and HTTPS will be considered for public firewall access. Any later custom-domain or DNS-provider change remains a separate approval and credential step.

## Reverse-proxy version verification

The production override will pin `caddy:2.11.4`. The official Caddy release page identifies **v2.11.4** as the latest release and describes security-related patches in that release. Docker Hub’s official Caddy image catalog lists the exact `2.11.4` tag for Linux/amd64. These sources were checked on 2026-08-01 before deployment.

- https://github.com/caddyserver/caddy/releases
- https://hub.docker.com/_/caddy/tags
