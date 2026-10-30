# Aircraft Sighting Statistics

Status: Feature design idea  
Created: October 30, 2026

## Summary

Add a public statistic to the McNair Farms homepage showing how many unique
aircraft have been spotted near the farm. Store sightings in Cloudflare D1,
serve aggregate counts through the existing flight-feed Worker, and render the
result near the live aircraft card.

Workers Observability remains the private operational and diagnostic view. The
website must not query Observability directly because doing so would require
private Cloudflare credentials and would couple a public feature to short-term
log retention.

## Proposed visitor experience

Show a compact, translucent statistics strip below the live flight card:

> **4 aircraft spotted near the farm today**  
> 27 this week · 143 unique aircraft all time

Use "near the farm" rather than "flown over" because the current feed includes
aircraft within the configured 30-nautical-mile display radius. If the desired
claim is specifically "over the farm," introduce a separate, smaller threshold
such as five nautical miles and label it clearly.

The feature should:

- Fit the existing glass-panel visual language.
- Remain readable on mobile and desktop.
- Avoid distracting from the selected live aircraft.
- Hide gracefully when statistics are unavailable.
- Refresh infrequently, such as on page load and every five minutes.
- Preserve the existing ADS-B data attribution in the footer.

## Counting definition

The recommended initial metric is:

> A unique aircraft identity observed within the configured display radius on
> a given calendar day in the farm's local time zone.

Use `registration` as the identity when available and fall back to the ADS-B
ICAO hexadecimal `id`. This matches the `aircraftKey` field already emitted by
the `aircraft_observed` structured log event.

This definition deliberately counts the same aircraft only once per day, even
if it remains in several consecutive snapshots or multiple visitors request
the feed. It does not attempt to distinguish two separate passes by the same
aircraft on the same day.

Suggested public metrics:

- `today`: unique aircraft identities seen today.
- `thisWeek`: unique aircraft identities seen during the current local week.
- `allTime`: unique aircraft identities seen since D1 collection began.

The interface should state when collection began so visitors do not interpret
`allTime` as covering the farm's entire history.

## Architecture

```text
adsb.lol / ADSBDB
        |
        v
mcnair-flight-feed Worker
        |
        +--> Workers Observability (private diagnostics)
        |
        +--> Cloudflare D1 (durable sightings)
                    |
                    v
             GET /api/flight-stats
                    |
                    v
              Farm homepage
```

Cloudflare D1 is preferable to KV for this feature because a relational table
can enforce uniqueness and efficiently aggregate by date, airline, equipment,
or aircraft identity. The D1 binding remains server-side; no database or
Cloudflare API credentials are exposed to the browser.

## Data model

Initial migration:

```sql
CREATE TABLE aircraft_sightings (
  sighting_date TEXT NOT NULL,
  aircraft_key TEXT NOT NULL,
  registration TEXT,
  airline TEXT,
  equipment TEXT,
  icao_type TEXT,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (sighting_date, aircraft_key)
) STRICT;

CREATE INDEX aircraft_sightings_date
ON aircraft_sightings (sighting_date);

CREATE INDEX aircraft_sightings_airline_equipment
ON aircraft_sightings (airline, equipment);
```

`sighting_date` should be computed using `America/Chicago`, which is the farm's
local time zone. `first_seen_at` should be stored as an ISO 8601 UTC timestamp.

For every aircraft in a successful live snapshot, execute a prepared statement
equivalent to:

```sql
INSERT OR IGNORE INTO aircraft_sightings (
  sighting_date,
  aircraft_key,
  registration,
  airline,
  equipment,
  icao_type,
  first_seen_at
) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);
```

The composite primary key makes repeated ten-second polls and simultaneous
visitors idempotent. Demo aircraft must never be written to production
statistics.

Database persistence should not delay or break the live flight response. Run
sighting writes through `ctx.waitUntil()` and record a structured warning if a
D1 operation fails.

## Public API

Add a read-only endpoint to the existing Worker:

```http
GET /api/flight-stats
```

Example response:

```json
{
  "today": 4,
  "thisWeek": 27,
  "allTime": 143,
  "collectionStartedOn": "2026-10-30",
  "asOf": "2026-10-30T12:35:00Z"
}
```

Recommended response behavior:

- Allow only `GET`, `HEAD`, and `OPTIONS` using the existing CORS policy.
- Return JSON with `X-Content-Type-Options: nosniff`.
- Cache publicly for approximately five minutes.
- Do not expose registration lists or raw database rows through this endpoint.
- Return a controlled unavailable response if D1 cannot be queried.

