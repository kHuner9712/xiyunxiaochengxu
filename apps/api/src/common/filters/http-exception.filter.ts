import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import {
  ERROR_CODE,
} from '../constants';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let code: number = ERROR_CODE.INTERNAL_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
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
      } else if (exception.getStatus() === HttpStatus.BAD_REQUEST) {
        code = ERROR_CODE.PARAM_ERROR;
      } else if (exception.getStatus() === HttpStatus.UNAUTHORIZED) {
        code = this.mapUnauthorizedCode(message);
      } else if (exception.getStatus() === HttpStatus.FORBIDDEN) {
        code = ERROR_CODE.FORBIDDEN;
      } else if (exception.getStatus() === HttpStatus.NOT_FOUND) {
        code = ERROR_CODE.NOT_FOUND;
      } else {
        code = ERROR_CODE.INTERNAL_ERROR;
      }
    }

    response.status(HttpStatus.OK).json({
      code,
      message,
      data: null,
    });
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
}
