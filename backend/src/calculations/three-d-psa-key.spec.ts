import {
  buildThreeDPsaUniqueKey,
  isSupportedThreeDPsaUniqueKey,
  THREE_D_PSA_UNIQUE_KEY_PREFIX,
} from './three-d-psa-key';

describe('three-d-psa unique key', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';

  it('creates a workspace-prefixed UUID v4', () => {
    const value = buildThreeDPsaUniqueKey();

    expect(value.startsWith(THREE_D_PSA_UNIQUE_KEY_PREFIX)).toBe(true);
    expect(isSupportedThreeDPsaUniqueKey(value)).toBe(true);
  });

  it('accepts a legacy UUID-only callback during transition', () => {
    expect(isSupportedThreeDPsaUniqueKey(uuid)).toBe(true);
  });

  it('rejects an incorrect prefix', () => {
    expect(isSupportedThreeDPsaUniqueKey(`worksapce-${uuid}`)).toBe(false);
  });

  it('rejects a non-v4 UUID suffix', () => {
    expect(
      isSupportedThreeDPsaUniqueKey(
        'workspace-550e8400-e29b-11d4-a716-446655440000',
      ),
    ).toBe(false);
  });
});

