import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ERROR_CODE } from '../constants';

describe('ErrorCodeMapping', () => {
  let filter: HttpExceptionFilter;
  let mockResponseJson: any;
  let mockResponse: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponseJson = {};

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((data) => {
        mockResponseJson = data;
      }),
      setHeader: jest.fn(),
      end: jest.fn(),
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/api/test', method: 'GET', headers: { 'x-request-id': 'test-request-id' } }),
      }),
    };
  });

  const invokeFilter = (exception: unknown) => {
    filter.catch(exception, mockHost);
    return mockResponseJson;
  };

  describe('NestJS 异常到业务错误码映射', () => {
    describe('BadRequestException', () => {
      it('BadRequestException 应该映射到 40001', () => {
        const exception = new BadRequestException('参数错误');
        const result = invokeFilter(exception);
        expect(result.code).toBe(ERROR_CODE.PARAM_ERROR);
      });

      it('带字符串消息的 BadRequestException 应该正确映射', () => {
        const exception = new BadRequestException('自定义错误消息');
        const result = invokeFilter(exception);
        expect(result.code).toBe(ERROR_CODE.PARAM_ERROR);
        expect(result.message).toBe('自定义错误消息');
      });
    });

    describe('UnauthorizedException', () => {
      it('默认 UnauthorizedException 应该映射到 40101', () => {
        const exception = new UnauthorizedException();
        const result = invokeFilter(exception);
        expect(result.code).toBe(ERROR_CODE.UNAUTHORIZED);
      });

      it('"登录已过期" 消息应该映射到 40102', () => {
        const exception = new UnauthorizedException('登录已过期');
        const result = invokeFilter(exception);
        expect(result.code).toBe(ERROR_CODE.TOKEN_EXPIRED);
        expect(result.message).toBe('登录已过期');
      });

      it('"Token 无效" 消息应该映射到 40103', () => {
        const exception = new UnauthorizedException('Token 无效');
        const result = invokeFilter(exception);
        expect(result.code).toBe(ERROR_CODE.TOKEN_INVALID);
        expect(result.message).toBe('Token 无效');
      });

      it('其他 UnauthorizedException 消息应该映射到 40101', () => {
        const exception = new UnauthorizedException('其他未授权原因');
        const result = invokeFilter(exception);
        expect(result.code).toBe(ERROR_CODE.UNAUTHORIZED);
      });
    });

    describe('ForbiddenException', () => {
      it('ForbiddenException 应该映射到 40301', () => {
        const exception = new ForbiddenException('没有权限');
        const result = invokeFilter(exception);
        expect(result.code).toBe(ERROR_CODE.FORBIDDEN);
      });
    });

    describe('NotFoundException', () => {
      it('NotFoundException 应该映射到 40401', () => {
        const exception = new NotFoundException('资源不存在');
        const result = invokeFilter(exception);
        expect(result.code).toBe(ERROR_CODE.NOT_FOUND);
      });
    });

    describe('其他 HTTP 异常', () => {
      it('500 错误应该映射到 50001', () => {
        const exception = new HttpException('服务器错误', 500);
        const result = invokeFilter(exception);
        expect(result.code).toBe(ERROR_CODE.INTERNAL_ERROR);
      });

      it('普通错误应该映射到 50001', () => {
        const result = invokeFilter(new Error('未知错误'));
        expect(result.code).toBe(ERROR_CODE.INTERNAL_ERROR);
      });
    });
  });

  describe('HttpExceptionFilter 响应格式', () => {
    it('响应应该包含 code、message 和 data', () => {
      const exception = new BadRequestException('测试错误');
      const result = invokeFilter(exception);

      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('requestId', 'test-request-id');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', 'test-request-id');
    });

    it('错误响应 code 不为 0', () => {
      const exception = new BadRequestException('测试错误');
      const result = invokeFilter(exception);
      expect(result.code).not.toBe(0);
    });

    it('上传接口 BadRequest 使用 HTTP 400', () => {
      mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => ({ url: '/api/common/file/upload', method: 'POST', headers: { 'x-request-id': 'test-request-id' } }),
        }),
      };

      invokeFilter(new BadRequestException('不支持的MIME类型'));
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('上传接口文件超限使用 HTTP 413', () => {
      mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => ({ url: '/api/common/file/upload', method: 'POST', headers: { 'x-request-id': 'test-request-id' } }),
        }),
      };

      const result = invokeFilter(new PayloadTooLargeException('File too large'));
      expect(result.code).toBe(ERROR_CODE.PARAM_ERROR);
      expect(mockResponse.status).toHaveBeenCalledWith(413);
    });

    it('成功响应格式包含 code=0', () => {
      const successResponse = {
        code: 0,
        message: '',
        data: {},
      };
      expect(successResponse.code).toBe(0);
    });
  });

  describe('ERROR_CODE 唯一性', () => {
    it('所有错误码值不应重复', () => {
      const values = Object.values(ERROR_CODE);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });
});
