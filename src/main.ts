import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  JoinGamePayload,
  PlaceBetPayload,
} from './game/dtos/socket-events.dto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Use CORS_ORIGIN from env or ConfigService for deployment
  const corsOrigin =
    configService.get('CORS_ORIGIN') ||
    process.env.CORS_ORIGIN ||
    'http://localhost:5173';

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Setup Swagger only in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Red Black Game API')
      .setDescription(
        `API documentation for the Red Black Game server.\n\n### Socket.IO Events\n\n| Event     | Payload DTO        | Description         |\n|-----------|--------------------|---------------------|\n| joinGame  | JoinGamePayload    | Join the game       |\n| placeBet  | PlaceBetPayload    | Place a bet         |\n\nSee DTO schemas below for payload details.`,
      )
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      extraModels: [JoinGamePayload, PlaceBetPayload],
    });
    SwaggerModule.setup('api', app, document);
    console.log('Swagger docs available at /api');
  }

  // Use Render's PORT if available
  const port = configService.get('PORT') || process.env.PORT || 5000;
  await app.listen(port);
  console.log(`API server running at http://localhost:${port}`);
}
bootstrap();
