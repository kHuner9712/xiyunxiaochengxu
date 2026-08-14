import { readFileSync } from 'fs';
import { resolve } from 'path';

const modulePath = resolve(__dirname, 'content.module.ts');
const apiPath = resolve(__dirname, '../../../admin-web/src/api/content.ts');

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('content production mutation wiring contract', () => {
  it('binds ContentService to the durable mutation provider', () => {
    const text = read(modulePath);

    expect(text).toContain("import { DurableContentMutationService } from './durable-content-mutation.service'");
    expect(text).toContain('{ provide: ContentService, useClass: DurableContentMutationService }');
  });

  it('keeps one pending admin content create request id across ambiguous network failures', () => {
    const text = read(apiPath);

    expect(text).toContain("const PENDING_CONTENT_CREATE_KEY = 'baby_mall_admin_pending_content_create_request_id'");
    expect(text).toContain('const clientRequestId = getOrCreateContentCreateRequestId()');
    expect(text).toContain("request.post('/admin/content', { ...data, clientRequestId })");
    expect(text).toContain('if (status >= 400 && status < 500)');
    expect(text).toContain('clearPendingContentCreateRequestId(clientRequestId)');
    expect(text).not.toContain('finally {\n        clearPendingContentCreateRequestId(clientRequestId)');
  });
});
