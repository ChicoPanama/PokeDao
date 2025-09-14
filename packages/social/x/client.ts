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
  if (!POSTING_ENABLED || POSTING_DRY_RUN) {
    // Dry-run: don’t require credentials; just log
    console.log(`[DRY RUN][X] ${label}`);
    return { data: { id: 'dry-run' } } as any;
  }
  return fn();
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
    for (const raw of lines) {
      const text = raw.slice(0, 270); // safety buffer
      const res = await client.v2.tweet({
        text,
        ...(replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {}),
      } as any);
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

