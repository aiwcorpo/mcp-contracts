export interface ExampleResponse {
  status: number;
  name: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface OperationExamples {
  operationId: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  route: string;
  defaultExample: string;
  responses: ExampleResponse[];
}
