import { existsSync, readFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";

export type WebAssets = Record<string, string | Buffer>;

export type StaticRouteOptions = {
  webRoot?: string;
  webAssets?: WebAssets;
};

const CSP =
  "default-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'";

export function registerStaticRoutes(
  server: FastifyInstance,
  options: StaticRouteOptions = {},
): void {
  const hasIndex = Boolean(readAsset("index.html", options));
  if (!hasIndex) {
    return;
  }

  server.get("/", async (_request, reply) => sendIndex(reply, options));
  server.get("/prompts", async (_request, reply) => sendIndex(reply, options));
  server.get("/prompts/:id", async (_request, reply) =>
    sendIndex(reply, options),
  );
  server.get("/settings", async (_request, reply) => sendIndex(reply, options));
  server.get("/assets/*", async (request, reply) => {
    const assetPath = request.url.replace(/^\//, "").split("?", 1)[0] ?? "";
    const asset = readAsset(assetPath, options);

    if (!asset) {
      reply.status(404).send({ error: "not_found" });
      return;
    }

    reply.type(contentType(assetPath)).send(asset);
  });
}

function sendIndex(reply: FastifyReply, options: StaticRouteOptions): void {
  const index = readAsset("index.html", options);

  reply
    .header("content-security-policy", CSP)
    .type("text/html; charset=utf-8")
    .send(index);
}

function readAsset(
  path: string,
  options: StaticRouteOptions,
): string | Buffer | undefined {
  if (options.webAssets?.[path]) {
    return options.webAssets[path];
  }

  if (!options.webRoot) {
    return undefined;
  }

  const resolvedRoot = resolve(options.webRoot);
  const resolvedPath = resolve(resolvedRoot, path);
  const rootPrefix = resolvedRoot.endsWith(sep)
    ? resolvedRoot
    : `${resolvedRoot}${sep}`;

  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(rootPrefix)) {
    return undefined;
  }

  if (!existsSync(resolvedPath)) {
    return undefined;
  }

  return readFileSync(resolvedPath);
}

function contentType(path: string): string {
  switch (extname(path)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}
