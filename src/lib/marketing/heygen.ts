const HEYGEN_API_URL = "https://api.heygen.com/v2";

async function heygenRequest(
  method: "GET" | "POST",
  endpoint: string,
  body?: unknown
): Promise<Response> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("Missing HEYGEN_API_KEY env var");

  return fetch(`${HEYGEN_API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * Submits an avatar video generation job to HeyGen.
 * Returns the jobId which can be polled via checkVideoStatus.
 */
export async function submitAvatarVideo(params: {
  script: string;
  avatarId: string;
  backgroundUrl?: string;
}): Promise<string> {
  const payload = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: params.avatarId,
        },
        voice: {
          type: "text",
          input_text: params.script,
        },
        ...(params.backgroundUrl
          ? {
              background: {
                type: "image",
                url: params.backgroundUrl,
              },
            }
          : {}),
      },
    ],
  };

  const response = await heygenRequest("POST", "/video/generate", payload);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen video submission failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { data?: { video_id?: string } };
  const jobId = data.data?.video_id;

  if (!jobId) {
    throw new Error("HeyGen response did not include a video_id");
  }

  return jobId;
}

/**
 * Checks the processing status of a HeyGen video generation job.
 * Poll this until status is "completed" or "failed".
 */
export async function checkVideoStatus(jobId: string): Promise<{
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}> {
  const response = await heygenRequest("GET", `/video/${jobId}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen status check failed for job ${jobId} (HTTP ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    data?: {
      status?: string;
      video_url?: string;
      error?: string;
    };
  };

  const rawStatus = data.data?.status ?? "processing";
  const status =
    rawStatus === "completed"
      ? "completed"
      : rawStatus === "failed"
      ? "failed"
      : "processing";

  return {
    status,
    videoUrl: data.data?.video_url,
    error: data.data?.error,
  };
}

/**
 * Downloads a completed HeyGen video and returns it as a Buffer,
 * ready for upload to Blob storage.
 */
export async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new Error(`Failed to download HeyGen video from ${videoUrl} (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
