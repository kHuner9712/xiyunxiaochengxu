import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TRANSFORM_SKIP_KEY } from '../decorators/skip-transform.decorator';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof Buffer)) {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = serializeBigInt(obj[key]);
    }
    return result;
  }
  return obj;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const skipTransform = this.reflector.get<boolean>(TRANSFORM_SKIP_KEY, context.getHandler());
    if (skipTransform) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'success',
        data: serializeBigInt(data),
      })),
    );
  }
}
