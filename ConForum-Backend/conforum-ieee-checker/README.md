# Conforum IEEE Checker

A lightweight Flask microservice that checks whether a research paper PDF meets IEEE formatting standards.

---

## Setup & Run

```bash
cd "Conforum IEEE Checker"
pip install -r requirements.txt
python app.py
```

The service starts on port **6000** by default.

---

## API Endpoints

### `GET /`
Health check.

**Response:**
```json
{ "status": "ok", "service": "IEEE Compliance Checker" }
```

### `POST /check-compliance`
Upload a PDF and get back an IEEE compliance report.

**Request:** `multipart/form-data` with a field named `file` containing the PDF.

**Response:**
```json
{
  "percentage": 85.0,
  "details": [
    { "rule": "Layout", "passed": true, "message": "..." },
    { "rule": "Title", "passed": true, "message": "..." },
    { "rule": "Abstract", "passed": false, "message": "...", "suggestion": "..." }
  ]
}
```

---

## Environment Variables

Configure via `.env` in this folder:

| Variable | Default | Description |
|---|---|---|
| `FLASK_PORT` | `6000` | Port the service listens on |

---

## Requirements

- Python 3.12+
- Flask
- PyMuPDF (`fitz`)
