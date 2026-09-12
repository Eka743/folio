import { parsePptxDirect, parseXlsxDirect } from "./office.parser";

type OfficeWorkerRequest = {
  id: number;
  kind: "pptx" | "xlsx";
  name: string;
  type: string;
  buffer: ArrayBuffer;
};

const workerScope = self as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<OfficeWorkerRequest>) => void): void;
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void;
};

workerScope.addEventListener("message", async (event: MessageEvent<OfficeWorkerRequest>) => {
  const request = event.data;
  if (!request || !request.id || !request.buffer || !["pptx", "xlsx"].includes(request.kind)) return;
  try {
    const bytes = new Uint8Array(request.buffer);
    const file = new File([request.buffer], request.name, { type: request.type });
    const document = request.kind === "pptx"
      ? await parsePptxDirect(file)
      : await parseXlsxDirect(file);
    workerScope.postMessage({ id: request.id, ok: true, document }, [bytes.buffer]);
  } catch (cause) {
    workerScope.postMessage({
      id: request.id,
      ok: false,
      error: { message: cause instanceof Error ? cause.message : "The Office document could not be read." },
    });
  }
});

export {};
