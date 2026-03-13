import { Router } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../lib/asyncHandler.js';
import { sha256 } from '../lib/auth.js';
import { createApiKey, listUserApiKeys, revokeApiKey } from '../lib/apiKeyService.js';

const router = Router();

// POST /api-keys — create a new API key
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const raw = `mp_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = sha256(raw);

  const { keyId } = await createApiKey({ userId, name: name.trim(), keyHash });

  // Raw key shown ONCE — never stored, never retrievable
  res.status(201).json({ keyId, key: raw, name: name.trim() });
}));

// GET /api-keys — list all keys for current user (metadata only, never raw)
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { keys } = await listUserApiKeys({ userId });
  res.json({ keys });
}));

// DELETE /api-keys/:id — revoke a key
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const keyId = req.params.id as string;

  const { success } = await revokeApiKey({ keyId, userId });

  if (!success) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }

  res.json({ message: 'API key revoked' });
}));

export default router;