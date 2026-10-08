const SET = new Map();

export function blacklistToken(payload, ttlSeconds) {
  if (!payload?.jti) return;
  const expiresAt = Date.now() + Math.max(1, ttlSeconds) * 1000;
  SET.set(payload.jti, expiresAt);
  prune();
}

export function isBlacklisted(payload) {
  if (!payload?.jti) return false;
  const expiresAt = SET.get(payload.jti);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    SET.delete(payload.jti);
    return false;
  }
  return true;
}

export function clearBlacklist() {
  SET.clear();
}

function prune() {
  if (SET.size < 1000) return;
  const now = Date.now();
  for (const [jti, expiresAt] of SET) {
    if (expiresAt <= now) SET.delete(jti);
  }
}

export default { blacklistToken, isBlacklisted, clearBlacklist };
