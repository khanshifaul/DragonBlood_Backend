import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

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

  // Use Render's PORT if available
  const port = configService.get('PORT') || process.env.PORT || 5000;
  await app.listen(port);
  console.log(`API server running at http://localhost:${port}`);
}
bootstrap();
