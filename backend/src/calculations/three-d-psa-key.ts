import { randomUUID } from "node:crypto";

export const THREE_D_PSA_UNIQUE_KEY_PREFIX = "workspace-";

const UUID_V4_PATTERN = new RegExp(
  "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
  "i",
);

export const buildThreeDPsaUniqueKey = (
  prefix = THREE_D_PSA_UNIQUE_KEY_PREFIX,
): string => `${prefix}${randomUUID()}`;

export const isSupportedThreeDPsaUniqueKey = (
  value: string,
  prefix = THREE_D_PSA_UNIQUE_KEY_PREFIX,
): boolean => {
  if (UUID_V4_PATTERN.test(value)) return true;
  if (!value.startsWith(prefix)) return false;
  return UUID_V4_PATTERN.test(value.slice(prefix.length));
};
