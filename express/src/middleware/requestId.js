import { randomUUID } from 'node:crypto';
import env from '../config/env.js';

const HEADER = env.requestIdHeader.toLowerCase();

export default function requestId(req, res, next) {
  const incoming = req.headers[HEADER];
  const id = typeof incoming === 'string' && incoming.trim().length > 0 ? incoming.trim().slice(0, 200) : randomUUID();
  req.id = id;
  res.locals.requestId = id;
  res.setHeader(env.requestIdHeader, id);
  next();
}
