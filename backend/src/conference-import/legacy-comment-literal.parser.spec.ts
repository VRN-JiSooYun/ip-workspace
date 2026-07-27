import { parseLegacyCommentLiteral } from './legacy-comment-literal.parser';

describe('parseLegacyCommentLiteral', () => {
  it('parses the restricted legacy Python literal and preserves comment text', () => {
    const result = parseLegacyCommentLiteral(
      "[{'id': '0', 'name': '문태훈', 'comment': '@thmoon@voronoi.io \\r\\ntest ', 'member_id': 256}]",
    );

    expect(result).toEqual([{
      id: 0,
      memberId: 256,
      name: '문태훈',
      content: '@thmoon@voronoi.io \r\ntest ',
    }]);
  });

  it('accepts an empty comment list', () => {
    expect(parseLegacyCommentLiteral('[]')).toEqual([]);
  });

  it('rejects executable expressions', () => {
    expect(() => parseLegacyCommentLiteral("__import__('os').system('id')"))
      .toThrow(/UNSUPPORTED_TOKEN/);
  });

  it('rejects duplicate dictionary keys', () => {
    expect(() => parseLegacyCommentLiteral(
      "[{'id': '0', 'id': '1', 'name': 'A', 'comment': 'x', 'member_id': 1}]",
    )).toThrow(/DUPLICATE_KEY/);
  });

  it('rejects unknown fields', () => {
    expect(() => parseLegacyCommentLiteral(
      "[{'id': '0', 'name': 'A', 'comment': 'x', 'member_id': 1, 'admin': True}]",
    )).toThrow(/UNKNOWN_FIELD/);
  });
});
