import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import {
  ERROR_CODE,
} from '../constants';
import { randomUUID } from 'crypto';

interface MappedException {
  code: number;
  message: string;
  httpStatus: number;
}

interface PrismaLikeError extends Error {
  code?: unknown;
  clientVersion?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let code: number = ERROR_CODE.INTERNAL_ERROR;
    let message = '服务器内部错误';
    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    const requestIdHeader = request.headers['x-request-id'] || request.headers['x-correlation-id'];
    const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader || randomUUID();

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message
          ? Array.isArray(resp.message)
            ? resp.message.join('; ')
            : resp.message
          : exception.message;
      }

      if (exception instanceof ThrottlerException) {
        code = ERROR_CODE.THROTTLER;
        message = '请求频率超限，请稍后再试';
      } else if (httpStatus === HttpStatus.BAD_REQUEST || httpStatus === HttpStatus.PAYLOAD_TOO_LARGE) {
        code = ERROR_CODE.PARAM_ERROR;
      } else if (httpStatus === HttpStatus.UNAUTHORIZED) {
        code = this.mapUnauthorizedCode(message);
      } else if (httpStatus === HttpStatus.FORBIDDEN) {
        code = ERROR_CODE.FORBIDDEN;
      } else if (httpStatus === HttpStatus.NOT_FOUND) {
        code = ERROR_CODE.NOT_FOUND;
      } else if (httpStatus === HttpStatus.CONFLICT) {
        code = ERROR_CODE.CONFLICT;
      } else {
        code = ERROR_CODE.INTERNAL_ERROR;
      }
    } else {
      const mappedPrismaError = this.mapPrismaException(exception);
      if (mappedPrismaError) {
        code = mappedPrismaError.code;
        message = mappedPrismaError.message;
        httpStatus = mappedPrismaError.httpStatus;
      }
    }

    response.setHeader('X-Request-Id', requestId);
    if (code >= 50001 && code <= 50099) {
      this.logger.error(
        `requestId=${requestId} ${request.method} ${request.originalUrl || request.url} code=${code} message=${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`requestId=${requestId} ${request.method} ${request.originalUrl || request.url} code=${code} message=${message}`);
    }

    const responseStatus = this.shouldUseUploadHttpStatus(request, httpStatus) ? httpStatus : HttpStatus.OK;
    response.status(responseStatus).json({
      code,
      message,
      data: null,
      requestId,
    });
  }

  private mapPrismaException(exception: unknown): MappedException | null {
    if (!exception || typeof exception !== 'object') return null;

    const prismaError = exception as PrismaLikeError;
    const prismaCode = typeof prismaError.code === 'string' ? prismaError.code : '';
    if (/^P\d{4}$/.test(prismaCode)) {
      switch (prismaCode) {
        case 'P2000':
          return {
            code: ERROR_CODE.PARAM_ERROR,
            message: '提交的数据超过字段长度限制',
            httpStatus: HttpStatus.BAD_REQUEST,
          };
        case 'P2002':
          return {
            code: ERROR_CODE.CONFLICT,
            message: '数据已存在，请勿重复提交',
            httpStatus: HttpStatus.CONFLICT,
          };
        case 'P2003':
          return {
            code: ERROR_CODE.PARAM_ERROR,
            message: '关联数据不存在或已失效',
            httpStatus: HttpStatus.BAD_REQUEST,
          };
        case 'P2011':
        case 'P2012':
        case 'P2013':
          return {
            code: ERROR_CODE.PARAM_ERROR,
            message: '缺少必填数据或字段值无效',
            httpStatus: HttpStatus.BAD_REQUEST,
          };
        case 'P2025':
          return {
            code: ERROR_CODE.NOT_FOUND,
            message: '数据不存在或已被删除',
            httpStatus: HttpStatus.NOT_FOUND,
          };
        default:
          return {
            code: ERROR_CODE.DB_ERROR,
            message: '数据库操作失败，请稍后重试',
            httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
          };
      }
    }

    const errorName = prismaError.constructor?.name || prismaError.name || '';
    if (errorName === 'PrismaClientValidationError') {
      return {
        code: ERROR_CODE.PARAM_ERROR,
        message: '请求数据格式无效',
        httpStatus: HttpStatus.BAD_REQUEST,
      };
    }

    if ([
      'PrismaClientInitializationError',
      'PrismaClientRustPanicError',
      'PrismaClientUnknownRequestError',
    ].includes(errorName)) {
      return {
        code: ERROR_CODE.DB_ERROR,
        message: '数据库服务暂时不可用',
        httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
      };
    }

    return null;
  }

  private mapUnauthorizedCode(message: string): number {
    const msg = message || '';
    if (msg.includes('过期')) {
      return ERROR_CODE.TOKEN_EXPIRED;
    }
    if (msg.includes('无效') || msg.includes('非法') || msg.includes('签名')) {
      return ERROR_CODE.TOKEN_INVALID;
    }
    return ERROR_CODE.UNAUTHORIZED;
  }

  private shouldUseUploadHttpStatus(request: Request, status: number): boolean {
    const url = request.originalUrl || request.url || '';
    return url.includes('/file/upload') && [HttpStatus.BAD_REQUEST, HttpStatus.PAYLOAD_TOO_LARGE].includes(status);
  }
}
