import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConferenceAbstractSearchQueryDto } from './conference-abstract-search-query.dto';

describe('ConferenceAbstractSearchQueryDto', () => {
  it('normalizes comma-separated Conference and year filters', async () => {
    const dto = plainToInstance(ConferenceAbstractSearchQueryDto, {
      conferenceIds:
        '1f4cb882-f8a5-4a1d-a452-cb30341a284b,1f4cb882-f8a5-4a1d-a452-cb30341a284b',
      years: '2026,2025',
      favoriteOnly: 'true',
      page: '2',
      pageSize: '30',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.conferenceIds).toEqual(['1f4cb882-f8a5-4a1d-a452-cb30341a284b']);
    expect(dto.years).toEqual([2026, 2025]);
    expect(dto.favoriteOnly).toBe(true);
    expect(dto.page).toBe(2);
  });

  it('rejects invalid filter values', async () => {
    const dto = plainToInstance(ConferenceAbstractSearchQueryDto, {
      searchField: 'session',
      conferenceIds: 'not-a-uuid',
      years: '1800',
      pageSize: '101',
    });

    const errors = await validate(dto);
    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(['searchField', 'conferenceIds', 'years', 'pageSize']),
    );
  });
});
