# Integração Multiplataforma

Hub central para gerenciar **catálogo, estoque e pedidos** em múltiplos
marketplaces (Mercado Livre, Shopee, Amazon, Magalu/Americanas) a partir de
uma única fonte da verdade.

## Arquitetura

```
Catálogo (Product → Variant/SKU)
   └─ Estoque unificado (Inventory) ──sincroniza──▶ Marketplaces
        └─ Listings (Variant ↔ Marketplace, com ID externo)
              ▲
        Pedidos entram ──normalizados──▶ Order unificado
```

O núcleo só conhece a interface `MarketplaceConnector`. Cada marketplace é
uma implementação registrada no `ConnectorRegistry`. Adicionar um canal novo =
criar um conector, sem tocar no resto.

- **`apps/api`** — API NestJS + Prisma (PostgreSQL)
- **`apps/web`** — Painel Next.js *(em construção)*
- **`packages/shared`** — tipos/enums compartilhados

## Requisitos

- Node.js 20+
- Docker Desktop (para o PostgreSQL) — ou SQLite como fallback (ver abaixo)

## Como rodar (desenvolvimento)

```bash
# 1. Instalar dependências (na raiz)
npm install

# 2. Configurar variáveis de ambiente
cp .env.example apps/api/.env   # ajuste se necessário

# 3. Subir o banco (precisa de Docker)
npm run db:up

# 4. Aplicar o schema e gerar o client
cd apps/api
npx prisma migrate dev --name init
npm run db:seed        # dados de exemplo (opcional)

# 5. Rodar a API
cd ../.. && npm run api:dev
```

API em `http://localhost:3333/api` · documentação interativa em `/docs`.

### Sem Docker (fallback SQLite)

Em `apps/api/prisma/schema.prisma`, troque `provider = "postgresql"` por
`provider = "sqlite"` e use `DATABASE_URL="file:./dev.db"` no `.env`.

## Marketplaces suportados

| Marketplace   | Estoque | Preço | Publicar | Pedidos |
|---------------|:-------:|:-----:|:--------:|:-------:|
| Mercado Livre | ✅ base | ✅ base | ⏳ | ⏳ |
| Shopee        | ⏳ | ⏳ | ⏳ | ⏳ |
| Amazon        | ⏳ | ⏳ | ⏳ | ⏳ |
| Magalu        | ⏳ | ⏳ | ⏳ | ⏳ |

✅ = estrutura de chamada pronta · ⏳ = a implementar (requer credenciais/OAuth)
