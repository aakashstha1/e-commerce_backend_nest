import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

// Catch all exceptions
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  // Logger for error/warning logs
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // Get HTTP request and response objects
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Default error response
    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    // Handle NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;

        // Extract message and error name
        message = (resObj.message as string | string[]) ?? exception.message;
        error = (resObj.error as string) ?? exception.name;
      }
    }

    // Handle Mongoose validation errors
    else if (exception instanceof MongooseError.ValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = Object.values(exception.errors).map((e) => e.message);
      error = 'Validation Error';
    }

    // Handle invalid MongoDB ObjectId errors
    else if (exception instanceof MongooseError.CastError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = `Invalid value for field "${exception.path}"`;
      error = 'Bad Request';
    }

    // Handle MongoDB duplicate key errors
    else if (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as { code?: number }).code === 11000
    ) {
      statusCode = HttpStatus.CONFLICT;

      const keyValue = (exception as { keyValue?: Record<string, unknown> })
        .keyValue;

      message = keyValue
        ? `Duplicate value for field(s): ${Object.keys(keyValue).join(', ')}`
        : 'Duplicate key error';

      error = 'Conflict';
    }

    // Handle normal JavaScript errors
    else if (exception instanceof Error) {
      message = exception.message || message;
      error = exception.name || error;
    }

    // Log server errors (5xx)
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    // Log client errors (4xx)
    else {
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode}`);
    }

    // Send consistent error response
    response.status(statusCode).json({
      success: false,
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
