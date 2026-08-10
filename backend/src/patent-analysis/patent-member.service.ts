import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class PatentMemberService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string) {
    const recipient = await this.prisma.client.notificationRecipient.findUnique(
      {
        where: { linkedUserId: userId },
        select: { memberId: true, email: true, name: true, status: true },
      },
    );
    if (!recipient?.memberId || recipient.status !== "ACTIVE") {
      throw new UnauthorizedException("AUTH_MEMBER_ID_NOT_LINKED");
    }
    return { ...recipient, memberId: recipient.memberId };
  }
}
