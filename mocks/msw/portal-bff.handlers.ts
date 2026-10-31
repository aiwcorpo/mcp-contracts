import { http, HttpResponse, type HttpHandler } from 'msw';
import { portalBffExamples, RETURN_PATH_PATTERN, SYSTEMS } from './portal-bff.examples.js';
import type { ExampleResponse, OperationExamples } from './types.js';

export interface PortalBffHandlerOptions {
  /** Prefix for every route, e.g. 'http://localhost:4200' in Node tests. Empty in the browser. */
  baseUrl?: string;
  /**
   * Enforce the C12 CSRF rule on POST, PUT and DELETE: header X-XSRF-TOKEN must equal cookie __Host-XSRF-TOKEN.
   * Default true, so that a frontend which forgets the header fails against the mock as it would against the BFF.
   */
  enforceCsrf?: boolean;
}

/** Value the mock sets in the __Host-XSRF-TOKEN cookie on GET /api/v1/me. Test value, not a secret. */
export const MOCK_XSRF_TOKEN = 'msw-xsrf-token-test';

/** requestId the mock puts in X-Request-Id of the errors it generates itself (CC-087). Test value. */
const MOCK_REQUEST_ID = '0192d1b2-7c3a-7d4e-8f10-2a3b4c5d6e7f';

function errorResponse(error: string, status: number): Response {
  return HttpResponse.json({ error }, { status, headers: { 'X-Request-Id': MOCK_REQUEST_ID } });
}

const MUTATING = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);
/** Name of the CSRF cookie (CC-055); the header stays X-XSRF-TOKEN. */
export const XSRF_COOKIE = '__Host-XSRF-TOKEN';
const RETURN_PATH = new RegExp(RETURN_PATH_PATTERN, 'u');
const MCP_ENDPOINT_PARAMETERS = ['systems', 'tools', 'access', 'exclude'];

// The BFF answers 400 for a returnPath outside the C4/C12 pattern (CC-032); the mock does the same so that the
// frontend sees the error case.
async function invalidReturnPath(operationId: string, request: Request): Promise<boolean> {
  let value: unknown;
  if (operationId === 'login') {
    value = new URL(request.url).searchParams.get('returnPath') ?? undefined;
  } else if (operationId === 'startConnectOAuth') {
    const text = await request.clone().text();
    try {
      value = text ? (JSON.parse(text) as { returnPath?: unknown } | null)?.returnPath : undefined;
    } catch {
      return true;
    }
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
    return http[method](baseUrl + mswPath(operation.route), async ({ request, cookies, params }) => {
      if (enforceCsrf && MUTATING.has(operation.method)) {
        const header = request.headers.get('X-XSRF-TOKEN');
        if (!header || header !== cookies[XSRF_COOKIE]) {
          return errorResponse('csrf_invalid', 403);
        }
      }
      if (operation.route.includes('{system}') && !SYSTEMS.includes(String(params.system))) {
        return errorResponse('invalid_request', 400);
      }
      if (await invalidReturnPath(operation.operationId, request)) {
        return errorResponse('invalid_request', 400);
      }
      if (operation.operationId === 'getMcpEndpoint') {
        // A parameter outside the four is an invalid filter and not a lost one, as on the gateway (CC-170).
        // searchParams are decoded, like the typed parameters the BFF receives (CC-182): a value that still has a percent sign
        // (sent as %25) is an invalid filter, and so is a name outside the four or a repeated one.
        const pairs = [...new URL(request.url).searchParams.entries()];
        const invalid = pairs.some(([name, value]) => !MCP_ENDPOINT_PARAMETERS.includes(name) || /[%&=]/u.test(value))
          || new Set(pairs.map(([name]) => name)).size !== pairs.length;
        if (invalid) return toResponse(pickExample(operation, 'example=invalid_filter'));
      }
      const extra: Record<string, string> = operation.operationId === 'getMe'
        ? { 'Set-Cookie': `${XSRF_COOKIE}=${MOCK_XSRF_TOKEN}; Path=/; Secure; SameSite=Strict` }
        : {};
      return toResponse(pickExample(operation, request.headers.get('Prefer')), extra);
    });
  });
}
