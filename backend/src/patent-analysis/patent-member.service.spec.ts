import { UnauthorizedException } from '@nestjs/common';
import { PatentMemberService } from './patent-member.service';

describe('PatentMemberService', () => {
  it('returns the helper member identity linked to the signed-in user', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      memberId: 256,
      email: 'researcher@example.com',
      name: 'Researcher',
      status: 'ACTIVE',
    });
    const service = new PatentMemberService({
      client: {
        notificationRecipient: { findUnique },
      },
    } as never);

    await expect(service.resolve('user-1')).resolves.toMatchObject({ memberId: 256 });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { linkedUserId: 'user-1' },
    }));
  });

  it('rejects users without an active helper member link', async () => {
    const service = new PatentMemberService({
      client: {
        notificationRecipient: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      },
    } as never);

    await expect(service.resolve('user-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
