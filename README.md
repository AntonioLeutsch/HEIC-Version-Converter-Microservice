# HEIC Converter Microservice

> Lightweight microservice for converting HEIC/HEIF images to JPEG or PNG, built with [Hono.js](https://hono.dev/) and [heic-convert](https://www.npmjs.com/package/heic-convert).

---

## Features

- **HEIC/HEIF to JPEG/PNG** -- fast, server-side conversion
- **Bearer Token Auth** -- secure API access with multiple tokens
- **Sentry Integration** -- error tracking (optional)
- **Health Checks** -- `/ping` and `/health` for monitoring (Uptime Kuma compatible)
- **Docker Ready** -- production container with health checks
- **CORS Support** -- `Content-Disposition` header exposed for browser downloads

---

## Quick Start

### Docker (recommended)

```bash
# Configure
cp .env.example .env
# Edit .env -- set VALID_TOKENS (and optionally SENTRY_DSN)

# Run
docker compose up -d

# Logs
docker compose logs -f heic-service
```

### Local

```bash
npm install

cp .env.example .env
# Edit .env

npm start
# Or: node app/server.js
```

---

## Configuration

### Environment Variables

| Variable       | Default      | Description                          |
| -------------- | ------------ | ------------------------------------ |
| `PORT`         | `3000`       | Server port                          |
| `NODE_ENV`     | `production` | Environment (`development`/`production`) |
| `VALID_TOKENS` | --           | Comma-separated bearer tokens        |
| `SENTRY_DSN`   | --           | Sentry DSN for error tracking (optional) |

### Generate a Token

```bash
openssl rand -hex 32
```

---

## API

### Public Endpoints

#### `GET /ping`

Returns `pong`. Use for simple uptime checks.

#### `GET /health`

```json
{
  "status": "ok",
  "service": "heic-service",
  "timestamp": "2026-04-08T10:00:00.000Z",
  "uptime": 3600.5
}
```

### Protected Endpoints

All protected endpoints require a `Authorization: Bearer <token>` header.

#### `POST /convert`

Converts a HEIC/HEIF file to JPEG or PNG.

**Body** (`multipart/form-data`):

| Field     | Type   | Required | Default | Description                    |
| --------- | ------ | -------- | ------- | ------------------------------ |
| `file`    | file   | yes      | --      | HEIC/HEIF file                 |
| `format`  | string | no       | `JPEG`  | Output format: `JPEG` or `PNG` |
| `quality` | number | no       | `80`    | Output quality: `0` -- `100`   |

**Example:**

```bash
curl -X POST \
  -H "Authorization: Bearer your-token" \
  -F "file=@photo.heic" \
  -F "format=JPEG" \
  -F "quality=85" \
  http://localhost:3000/convert \
  --output photo.jpg
```

**Success:** `200` with the converted image as binary response (`Content-Type: image/jpeg` or `image/png`).

**Errors:**

| Status | Error                        |
| ------ | ---------------------------- |
| `400`  | Keine Datei hochgeladen      |
| `400`  | Format: X (JPEG/PNG)         |
| `400`  | Datei leer                   |
| `401`  | Bearer Token fehlt           |
| `403`  | Ungültiger Token             |
| `415`  | Nur HEIC/HEIF unterstützt    |
| `500`  | Konvertierung fehlgeschlagen  |

---

## Laravel Integration

**config/services.php:**

```php
'heic_converter' => [
    'url' => env('HEIC_CONVERTER_URL', 'http://localhost:3000'),
    'token' => env('HEIC_CONVERTER_TOKEN'),
],
```

**Service class:**

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\UploadedFile;

class HeicConverterService
{
    public function __construct(
        protected string $baseUrl = '',
        protected string $token = '',
    ) {
        $this->baseUrl = config('services.heic_converter.url');
        $this->token = config('services.heic_converter.token');
    }

    public function convert(
        UploadedFile $file,
        string $format = 'JPEG',
        int $quality = 80,
    ): string {
        $response = Http::withToken($this->token)
            ->timeout(120)
            ->attach('file', file_get_contents($file->path()), $file->getClientOriginalName())
            ->post("{$this->baseUrl}/convert", [
                'format' => $format,
                'quality' => $quality,
            ]);

        if ($response->failed()) {
            throw new \Exception('HEIC conversion failed: ' . $response->body());
        }

        return $response->body();
    }
}
```

---

## Monitoring (Uptime Kuma)

| Check Type | URL | Expected |
| ---------- | --- | -------- |
| Simple ping | `GET /ping` | Response: `pong` |
| Health JSON | `GET /health` | Keyword: `"status":"ok"` |

---

## Sentry

Optional. Set `SENTRY_DSN` in your `.env` to enable error tracking. Unhandled errors and failed conversions are captured automatically.

---

## Docker Commands

```bash
docker compose up -d              # Start
docker compose down               # Stop
docker compose up -d --build      # Rebuild
docker compose logs -f heic-service  # Logs
docker compose exec heic-service sh  # Shell
```

---

## Project Structure

```
heic-service/
├── app/
│   └── server.js          # Main application
├── package.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## License

MIT

## Author

Antonio
