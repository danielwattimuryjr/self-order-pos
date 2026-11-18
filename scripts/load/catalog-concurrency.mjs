const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const tableCode = process.env.E2E_TABLE_CODE;
const base = new URL(baseURL);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? "20");

if (base.protocol !== "http:" || !localHosts.has(base.hostname)) {
  process.stderr.write("Load check hanya boleh diarahkan ke HTTP localhost.\n");
  process.exit(1);
}
if (
  !tableCode ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    tableCode,
  )
) {
  process.stderr.write(
    "Atur E2E_TABLE_CODE dengan UUIDv4 dari meja aktif Supabase lokal.\n",
  );
  process.exit(1);
}
if (!Number.isInteger(concurrency) || concurrency < 2 || concurrency > 30) {
  process.stderr.write(
    "LOAD_CONCURRENCY harus berupa bilangan bulat 2–30 agar tidak melampaui batas rate limit lokal.\n",
  );
  process.exit(1);
}

const endpoint = `${base.origin}/api/v1/tables/${encodeURIComponent(tableCode)}/catalog`;
const startedAt = performance.now();
const responses = await Promise.all(
  Array.from({ length: concurrency }, async () => {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, sessionId: body?.data?.session?.id };
  }),
);

const failed = responses.filter(
  (response) =>
    response.status !== 200 || typeof response.sessionId !== "string",
);
const sessions = new Set(
  responses.map((response) => response.sessionId).filter(Boolean),
);
const durationMs = Math.round(performance.now() - startedAt);

if (failed.length || sessions.size !== 1) {
  process.stderr.write(
    `Gagal: ${failed.length} request error; ${sessions.size} sesi berbeda dari ${concurrency} request konkuren.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Lulus: ${concurrency} request katalog konkuren bergabung ke satu sesi dalam ${durationMs} ms. Target: Supabase lokal.\n`,
);
