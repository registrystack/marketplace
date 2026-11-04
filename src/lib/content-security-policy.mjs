export function marketplaceCsp({ analyticsScript, requestEndpoint } = {}) {
  const origin = value => {
    if (!value) return null;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Marketplace connections require an explicit HTTPS origin.');
    return url.origin;
  };
  const analytics = origin(analyticsScript);
  const request = origin(requestEndpoint);
  const connections = [...new Set([analytics, request].filter(Boolean))];
  return [
    "default-src 'self'",
    "script-src 'self'" + (analytics ? ' ' + analytics : ''),
    "connect-src 'self'" + (connections.length ? ' ' + connections.join(' ') : ''),
    'frame-src https://registrystack.org',
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}
