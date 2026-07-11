# AI CSV Importer — GrowEasy CRM

An AI-powered CSV importer that intelligently converts **any** CSV file into GrowEasy CRM format using large language model field mapping.

Upload a CSV from Facebook Lead Ads, Google Ads, HubSpot, Excel, or any source. The AI understands arbitrary column names, abbreviations, mixed languages, and inconsistent formatting — and maps everything to the correct CRM schema automatically.

---
## demo

## Architecture

```
project/
├── frontend/          # Next.js 15 — UI, stepper, tables
├── backend/           # Express + Node.js — API, AI, CSV parsing
└── docker-compose.yml # Full-stack container orchestration
```

### Request flow

```
Browser → Next.js → POST /api/upload → PapaParse → Session store
                  → POST /api/process → Batch splitter
                                      → Groq AI (per batch)
                                      → CRM record sanitizer
                                      → JSON response
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Shadcn UI |
| Tables | TanStack Table v8 |
| Form/upload | React Dropzone, React Hook Form |
| HTTP client | Axios |
| CSV parsing (FE) | PapaParse |
| Backend | Node.js, Express, TypeScript |
| AI provider | Groq (`openai/gpt-oss-120b`) |
| CSV parsing (BE) | PapaParse |
| File upload | Multer |
| Logging | Pino + pino-pretty |
| Validation | Zod |
| Config | dotenv |

---

## Installation

### Prerequisites

- Node.js 20+
- A free Groq API key from [console.groq.com](https://console.groq.com)

### 1. Clone / unzip the project

```cmd
cd C:\Users\HP\Desktop\project
```

### 2. Backend setup

```cmd
cd backend
copy .env.example .env
npm install
```

Edit `backend/.env` and set your Groq key:
```
GROQ_API_KEY=gsk_your_actual_key_here
```

### 3. Frontend setup

```cmd
cd ..\frontend
copy .env.local.example .env.local
npm install
```

---

## Running

### Backend (terminal 1)

```cmd
cd backend
npm run dev
```

Server starts at `http://localhost:4000`

### Frontend (terminal 2)

```cmd
cd frontend
npm run dev
```

App opens at `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `GROQ_API_KEY` | — | **Required.** Get from console.groq.com |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq model to use |
| `GROQ_MAX_TOKENS` | `8192` | Max tokens per response |
| `BATCH_SIZE` | `5` | Rows per AI call |
| `DELAY_BETWEEN_BATCHES_MS` | `3000` | Delay between batches (rate limiting) |
| `MAX_RETRIES` | `3` | Retry attempts per batch |
| `MAX_FILE_SIZE_MB` | `10` | Max CSV upload size |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend base URL |

---

## How AI Mapping Works

### System prompt

The system prompt instructs the model to act as a CRM data migration specialist. It provides:

- **Field mapping intelligence** — maps arbitrary column names to schema fields using semantic understanding (e.g. `"Ph No"`, `"WhatsApp"`, `"Contact Number"` → `mobile`)
- **Phone normalization** — extracts country codes, strips formatting characters
- **Date normalization** — converts any date format to ISO 8601
- **CRM status inference** — maps free-text statuses like "hot lead", "not picking up", "deal closed" to enum values
- **Data source matching** — fuzzy matches source names to allowed enum values
- **Note aggregation** — collects extra emails, phones, and unmapped columns into `crm_note`
- **Skip rules** — omits rows with neither email nor phone

### Target CRM schema

```
created_at                    ISO 8601 date
name                          Full name
email                         Primary email
country_code                  e.g. "+91"
mobile_without_country_code   Digits only
company                       Organization
city / state / country        Location
lead_owner                    Assigned rep
crm_status                    GOOD_LEAD_FOLLOW_UP | DID_NOT_CONNECT | BAD_LEAD | SALE_DONE
crm_note                      Extra info, remarks
data_source                   leads_on_demand | meridian_tower | eden_park | varah_swamy | sarjapur_plots
possession_time               Property handover timeframe
description                   Product/property interest
```

### Batch processing

Large CSVs are split into batches (default: 5 rows each). Each batch is sent to the AI independently. Failed batches are retried with exponential back-off. Token-size errors fail fast without retrying.

---

## Groq Rate Limits (Free Tier)

For `openai/gpt-oss-120b`:

| Limit | Value |
|-------|-------|
| Requests / minute | 30 |
| Tokens / minute | ~6,000 |

With `BATCH_SIZE=5` and `DELAY_BETWEEN_BATCHES_MS=3000`, a 5000-row CSV (~1000 batches) takes roughly **50 minutes** on the free tier. Upgrade to the Dev tier for 10× faster processing.

---

## Docker

```cmd
docker-compose up --build
```

Frontend: `http://localhost:3000`
Backend: `http://localhost:4000`

---

## Folder Structure

```
backend/src/
  config/         Environment config loader
  controllers/    Upload and process request handlers
  middleware/     Error handler, request logger, file upload validator
  prompts/        System prompt and user prompt builder
  routes/         API route definitions
  services/       AI service (Groq), CSV service, batch processor
  types/          TypeScript interfaces
  utils/          Logger, sleep, chunk array

frontend/
  app/            Next.js app router (layout, page)
  components/
    ui/           Shadcn UI primitives
    stepper/      Step indicator component
    steps/        Step1Upload, Step2Preview, Step3Confirm, Step4Results
  hooks/          useImporter — central state management
  services/       Axios API client
  types/          TypeScript interfaces
  utils/          cn (class merger), download helpers
```

---

## API Endpoints

### `POST /api/upload`
Upload a CSV file. Returns session ID and preview data.

**Request:** `multipart/form-data` with field `file`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "fileName": "leads.csv",
    "totalRows": 5361,
    "columns": ["Name", "Phone", "Email", ...],
    "preview": [...]
  }
}
```

### `POST /api/process`
Trigger AI processing for a session.

**Request:** `{ "sessionId": "uuid" }`

**Response:**
```json
{
  "success": true,
  "data": {
    "importedCount": 4891,
    "skippedCount": 470,
    "errorCount": 0,
    "records": [...],
    "skippedRows": [...],
    "processingTimeMs": 184320
  }
}
```

### `GET /api/health`
Health check. Returns `200 OK`.
