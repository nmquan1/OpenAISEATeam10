export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
export const problemSchema = {
  type: 'object',
  required: ['status', 'detail', 'requestId'],
  properties: {
    type: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'integer' },
    detail: { type: 'string' },
    error: { type: 'string' },
    requestId: { type: 'string' },
  },
  additionalProperties: false,
} as const;
export const errorSchemas = {
  400: problemSchema,
  401: problemSchema,
  403: problemSchema,
  413: problemSchema,
  415: problemSchema,
  422: problemSchema,
  429: problemSchema,
  500: problemSchema,
  502: problemSchema,
  503: problemSchema,
  504: problemSchema,
};
