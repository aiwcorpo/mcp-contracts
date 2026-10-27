import { http, HttpResponse, type HttpHandler } from 'msw';
import { portalBffExamples, RETURN_PATH_PATTERN } from './portal-bff.examples.js';
import type { ExampleResponse, OperationExamples } from './types.js';

export interface PortalBffHandlerOptions {
  /** Prefix for every route, e.g. 'http://localhost:4200' in Node tests. Empty in the browser. */
  baseUrl?: string;
  /**
   * Enforce the C12 CSRF rule on POST, PUT and DELETE: header X-XSRF-TOKEN must equal cookie XSRF-TOKEN.
   * Default true, so that a frontend which forgets the header fails against the mock as it would against the BFF.
   */
  enforceCsrf?: boolean;
}

/** Value the mock sets in the XSRF-TOKEN cookie on GET /api/v1/me. Test value, not a secret. */
export const MOCK_XSRF_TOKEN = 'msw-xsrf-token-test';

const MUTATING = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);
const RETURN_PATH = new RegExp(RETURN_PATH_PATTERN, 'u');

// The BFF answers 400 for a returnPath outside the C4/C12 pattern (CC-032); the mock does the same so that the
// frontend sees the error case.
async function invalidReturnPath(operationId: string, request: Request): Promise<boolean> {
  let value: unknown;
  if (operationId === 'login') {
    value = new URL(request.url).searchParams.get('returnPath') ?? undefined;
  } else if (operationId === 'startConnectOAuth') {
    const text = await request.clone().text();
    value = text ? (JSON.parse(text) as { returnPath?: unknown }).returnPath : undefined;
  } else {
    return false;
  }
  return value !== undefined && (typeof value !== 'string' || !RETURN_PATH.test(value));
}

function pickExample(operation: OperationExamples, prefer: string | null): ExampleResponse {
  const requested = prefer?.match(/(?:^|[\s,;])example=([A-Za-z0-9_-]+)/)?.[1];
  const name = requested ?? operation.defaultExample;
  const found = operation.responses.find((r) => r.name === name);
  if (!found) {
    throw new Error(`${operation.operationId}: no example named ${name}`);
  }
  return found;
}

function toResponse(example: ExampleResponse, extraHeaders: Record<string, string> = {}): Response {
  const headers = { ...example.headers, ...extraHeaders };
  if (example.body === undefined) {
    return new HttpResponse(null, { status: example.status, headers });
  }
  return HttpResponse.json(example.body as never, { status: example.status, headers });
}

function mswPath(route: string): string {
  return route.replace(/\{([^}]+)\}/g, ':$1');
}

/** Response of an operation by its example name, for use in server.use(...) overrides. */
export function portalBffExample(operationId: string, exampleName?: string): Response {
  const operation = portalBffExamples.find((o) => o.operationId === operationId);
  if (!operation) {
    throw new Error(`unknown operationId ${operationId}`);
  }
  return toResponse(pickExample(operation, exampleName ? `example=${exampleName}` : null));
}

/**
 * MSW handlers for every C12 operation, answering with the examples of portal-bff.v1.yaml.
 * Select a non-default example with the request header `Prefer: example=<name>`.
 */
export function createPortalBffHandlers(options: PortalBffHandlerOptions = {}): HttpHandler[] {
  const baseUrl = options.baseUrl ?? '';
  const enforceCsrf = options.enforceCsrf ?? true;
  return portalBffExamples.map((operation) => {
    const method = operation.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
    return http[method](baseUrl + mswPath(operation.route), async ({ request, cookies }) => {
      if (enforceCsrf && MUTATING.has(operation.method)) {
        const header = request.headers.get('X-XSRF-TOKEN');
        if (!header || header !== cookies['XSRF-TOKEN']) {
          return HttpResponse.json({ error: 'csrf_invalid' }, { status: 403 });
        }
      }
      if (await invalidReturnPath(operation.operationId, request)) {
        return HttpResponse.json({ error: 'invalid_request' }, { status: 400 });
      }
      const extra: Record<string, string> = operation.operationId === 'getMe'
        ? { 'Set-Cookie': `XSRF-TOKEN=${MOCK_XSRF_TOKEN}; Path=/; Secure; SameSite=Strict` }
        : {};
      return toResponse(pickExample(operation, request.headers.get('Prefer')), extra);
    });
  });
}
