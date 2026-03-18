// Unit test for metadata validation logic

function validateMetadataEntry(key: string, value: string): string | null {
  if (!key || key.trim().length === 0) return "Key is required";
  if (key.length > 100) return "Key exceeds 100 characters";
  if (value.length > 1000) return "Value exceeds 1000 characters";
  return null;
}

describe("Metadata validation", () => {
  it("accepts valid key-value pair", () => {
    expect(validateMetadataEntry("department", "finance")).toBeNull();
  });

  it("rejects empty key", () => {
    expect(validateMetadataEntry("", "value")).toBe("Key is required");
  });

  it("rejects key longer than 100 chars", () => {
    expect(validateMetadataEntry("a".repeat(101), "value")).toBe("Key exceeds 100 characters");
  });

  it("rejects value longer than 1000 chars", () => {
    expect(validateMetadataEntry("key", "x".repeat(1001))).toBe("Value exceeds 1000 characters");
  });

  it("allows 1000-char value", () => {
    expect(validateMetadataEntry("key", "x".repeat(1000))).toBeNull();
  });
});
