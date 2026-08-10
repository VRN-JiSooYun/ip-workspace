import { Logger } from "@nestjs/common";

import { authRuntimeConfig } from "./auth-config";

const logger = new Logger("GroupwareLoginCheck");

// 운영에서는 login_check 응답에 개인정보(email, team, fullname)가 담기므로 남기지 않는다.
const debugEnabled = process.env.NODE_ENV !== "production";

type LoginCheckResponse = {
  loginCheck?: unknown;
  id?: unknown;
  team?: unknown;
  fullname?: unknown;
};

export type GroupwareLoginCheckResult =
  | { loginCheck: false }
  | {
      loginCheck: true;
      email: string;
      team: string;
      fullname: string;
    };

export type GroupwareIdentity = Extract<
  GroupwareLoginCheckResult,
  { loginCheck: true }
>;

const requiredProfileText = (value: unknown, errorCode: string): string => {
  if (typeof value !== "string") throw new Error(errorCode);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) throw new Error(errorCode);
  return trimmed;
};

export const parseGroupwareLoginCheckResponse = (
  result: LoginCheckResponse,
): GroupwareLoginCheckResult => {
  if (debugEnabled) {
    logger.log(`parse result=${JSON.stringify(result)}`);
  }
  if (result.loginCheck === false) return { loginCheck: false };
  if (result.loginCheck !== true) {
    throw new Error("GROUPWARE_LOGIN_CHECK_INVALID_RESPONSE");
  }
  if (typeof result.id !== "string" || !result.id.trim()) {
    throw new Error("GROUPWARE_ID_INVALID");
  }

  const email = result.id.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("GROUPWARE_ID_INVALID");
  }
  return {
    loginCheck: true,
    email,
    team: requiredProfileText(result.team, "GROUPWARE_TEAM_INVALID"),
    fullname: requiredProfileText(
      result.fullname,
      "GROUPWARE_FULLNAME_INVALID",
    ),
  };
};

export const checkGroupwareToken = async (
  loginToken: string,
): Promise<GroupwareLoginCheckResult> => {
  if (debugEnabled) {
    // loginToken 자체는 자격증명이므로 길이만 남긴다.
    logger.log(
      `request url=${authRuntimeConfig.groupwareLoginCheckUrl} authHeader=${
        authRuntimeConfig.compoundApiAuthToken ? "present" : "absent"
      } loginTokenLength=${loginToken.length}`,
    );
  }

  const response = await fetch(authRuntimeConfig.groupwareLoginCheckUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authRuntimeConfig.compoundApiAuthToken
        ? { Authorization: `Bearer ${authRuntimeConfig.compoundApiAuthToken}` }
        : {}),
    },
    body: JSON.stringify({ login_token: loginToken }),
    signal: AbortSignal.timeout(authRuntimeConfig.groupwareTimeoutMs),
  });

  // 실패 응답의 body에 원인이 담기므로 status 확인 전에 읽어둔다.
  const rawBody = await response.text();
  if (debugEnabled) {
    logger.log(
      `response status=${response.status} body=${rawBody.slice(0, 1000)}`,
    );
  }
  if (!response.ok) throw new Error(`GROUPWARE_LOGIN_CHECK_${response.status}`);

  return parseGroupwareLoginCheckResponse(
    JSON.parse(rawBody) as LoginCheckResponse,
  );
};

export const validateGroupwareToken = async (
  loginToken: string,
): Promise<GroupwareIdentity> => {
  const result = await checkGroupwareToken(loginToken);
  if (!result.loginCheck) throw new Error("GROUPWARE_LOGIN_INVALID");
  return result;
};
