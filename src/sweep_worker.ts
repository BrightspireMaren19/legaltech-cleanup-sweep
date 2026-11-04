import { InfraiClient } from "./infrai_client.js";
import { staleMatters, type Matter } from "./sweep_decision.js";
import { z } from "zod";

export const sweepRequest = z.object({
  matters: z.array(z.object({
    id: z.string().min(1),
    client: z.string().min(1),
    signedAt: z.string().datetime().optional(),
    followUpDue: z.string().datetime(),
    documentKey: z.string().min(1).optional()
  }))
});

export function parseSweepRequest(input: unknown): Matter[] {
  return sweepRequest.parse(input).matters.map((matter) => ({
    id: matter.id,
    client: matter.client,
    signedAt: matter.signedAt,
    followUpDue: matter.followUpDue,
    documentKey: matter.documentKey
  }));
}

const client = new InfraiClient(process.env.INFRAI_API_KEY ?? "");
const bucket = process.env.LEGAL_BUCKET ?? "legal-sweep-records";
const webhook = process.env.SWEEP_WEBHOOK_URL ?? "https://example.com/legal/sweep";

export async function registerSweep(): Promise<string> {
  await client.storage.bucket.create(bucket);
  const job = await client.cron.create({ cron_expr: "0 2 * * *", task: webhook });
  return job.job_id;
}

export async function runSweep(matters: Matter[], now = new Date()) {
  const stale = staleMatters(matters, now);
  const documentKeys = stale.flatMap((matter) => (matter.documentKey ? [matter.documentKey] : []));
  if (documentKeys.length > 0) await client.storage.object.delete_batch(bucket, documentKeys);
  return { removedMatterIds: stale.map((matter) => matter.id), deletedDocumentKeys: documentKeys };
}

export async function runDemo(api = client, demoBucket = bucket, task = webhook) {
  let bucketCreated = false;
  let jobId: string | undefined;
  try {
    await api.storage.bucket.create(demoBucket);
    bucketCreated = true;
    const job = await api.cron.create({ cron_expr: "0 2 * * *", task });
    jobId = job.job_id;
    console.log(`scheduled legal cleanup: ${jobId}`);
  } finally {
    try {
      if (jobId) await api.cron.delete(jobId);
    } finally {
      if (bucketCreated) await api.storage.bucket.delete(demoBucket);
    }
  }
}

if (process.argv[1]?.endsWith("sweep_worker.ts")) {
  await runDemo();
}
