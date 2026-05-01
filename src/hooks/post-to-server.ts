export type PostHookPayloadRequest = {
  url: string;
  ingestToken: string;
  payload: unknown;
  timeoutMs: number;
};

export type PostHookPayloadResult = {
  ok: boolean;
  status?: number;
};

export async function postHookPayload(
  request: PostHookPayloadRequest,
): Promise<PostHookPayloadResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${request.ingestToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(request.payload),
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}
