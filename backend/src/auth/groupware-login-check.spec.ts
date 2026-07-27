import { parseGroupwareLoginCheckResponse } from './groupware-login-check';

describe('parseGroupwareLoginCheckResponse', () => {
  it('normalizes the updated Groupware identity response', () => {
    expect(parseGroupwareLoginCheckResponse({
      loginCheck: true,
      id: ' ThMoon@Voronoi.io ',
      team: ' AI 연구소 수리응용2팀 ',
      fullname: ' 문태훈 ',
    })).toEqual({
      loginCheck: true,
      email: 'thmoon@voronoi.io',
      team: 'AI 연구소 수리응용2팀',
      fullname: '문태훈',
    });
  });

  it('keeps an explicit failed login response', () => {
    expect(parseGroupwareLoginCheckResponse({ loginCheck: false })).toEqual({
      loginCheck: false,
    });
  });

  it('rejects a response without team', () => {
    expect(() => parseGroupwareLoginCheckResponse({
      loginCheck: true,
      id: 'thmoon@voronoi.io',
      fullname: '문태훈',
    })).toThrow('GROUPWARE_TEAM_INVALID');
  });

  it('rejects a response without fullname', () => {
    expect(() => parseGroupwareLoginCheckResponse({
      loginCheck: true,
      id: 'thmoon@voronoi.io',
      team: '수리응용2팀',
    })).toThrow('GROUPWARE_FULLNAME_INVALID');
  });
});
