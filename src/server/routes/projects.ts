import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type {
  ProjectInstructionStoragePort,
  ProjectPolicyActor,
  ProjectPolicyPatch,
  ProjectPolicyStoragePort,
} from "../../storage/ports.js";
import { requireAppAccess, type ServerAuthConfig } from "../auth.js";
import { problem } from "../errors.js";

export type ProjectRouteOptions = {
  auth: ServerAuthConfig;
  storage: Partial<ProjectPolicyStoragePort & ProjectInstructionStoragePort>;
};

const ProjectParamsSchema = z.object({
  id: z.string().regex(/^proj_[A-Za-z0-9_]+$/),
});

const ProjectPolicyPatchSchema = z.object({
  alias: z.string().trim().min(1).max(80).nullable().optional(),
  capture_disabled: z.boolean().optional(),
  analysis_disabled: z.boolean().optional(),
  retention_candidate_days: z.number().int().positive().nullable().optional(),
  external_analysis_opt_in: z.boolean().optional(),
  export_disabled: z.boolean().optional(),
});

export function registerProjectRoutes(
  server: FastifyInstance,
  options: ProjectRouteOptions,
): void {
  server.get("/api/v1/projects", async (request) => {
    requireAppAccess(request, options.auth);
    const storage = requireProjectStorage(options.storage, request.url);

    return { data: storage.listProjects() };
  });

  server.patch("/api/v1/projects/:id/policy", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const storage = requireProjectStorage(options.storage, request.url);
    const params = ProjectParamsSchema.parse(request.params);
    const body = ProjectPolicyPatchSchema.parse(request.body);
    const result = storage.updateProjectPolicy(
      params.id,
      body satisfies ProjectPolicyPatch,
      "web" satisfies ProjectPolicyActor,
    );

    if (!result) {
      throw problem(404, "Not Found", "Project not found.", request.url);
    }

    return { data: result };
  });

  server.post("/api/v1/projects/:id/instructions/analyze", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const storage = requireProjectInstructionStorage(
      options.storage,
      request.url,
    );
    const params = ProjectParamsSchema.parse(request.params);
    const result = storage.analyzeProjectInstructions(params.id);

    if (!result) {
      throw problem(404, "Not Found", "Project not found.", request.url);
    }

    return { data: result };
  });

  server.get("/api/v1/projects/:id/instructions", async (request) => {
    requireAppAccess(request, options.auth);
    const storage = requireProjectInstructionStorage(
      options.storage,
      request.url,
    );
    const params = ProjectParamsSchema.parse(request.params);
    const result = storage.getProjectInstructionReview(params.id);

    if (!result) {
      throw problem(
        404,
        "Not Found",
        "Project instruction review not found.",
        request.url,
      );
    }

    return { data: result };
  });
}

function requireProjectStorage(
  storage: ProjectRouteOptions["storage"],
  instance: string,
): ProjectPolicyStoragePort {
  if (
    !storage.listProjects ||
    !storage.updateProjectPolicy ||
    !storage.getProjectPolicyForEvent
  ) {
    throw problem(
      500,
      "Internal Server Error",
      "Project policy storage is not configured.",
      instance,
    );
  }

  return storage as ProjectPolicyStoragePort;
}

function requireProjectInstructionStorage(
  storage: ProjectRouteOptions["storage"],
  instance: string,
): ProjectInstructionStoragePort {
  if (
    !storage.getProjectInstructionReview ||
    !storage.analyzeProjectInstructions
  ) {
    throw problem(
      500,
      "Internal Server Error",
      "Project instruction storage is not configured.",
      instance,
    );
  }

  return storage as ProjectInstructionStoragePort;
}
