import { Request, Response, NextFunction } from 'express';
import { sha256 } from '../lib/auth.js';
import { getApiKeyByHash } from '../lib/apiKeyService.js';

export const validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const rawKey = authHeader.slice(7);

  if (!rawKey.startsWith('mp_')) {
    res.status(401).json({ error: 'Invalid API key format' });
    return;
  }

  const keyHash = sha256(rawKey);

  try {
    const { userId } = await getApiKeyByHash({ keyHash });
    req.user = { userId, email: '' }; // email not needed for agent requests
    next();
  } catch {
    res.status(401).json({ error: 'Invalid API key' });
  }
};