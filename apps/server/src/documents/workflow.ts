import {
  generatedDocumentFormatSchema,
  type CoverLetterResult,
  type DocumentMetadata,
  type GeneratedDocumentFormat,
  type ResumeParseResult,
  type TailoredResume,
} from "@job-copilot/contracts";

import type { JobRepository } from "../repositories/jobs.js";
import type { ProfileRepository } from "../repositories/profile.js";
import type { CanonicalResumeRepository } from "../repositories/canonical-resumes.js";
import { extractDocumentText } from "./extract.js";
import type { DocumentAiService } from "./generation.js";
import type { DocumentImportService } from "./import.js";
import {
  renderCoverLetterDocx,
  renderCoverLetterPdf,
  renderResumeDocx,
  renderResumePdf,
} from "./render.js";
import { parseResumeText } from "./resume-parser.js";

const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const;

export interface DocumentWorkflowDependencies {
  canonicalResumes: CanonicalResumeRepository;
  documents: DocumentImportService;
  generator: DocumentAiService;
  jobs: JobRepository;
  profiles: ProfileRepository;
}

export interface GenerateDocumentInput {
  sourceDocumentId: string;
  jobId: string;
  applicationId?: string | undefined;
  format?: GeneratedDocumentFormat;
  instructions?: string | undefined;
}

export interface GeneratedDocumentResult<T> {
  content: T;
  documents: DocumentMetadata[];
}

export class DocumentWorkflowService {
  constructor(private readonly dependencies: DocumentWorkflowDependencies) {}

  async parseResume(sourceDocumentId: string): Promise<ResumeParseResult> {
    const source = this.dependencies.documents.read(sourceDocumentId);
    if (source.metadata.kind !== "resume") throw new Error("Document is not a resume");
    const text = await extractDocumentText(source.bytes, source.metadata.mediaType);
    const result = parseResumeText(text, source.metadata.id);
    this.dependencies.canonicalResumes.upsert(result.canonical);
    return result;
  }

  async generateResume(
    input: GenerateDocumentInput,
  ): Promise<GeneratedDocumentResult<TailoredResume>> {
    const context = this.#context(input);
    const content = await this.dependencies.generator.tailorResume(context.request);
    const documents = await this.#persistVariants(
      input,
      content.promptVersion,
      "resume",
      "tailored-resume",
      (format) => format === "pdf" ? renderResumePdf(content) : renderResumeDocx(content),
    );
    return { content, documents };
  }

  async generateCoverLetter(
    input: GenerateDocumentInput,
  ): Promise<GeneratedDocumentResult<CoverLetterResult>> {
    const context = this.#context(input);
    const content = await this.dependencies.generator.generateCoverLetter(context.request);
    const documents = await this.#persistVariants(
      input,
      content.promptVersion,
      "cover-letter",
      "cover-letter",
      (format) =>
        format === "pdf" ? renderCoverLetterPdf(content) : renderCoverLetterDocx(content),
    );
    return { content, documents };
  }

  #context(input: GenerateDocumentInput) {
    const format = generatedDocumentFormatSchema.parse(input.format ?? "both");
    const canonical = this.dependencies.canonicalResumes.getBySourceDocumentId(
      input.sourceDocumentId,
    );
    if (canonical === undefined) throw new Error("Canonical resume not found");
    const job = this.dependencies.jobs.get(input.jobId);
    if (job === undefined) throw new Error("Job not found");
    return {
      request: {
        sourceDocumentId: input.sourceDocumentId,
        canonical,
        profile: this.dependencies.profiles.get(),
        job,
        format,
        ...(input.applicationId === undefined ? {} : { applicationId: input.applicationId }),
        ...(input.instructions === undefined ? {} : { instructions: input.instructions }),
      },
    };
  }

  async #persistVariants(
    input: GenerateDocumentInput,
    promptVersion: string,
    kind: "resume" | "cover-letter",
    basename: string,
    render: (format: "pdf" | "docx") => Promise<Buffer>,
  ): Promise<DocumentMetadata[]> {
    const requested = generatedDocumentFormatSchema.parse(input.format ?? "both");
    const formats: Array<"pdf" | "docx"> = requested === "both" ? ["pdf", "docx"] : [requested];
    const metadata: DocumentMetadata[] = [];
    for (const format of formats) {
      const bytes = await render(format);
      metadata.push(
        this.dependencies.documents.storeGenerated({
          bytes,
          filename: `${basename}.${format}`,
          kind,
          mediaType: format === "pdf" ? "application/pdf" : DOCX_MEDIA_TYPE,
          sourceDocumentId: input.sourceDocumentId,
          jobId: input.jobId,
          promptVersion,
          tags: ["ai-generated", kind === "resume" ? "tailored" : "cover-letter"],
          ...(input.applicationId === undefined
            ? {}
            : { applicationId: input.applicationId }),
        }),
      );
    }
    return metadata;
  }
}