The first version can return totals only. A later version could add a small
airline/equipment breakdown, but the response should remain compact and should
avoid turning the homepage into a detailed tracking interface.

## Collection without website visitors

The current Worker builds a flight snapshot only when a browser requests
`/api/flights`. Without another trigger, statistics would miss aircraft during
periods when nobody has the homepage open.

Add a Cloudflare scheduled trigger that refreshes the feed at a reasonable
interval, such as once per minute, and stores the resulting unique sightings.
The scheduled handler and HTTP handler should share the same snapshot-building
and persistence functions.

The schedule should balance coverage with upstream provider expectations,
Cloudflare quotas, and database usage. A one-minute interval is a reasonable
starting point; it should be confirmed against the current upstream terms and
observed traffic before deployment.

## Homepage integration

Add semantic markup beneath the current `.ff-flight` card, for example:

```html
<p class="ff-stats" hidden>
  <strong><span class="ff-stats-today"></span> aircraft</strong>
  spotted near the farm today
  <span class="ff-stats-secondary"></span>
</p>
```

The flight-feed client should:

1. Derive `/api/flight-stats` from the configured flight-feed endpoint.
2. Fetch statistics independently from the ten-second live-flight poll.
3. Validate that returned counts are finite, non-negative integers.
4. Format singular and plural text correctly.
5. Reveal the statistics element only after a valid response.
6. Retain the last successful values during transient failures.
7. Refresh statistics no more frequently than every five minutes.

Suggested wording:

- `1 aircraft spotted near the farm today`
- `4 aircraft spotted near the farm today`
- `27 this week · 143 unique aircraft since October 30, 2026`

## Privacy and data handling

The feature records public ADS-B aircraft information, not visitor information.
Do not add visitor IP addresses, cookies, user agents, or browser identifiers to
the sightings table. Cloudflare already provides request metadata in its own
operational systems; that metadata is not needed for public aircraft totals.

Keep exact farm coordinates in Worker secrets as they are today. The statistics
endpoint should return aggregate counts only and should not reveal those
coordinates.

## Reliability and abuse considerations

- D1 uniqueness constraints, rather than browser behavior, determine counts.
- Website traffic cannot inflate a daily count for an aircraft already stored.
- A D1 failure must not make `/api/flights` unavailable.
- Scheduled collection should use the same live/demo safeguards as normal
  requests.
- The statistics endpoint should be cached to limit repeated aggregate queries.
- Counts should be presented as observations, not guaranteed complete airspace
  records; ADS-B coverage and upstream availability can have gaps.

## Testing

Add automated coverage for:

- Registration identity with ICAO hexadecimal fallback.
- Duplicate sightings ignored within the same local day.
- The same identity accepted again on a later local day.
- Correct local-day and local-week boundaries around UTC offsets and daylight
  saving time.
- Demo snapshots never persisted.
- D1 errors do not break the flight response.
- Statistics endpoint totals, cache headers, CORS, and method handling.
- Browser singular/plural formatting and unavailable-state behavior.
- Scheduled and visitor-triggered snapshots producing equivalent records.

Before production rollout, verify the homepage at narrow and wide viewport
sizes and confirm that the statistics line does not overlap the live aircraft
card, route labels, or footer.

## Rollout plan

1. Create the D1 database and versioned migration.
2. Add the D1 binding to `api/wrangler.toml`.
3. Implement idempotent sighting persistence behind a disabled-by-default
   feature flag.
4. Add and test `GET /api/flight-stats`.
5. Add the homepage statistics component and graceful failure behavior.
6. Enable persistence in production and establish `collectionStartedOn`.
7. Enable the scheduled trigger after confirming upstream usage expectations.
8. Monitor D1 operations, scheduled executions, and endpoint latency.
9. Enable the public component after validating production counts.

Historical Workers Observability logs may be useful for a one-time seed, but
the initial implementation should not depend on importing them. Starting from
a clear published collection date is simpler and less error-prone.

## Open decisions

- Keep the current 30-nautical-mile definition or introduce a smaller
  "overhead" radius?
- Use Sunday or Monday as the start of the displayed week?
- Show only today's total, or include week and all-time totals?
- Count unique aircraft per day only, or later model separate flyover sessions
  when the same aircraft returns after a defined absence?
- Run scheduled collection every minute, every two minutes, or only while the
  public site is active?

## Recommended first release

Use the existing 30-nautical-mile display radius and describe the metric as
"aircraft spotted near the farm." Count unique `aircraftKey` values per local
day, display today/week/all-time totals, collect once per minute with a
scheduled Worker, and publish only aggregate counts through the cached public
endpoint.
