# E-Commerce Backend (NestJS + MongoDB)

A modular e-commerce API implementing the workflows in the project's ER diagram: auth, users, addresses,
categories, products, cart, wishlist, orders, payments, reviews, and notifications.

See **[ANALYSIS_REPORT.md](./ANALYSIS_REPORT.md)** for the full gap analysis, architecture rationale,
API design, testing strategy, and deployment recommendations.

## Requirements

- Node.js 18+
- MongoDB running as a **replica set** (required for the transactional checkout flow — see below)

## Setup

```bash
npm install
cp .env.example .env   # then fill in real secrets
```

### Running Mongo as a single-node replica set (local dev)

Mongo transactions (used in `OrderService.checkout()`) require a replica set — a standalone `mongod`
will throw at runtime. Locally:

```bash
mongod --dbpath ./data --replSet rs0
# in a separate shell:
mongosh --eval "rs.initiate()"
```

Or use Docker:

```bash
docker run -d -p 27017:27017 --name mongo mongo:7 --replSet rs0
docker exec -it mongo mongosh --eval "rs.initiate()"
```

### Run the app

```bash
npm run start:dev     # watch mode
npm run build && npm run start:prod
```

The API is served at `http://localhost:3000/api/v1` (global prefix + versioning set in `main.ts`).

### Tests

```bash
npm test            # unit tests
npm run test:cov     # with coverage
```

### Lint

```bash
npm run lint
```

## Project structure

```
src/
  common/       # global guards, filters, interceptors, decorators
  config/       # typed config loaders
  modules/      # one folder per domain module (see ANALYSIS_REPORT.md)
```
