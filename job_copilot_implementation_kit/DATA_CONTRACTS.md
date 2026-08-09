# Data Contracts

These contracts are directional. The agent may refine names/types while preserving semantics.

## User

```ts
interface User {
  id: string;
  createdAt: string;
  updatedAt: string;
}
```

Even local v1 should use a user ID to avoid architectural dead ends.

## Applicant Profile

```ts
interface ApplicantProfile {
  id: string;
  userId: string;

  identity: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    preferredName?: string;
  };

  contact: {
    email?: string;
    phone?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };

  education: EducationRecord[];
  employment: EmploymentRecord[];
  projects: ProjectRecord[];
  skills: SkillRecord[];
  certifications: CertificationRecord[];

  eligibility: Record<string, unknown>;

  preferences: {
    relocation?: boolean;
    remote?: boolean;
    hybrid?: boolean;
    onsite?: boolean;
    startDate?: string;
    salary?: Record<string, unknown>;
  };

  customFacts: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}
```

## Job

```ts
interface JobRecord {
  id: string;
  userId: string;

  company?: string;
  title?: string;
  location?: string;
  jobId?: string;

  descriptionRaw?: string;
  descriptionNormalized?: string;

  requirements?: string[];
  preferredQualifications?: string[];
  responsibilities?: string[];

  listingUrl?: string;
  applicationUrl?: string;
  ats?: string;

  capturedAt: string;
}
```

## Application

```ts
interface ApplicationSession {
  id: string;
  userId: string;
  jobId?: string;

  state: ApplicationState;

  originatingTabId?: number;
  activeTabIds?: number[];

  adapterId?: string;

  createdAt: string;
  updatedAt: string;
  submittedAt?: string;

  autoContinue: boolean;
  autoSubmit: boolean;
  autopilot: boolean;
}
```

## Page snapshot

```ts
interface ApplicationPageSnapshot {
  id: string;
  applicationId: string;
  url: string;
  title?: string;
  stepIndex?: number;
  stepLabel?: string;
  fields: SerializableFieldSnapshot[];
  errors: ValidationIssue[];
  createdAt: string;
}
```

## Answer record

```ts
interface AnswerRecord {
  id: string;
  applicationId: string;
  fieldSignature: string;
  question: string;
  value: unknown;

  source:
    | "profile"
    | "resume"
    | "memory"
    | "ai"
    | "rewrite"
    | "inferred"
    | "manual";

  confidence?: number;

  previousValue?: unknown;
  createdAt: string;
}
```

## Global answer memory

```ts
interface AnswerMemory {
  id: string;
  userId: string;

  normalizedQuestion: string;
  signature: string;

  candidateValues: Array<{
    value: unknown;
    sourceApplicationId?: string;
    domain?: string;
    pinned?: boolean;
    usageCount: number;
    lastUsedAt?: string;
  }>;

  createdAt: string;
  updatedAt: string;
}
```

## Validation issue

```ts
interface ValidationIssue {
  id: string;
  fieldId?: string;
  type: string;
  message: string;
  severity: "warning" | "error";
  attempt: number;
}
```

## Action journal

Persist an action journal sufficient for debugging and recovery.

```ts
interface BrowserActionRecord {
  id: string;
  applicationId: string;
  pageSnapshotId?: string;

  actionType: string;
  fieldId?: string;

  status: "planned" | "executed" | "verified" | "failed";
  errorCode?: string;

  createdAt: string;
}
```
