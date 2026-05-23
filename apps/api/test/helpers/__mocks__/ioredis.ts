export default class Redis {
  get = jest.fn().mockResolvedValue(null);
  set = jest.fn().mockResolvedValue('OK');
  del = jest.fn().mockResolvedValue(1);
  ping = jest.fn().mockResolvedValue('PONG');
  exists = jest.fn().mockResolvedValue(0);
  incr = jest.fn().mockResolvedValue(1);
  expire = jest.fn().mockResolvedValue(1);
  setnx = jest.fn().mockResolvedValue(1);
  hset = jest.fn().mockResolvedValue(1);
  hget = jest.fn().mockResolvedValue(null);
  hgetall = jest.fn().mockResolvedValue({});
  keys = jest.fn().mockResolvedValue([]);
  on = jest.fn();
  connect = jest.fn().mockResolvedValue(undefined);
  disconnect = jest.fn();
}
