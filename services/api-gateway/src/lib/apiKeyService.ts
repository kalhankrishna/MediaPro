import { promisify } from 'util';
import { grpcClient } from './grpcClient.js';
import type {
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ListUserApiKeysRequest,
  ListUserApiKeysResponse,
  RevokeApiKeyRequest,
  RevokeApiKeyResponse,
  GetApiKeyByHashRequest,
  GetApiKeyByHashResponse,
} from '@mediapro/proto';

export const createApiKey = promisify(
  grpcClient.createApiKey.bind(grpcClient)
) as (req: CreateApiKeyRequest) => Promise<CreateApiKeyResponse>;

export const listUserApiKeys = promisify(
  grpcClient.listUserApiKeys.bind(grpcClient)
) as (req: ListUserApiKeysRequest) => Promise<ListUserApiKeysResponse>;

export const revokeApiKey = promisify(
  grpcClient.revokeApiKey.bind(grpcClient)
) as (req: RevokeApiKeyRequest) => Promise<RevokeApiKeyResponse>;

export const getApiKeyByHash = promisify(
  grpcClient.getApiKeyByHash.bind(grpcClient)
) as (req: GetApiKeyByHashRequest) => Promise<GetApiKeyByHashResponse>;