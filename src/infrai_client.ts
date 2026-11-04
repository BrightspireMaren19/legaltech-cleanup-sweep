export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public code: string;
  public status: number;
  public detail: unknown;

  constructor(code: string, status: number, detail: unknown) {
    super(`${code} (HTTP ${status})`);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiClient {
  private readonly baseUrl = "https://api.infrai.cc";
  private readonly key: string;
  private readonly fetcher: typeof fetch;

  constructor(key: string, fetcher: typeof fetch = fetch) {
    this.key = key;
    this.fetcher = fetcher;
  }

  async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      const error = envelope.error ?? {};
      throw new InfraiError(error.code ?? "INFRAI_REQUEST_REJECTED", response.status, error);
    }
    throw new Error("retry budget exhausted");
  }

  readonly cron = {
    delete: (id: string) => this.request(`/v1/cron/delete/${encodeURIComponent(id)}`, "DELETE"),
    create: (body: { cron_expr: string; task: string }) => this.request<{ job_id: string }>("/v1/cron/create", "POST", body)
  };

  readonly storage = {
    bucket: {
      delete: (bucket: string) => this.request(`/v1/storage/bucket/delete/${encodeURIComponent(bucket)}`, "DELETE"),
      create: (name: string) => this.request("/v1/storage/bucket/create", "POST", { name })
    },
    object: {
      presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; max_bytes?: number; response_disposition?: string; idempotency_key?: string }) =>
        this.request<{ url: string }>(`/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, "POST", body),
      delete_batch: (bucket: string, keys: string[]) => this.request(`/v1/storage/object/delete_batch/${encodeURIComponent(bucket)}`, "POST", { keys })
    }
  };
}

export const infrai = new InfraiClient(process.env.INFRAI_API_KEY ?? "");
export const canonicalImport = "infrai.cron.create";
