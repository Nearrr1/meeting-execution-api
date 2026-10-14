declare module 'express' {
  export interface Request {
    headers: Record<string, string | string[] | undefined>;
    method: string;
    ip?: string;
    requestId?: string;
  }

  export interface Response {
    setHeader(name: string, value: string): this;
    status(code: number): this;
    json(body: unknown): this;
  }
}
