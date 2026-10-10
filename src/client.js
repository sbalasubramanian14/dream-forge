export function getPort() {
  const port = Number(process.env.DREAM_FORGE_PORT || 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('DREAM_FORGE_PORT must be an integer from 1024 to 65535');
  return port;
}
export function getSession() {
  return process.env.DREAM_FORGE_SESSION || 'local';
}
export function canvasUrl(session = getSession(), port = getPort()) {
  return `http://127.0.0.1:${port}/?session=${encodeURIComponent(session)}`;
}
export async function request(path, body, port = getPort(), session = getSession()) {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/${path}?session=${encodeURIComponent(session)}`,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
