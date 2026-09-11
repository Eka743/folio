const origin = process.env.LOAD_REVIEW_ORIGIN ?? "http://127.0.0.1:3001";
const levels = [10, 25, 50, 100];
const paths = ["/", "/tools/merge-pdf", "/privacy"];

async function request(path) {
  const started = performance.now();
  try {
    const response = await fetch(`${origin}${path}`, { redirect: "manual" });
    await response.arrayBuffer();
    return {
      path,
      status: response.status,
      ms: performance.now() - started,
      ok: response.ok,
    };
  } catch (error) {
    return {
      path,
      status: 0,
      ms: performance.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function percentile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))] ?? 0;
}

for (const concurrency of levels) {
  const jobs = Array.from({ length: concurrency }, (_, index) => request(paths[index % paths.length]));
  const results = await Promise.all(jobs);
  const durations = results.map((result) => result.ms);
  const failures = results.filter((result) => !result.ok);
  console.log(JSON.stringify({
    origin,
    concurrency,
    requests: results.length,
    errors: failures.length,
    statusCounts: Object.fromEntries(
      [...new Set(results.map((result) => result.status))].map((status) => [
        status,
        results.filter((result) => result.status === status).length,
      ]),
    ),
    p50Ms: Number(percentile(durations, 0.5).toFixed(1)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(1)),
    maxMs: Number(Math.max(...durations).toFixed(1)),
    failedPaths: failures.slice(0, 3).map((result) => ({ path: result.path, error: result.error })),
  }));
}
