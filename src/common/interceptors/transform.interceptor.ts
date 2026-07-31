import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Standard API response format
export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    // Get Express response object
    const res = context.switchToHttp().getResponse<ExpressResponse>();

    // Continue request and transform response
    return next.handle().pipe(
      map((data: T): ApiResponse<T> => ({
        // Request successful
        success: true,

        // HTTP status code (200, 201, etc.)
        statusCode: res.statusCode,

        // Controller returned data
        data,

        // Current timestamp
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
