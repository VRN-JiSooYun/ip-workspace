export type LegacyCommentLiteral = {
  id: number;
  memberId: number;
  name: string;
  content: string;
};

const MAX_LITERAL_LENGTH = 200_000;
const MAX_DEPTH = 20;

class PythonLiteralParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse(): unknown {
    if (this.input.length > MAX_LITERAL_LENGTH) {
      throw new Error("LEGACY_COMMENT_LITERAL_TOO_LARGE");
    }
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.input.length) {
      throw new Error(`LEGACY_COMMENT_LITERAL_TRAILING_TOKEN_AT_${this.index}`);
    }
    return value;
  }

  private parseValue(depth: number): unknown {
    if (depth > MAX_DEPTH) throw new Error("LEGACY_COMMENT_LITERAL_TOO_DEEP");
    this.skipWhitespace();
    const token = this.input[this.index];
    if (token === "[") return this.parseList(depth + 1);
    if (token === "{") return this.parseDictionary(depth + 1);
    if (token === "'" || token === '"') return this.parseString();
    if (token === "-" || token === "+" || /\d/.test(token ?? "")) {
      return this.parseNumber();
    }
    if (this.consumeKeyword("None")) return null;
    if (this.consumeKeyword("True")) return true;
    if (this.consumeKeyword("False")) return false;
    throw new Error(
      `LEGACY_COMMENT_LITERAL_UNSUPPORTED_TOKEN_AT_${this.index}`,
    );
  }

  private parseList(depth: number): unknown[] {
    this.expect("[");
    const values: unknown[] = [];
    this.skipWhitespace();
    if (this.consume("]")) return values;
    while (true) {
      values.push(this.parseValue(depth));
      this.skipWhitespace();
      if (this.consume("]")) return values;
      this.expect(",");
      this.skipWhitespace();
      if (this.consume("]")) return values;
    }
  }

  private parseDictionary(depth: number): Record<string, unknown> {
    this.expect("{");
    const value: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    this.skipWhitespace();
    if (this.consume("}")) return value;
    while (true) {
      const key = this.parseString();
      if (Object.hasOwn(value, key)) {
        throw new Error(`LEGACY_COMMENT_LITERAL_DUPLICATE_KEY_${key}`);
      }
      this.skipWhitespace();
      this.expect(":");
      value[key] = this.parseValue(depth);
      this.skipWhitespace();
      if (this.consume("}")) return value;
      this.expect(",");
      this.skipWhitespace();
      if (this.consume("}")) return value;
    }
  }

  private parseString(): string {
    const quote = this.input[this.index];
    if (quote !== "'" && quote !== '"') {
      throw new Error(
        `LEGACY_COMMENT_LITERAL_STRING_EXPECTED_AT_${this.index}`,
      );
    }
    this.index += 1;
    let result = "";
    while (this.index < this.input.length) {
      const character = this.input[this.index++];
      if (character === quote) return result;
      if (character !== "\\") {
        result += character;
        continue;
      }
      if (this.index >= this.input.length) {
        throw new Error("LEGACY_COMMENT_LITERAL_UNTERMINATED_ESCAPE");
      }
      const escaped = this.input[this.index++];
      const simpleEscapes: Record<string, string> = {
        "\\": "\\",
        "'": "'",
        '"': '"',
        a: "\x07",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
        v: "\v",
      };
      if (Object.hasOwn(simpleEscapes, escaped)) {
        result += simpleEscapes[escaped];
        continue;
      }
      if (escaped === "x") {
        result += this.parseUnicodeEscape(2);
        continue;
      }
      if (escaped === "u") {
        result += this.parseUnicodeEscape(4);
        continue;
      }
      if (escaped === "U") {
        result += this.parseUnicodeEscape(8);
        continue;
      }
      throw new Error(`LEGACY_COMMENT_LITERAL_UNSUPPORTED_ESCAPE_${escaped}`);
    }
    throw new Error("LEGACY_COMMENT_LITERAL_UNTERMINATED_STRING");
  }

  private parseUnicodeEscape(length: number): string {
    const hex = this.input.slice(this.index, this.index + length);
    if (hex.length !== length || !/^[0-9a-f]+$/i.test(hex)) {
      throw new Error(
        `LEGACY_COMMENT_LITERAL_INVALID_UNICODE_AT_${this.index}`,
      );
    }
    this.index += length;
    const codePoint = Number.parseInt(hex, 16);
    if (codePoint > 0x10ffff) {
      throw new Error(`LEGACY_COMMENT_LITERAL_INVALID_CODE_POINT_${codePoint}`);
    }
    return String.fromCodePoint(codePoint);
  }

  private parseNumber(): number {
    const rest = this.input.slice(this.index);
    const match = /^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest);
    if (!match)
      throw new Error(
        `LEGACY_COMMENT_LITERAL_NUMBER_EXPECTED_AT_${this.index}`,
      );
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value))
      throw new Error("LEGACY_COMMENT_LITERAL_NUMBER_OUT_OF_RANGE");
    return value;
  }

  private consumeKeyword(keyword: string): boolean {
    if (!this.input.startsWith(keyword, this.index)) return false;
    const next = this.input[this.index + keyword.length];
    if (next && /[A-Za-z0-9_]/.test(next)) return false;
    this.index += keyword.length;
    return true;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.input[this.index] ?? "")) this.index += 1;
  }

  private consume(token: string): boolean {
    if (this.input[this.index] !== token) return false;
    this.index += 1;
    return true;
  }

  private expect(token: string): void {
    if (!this.consume(token)) {
      throw new Error(
        `LEGACY_COMMENT_LITERAL_EXPECTED_${token}_AT_${this.index}`,
      );
    }
  }
}

const integer = (value: unknown, field: string): number => {
  const parsed =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || Number(parsed) < 0) {
    throw new Error(`LEGACY_COMMENT_${field.toUpperCase()}_INVALID`);
  }
  return Number(parsed);
};

export const parseLegacyCommentLiteral = (
  input: string,
): LegacyCommentLiteral[] => {
  const parsed = new PythonLiteralParser(input).parse();
  if (!Array.isArray(parsed)) throw new Error("LEGACY_COMMENT_LIST_REQUIRED");
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`LEGACY_COMMENT_OBJECT_REQUIRED_AT_${index}`);
    }
    const object = item as Record<string, unknown>;
    const allowedKeys = new Set(["id", "member_id", "name", "comment"]);
    if (Object.keys(object).some((key) => !allowedKeys.has(key))) {
      throw new Error(`LEGACY_COMMENT_UNKNOWN_FIELD_AT_${index}`);
    }
    const id = integer(object.id, "id");
    const memberId = integer(object.member_id, "member_id");
    const name = typeof object.name === "string" ? object.name.trim() : "";
    const content = typeof object.comment === "string" ? object.comment : "";
    if (memberId <= 0)
      throw new Error(`LEGACY_COMMENT_MEMBER_ID_INVALID_AT_${index}`);
    if (name.length === 0 || name.length > 200) {
      throw new Error(`LEGACY_COMMENT_NAME_INVALID_AT_${index}`);
    }
    if (content.trim().length === 0 || content.length > 10_000) {
      throw new Error(`LEGACY_COMMENT_CONTENT_INVALID_AT_${index}`);
    }
    return { id, memberId, name, content };
  });
};
