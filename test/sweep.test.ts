import assert from "node:assert/strict";
import test from "node:test";
import { staleMatters, type Matter } from "../src/sweep_decision.js";
import { InfraiClient } from "../src/infrai_client.js";
import { runDemo } from "../src/sweep_worker.js";

test("the sweep selects only matters past their follow-up deadline", () => {
  const matters: Matter[] = [
    { id: "m-closed", client: "Acme", followUpDue: "2026-09-01T00:00:00Z" },
    { id: "m-open", client: "Beta", followUpDue: "2026-09-20T00:00:00Z" }
  ];
  assert.deepEqual(staleMatters(matters, new Date("2026-09-11T00:00:00Z")).map((matter) => matter.id), ["m-closed"]);
});

for (const failure of [undefined, "cron/create", "cron/delete/job-1"]) {
  test(`demo cleans up its resources with failure=${failure}`, async () => {
    const calls: string[] = [];
    const api = new InfraiClient("test", async (url, init) => {
      const path = new URL(String(url)).pathname.replace("/v1/", "");
      calls.push(`${init?.method} ${path}`);
      return new Response(JSON.stringify(path === failure
        ? { ok: false, error: { code: "TEST_FAILURE" } }
        : { ok: true, data: { job_id: "job-1" } }), { status: path === failure ? 400 : 200 });
    });
    const result = runDemo(api, "demo-bucket", "https://example.com/sweep");
    if (failure) await assert.rejects(result, /TEST_FAILURE/);
    else await result;
    assert.deepEqual(calls, [
      "POST storage/bucket/create",
      "POST cron/create",
      ...(failure === "cron/create" ? [] : ["DELETE cron/delete/job-1"]),
      "DELETE storage/bucket/delete/demo-bucket"
    ]);
  });
}

test("demo does not delete a bucket when creation fails", async () => {
  const calls: string[] = [];
  const api = new InfraiClient("test", async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ ok: false, error: { code: "NAME_CONFLICT" } }), { status: 409 });
  });
  await assert.rejects(runDemo(api, "existing-bucket"), /NAME_CONFLICT/);
  assert.equal(calls.length, 1);
});
