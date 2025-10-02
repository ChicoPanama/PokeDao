declare module 'node-fetch' {
  export default function fetch(
    url: string | URL,
    init?: RequestInit
  ): Promise<Response>;

  export interface RequestInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }

  export interface Response {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Headers;
    json<T = any>(): Promise<T>;
    text(): Promise<string>;
  }

  export interface Headers {
    get(name: string): string | null;
  }
}
