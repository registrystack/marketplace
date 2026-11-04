import { marketplaceCanonicalPath } from '../tracking/marketplace-tracking.mjs';

export interface PackRequestInput {
  email: string;
  organization?: string;
  role?: string;
  message?: string;
  website?: string;
  packId: string;
  packTitle: string;
  sourcePage: string;
}

interface PackRequestEnvironment {
  fetch?: typeof globalThis.fetch;
  randomUUID?: () => string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function packRequestEndpoint(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Invalid pack request form endpoint.');
  }
  const formIds = url.searchParams.getAll('formId');
  const privacy = url.searchParams.getAll('privacy');
  const formId = formIds[0] ?? '';
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== '/form/submit' ||
    [...url.searchParams].length !== 2 ||
    formIds.length !== 1 ||
    privacy.length !== 1 ||
    privacy[0] !== 'kiosk' ||
    !/^[1-9]\d*$/.test(formId) ||
    !Number.isSafeInteger(Number(formId))
  ) {
    throw new Error('Invalid pack request form endpoint.');
  }
  return url.href;
}

export function packRequestSourcePage(value: string | undefined): string | undefined {
  if (!value || value !== value.trim() || value.length > 1200) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (
    url.origin !== 'https://marketplace.registrystack.org' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.toString() !== value ||
    marketplaceCanonicalPath(url.pathname) !== url.pathname
  ) return undefined;
  return url.toString();
}

function packRequestContext(value: string): string | undefined {
  const context = value.trim();
  return context && context.length <= 200 && !/[\u0000-\u001f\u007f]/.test(context)
    ? context
    : undefined;
}

function endpointFormId(endpoint: string): string {
  return new URL(endpoint).searchParams.get('formId') as string;
}

function submissionUrl(endpoint: string): string {
  const url = new URL(endpoint);
  url.searchParams.set('ajax', '1');
  return url.href;
}

export function packRequestRecoveryHref(packTitle: string): string {
  const context = packRequestContext(packTitle) ?? 'Registry Stack pack';
  const subject = `Pack access request: ${context}`;
  const body = [
    `Pack: ${context}`,
    'Organization: ',
    'Your role: ',
    'What are you trying to do?: ',
  ].join('\n');
  return `mailto:contact@registrystack.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function submitPackRequest(
  endpoint: string,
  input: PackRequestInput,
  environment: PackRequestEnvironment = {},
): Promise<void> {
  const configuredEndpoint = packRequestEndpoint(endpoint);
  if (!configuredEndpoint) throw new Error('Pack request form is unavailable.');

  const email = input.email.trim();
  const organization = input.organization?.trim() ?? '';
  const role = input.role?.trim() ?? '';
  const message = input.message?.trim() ?? '';
  const packId = input.packId.trim();
  const context = packRequestContext(input.packTitle);
  const sourcePage = packRequestSourcePage(input.sourcePage);
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    organization.length > 200 ||
    role.length > 200 ||
    message.length > 2000 ||
    input.website?.trim() ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId) ||
    packId.length > 120 ||
    !context ||
    !sourcePage
  ) {
    throw new Error('Check the request details.');
  }

  const randomUUID = environment.randomUUID ?? (() => globalThis.crypto.randomUUID());
  const requestToken = randomUUID();
  const savedFields = {
    email,
    organization,
    role,
    message,
    starter_id: packId,
    source_page: sourcePage,
    request_token: requestToken,
    request_type: 'starter',
    request_context: context,
  };
  const body = new URLSearchParams({
    'mauticform[email]': savedFields.email,
    'mauticform[organization]': savedFields.organization,
    'mauticform[role]': savedFields.role,
    'mauticform[message]': savedFields.message,
    'mauticform[starter_id]': savedFields.starter_id,
    'mauticform[source_page]': savedFields.source_page,
    'mauticform[request_token]': savedFields.request_token,
    'mauticform[request_type]': savedFields.request_type,
    'mauticform[request_context]': savedFields.request_context,
    'mauticform[website]': '',
    'mauticform[formId]': endpointFormId(configuredEndpoint),
  });

  const timeoutMs = environment.timeoutMs ?? 20_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000) {
    throw new Error('Invalid pack request timeout.');
  }
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = environment.signal
    ? AbortSignal.any([environment.signal, timeoutSignal])
    : timeoutSignal;
  const send = environment.fetch ?? globalThis.fetch;
  const response = await send(submissionUrl(configuredEndpoint), {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
    signal,
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Could not confirm the pack request.');
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error('Could not confirm the pack request.');
  }
  if (!result || typeof result !== 'object') throw new Error('Could not confirm the pack request.');
  const nativeResult = result as {
    success?: unknown;
    results?: Record<string, unknown>;
    validationErrors?: unknown;
    errorMessage?: unknown;
  };
  if (
    nativeResult.success !== 1 ||
    nativeResult.validationErrors !== undefined ||
    nativeResult.errorMessage !== undefined ||
    !nativeResult.results ||
    Object.entries(savedFields).some(([field, expected]) => nativeResult.results?.[field] !== expected)
  ) {
    throw new Error('Could not confirm the pack request.');
  }
}
