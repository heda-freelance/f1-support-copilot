# API Rate Limits

The Acme REST API enforces rate limits per workspace and per API token. Limits depend on your plan tier.

## Limits per plan

| Plan | Requests per minute | Burst |
| --- | --- | --- |
| Free | 60 | 120 |
| Starter | 300 | 600 |
| Business | 1,200 | 2,400 |
| Enterprise | 6,000 | 12,000 (custom on request) |

The burst window is 10 seconds. If you exceed the burst, you receive a `429 Too Many Requests` response immediately. Sustained requests above the per-minute limit also return `429`.

Webhook delivery, batch endpoints, and streaming connections have separate limits documented on each endpoint reference page.

## Response headers

Every API response includes the following headers so you can adapt your client behaviour:

- `X-RateLimit-Limit` — your per-minute quota.
- `X-RateLimit-Remaining` — requests left in the current minute.
- `X-RateLimit-Reset` — Unix timestamp (seconds) when the window resets.
- `Retry-After` — present only on `429` responses, gives the number of seconds to wait before retrying.

## Recommended client behaviour: exponential backoff

When you receive a `429`, the official Acme SDKs apply jittered exponential backoff automatically. If you write your own client, follow this pattern:

1. On the first `429`, wait the value of `Retry-After` plus a small random jitter (0–250 ms).
2. On a second consecutive `429`, double the base wait to `2 × Retry-After`.
3. Continue doubling up to a maximum of 60 seconds.
4. After a successful `2xx` response, reset the backoff counter.

Do not retry `4xx` responses other than `429` and `408`. They indicate a client-side error and will not succeed on retry.

## Bulk operations

If you need to perform a large batch of inserts or updates, use the `/v1/batch` endpoint. A single batch request counts as one request against your rate limit, regardless of the number of records inside, up to a payload limit of 5 MB or 1,000 records.

## Requesting higher limits

Enterprise customers can request custom rate limits by contacting their CSM. Include the endpoint(s), the desired peak rate, and a brief description of the workload.
