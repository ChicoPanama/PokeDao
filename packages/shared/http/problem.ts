export type Problem = {
  type: string; 
  title: string; 
  status: number; 
  detail?: string; 
  instance?: string;
};

export function problem(status: number, title: string, detail?: string): Response {
  const body: Problem = {
    type: "about:blank",
    title, 
    status,
    ...(detail ? { detail } : {})
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" }
  });
}
