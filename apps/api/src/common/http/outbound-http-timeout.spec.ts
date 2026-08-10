import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import {
  DEFAULT_OUTBOUND_HTTP_TIMEOUT_MS,
  configureOutboundHttpTimeout,
} from './outbound-http-timeout';

describe('configureOutboundHttpTimeout', () => {
  const previousTimeout = axios.defaults.timeout;

  afterEach(() => {
    axios.defaults.timeout = previousTimeout;
  });

  it('默认把 Axios 外呼最大等待时间限制为 10 秒', () => {
    const result = configureOutboundHttpTimeout();

    expect(result).toBe(DEFAULT_OUTBOUND_HTTP_TIMEOUT_MS);
    expect(axios.defaults.timeout).toBe(DEFAULT_OUTBOUND_HTTP_TIMEOUT_MS);
  });

  it('接受合法生产配置并真实写入 Axios defaults', () => {
    expect(configureOutboundHttpTimeout('15000')).toBe(15_000);
    expect(axios.defaults.timeout).toBe(15_000);
  });

  it.each(['0', '999', '60001', 'abc', '1000.5'])(
    '拒绝无效超时配置 %s',
    (value) => {
      expect(() => configureOutboundHttpTimeout(value)).toThrow(BadRequestException);
    },
  );
});
