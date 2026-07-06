# CircuitSmith Docker Deploy

This deploy runs the built Vite app as static files through nginx, bound only to
a loopback address. Apache terminates HTTPS and proxies
`circuitsmith.vulpfin.com` to the container.

Build locally:

```sh
corepack pnpm -r build
```

Server layout:

```text
/var/www/CircuitSmith/
  compose.yaml
  nginx.conf
  dist/
```

Run on the server:

```sh
cd /var/www/CircuitSmith
docker compose up -d
a2ensite circuitsmith.vulpfin.com.conf
apache2ctl configtest
systemctl reload apache2
```
