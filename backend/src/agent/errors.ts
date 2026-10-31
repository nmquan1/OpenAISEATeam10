/** `message` is safe to show users; `internal` is logged server-side only. */
export class ProviderError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly internal?: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
