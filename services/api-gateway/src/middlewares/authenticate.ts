import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/auth.js';
import { sha256 } from '../lib/auth.js';
import { getApiKeyByHash } from '../lib/apiKeyService.js';

/**
 * Accepts either:
 * - JWT in access_token cookie (human via browser)
 * - API key in Authorization: Bearer mp_... header (agent via MCP)
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Try Bearer token first (API key)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer mp_')) {
    const rawKey = authHeader.slice(7);
    const keyHash = sha256(rawKey);

    try {
      const { userId } = await getApiKeyByHash({ keyHash });
      req.user = { userId, email: '' };
      return next();
    } catch {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
  }

  // Fall back to JWT cookie
  const token = req.cookies?.access_token;
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
      return next();
    }
  }

  res.status(401).json({ error: 'Authentication required' });
};