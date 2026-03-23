import { describe, it, expect } from "vitest";
import { categorizeMerchant } from "./categorize";

describe("categorizeMerchant", () => {
  it("categorizes supermarkets", () => {
    expect(categorizeMerchant("イオンモール幕張")).toBe("スーパー・食品");
    expect(categorizeMerchant("COSTCO WHOLESALE")).toBe("スーパー・食品");
  });

  it("categorizes convenience stores", () => {
    expect(categorizeMerchant("セブンイレブン新宿店")).toBe("コンビニ");
    expect(categorizeMerchant("LAWSON STORE")).toBe("コンビニ");
  });

  it("categorizes restaurants", () => {
    expect(categorizeMerchant("マクドナルド渋谷店")).toBe("飲食");
    expect(categorizeMerchant("STARBUCKS COFFEE")).toBe("飲食");
    expect(categorizeMerchant("UBER EATS")).toBe("飲食");
  });

  it("categorizes transportation", () => {
    expect(categorizeMerchant("タイムズカーシェア")).toBe("交通・カーシェア");
    expect(categorizeMerchant("JR東日本")).toBe("交通・カーシェア");
  });

  it("categorizes shopping", () => {
    expect(categorizeMerchant("AMAZON.CO.JP")).toBe("ショッピング");
    expect(categorizeMerchant("ユニクロ銀座店")).toBe("ショッピング");
  });

  it("categorizes utilities", () => {
    expect(categorizeMerchant("東京電力")).toBe("公共料金");
    expect(categorizeMerchant("NHK受信料")).toBe("公共料金");
  });

  it("returns null for unknown merchants", () => {
    expect(categorizeMerchant("XYZABC UNKNOWN")).toBeNull();
    expect(categorizeMerchant("")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(categorizeMerchant("amazon.co.jp")).toBe("ショッピング");
    expect(categorizeMerchant("lawson store")).toBe("コンビニ");
  });
});
