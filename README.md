# 發票收據管理系統 (Invoice Receipt Management System)

A Telegram bot that uses Claude Vision (OCR) to automatically recognize and catalog invoices/receipts, paired with a Hono API server and a Next.js dashboard for browsing and analyzing spending data.

## Architecture

```
+------------------+       +------------------+       +------------------+
|                  |       |                  |       |                  |
|  Telegram User   +------>+  Telegram Bot    +------>+  Claude Vision   |
|  (send photo)    |       |  (grammY)        |       |  (OCR)           |
|                  |       |                  |       |                  |
+------------------+       +--------+---------+       +------------------+
                                    |
                                    | insert
                                    v
                           +--------+---------+
                           |                  |
                           |  SQLite DB       |
                           |  (better-sqlite3)|
                           |                  |
                           +--------+---------+
                                    ^
                                    | query
                                    |
+------------------+       +--------+---------+
|                  |       |                  |
|  Next.js         +------>+  Hono API        |
|  Dashboard       |  HTTP |  (port 3456)     |
|  (port 3000)     |       |                  |
+------------------+       +------------------+
```

## Project Structure

```
invoice-bot/
├── src/
│   ├── bot/index.ts        # Telegram bot (grammY)
│   ├── api/index.ts        # Hono REST API server
│   ├── ocr/index.ts        # Claude Vision OCR integration
│   ├── db/
│   │   ├── index.ts        # Database queries
│   │   ├── schema.ts       # Table definitions
│   │   └── init.ts         # DB initialization script
│   └── types/index.ts      # Shared TypeScript types
├── dashboard/              # Next.js 16 dashboard app
│   ├── app/                # App Router pages
│   └── package.json
├── data/
│   ├── invoices.db         # SQLite database (generated)
│   └── uploads/            # Uploaded invoice images
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── .env.example
└── .env                    # Local env (not committed)
```

## Setup

### Prerequisites

- Node.js >= 20
- npm >= 10

### 1. Clone and install dependencies

```bash
# Root (bot + API)
npm install

# Dashboard
cd dashboard && npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable             | Description                            | Required |
|----------------------|----------------------------------------|----------|
| `TELEGRAM_BOT_TOKEN` | Bot token from Telegram @BotFather    | Yes      |
| `ANTHROPIC_API_KEY`  | Anthropic API key for Claude Vision    | Yes      |
| `API_PORT`           | Hono API server port (default: 3456)   | No       |
| `DASHBOARD_ORIGIN`   | Allowed CORS origin (default: http://localhost:3000) | No |

### 3. Initialize the database

```bash
npm run db:init
```

## Running

### Development

```bash
# Run everything (bot + API + dashboard)
npm run dev:all

# Or run individually:
npm run dev:bot        # Telegram bot only
npm run dev:api        # Hono API only
npm run dev:dashboard  # Next.js dashboard only
npm run dev            # Bot + API (no dashboard)
```

### Production

```bash
# Build
npm run build
cd dashboard && npm run build

# Start
npm run start:bot &
npm run start:api &
cd dashboard && npm run start
```

## Bot Commands

| Command             | Description                              |
|---------------------|------------------------------------------|
| `/start`            | Welcome message and feature overview     |
| `/help`             | Detailed usage instructions              |
| `/stats`            | Current month spending statistics         |
| `/stats 2024-03`    | Statistics for a specific month          |
| `/list`             | Last 10 invoices                         |
| `/list 20`          | Last 20 invoices                         |
| `/company`          | Current month company invoices (with tax ID) |
| `/delete [ID]`      | Delete an invoice by ID                  |
| *Send a photo*      | Auto-OCR and catalog the invoice         |

## API Endpoints

Base URL: `http://localhost:3456`

| Method   | Endpoint             | Description                   | Query Params                                              |
|----------|----------------------|-------------------------------|-----------------------------------------------------------|
| `GET`    | `/api/invoices`      | List invoices                 | `startDate`, `endDate`, `category`, `isCompany`, `limit`, `offset` |
| `GET`    | `/api/stats`         | Get spending statistics       | `startDate` (required), `endDate` (required)              |
| `DELETE` | `/api/invoices/:id`  | Delete an invoice             | -                                                         |
| `GET`    | `/api/health`        | Health check                  | -                                                         |

### Example Requests

```bash
# Get all invoices this month
curl "http://localhost:3456/api/invoices?startDate=2026-04-01&endDate=2026-04-30"

# Get statistics
curl "http://localhost:3456/api/stats?startDate=2026-04-01&endDate=2026-04-30"

# Delete invoice #5
curl -X DELETE "http://localhost:3456/api/invoices/5"

# Health check
curl "http://localhost:3456/api/health"
```

## Docker

To run everything with Docker Compose:

```bash
docker compose up --build
```

This starts:
- **bot** - Telegram bot process
- **api** - Hono API on port 3456
- **dashboard** - Next.js on port 3000

All services share the `./data` volume for the SQLite database and uploaded images.
