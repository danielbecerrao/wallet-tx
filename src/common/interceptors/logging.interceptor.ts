import {
  CallHandler,
  ExecutionContext,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { ip?: string }>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`${method} ${url} ${ms}ms - ${req.ip || ''}`);
        },
        error: (err: unknown) => {
          const ms = Date.now() - start;
          this.logger.error(
            `${method} ${url} ${ms}ms - ${req.ip || ''} - ${(err as Error).message}`,
          );
        },
      }),
    );
  }
}
