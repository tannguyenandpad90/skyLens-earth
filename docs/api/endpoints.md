# API Endpoints

## Flights

- `GET /api/flights?bounds=south,west,north,east&limit=2000`
- `GET /api/flights/:id`

## Airports

- `GET /api/airports?search=JFK`
- `GET /api/airports/:icao`

## Stats

- `GET /api/stats?region=north_america`

## AI

- `POST /api/ai/sky-summary` — body: `{ region?: string }`
- `POST /api/ai/flight-explain` — body: `{ flight_id: string }`

## Error Format

All errors return:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Flight not found",
    "retry_after": 42
  }
}
```
