import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { urlencoded } from "express";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { TimeoutInterceptor } from "./common/interceptors/timeout.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);
  const port = configService.get<number>("port", 3000);
  const corsOrigins = configService.get<string[]>("corsOrigins", []);
  const callbackMaxBodyMb = configService.get<number>(
    "threeDPsa.callbackMaxBodyMb",
    25,
  );

  app.use(
    "/api/calculations/3d-psa/callback",
    urlencoded({
      extended: false,
      limit: `${callbackMaxBodyMb}mb`,
      parameterLimit: 20,
    }),
  );

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new TimeoutInterceptor(configService, app.get(Reflector)),
  );

  await app.listen(port);
}

void bootstrap();
