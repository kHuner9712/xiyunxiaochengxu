import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let code = -1;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
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

      if (status === HttpStatus.UNAUTHORIZED) {
        code = 40101;
      } else if (status === HttpStatus.FORBIDDEN) {
        code = 40301;
      } else if (status === HttpStatus.NOT_FOUND) {
        code = 40401;
      } else if (status === HttpStatus.BAD_REQUEST) {
        code = 40001;
      } else {
        code = -1;
      }
    }

    response.status(HttpStatus.OK).json({
      code,
      message,
      data: null,
    });
  }
}
