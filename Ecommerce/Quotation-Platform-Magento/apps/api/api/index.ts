// Vercel serverless entry point — deliberately separate from src/main.ts,
// which stays the entry point for Render/local dev (`node dist/main`,
// `nest start`). Vercel calls this file as a request handler; it never
// calls app.listen() itself since Vercel's own runtime owns the HTTP
// server, not Nest.
//
// Imports the COMPILED AppModule (from ../dist, produced by `nest build`
// during Vercel's build step — see vercel.json's buildCommand) rather than
// the raw TypeScript in ../src. NestJS's dependency injection relies on
// emitDecoratorMetadata, which needs the real TypeScript compiler (tsc,
// via Nest CLI) to have run — Vercel's own zero-config bundler for
// serverless functions uses esbuild, which does not reliably reproduce
// that metadata. Routing through the already-compiled JS output sidesteps
// that risk entirely: this file itself has no decorators, so esbuild only
// ever has to bundle plain JS/TS control flow, not Nest's DI metadata.
import type { IncomingMessage, ServerResponse } from 'http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express, { Express } from 'express';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AppModule } = require('../dist/app.module');

// Reused across warm invocations of the same lambda instance — re-running
// NestFactory.create() (which rebuilds the entire DI container) on every
// single request would make every request pay a full cold-start cost.
let cachedServer: Express | null = null;

async function bootstrap(): Promise<Express> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return server;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  cachedServer(req, res);
}
