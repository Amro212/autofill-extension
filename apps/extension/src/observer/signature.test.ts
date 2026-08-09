import { describe, expect, it } from "vitest";

import { ObservationSignature } from "./signature.js";

describe("ObservationSignature", () => {
  it("claims work before async processing and allows an explicit retry", () => {
    const signature = new ObservationSignature();

    expect(signature.claim("https://example.test/apply|application")).toBe(true);
    expect(signature.claim("https://example.test/apply|application")).toBe(false);
    signature.reset();
    expect(signature.claim("https://example.test/apply|application")).toBe(true);
  });

  it("does not clear a newer claim when an older inspection fails", () => {
    const signature = new ObservationSignature();
    signature.claim("page-a");
    signature.claim("page-b");

    signature.retry("page-a");

    expect(signature.claim("page-b")).toBe(false);
  });
});
