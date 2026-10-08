import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

const BASE = { issuer: env.jwt.issuer, audience: env.jwt.audience };

function sign(payload, secret, expiresIn) {
  return jwt.sign({ ...payload, jti: randomUUID() }, secret, { ...BASE, expiresIn });
}

export function signAccessToken(user) {
  return sign({ sub: String(user.id), role: user.role, typ: 'access' }, env.jwt.accessSecret, env.jwt.expiresIn);
}

export function signRefreshToken(user) {
  return sign({ sub: String(user.id), role: user.role, typ: 'refresh' }, env.jwt.refreshSecret, env.jwt.refreshExpiresIn);
}

export function issueTokenPair(user) {
  return {
    token: signAccessToken(user),
    refresh_token: signRefreshToken(user),
    token_type: 'Bearer',
    expires_in: env.jwt.expiresIn,
  };
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwt.accessSecret, BASE);
  if (payload.typ !== 'access') {
    const error = new Error('Invalid token type');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.jwt.refreshSecret, BASE);
  if (payload.typ !== 'refresh') {
    const error = new Error('Invalid token type');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  return payload;
}

export function decode(token) {
  return jwt.decode(token);
}

export function ttlSecondsFrom(payload, fallback) {
  if (!payload?.exp) return fallback;
  return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
}

export default {
  signAccessToken,
  signRefreshToken,
  issueTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decode,
  ttlSecondsFrom,
};
