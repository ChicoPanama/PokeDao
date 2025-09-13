import { TwitterApi } from 'twitter-api-v2';

const POSTING_ENABLED = process.env.POSTING_ENABLED === 'true';
const POSTING_DRY_RUN = process.env.POSTING_DRY_RUN !== 'false'; // default true

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || v.length === 0) throw new Error(`Missing ENV: ${name}`);
  return v;
}

// Lazily construct the client only if we intend to post for real
function getXClient() {
  return new TwitterApi({
    appKey: requireEnv('X_APP_KEY'),
    appSecret: requireEnv('X_APP_SECRET'),
    accessToken: requireEnv('X_ACCESS_TOKEN'),
    accessSecret: requireEnv('X_ACCESS_SECRET'),
  });
}

async function maybePost<T>(label: string, fn: () => Promise<T>): Promise<T | { data: { id: string; text?: string } }> {
  const shouldDry = !POSTING_ENABLED || POSTING_DRY_RUN;
  const start = Date.now();
  if (shouldDry) {
    console.log(`[DRY RUN][X] ${label}`);
    if (process.env.AGENT_DEBUG === 'true') console.log(`[dbg][X] ${label} took ${Date.now()-start}ms (dry)`);
    return { data: { id: 'dry-run' } } as any;
  }

  if (process.env.AGENT_DEBUG === 'true') console.log(`[dbg][X] POST start: ${label}`);
  try {
    const res = await fn();
    if (process.env.AGENT_DEBUG === 'true') console.log(`[dbg][X] POST done: ${label} ${Date.now()-start}ms`);
    return res;
  } catch (err: any) {
    console.error('[err][X] post failed:', String(err?.message ?? err));
    throw err;
  }
}

export async function postText(text: string) {
  return maybePost('Tweet: ' + text, async () => {
    const client = getXClient();
    return client.v2.tweet(text);
  });
}

export async function postThread(lines: string[]) {
  return maybePost('Thread with ' + lines.length + ' tweets', async () => {
    const client = getXClient();
    let replyTo: string | undefined;
    let i = 0;
    for (const raw of lines) {
      i++;
      const text = raw.slice(0, 270); // safety buffer
      const tstart = Date.now();
      if (process.env.AGENT_DEBUG === 'true') console.log(`[dbg][X] tweet#${i} start`);
      const res = await client.v2.tweet({
        text,
        ...(replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {}),
      } as any);
      if (process.env.AGENT_DEBUG === 'true') console.log(`[dbg][X] tweet#${i} done ${Date.now()-tstart}ms`);
      replyTo = (res as any).data.id;
    }
    return { data: { id: replyTo! } } as any;
  });
}

export async function postWithImage(text: string, pngOrJpg: Buffer) {
  return maybePost('Tweet with image', async () => {
    const client = getXClient();
    const mediaId = await client.v1.uploadMedia(pngOrJpg, { type: 'png' });
    return client.v2.tweet({ text, media: { media_ids: [mediaId] } });
  });
}

