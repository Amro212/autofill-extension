import type {
  CoverLetterRequest,
  CoverLetterResult,
  ResumeTailorRequest,
  TailoredResume,
} from "@job-copilot/contracts";
import {
  coverLetterRequestSchema,
  resumeTailorRequestSchema,
} from "@job-copilot/contracts";

import type { AiService } from "../ai/service.js";
import { validateCoverLetterTruth, validateTailoredResumeTruth } from "./truth.js";

export class DocumentAiService {
  constructor(private readonly ai: AiService) {}

  async tailorResume(request: ResumeTailorRequest): Promise<TailoredResume> {
    const parsed = resumeTailorRequestSchema.parse(request);
    const result = await this.ai.tailorResume(parsed);
    return validateTailoredResumeTruth(result, parsed.canonical);
  }

  async generateCoverLetter(request: CoverLetterRequest): Promise<CoverLetterResult> {
    const parsed = coverLetterRequestSchema.parse(request);
    const result = await this.ai.generateCoverLetter(parsed);
    return validateCoverLetterTruth(result, parsed.canonical);
  }
}
