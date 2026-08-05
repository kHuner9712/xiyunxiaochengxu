import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODE } from '../constants';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost(url = '/api/admin/content') {
  const response: any = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);

  const request = {
    headers: {},
    method: 'POST',
    originalUrl: url,
    url,
  };

  const host: any = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };

  return { host, response };
}

function knownPrismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: '5.22.0',
    meta: { field_name: 'category_id' },
  });
}

describe('HttpExceptionFilter Prisma mapping', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter = new HttpExceptionFilter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a foreign key violation to a clear parameter error', () => {
    const { host, response } = createHost();

    filter.catch(knownPrismaError('P2003'), host);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: ERROR_CODE.PARAM_ERROR,
      message: '关联数据不存在或已失效',
      data: null,
      requestId: expect.any(String),
    }));
  });

  it('maps a unique constraint violation to a conflict response', () => {
    const { host, response } = createHost();

    filter.catch(knownPrismaError('P2002'), host);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: ERROR_CODE.CONFLICT,
      message: '数据已存在，请勿重复提交',
    }));
  });

  it('maps a missing record to a not-found business response', () => {
    const { host, response } = createHost();

    filter.catch(knownPrismaError('P2025'), host);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: ERROR_CODE.NOT_FOUND,
      message: '数据不存在或已被删除',
    }));
  });

  it('keeps unknown exceptions as internal errors', () => {
    const { host, response } = createHost();

    filter.catch(new Error('unexpected'), host);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: ERROR_CODE.INTERNAL_ERROR,
      message: '服务器内部错误',
    }));
  });
});
