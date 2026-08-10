import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import {
  Observable,
  TimeoutError,
  catchError,
  throwError,
  timeout,
} from "rxjs";
import { SKIP_TIMEOUT_INTERCEPTOR } from "../decorators/skip-timeout.decorator";

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const shouldSkipTimeout = this.reflector.getAllAndOverride<boolean>(
      SKIP_TIMEOUT_INTERCEPTOR,
      [context.getHandler(), context.getClass()],
    );
    if (shouldSkipTimeout) return next.handle();

    const timeoutMs = this.configService.get<number>("httpTimeoutMs", 30000);

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => error);
      }),
    );
  }
}
