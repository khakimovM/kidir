import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import { DomainExceptionFilter } from "./filters/domain-exception.filter";

/**
 * Cross-cutting request handling every module relies on.
 *
 * The Zod pipe is global so a controller can never accidentally skip
 * validation: raw `req.body` must not reach Prisma. Every DTO is built from a
 * shared schema with `createZodDto` (see .claude/rules/api-design.md).
 */
@Global()
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class CommonModule {}
