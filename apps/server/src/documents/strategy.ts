import type {
  DocumentKind,
  DocumentMetadata,
} from "@job-copilot/contracts";

import type { ApplicationRepository } from "../repositories/applications.js";
import type { DocumentImportService } from "./import.js";
import type { DocumentWorkflowService } from "./workflow.js";

export interface DocumentStrategyDependencies {
  applications: ApplicationRepository;
  documents: DocumentImportService;
  workflow: DocumentWorkflowService;
}

export interface SelectApplicationDocumentInput {
  applicationId: string;
  kind: DocumentKind;
}

export class DocumentStrategyService {
  constructor(private readonly dependencies: DocumentStrategyDependencies) {}

  async select(input: SelectApplicationDocumentInput): Promise<DocumentMetadata> {
    const application = this.dependencies.applications.get(input.applicationId);
    if (application === undefined) throw new Error("Application not found");
    const library = this.dependencies.documents.list();
    const associated = library.find(
      (document) =>
        document.applicationId === application.id && document.kind === input.kind,
    );
    if (associated !== undefined) return associated;

    if (
      (input.kind === "resume" || input.kind === "cover-letter") &&
      application.jobId !== undefined
    ) {
      const source =
        library.find(
          (document) =>
            document.kind === "resume" &&
            document.source === "uploaded" &&
            document.isDefault,
        ) ??
        library.find(
          (document) => document.kind === "resume" && document.source === "uploaded",
        );
      if (source !== undefined) {
        try {
          const generated =
            input.kind === "resume"
              ? await this.dependencies.workflow.generateResume({
                  applicationId: application.id,
                  sourceDocumentId: source.id,
                  jobId: application.jobId,
                  format: "pdf",
                })
              : await this.dependencies.workflow.generateCoverLetter({
                  applicationId: application.id,
                  sourceDocumentId: source.id,
                  jobId: application.jobId,
                  format: "pdf",
                });
          const [selected] = generated.documents;
          if (selected !== undefined) return selected;
        } catch {
          // A usable uploaded default remains safer than blocking on optional generation.
        }
      }
    }

    const fallback =
      library.find((document) => document.kind === input.kind && document.isDefault) ??
      library.find((document) => document.kind === input.kind);
    if (fallback === undefined) throw new Error("Required document not found");
    return fallback;
  }
}
