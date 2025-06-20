import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: [
      configService.get('CLIENT_URL') || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://192.168.1.211:5173',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  });

  const port = configService.get('PORT') || 5000;
  await app.listen(port);
  console.log(`API server running at http://localhost:${port}`);
}
bootstrap();
