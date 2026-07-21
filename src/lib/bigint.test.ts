import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bigintToString,
  stringToBigint,
  stringToBigintSafe,
  bigintReplacer,
  serializeRecord,
  bigintIdSchema,
  getCompanyFilterBigInt,
} from "./bigint";

describe("bigint helpers", () => {
  it("bigintToString converts BigInt to decimal string", () => {
    assert.equal(bigintToString(9007199254740993n), "9007199254740993");
    assert.equal(bigintToString(0n), "0");
    assert.equal(bigintToString(-42n), "-42");
    assert.equal(bigintToString(null), null);
    assert.equal(bigintToString(undefined), undefined);
  });

  it("stringToBigint parses valid decimal strings", () => {
    assert.equal(stringToBigint("42"), 42n);
    assert.equal(stringToBigint("0"), 0n);
    assert.equal(stringToBigint("-7"), -7n);
    assert.equal(stringToBigint("9007199254740993"), 9007199254740993n);
    assert.equal(stringToBigint(null), null);
    assert.equal(stringToBigint(undefined), undefined);
  });

  it("stringToBigint throws on invalid input", () => {
    assert.throws(() => stringToBigint("abc"));
    assert.throws(() => stringToBigint(""));
    assert.throws(() => stringToBigint("12.5"));
    assert.throws(() => stringToBigint("  "));
  });

  it("stringToBigintSafe returns null on invalid input", () => {
    assert.equal(stringToBigintSafe("abc"), null);
    assert.equal(stringToBigintSafe(""), null);
    assert.equal(stringToBigintSafe(null), null);
    assert.equal(stringToBigintSafe("42"), 42n);
  });

  it("bigintReplacer serializes BigInt to string", () => {
    const obj = { id: 42n, name: "foo", nested: { value: 99n } };
    const json = JSON.stringify(obj, bigintReplacer);
    assert.equal(json, '{"id":"42","name":"foo","nested":{"value":"99"}}');
  });

  it("serializeRecord converts BigInt fields deeply", () => {
    const record = {
      id: 1n,
      companyId: 10n,
      nested: { employeeId: 5n },
      list: [{ branchId: 2n }],
    };
    const serialized = serializeRecord(record);
    assert.equal(serialized.id, "1");
    assert.equal(serialized.companyId, "10");
    assert.equal(serialized.nested.employeeId, "5");
    assert.equal(serialized.list[0].branchId, "2");
  });

  it("bigintIdSchema coerces positive IDs", () => {
    assert.equal(bigintIdSchema.parse("42"), 42n);
    assert.equal(bigintIdSchema.parse(42), 42n);
    assert.throws(() => bigintIdSchema.parse("abc"));
    assert.throws(() => bigintIdSchema.parse("0"));
    assert.throws(() => bigintIdSchema.parse("-1"));
  });

  it("getCompanyFilterBigInt returns scoped bigint filter", () => {
    assert.deepEqual(getCompanyFilterBigInt({ role: "SAAS_SUPER_ADMIN", companyId: "1" }), {});
    assert.deepEqual(getCompanyFilterBigInt({ role: "COMPANY_ADMIN", companyId: "7" }), { companyId: 7n });
    assert.deepEqual(getCompanyFilterBigInt({ role: "COMPANY_ADMIN", companyId: null }), { companyId: -1n });
  });
});
