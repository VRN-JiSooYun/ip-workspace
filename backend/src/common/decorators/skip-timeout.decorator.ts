import { SetMetadata } from "@nestjs/common";

export const SKIP_TIMEOUT_INTERCEPTOR = "skipTimeoutInterceptor";

export const SkipTimeout = () => SetMetadata(SKIP_TIMEOUT_INTERCEPTOR, true);
