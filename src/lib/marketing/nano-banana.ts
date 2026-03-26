const NANO_BANANA_API_URL = "https://nanobananavideo.com/api/v1";

async function nanoBananaRequest(
  method: "GET" | "POST",
  endpoint: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const apiKey = process.env.NANO_BANANA_API_KEY;
  if (!apiKey) throw new Error("Missing NANO_BANANA_API_KEY env var");

  const url = new URL(`${NANO_BANANA_API_URL}${endpoint}`);

  // For GET requests, append query params from body
  if (method === "GET" && body) {
    for (const [key, value] of Object.entries(body)) {
      url.searchParams.set(key, String(value));
    }
  }

  return fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    ...(method === "POST" && body ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * Submits a text-to-video generation job to Nano Banana.
 * Returns the video_id which can be polled via checkVideoStatus.
 */
export async function submitTextToVideo(params: {
  prompt: string;
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
  aspectRatio?: string;
}): Promise<string> {
  const payload = {
    prompt: params.prompt.slice(0, 500), // API max 500 chars
    duration: params.duration ?? 5,
    resolution: params.resolution ?? "1080p",
    aspect_ratio: params.aspectRatio ?? "16:9",
  };

  const response = await nanoBananaRequest("POST", "/text-to-video.php", payload);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Nano Banana text-to-video failed (HTTP ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    success: boolean;
    video_id?: string;
    error?: string;
  };

  if (!data.success || !data.video_id) {
    throw new Error(`Nano Banana submission failed: ${data.error ?? "No video_id returned"}`);
  }

  return data.video_id;
}

/**
 * Submits an image-to-video generation job to Nano Banana.
 * Useful for animating a static Lucid the Lizard image.
 */
export async function submitImageToVideo(params: {
  imageUrls: string[];
  prompt: string;
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
}): Promise<string> {
  const payload = {
    image_urls: params.imageUrls,
    prompt: params.prompt.slice(0, 500),
    duration: params.duration ?? 5,
    resolution: params.resolution ?? "1080p",
  };

  const response = await nanoBananaRequest("POST", "/image-to-video.php", payload);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Nano Banana image-to-video failed (HTTP ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    success: boolean;
    video_id?: string;
    error?: string;
  };

  if (!data.success || !data.video_id) {
    throw new Error(`Nano Banana submission failed: ${data.error ?? "No video_id returned"}`);
  }

  return data.video_id;
}

/**
 * Checks the processing status of a Nano Banana video generation job.
 * Poll this until status is "completed" or "failed".
 */
export async function checkVideoStatus(videoId: string): Promise<{
  status: "queued" | "processing" | "completed" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}> {
  const response = await nanoBananaRequest("GET", "/video-status.php", {
    video_id: videoId,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Nano Banana status check failed for video ${videoId} (HTTP ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    success: boolean;
    status?: string;
    video_url?: string;
    thumbnail_url?: string;
    error?: string;
  };

  const status = (data.status ?? "processing") as
    | "queued"
    | "processing"
    | "completed"
    | "failed";

  return {
    status,
    videoUrl: data.video_url,
    thumbnailUrl: data.thumbnail_url,
    error: status === "failed" ? (data.error ?? "Unknown error") : undefined,
  };
}

/**
 * Downloads a completed Nano Banana video and returns it as a Buffer,
 * ready for upload to Blob storage.
 */
export async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Nano Banana video from ${videoUrl} (HTTP ${response.status})`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
