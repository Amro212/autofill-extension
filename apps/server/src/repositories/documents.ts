import { randomUUID } from "node:crypto";

import {
  documentMetadataSchema,
  type DocumentKind,
  type DocumentMediaType,
  type DocumentMetadata,
} from "@job-copilot/contracts";
import { and, asc, eq } from "drizzle-orm";

import type { JobCopilotDatabase } from "../db/client.js";
import { documents } from "../db/schema.js";
import { ensureLocalUser } from "./local-user.js";

export interface NewDocumentRecord {
  kind: DocumentKind;
  source: "uploaded" | "generated";
  originalFilename: string;
  mediaType: DocumentMediaType;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  sourceDocumentId?: string;
  applicationId?: string;
  jobId?: string;
  promptVersion?: string;
  tags?: string[];
}

export interface StoredDocument extends DocumentMetadata {
  storageKey: string;
}

function metadataFromRow(row: typeof documents.$inferSelect): DocumentMetadata {
  const {
    storageKey: _storageKey,
    tagsJson,
    sourceDocumentId,
    applicationId,
    jobId,
    promptVersion,
    ...metadata
  } = row;
  return documentMetadataSchema.parse({
    ...metadata,
    tags: JSON.parse(tagsJson),
    ...(sourceDocumentId === null ? {} : { sourceDocumentId }),
    ...(applicationId === null ? {} : { applicationId }),
    ...(jobId === null ? {} : { jobId }),
    ...(promptVersion === null ? {} : { promptVersion }),
  });
}

function toStoredDocument(row: typeof documents.$inferSelect): StoredDocument {
  return {
    ...metadataFromRow(row),
    storageKey: row.storageKey,
  };
}

function toMetadata(row: typeof documents.$inferSelect): DocumentMetadata {
  return metadataFromRow(row);
}

export class DocumentRepository {
  readonly #userId: string;

  constructor(private readonly db: JobCopilotDatabase) {
    this.#userId = ensureLocalUser(db);
  }

  create(input: NewDocumentRecord): DocumentMetadata {
    const createdAt = new Date().toISOString();
    const isDefault =
      this.db
        .select()
        .from(documents)
        .where(and(eq(documents.userId, this.#userId), eq(documents.kind, input.kind)))
        .get() === undefined;
    const { tags = [], ...record } = input;
    const row: typeof documents.$inferInsert = {
      id: randomUUID(),
      userId: this.#userId,
      ...record,
      tagsJson: JSON.stringify(tags),
      isDefault,
      createdAt,
    };
    this.db.insert(documents).values(row).run();
    return toMetadata(row as typeof documents.$inferSelect);
  }

  list(): DocumentMetadata[] {
    return this.db
      .select()
      .from(documents)
      .where(eq(documents.userId, this.#userId))
      .orderBy(asc(documents.createdAt))
      .all()
      .map(toMetadata);
  }

  get(id: string): StoredDocument | undefined {
    const row = this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, this.#userId)))
      .get();
    return row === undefined ? undefined : toStoredDocument(row);
  }

  setDefault(id: string): DocumentMetadata {
    const target = this.get(id);
    if (target === undefined) throw new Error("Document not found");
    this.db
      .update(documents)
      .set({ isDefault: false })
      .where(
        and(
          eq(documents.userId, this.#userId),
          eq(documents.kind, target.kind),
        ),
      )
      .run();
    this.db
      .update(documents)
      .set({ isDefault: true })
      .where(eq(documents.id, target.id))
      .run();
    return documentMetadataSchema.parse({ ...target, isDefault: true });
  }
}
