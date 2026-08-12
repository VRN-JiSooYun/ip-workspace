import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("UnhandledException");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // HttpException은 의도적으로 만든 응답이라 조용히 넘긴다. 나머지는 버그이므로
    // 반드시 남긴다. 이게 없으면 500이 "Internal server error" 한 줄로 삼켜져
    // 서버 쪽에 아무 흔적도 남지 않는다.
    if (!(exception instanceof HttpException)) {
      const request = ctx.getRequest<Request>();
      this.logger.error(
        `${request?.method ?? "?"} ${request?.originalUrl ?? "?"} -> 500`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === "string"
        ? exceptionResponse
        : exceptionResponse &&
            typeof exceptionResponse === "object" &&
            "message" in exceptionResponse
          ? (exceptionResponse as { message: string | string[] }).message
          : "Internal server error";
    const detail =
      exceptionResponse &&
      typeof exceptionResponse === "object" &&
      "detail" in exceptionResponse
        ? (exceptionResponse as { detail: unknown }).detail
        : undefined;

    response.status(status).json({
      statusCode: status,
      message,
      ...(detail !== undefined ? { detail } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
