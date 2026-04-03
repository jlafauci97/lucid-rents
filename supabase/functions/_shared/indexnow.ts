const INDEXNOW_KEY = 'abef9b924e2f4854b589f0b2aad38695';
const HOST = 'https://lucidrents.com';

/**
 * Notify search engines (Bing, Yandex, Naver, etc.) about updated URLs
 * via the IndexNow protocol. Fire-and-forget — errors are logged but not thrown.
 */
export async function notifyIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  // Ensure all URLs are absolute
  const absoluteUrls = urls.map((u) =>
    u.startsWith('http') ? u : `${HOST}${u.startsWith('/') ? '' : '/'}${u}`
  );

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'lucidrents.com',
        key: INDEXNOW_KEY,
        keyLocation: `${HOST}/${INDEXNOW_KEY}.txt`,
        urlList: absoluteUrls.slice(0, 10000), // IndexNow max 10k per request
      }),
    });

    if (!res.ok) {
      console.error(`IndexNow responded ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error('IndexNow notify error:', err);
  }
}
