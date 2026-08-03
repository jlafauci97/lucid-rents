import { describe, it, expect } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import { unwrap } from "../unwrap";

const dbError = (message: string): PostgrestError =>
  ({ message, details: "", hint: "", code: "57014", name: "PostgrestError" }) as PostgrestError;

describe("unwrap", () => {
  it("passes rows through untouched", () => {
    const rows = [{ slug: "4330-n-milwaukee-ave" }];
    expect(unwrap({ data: rows, error: null }, "ctx")).toBe(rows);
  });

  // The whole point of the helper: a real miss must stay a miss so the caller
  // can notFound(), while a failed query must NOT be able to reach notFound().
  it("passes an empty result through so callers can notFound()", () => {
    expect(unwrap({ data: [], error: null }, "ctx")).toEqual([]);
    expect(unwrap({ data: null, error: null }, "ctx")).toBeNull();
  });

  it("throws on a query error instead of returning an empty result", () => {
    expect(() =>
      unwrap({ data: null, error: dbError("canceling statement due to statement timeout") }, "getBuilding chicago/x")
    ).toThrow(/getBuilding chicago\/x/);
  });

  it("keeps the underlying error as `cause` for logging", () => {
    const err = dbError("connection reset by peer");
    try {
      unwrap({ data: null, error: err }, "ctx");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as Error).cause).toBe(err);
      expect((e as Error).message).toContain("connection reset by peer");
    }
  });
});
