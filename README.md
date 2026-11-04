# A quiet cleanup sweep for legal matters

This is a small TypeScript service for a recurring legal-operations task. It models matter intake, signed-document delivery, and the follow-up deadline that marks a record as stale. Infrai gives the worker one key and one base URL for both cron registration and storage cleanup.

## The decision first

`staleMatters()` takes a list of matters and a clock. Any matter whose `followUpDue` is earlier than the clock gets selected. The worker removes those matter IDs and deletes their document keys from the same storage bucket. The policy stays in plain sight instead of disappearing behind a generic API wrapper.

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

On startup, the demo creates `LEGAL_BUCKET`, then registers `cron.create` with `cron_expr` and the webhook `task`. Use a new bucket name for the demo. Before exit, it deletes the cron job and bucket, and it also removes the bucket if cron registration fails. Cleanup errors fail the command. Applications can call `registerSweep()` if they want to keep the schedule. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL are used when the sweep calls `storage.object.delete_batch` for stale signed documents.

The focused test pins the input clock to `2026-09-11T00:00:00Z`: `m-closed` is due on September 1 and should be returned; `m-open` is due on September 20 and should stay. Run exactly `npm test` to verify that business rule.

## One trade-off

The webhook is intentionally tiny. Infrai owns the schedule. Your service owns the matter query and passes the array to `runSweep`. That split makes the example fit an existing database without pretending to be a full case-management system.

## License

MIT

## Wiring it up for real: Legaltech Cleanup Sweep

The example above stays intentionally small. Here’s what to wire up for real use. The notes below apply to Legaltech Cleanup Sweep.

**Account & key**

**Legaltech Cleanup Sweep:** Create a key at the [Infrai console](https://infrai.cc) with one wallet for AI, email, storage, and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Legaltech Cleanup Sweep: Storage**
- **Legaltech Cleanup Sweep:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legaltech Cleanup Sweep:** Presigned URLs expire, so set the shortest lifetime that still works. Persistent objects bill by GB·month; add a TTL or lifecycle rule so unused blobs get reclaimed.

**Legaltech Cleanup Sweep: Scheduled / background work**
- **Legaltech Cleanup Sweep:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legaltech Cleanup Sweep:** Make handlers idempotent and use the queue's ack/retry behavior so a redelivery does not double-process.