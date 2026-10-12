/**
 * In-memory sliding-window counters for failed logins
 * (`_SECURITY_SPEC.md` section 1).
 *
 * Two dimensions are tracked:
 *   - one bucket per **normalized email** (trim + lowercase) so `Admin@X.com`
 *     cannot bypass the per-account limit;
 *   - one bucket per **client IP** which is itself split per email, so the IP
 *     limit counts every failure coming from that address while a successful
 *     login can still drop exactly its own failures.
 *
 * Every evaluation prunes expired timestamps (and forgets empty buckets) so
 * the store cannot grow forever. The counters live in this process only -
 * swap the store for Redis when the API runs on several instances.
 */

/** Limits handed to the store, one pair of windows per dimension. */
export interface LoginLimits {
  emailMax: number;
  emailWindowMs: number;
  ipMax: number;
  ipWindowMs: number;
}

/** Result of checking a (email, ip) pair against the limits. */
export interface LoginEvaluation {
  locked: boolean;
  retryAfterSeconds: number;
}

/** `ip -> { all failures, failures grouped by normalized email }` */
interface IpBucket {
  all: number[];
  byEmail: Map<string, number[]>;
}

/** Key used for the email dimension: trimmed + lowercased. */
export const normalizeEmail = (email: unknown): string =>
  String(email ?? '')
    .trim()
    .toLowerCase();

const emailFailures = new Map<string, number[]>(); // email -> [timestamp, ...]
const ipFailures = new Map<string, IpBucket>();

/** Removes timestamps whose window has elapsed; keeps the list chronological. */
const pruneList = (list: number[], windowMs: number, now: number): number[] => {
  let expired = 0;
  while (expired < list.length && list[expired] + windowMs <= now) expired += 1;
  if (expired > 0) list.splice(0, expired);
  return list;
};

/** Drops every expired entry (and any bucket left empty) from both stores. */
export const sweep = ({ emailWindowMs, ipWindowMs }: LoginLimits): void => {
  const now = Date.now();

  for (const [email, list] of emailFailures) {
    pruneList(list, emailWindowMs, now);
    if (list.length === 0) emailFailures.delete(email);
  }

  for (const [ip, bucket] of ipFailures) {
    pruneList(bucket.all, ipWindowMs, now);
    for (const [email, list] of bucket.byEmail) {
      pruneList(list, ipWindowMs, now);
      if (list.length === 0) bucket.byEmail.delete(email);
    }
    if (bucket.all.length === 0) ipFailures.delete(ip);
  }
};

/**
 * Moment (epoch ms) when `list` drops below `max`, or `null` while the bucket
 * is still under its limit. Failures expire oldest first, so the bucket frees
 * up once `list.length - max + 1` entries have aged out of the window.
 */
const releaseAt = (list: number[] | undefined, max: number, windowMs: number): number | null => {
  if (!list || list.length < max) return null;
  return list[list.length - max] + windowMs;
};

/**
 * Decides whether a login attempt may run. A pair is locked while the email
 * bucket **or** the IP bucket is at/over its max inside its own window, and
 * `retryAfterSeconds` is the time until the last blocking bucket frees up.
 */
export const evaluate = (email: string, ip: string, limits: LoginLimits): LoginEvaluation => {
  sweep(limits);

  const now = Date.now();
  const emailRelease = releaseAt(emailFailures.get(email), limits.emailMax, limits.emailWindowMs);

  const ipBucket = ipFailures.get(ip);
  const ipRelease = ipBucket ? releaseAt(ipBucket.all, limits.ipMax, limits.ipWindowMs) : null;

  const releases = [emailRelease, ipRelease].filter((value): value is number => value !== null);
  if (releases.length === 0) return { locked: false, retryAfterSeconds: 0 };

  const unlockAt = releases.reduce((latest, value) => Math.max(latest, value));
  return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((unlockAt - now) / 1000)) };
};

/** Records one failed credential check for the email and the client IP. */
export const recordFailure = (email: string, ip: string): void => {
  const now = Date.now();

  let emailList = emailFailures.get(email);
  if (!emailList) {
    emailList = [];
    emailFailures.set(email, emailList);
  }
  emailList.push(now);

  let ipBucket = ipFailures.get(ip);
  if (!ipBucket) {
    ipBucket = { all: [], byEmail: new Map() };
    ipFailures.set(ip, ipBucket);
  }
  ipBucket.all.push(now);

  let ipEmailList = ipBucket.byEmail.get(email);
  if (!ipEmailList) {
    ipEmailList = [];
    ipBucket.byEmail.set(email, ipEmailList);
  }
  ipEmailList.push(now);
};

/** A successful login clears the email counter and its own failures from the IP counter. */
export const reset = (email: string, ip: string): void => {
  emailFailures.delete(email);

  const ipBucket = ipFailures.get(ip);
  if (!ipBucket) return;

  const own = ipBucket.byEmail.get(email);
  if (own) {
    const ownFailures = new Set(own);
    ipBucket.all = ipBucket.all.filter((timestamp) => !ownFailures.has(timestamp));
    ipBucket.byEmail.delete(email);
  }

  if (ipBucket.all.length === 0) ipFailures.delete(ip);
};

/** Test hook: forgets every counter so suites stay deterministic. */
export const resetLoginRateLimits = (): void => {
  emailFailures.clear();
  ipFailures.clear();
};
