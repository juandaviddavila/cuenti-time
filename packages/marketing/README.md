# cuenti time marketing

Sitio público independiente de la aplicación SaaS.

## Desarrollo

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use v24.13.1
pnpm install
pnpm marketing:dev
```

- Marketing: <http://localhost:3008>
- Aplicación: <http://localhost:7578>

## Variables

Copiar `.env.example` a `.env.local` si se necesitan URLs distintas:

- `NEXT_PUBLIC_SITE_URL`: origen canónico del sitio público.
- `NEXT_PUBLIC_APP_URL`: origen de la aplicación SaaS para registro, acceso y pagos.
- `NEXT_PUBLIC_APP_NAME`: nombre visible del producto.

El paquete no depende de Prisma, JWT ni de la sesión del SaaS.
