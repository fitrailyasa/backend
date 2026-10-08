export function ok(res, message, data = null) {
  return res.status(200).json({ success: true, message, data });
}

export function created(res, message, data = null) {
  return res.status(201).json({ success: true, message, data });
}

export function noContentBody(res, message, data = null) {
  return res.status(200).json({ success: true, message, data });
}

export function paginated(res, message, data, meta) {
  return res.status(200).json({ success: true, message, data, meta });
}

export function failure(res, statusCode, message, errors) {
  const body = { success: false, message };
  if (errors !== undefined && errors !== null) body.errors = errors;
  return res.status(statusCode).json(body);
}

export default { ok, created, noContentBody, paginated, failure };
