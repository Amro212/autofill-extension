import {
  pageAnswerRequestSchema,
  rewriteRequestSchema,
  type JobRecord,
  type NormalizedField,
} from "@job-copilot/contracts";
import type { FastifyInstance, FastifyReply } from "fastify";

import type { AiService } from "../ai/service.js";
import { createAuthGuard } from "../auth/guard.js";
import type { PairingService } from "../auth/pairing.js";
import type { AnswerMemoryRepository } from "../memory/repository.js";
import { createEmployerScopeKey } from "../memory/ranking.js";
import type { ApplicationRepository } from "../repositories/applications.js";
import type { AnswerRecordRepository } from "../repositories/answers.js";
import type { JobRepository } from "../repositories/jobs.js";
import type { ProfileRepository } from "../repositories/profile.js";

export interface AiRouteDependencies {
  service: AiService;
  profiles: ProfileRepository;
  applications: ApplicationRepository;
  jobs: JobRepository;
  memories: AnswerMemoryRepository;
  answers: AnswerRecordRepository;
}

function jobDomain(job: JobRecord | undefined): string | undefined {
  return job === undefined ? undefined : createEmployerScopeKey(job);
}

function validationFailed(reply: FastifyReply) {
  return reply.code(400).send({
    error: { code: "VALIDATION_FAILED", message: "Invalid AI request" },
  });
}

function providerFailed(reply: FastifyReply) {
  return reply.code(502).send({
    error: { code: "AI_PROVIDER_FAILED", message: "AI answer generation failed" },
  });
}

function isNarrative(field: NormalizedField): boolean {
  return ["textarea", "contenteditable", "rich-text"].includes(field.kind);
}

export function registerAiRoutes(
  app: FastifyInstance,
  pairingService: PairingService,
  dependencies: AiRouteDependencies,
): void {
  const preHandler = createAuthGuard(pairingService);

  app.get("/v1/memories", { preHandler }, async () => dependencies.memories.list());

  function contextFor(
    fields: NormalizedField[],
    applicationId: string | undefined,
  ) {
    const application =
      applicationId === undefined
        ? undefined
        : dependencies.applications.get(applicationId);
    if (applicationId !== undefined && application === undefined) return undefined;
    const job =
      application?.jobId === undefined
        ? undefined
        : dependencies.jobs.get(application.jobId);
    const domain = jobDomain(job);
    const memories = fields.flatMap((field) =>
      dependencies.memories
        .findRelevant(field.label, {
          ...(domain === undefined ? {} : { domain }),
          ...(applicationId === undefined ? {} : { applicationId }),
          limit: 3,
        })
        .map((memory) => ({
          question: memory.normalizedQuestion,
          value: memory.value,
          scope: memory.scope,
        })),
    );
    return {
      profile: dependencies.profiles.get(),
      ...(job === undefined ? {} : { job }),
      resumeFacts: [],
      memories,
      domain,
    };
  }

  app.post("/v1/ai/pages/answer", { preHandler }, async (request, reply) => {
    const parsed = pageAnswerRequestSchema.safeParse(request.body);
    if (!parsed.success) return validationFailed(reply);
    const context = contextFor(parsed.data.fields, parsed.data.applicationId);
    if (context === undefined) {
      return reply.code(404).send({
        error: { code: "NOT_FOUND", message: "Application not found" },
      });
    }
    try {
      const result = await dependencies.service.answerPage(parsed.data, context);
      const byId = new Map(parsed.data.fields.map((field) => [field.id, field]));
      for (const answer of result.answers) {
        const field = byId.get(answer.fieldId);
        if (field === undefined) continue;
        if (parsed.data.applicationId !== undefined) {
          dependencies.answers.record({
            applicationId: parsed.data.applicationId,
            fieldSignature: field.id,
            question: field.label,
            value: answer.value,
            previousValue: field.currentValue,
            source: answer.inferred === true ? "inferred" : "ai",
            ...(answer.confidence === undefined
              ? {}
              : { confidence: answer.confidence }),
            ...(answer.inferred === undefined ? {} : { inferred: answer.inferred }),
            ...(answer.rationaleCode === undefined
              ? {}
              : { rationaleCode: answer.rationaleCode }),
          });
        }
        if (isNarrative(field)) {
          if (parsed.data.applicationId === undefined) continue;
          dependencies.memories.remember({
            question: field.label,
            value: answer.value,
            scope: "application",
            sourceApplicationId: parsed.data.applicationId,
            ...(context.domain === undefined ? {} : { domain: context.domain }),
          });
        } else {
          dependencies.memories.remember({
            question: field.label,
            value: answer.value,
            scope: "global",
          });
        }
      }
      return result;
    } catch {
      return providerFailed(reply);
    }
  });

  app.post("/v1/ai/fields/rewrite", { preHandler }, async (request, reply) => {
    const parsed = rewriteRequestSchema.safeParse(request.body);
    if (!parsed.success) return validationFailed(reply);
    const context = contextFor([parsed.data.field], parsed.data.applicationId);
    if (context === undefined) {
      return reply.code(404).send({
        error: { code: "NOT_FOUND", message: "Application not found" },
      });
    }
    try {
      const result = await dependencies.service.rewriteField(parsed.data, context);
      if (parsed.data.applicationId !== undefined) {
        dependencies.answers.record({
          applicationId: parsed.data.applicationId,
          fieldSignature: parsed.data.field.id,
          question: parsed.data.field.label,
          value: result.value,
          previousValue: parsed.data.currentAnswer,
          source: "rewrite",
          ...(result.confidence === undefined ? {} : { confidence: result.confidence }),
        });
        dependencies.memories.remember({
          question: parsed.data.field.label,
          value: result.value,
          scope: "application",
          sourceApplicationId: parsed.data.applicationId,
          ...(context.domain === undefined ? {} : { domain: context.domain }),
        });
      }
      return result;
    } catch {
      return providerFailed(reply);
    }
  });
}
