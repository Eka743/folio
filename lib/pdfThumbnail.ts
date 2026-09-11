import { readFileBytes } from "./files";

const PDF_WORKER_SRC = "/pdf.worker.min.mjs";
const MAX_THUMBNAIL_PIXELS = 520;
const MAX_CONCURRENT_THUMBNAILS = 2;

type ThumbnailJob = {
  run: () => Promise<void>;
  signal: AbortSignal;
  resolve: () => void;
  reject: (error: unknown) => void;
};

const queuedJobs: ThumbnailJob[] = [];
let activeJobs = 0;

function pumpQueue(): void {
  while (activeJobs < MAX_CONCURRENT_THUMBNAILS && queuedJobs.length > 0) {
    const job = queuedJobs.shift()!;
    if (job.signal.aborted) {
      job.resolve();
      continue;
    }
    activeJobs++;
    job.run()
      .then(job.resolve, job.reject)
      .finally(() => {
        activeJobs--;
        pumpQueue();
      });
  }
}

function abortError(): Error {
  const error = new Error("Thumbnail rendering was cancelled.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

/**
 * Schedule a bounded first-page render. Cancellation removes queued work and
 * aborts active PDF.js loading/rendering when the browser supports it.
 */
export function schedulePdfThumbnail(
  file: File,
  canvas: HTMLCanvasElement,
): { promise: Promise<void>; cancel: () => void } {
  const controller = new AbortController();
  let queued = true;
  let resolvePromise!: () => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  const job: ThumbnailJob = {
    signal: controller.signal,
    run: async () => {
      queued = false;
      await renderPdfThumbnail(file, canvas, controller.signal);
    },
    resolve: resolvePromise,
    reject: rejectPromise,
  };
  queuedJobs.push(job);
  pumpQueue();

  return {
    promise,
    cancel: () => {
      controller.abort();
      if (!queued) return;
      const index = queuedJobs.indexOf(job);
      if (index >= 0) queuedJobs.splice(index, 1);
      queued = false;
      resolvePromise();
    },
  };
}

async function renderPdfThumbnail(
  file: File,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  }

  const data = await readFileBytes(file);
  throwIfAborted(signal);

  const loading = pdfjs.getDocument({ data });
  let pdf: import("pdfjs-dist").PDFDocumentProxy | null = null;
  let page: import("pdfjs-dist").PDFPageProxy | null = null;
  let renderTask: ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null = null;
  const abort = () => {
    void loading.destroy();
    renderTask?.cancel();
  };
  signal.addEventListener("abort", abort, { once: true });

  try {
    pdf = await loading.promise;
    throwIfAborted(signal);
    if (pdf.numPages < 1) throw new Error("The PDF has no pages.");

    page = await pdf.getPage(1);
    throwIfAborted(signal);
    const initialViewport = page.getViewport({ scale: 1 });
    const longestSide = Math.max(initialViewport.width, initialViewport.height);
    const scale = Math.min(1.4, MAX_THUMBNAIL_PIXELS / Math.max(1, longestSide));
    const viewport = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas unavailable in this browser.");
    context.save();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    renderTask = page.render({ canvasContext: context, viewport });
    await renderTask.promise;
    throwIfAborted(signal);
  } finally {
    signal.removeEventListener("abort", abort);
    page?.cleanup();
    if (pdf) await pdf.destroy();
    else await loading.destroy();
  }
}
