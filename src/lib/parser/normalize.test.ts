import { describe, it, expect } from "vitest";
import { fullToHalf, normalizeSpaces, normalizeYen, removeNumberCommas, normalizeText } from "./normalize";

describe("fullToHalf", () => {
  it("converts full-width ASCII to half-width", () => {
    expect(fullToHalf("ＮＥＴＦＬＩＸ")).toBe("NETFLIX");
    expect(fullToHalf("１２３")).toBe("123");
    expect(fullToHalf("！")).toBe("!");
  });

  it("leaves half-width characters unchanged", () => {
    expect(fullToHalf("NETFLIX")).toBe("NETFLIX");
    expect(fullToHalf("123")).toBe("123");
  });

  it("leaves Japanese characters unchanged", () => {
    expect(fullToHalf("ネットフリックス")).toBe("ネットフリックス");
  });
});

describe("normalizeSpaces", () => {
  it("converts full-width spaces to half-width", () => {
    expect(normalizeSpaces("hello\u3000world")).toBe("hello world");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeSpaces("hello   world")).toBe("hello world");
  });

  it("trims whitespace", () => {
    expect(normalizeSpaces("  hello  ")).toBe("hello");
  });
});

describe("normalizeYen", () => {
  it("normalizes yen symbol variants", () => {
    expect(normalizeYen("￥1300")).toBe("¥1300");
    expect(normalizeYen("\\1300")).toBe("¥1300");
  });
});

describe("removeNumberCommas", () => {
  it("removes commas from numbers", () => {
    expect(removeNumberCommas("1,300")).toBe("1300");
    expect(removeNumberCommas("1,300,000")).toBe("1300000");
  });

  it("leaves non-number commas alone", () => {
    expect(removeNumberCommas("hello, world")).toBe("hello, world");
  });
});

describe("normalizeText", () => {
  it("applies full normalization pipeline", () => {
    expect(normalizeText("　ＮＥＴＦＬＩＸ　￥１，５９０")).toBe("NETFLIX ¥1,590");
  });
});
