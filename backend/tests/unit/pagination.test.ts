// Unit test for pagination logic

function buildPagination(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    has_next: page < Math.ceil(total / limit),
    has_prev: page > 1,
  };
}

describe("Pagination helper", () => {
  it("computes pages correctly", () => {
    const p = buildPagination(100, 1, 20);
    expect(p.pages).toBe(5);
  });

  it("handles partial last page", () => {
    const p = buildPagination(101, 1, 20);
    expect(p.pages).toBe(6);
  });

  it("has_next is false on last page", () => {
    const p = buildPagination(40, 2, 20);
    expect(p.has_next).toBe(false);
  });

  it("has_prev is false on first page", () => {
    const p = buildPagination(40, 1, 20);
    expect(p.has_prev).toBe(false);
  });

  it("zero results yields 0 pages", () => {
    const p = buildPagination(0, 1, 20);
    expect(p.pages).toBe(0);
  });
});
