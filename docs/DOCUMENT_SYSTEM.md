# Document System

The authenticated library accepts bounded PDF and DOCX uploads, sanitizes
filenames, hashes bytes, stores metadata in SQLite, and stores bytes beneath the
private data directory. Defaults are selected per document kind.

Resume parsing extracts text, recognizes sections, creates canonical facts with
stable source IDs/excerpts, records unsupported sections, and returns profile
suggestions. Suggestions populate editable Profile fields and require an
explicit save. Canonical data is never inferred from generated prose.

Tailoring and cover-letter generation use the canonical resume, profile, and
captured job. Every generated bullet or paragraph cites source fact IDs;
truthfulness validation rejects unsupported facts before rendering. Both PDF
and DOCX outputs remain text-based. Generated metadata records source document,
application, job, prompt version, tags, hash, and format.

Before a file field is filled, the application strategy reuses an already
attached matching document, otherwise generates from the default parsed resume,
otherwise falls back to the default upload. Download occurs through the paired
background and upload is verified from the page's accepted filename state.
