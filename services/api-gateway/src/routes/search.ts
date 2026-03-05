import { Router } from 'express';
import { pool } from '../lib/pgClient.js';
import Groq from 'groq-sdk';
import { asyncHandler } from '../lib/asyncHandler.js';
import { searchSchema } from '../schemas/search.schema.js';

const router = Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const EMBEDDING_MODEL = 'voyage-3';
const TOP_K = 6;

async function embedQuery(text: string): Promise<number[]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
        input: text,
        model: EMBEDDING_MODEL,
        input_type: 'query',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Voyage API error ${response.status}: ${error}`);
    }

    const data = await response.json() as { data: { embedding: number[]; index: number }[] };
    return data.data[0].embedding;
}

// POST /search
router.post('/', asyncHandler(async (req, res) => {
    const { query } = searchSchema.parse(req.body);

    // 1. Embed the query
    const queryVector = await embedQuery(query);

    // 2. pgvector similarity search
    const result = await pool.query(
    `SELECT
        "videoId",
        "transcriptId",
        "chunkText",
        "chunkIndex",
        "startChar",
        "endChar",
        1 - ("embedding" <=> $1::vector) AS similarity
        FROM "VideoEmbedding"
        ORDER BY "embedding" <=> $1::vector
        LIMIT $2`,
        [JSON.stringify(queryVector), TOP_K]
    );

    const sources = result.rows;

    if (sources.length === 0) {
        res.json({ answer: 'No relevant content found.', sources: [] });
        return;
    }

    // 3. Build context and generate answer with Groq
    const context = sources.map((s, i) => `[${i + 1}] (videoId: ${s.videoId})\n${s.chunkText}`).join('\n\n');

    const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
            {
            role: 'system',
            content: 'You are a helpful assistant. Answer the user\'s question using only the provided transcript excerpts. Be concise and cite the source numbers.',
            },
            {
            role: 'user',
            content: `Transcript excerpts:\n\n${context}\n\nQuestion: ${query}`,
            },
        ],
        max_tokens: 512,
        temperature: 0.3,
    });

    const answer = completion.choices[0]?.message?.content ?? 'No answer generated.';

    res.json({
        answer,
        sources: sources.map(s => ({
            videoId: s.videoId,
            transcriptId: s.transcriptId,
            chunkText: s.chunkText,
            similarity: parseFloat(s.similarity.toFixed(4)),
        })),
    });
}));

export default router;