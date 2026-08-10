import { Injectable, UnauthorizedException } from "@nestjs/common";
import { decryptOAuthToken } from "better-auth/oauth2";
import { PrismaService } from "../database/prisma.service";
import { auth } from "./auth";

@Injectable()
export class GroupwareTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string): Promise<string> {
    const account = await this.prisma.client.account.findUnique({
      where: {
        userId_providerId: { userId, providerId: "groupware" },
      },
      select: { accessToken: true },
    });
    if (!account?.accessToken) {
      throw new UnauthorizedException("GROUPWARE_ACCOUNT_NOT_FOUND");
    }
    return this.decrypt(account.accessToken);
  }

  async decrypt(encryptedToken: string): Promise<string> {
    const context = await auth.$context;
    const token = await decryptOAuthToken(
      encryptedToken,
      context as unknown as Parameters<typeof decryptOAuthToken>[1],
    );
    if (!token) throw new UnauthorizedException("GROUPWARE_TOKEN_NOT_FOUND");
    return token;
  }
}
