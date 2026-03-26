import { SignJWT } from "jose";

const KLING_API_URL = "https://api.klingai.com/v1";

/**
 * Creates a JWT token for Kling AI API authentication.
 * Uses KLING_ACCESS_KEY and KLING_SECRET_KEY env vars.
 */
async function createKlingToken(): Promise<string> {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;
  if (!accessKey || !secretKey)
    throw new Error("Missing KLING_ACCESS_KEY or KLING_SECRET_KEY env vars");

  const now = Math.floor(Date.now() / 1000);
  const secret = new TextEncoder().encode(secretKey);

  return new SignJWT({
    iss: accessKey,
    exp: now + 1800, // 30 minute expiry
    nbf: now - 5,
    iat: now,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(secret);
}

async function klingRequest(
  method: "GET" | "POST",
  endpoint: string,
  body?: unknown
): Promise<Response> {
  const token = await createKlingToken();

  return fetch(`${KLING_API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * Submits a text-to-video generation job to Kling AI.
 * Returns the taskId which can be polled via checkTaskStatus.
 */
export async function submitTextToVideo(params: {
  prompt: string;
  duration?: number;
  aspectRatio?: string;
}): Promise<string> {
  const payload = {
    prompt: params.prompt,
    duration: params.duration ?? 5,
    aspect_ratio: params.aspectRatio ?? "16:9",
  };

  const response = await klingRequest("POST", "/videos/text2video", payload);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Kling AI video submission failed (HTTP ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as { data?: { task_id?: string } };
  const taskId = data.data?.task_id;

  if (!taskId) {
    throw new Error("Kling AI response did not include a task_id");
  }

  return taskId;
}

/**
 * Checks the processing status of a Kling AI video generation task.
 * Poll this until status is "completed" or "failed".
 */
export async function checkTaskStatus(taskId: string): Promise<{
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}> {
  const response = await klingRequest(
    "GET",
    `/videos/text2video/${taskId}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Kling AI status check failed for task ${taskId} (HTTP ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    data?: {
      task_status?: string;
      task_result?: {
        videos?: Array<{ url?: string }>;
      };
      task_status_msg?: string;
    };
  };

  const rawStatus = data.data?.task_status ?? "processing";
  const status =
    rawStatus === "succeed"
      ? "completed"
      : rawStatus === "failed"
        ? "failed"
        : "processing";

  const videoUrl = data.data?.task_result?.videos?.[0]?.url;

  return {
    status,
    videoUrl,
    error:
      status === "failed"
        ? (data.data?.task_status_msg ?? "Unknown error")
        : undefined,
  };
}

/**
 * Downloads a completed Kling AI video and returns it as a Buffer,
 * ready for upload to Blob storage.
 */
export async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Kling AI video from ${videoUrl} (HTTP ${response.status})`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
