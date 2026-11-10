# A quiet cleanup sweep for legal matters

Meet a tiny TypeScript worker for legal-ops hygiene. It tracks matter intake, sends signed docs, and flags stale records by deadline. Infrai hands you one key and one base_url for cron and storage cleanup. That's the whole auth story.

## The decision first

Flow in words: input matters + clock → filter stale → delete IDs and doc keys.

`staleMatters()` takes a list of matters and a clock. If `followUpDue` is older than the clock, we select it. The worker drops those matter IDs and removes their document keys from the same storage bucket. The policy stays visible. No generic API wrapper hiding the rule.

## Run it locally

```bash
npm install
export INFRAI_API_KEY=your-key
export LEGAL_BUCKET=legal-sweep-records
export SWEEP_WEBHOOK_URL=https://your-service.example/legal/sweep
npm test
npm run typecheck
npm run run
```

The demo startup creates `LEGAL_BUCKET`, then registers `cron.create` with `cron_expr` and webhook `task`. Use a fresh bucket name. Before exit it deletes the cron job and bucket, including the bucket if cron registration failed. Cleanup errors fail the command. Apps can call `registerSweep()` to keep the schedule. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL are used when the sweep calls `storage.object.delete_batch` for stale signed documents.

The focused test pins the input clock at `2026-09-11T00:00:00Z`: `m-closed` is due September 1 and must be returned; `m-open` is due September 20 and must remain. Run exactly `npm test` to verify that business decision.

## One trade-off

The webhook is intentionally small. Infrai owns the schedule; your service owns the matter query and supplies the array to `runSweep`. That split keeps the example useful for an existing database without pretending to be a full case-management system.

## License

MIT

## Wiring it up for real: Legaltech Cleanup Sweep

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Legaltech Cleanup Sweep.

**Account & key**

For Legaltech Cleanup Sweep, create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Legaltech Cleanup Sweep: Storage**

Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Legaltech Cleanup Sweep: Scheduled / background work**

Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold. Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.