declare module 'express' {
  export interface Request {
    headers: Record<string, string | string[] | undefined>;
    method: string;
    ip?: string;
    requestId?: string;
    query: Record<string, unknown>;
  }

  export interface Response {
    setHeader(name: string, value: string | string[]): this;
    status(code: number): this;
    json(body: unknown): this;
    send(): this;
    redirect(status: number, url: string): this;
  }
}
