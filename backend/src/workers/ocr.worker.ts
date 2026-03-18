import { Worker, Job } from "bullmq";
import { Pool } from "pg";
import { Client as MinioClient } from "minio";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { config } from "../config";

const execAsync = promisify(exec);

const db = new Pool({ connectionString: config.DATABASE_URL });
const minio = new MinioClient({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY,
});

interface OcrJobData {
  documentId: string;
  storageKey: string;
}

async function downloadToTemp(storageKey: string): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), "ged-ocr-"));
  const localPath = join(tmpDir, "input.pdf");
  const stream = await minio.getObject(config.MINIO_BUCKET, storageKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  await writeFile(localPath, Buffer.concat(chunks));
  return localPath;
}

async function extractTextFromPdf(pdfPath: string): Promise<string> {
  try {
    // Try pdftotext first (faster, better for native PDFs)
    const { stdout } = await execAsync(`pdftotext -layout "${pdfPath}" -`);
    if (stdout.trim().length > 50) return stdout;
  } catch {
    // pdftotext not available or failed
  }

  // Fall back to Tesseract OCR
  const tmpDir = await mkdtemp(join(tmpdir(), "ged-tess-"));
  const outputBase = join(tmpDir, "output");
  await execAsync(`tesseract "${pdfPath}" "${outputBase}" -l por+eng pdf txt`);
  const text = await readFile(`${outputBase}.txt`, "utf-8");
  await unlink(`${outputBase}.txt`).catch(() => {});
  await unlink(`${outputBase}.pdf`).catch(() => {});
  return text;
}

const worker = new Worker<OcrJobData>(
  "ocr",
  async (job: Job<OcrJobData>) => {
    const { documentId, storageKey } = job.data;

    // Mark as processing
    await db.query(
      "UPDATE documents SET ocr_status = 'processing', updated_at = NOW() WHERE id = $1",
      [documentId]
    );

    let localPath: string | null = null;
    try {
      localPath = await downloadToTemp(storageKey);
      const text = await extractTextFromPdf(localPath);
      const cleanText = text.replace(/\s+/g, " ").trim();

      await db.query(
        `UPDATE documents
         SET ocr_status = 'done',
             is_searchable = true,
             ocr_text = $1,
             ocr_text_vector = to_tsvector('portuguese', $1),
             updated_at = NOW()
         WHERE id = $2`,
        [cleanText, documentId]
      );

      console.log(`[OCR] Document ${documentId} processed successfully (${cleanText.length} chars)`);
    } catch (err) {
      console.error(`[OCR] Failed for document ${documentId}:`, err);
      await db.query(
        "UPDATE documents SET ocr_status = 'failed', updated_at = NOW() WHERE id = $1",
        [documentId]
      );
      throw err;
    } finally {
      if (localPath) await unlink(localPath).catch(() => {});
    }
  },
  {
    connection: { url: config.REDIS_URL },
    concurrency: 2,
  }
);

worker.on("completed", (job) => {
  console.log(`[OCR Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[OCR Worker] Job ${job?.id} failed:`, err.message);
});

console.log("[OCR Worker] Started");

// Graceful shutdown
process.on("SIGTERM", async () => {
  await worker.close();
  await db.end();
  process.exit(0);
});
