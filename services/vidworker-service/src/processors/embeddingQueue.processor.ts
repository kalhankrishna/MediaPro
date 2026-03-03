import { Job } from 'bullmq';
import pg from 'pg';
import { VideoStatus } from "@mediapro/proto";
import { updateVideoStatus } from "../lib/vidMetadataService.js";
import { type EmbeddingJob } from "@mediapro/queue";

const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 50;
const BATCH_SIZE = 64;
const EMBEDDING_MODEL = 'voyage-3';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
        input: texts,
        model: EMBEDDING_MODEL,
        input_type: 'document',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Voyage API error ${response.status}: ${error}`);
    }

    const data = await response.json() as { data: { embedding: number[]; index: number }[] };
    return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

function chunkText(text: string): Array<{ text: string; startChar: number; endChar: number }> {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        chunks.push({ text: text.slice(start, end), startChar: start, endChar: end });
        if (end === text.length) break;
        start += CHUNK_SIZE - CHUNK_OVERLAP;
    }

    return chunks;
}

export async function embeddingQueueProcessor(job: Job<EmbeddingJob>) {
    const { videoId, transcriptId, transcriptText } = job.data;

    await job.updateProgress(10);

    // Chunk the transcript
    const chunks = chunkText(transcriptText);
    await job.updateProgress(20);

    // Embed in batches
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const vectors = await embedBatch(batch.map(c => c.text));
        allEmbeddings.push(...vectors);

        const progress = 20 + Math.floor(((i + batch.length) / chunks.length) * 60);
        await job.updateProgress(progress);
    }

    // Idempotent write — delete existing embeddings for this transcript first
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`DELETE FROM "VideoEmbedding" WHERE "transcriptId" = $1`, [transcriptId]);

        for (let i = 0; i < chunks.length; i++) {
        await client.query(
            `INSERT INTO "VideoEmbedding" 
            ("videoId", "transcriptId", "chunkIndex", "chunkText", "embedding", "startChar", "endChar")
            VALUES ($1, $2, $3, $4, $5::vector, $6, $7)`,
            [
            videoId,
            transcriptId,
            i,
            chunks[i].text,
            JSON.stringify(allEmbeddings[i]),
            chunks[i].startChar,
            chunks[i].endChar,
            ]
        );
        }

        await client.query('COMMIT');

        await job.updateProgress(90);

        await updateVideoStatus({ videoId, status: VideoStatus.VIDEO_STATUS_COMPLETED });

        await job.updateProgress(100);
        console.log(`[${job.id}] Embedding complete.`);
    }
    catch(err) {
        await client.query('ROLLBACK');
        console.error(`[${job.id}] Embedding failed:`, err);
        await updateVideoStatus({ videoId, status: VideoStatus.VIDEO_STATUS_FAILED, errorMessage: err instanceof Error ? err.message : 'Unknown error' });
        throw err;
    }
    finally {
        client.release();
    }
}