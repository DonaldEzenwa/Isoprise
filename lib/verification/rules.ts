export function parseHttpUrl(value: string | null | undefined): URL | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test')) return null;
    if (host.includes(':') || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return null;
    return url;
  } catch { return null; }
}

export function normalizeDomain(value: string | null | undefined) {
  if (!value) return '';
  const candidate = value.includes('://') ? parseHttpUrl(value)?.hostname : value;
  return (candidate || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

export function isOfficialDomainMatch(applicationUrl: string | null | undefined, officialDomain: string | null | undefined) {
  const target = parseHttpUrl(applicationUrl);
  const official = normalizeDomain(officialDomain);
  if (!target || !official) return false;
  const host = target.hostname.toLowerCase().replace(/^www\./, '');
  return host === official || host.endsWith(`.${official}`);
}

export function officialPageListsPortal(html: string, authorizedPortalUrl: string) {
  const portal = parseHttpUrl(authorizedPortalUrl);
  if (!portal) return false;
  const normalized = portal.href.replace(/\/$/, '').toLowerCase();
  const source = html.toLowerCase();
  if (source.includes(normalized)) return true;
  const hostPath = `${portal.hostname}${portal.pathname}`.replace(/\/$/, '').toLowerCase();
  return source.includes(hostPath) && /<a\b/i.test(html);
}

export function isExpiredOpportunity(input: { close_date?: string | null; created_at?: string | null; description?: string | null; title?: string | null }, now = new Date()) {
  if (input.close_date) {
    const close = new Date(`${input.close_date}T23:59:59Z`);
    if (!Number.isNaN(close.getTime()) && close < now) return true;
  }
  if (!input.created_at) return false;
  const age = now.getTime() - new Date(input.created_at).getTime();
  const closed = /\b(closed|no longer accepting|applications ended|not accepting applications)\b/i.test(`${input.title || ''} ${input.description || ''}`);
  return age >= 45 * 24 * 60 * 60 * 1000 && closed;
}
