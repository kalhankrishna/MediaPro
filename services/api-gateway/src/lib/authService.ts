import { promisify } from 'util';
import { grpcClient } from './grpcClient.js';
import type {
  UpsertUserRequest,
  UpsertUserResponse,
  GetUserByIdRequest,
  GetUserByIdResponse,
  CreateRefreshTokenRequest,
  CreateRefreshTokenResponse,
  GetRefreshTokenByHashRequest,
  GetRefreshTokenByHashResponse,
  DeleteRefreshTokenRequest,
  DeleteRefreshTokenResponse,
  DeleteAllUserRefreshTokensRequest,
  DeleteAllUserRefreshTokensResponse,
} from '@mediapro/proto';

export const upsertUser = promisify(
  grpcClient.upsertUser.bind(grpcClient)
) as (req: UpsertUserRequest) => Promise<UpsertUserResponse>;

export const getUserById = promisify(
  grpcClient.getUserById.bind(grpcClient)
) as (req: GetUserByIdRequest) => Promise<GetUserByIdResponse>;

export const createRefreshToken = promisify(
  grpcClient.createRefreshToken.bind(grpcClient)
) as (req: CreateRefreshTokenRequest) => Promise<CreateRefreshTokenResponse>;

export const getRefreshTokenByHash = promisify(
  grpcClient.getRefreshTokenByHash.bind(grpcClient)
) as (req: GetRefreshTokenByHashRequest) => Promise<GetRefreshTokenByHashResponse>;

export const deleteRefreshToken = promisify(
  grpcClient.deleteRefreshToken.bind(grpcClient)
) as (req: DeleteRefreshTokenRequest) => Promise<DeleteRefreshTokenResponse>;

export const deleteAllUserRefreshTokens = promisify(
  grpcClient.deleteAllUserRefreshTokens.bind(grpcClient)
) as (req: DeleteAllUserRefreshTokensRequest) => Promise<DeleteAllUserRefreshTokensResponse>;