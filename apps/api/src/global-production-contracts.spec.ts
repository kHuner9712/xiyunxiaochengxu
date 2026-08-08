import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, relative } from 'path';

const repoRoot = resolve(__dirname, '../../..');

function walk(dir: string, predicate: (path: string) => boolean): string[] {
  const result: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) result.push(...walk(full, predicate));
    else if (predicate(full)) result.push(full);
  }
  return result;
}

function failViolations(title: string, violations: string[]) {
  if (violations.length > 0) {
    throw new Error(`${title}\n${violations.map((item) => `- ${item}`).join('\n')}`);
  }
}

describe('global production API contracts', () => {
  it('does not allow unvalidated controller bodies or compile-time-only Partial DTOs', () => {
    const controllers = walk(resolve(repoRoot, 'apps/api/src'), (path) => path.endsWith('.controller.ts'));
    const violations: string[] = [];
    const forbidden = [
      { label: '@Body() typed as any', regex: /@Body\(\)\s+[A-Za-z_$][\w$]*\s*:\s*any\b/g },
      { label: '@Body() typed as anonymous object', regex: /@Body\(\)\s+[A-Za-z_$][\w$]*\s*:\s*\{/g },
      { label: 'Partial<...Dto> has no runtime validation metadata', regex: /Partial\s*<\s*[A-Za-z_$][\w$]*Dto\s*>/g },
    ];

    for (const file of controllers) {
      const source = readFileSync(file, 'utf8');
      for (const rule of forbidden) {
        if (rule.regex.test(source)) violations.push(`${relative(repoRoot, file)}: ${rule.label}`);
        rule.regex.lastIndex = 0;
      }
    }
    failViolations('Controller runtime-validation regressions found:', violations);
  });

  it('does not parse page/pageSize manually inside controllers', () => {
    const controllers = walk(resolve(repoRoot, 'apps/api/src'), (path) => path.endsWith('.controller.ts'));
    const violations: string[] = [];
    for (const file of controllers) {
      const source = readFileSync(file, 'utf8');
      const manualPagination = /@Query\(\s*['"](?:page|pageSize)['"]\s*\)[\s\S]{0,260}?Number\s*\(/g;
      if (manualPagination.test(source)) {
        violations.push(`${relative(repoRoot, file)}: page/pageSize must use a validated DTO`);
      }
    }
    failViolations('Manual pagination parsing found:', violations);
  });

  it('does not directly BigInt-cast external controller input', () => {
    const controllers = walk(resolve(repoRoot, 'apps/api/src'), (path) => path.endsWith('.controller.ts'));
    const violations: string[] = [];
    for (const file of controllers) {
      const source = readFileSync(file, 'utf8');
      if (/\bBigInt\s*\(/.test(source)) {
        violations.push(`${relative(repoRoot, file)}: use parsePositiveBigIntId in the service/DTO boundary`);
      }
    }
    failViolations('Unsafe BigInt conversion found in controllers:', violations);
  });

  it('keeps database identifiers as strings in admin and mini-program API contracts', () => {
    const roots = [
      resolve(repoRoot, 'apps/admin-web/src/api'),
      resolve(repoRoot, 'apps/miniprogram/src/api'),
    ];
    const violations: string[] = [];
    // Reject number anywhere in an id/xxxId type annotation, including unions such as
    // `string | number`. Also reject ID aliases that hide the same union, e.g.
    // `type Id = string | number` or `type ProductId = string | number`.
    const idTypedWithNumber = /\b(?:id|[A-Za-z][A-Za-z0-9]*Id)\??\s*:\s*[^,;\n)}]*\bnumber\b/g;
    const idAliasWithNumber = /\btype\s+(?:Id|[A-Za-z][A-Za-z0-9]*Id)\s*=\s*[^;\n]*\bnumber\b/g;

    for (const root of roots) {
      const files = walk(root, (path) => /\.(ts|tsx)$/.test(path));
      for (const file of files) {
        const source = readFileSync(file, 'utf8');
        if (idTypedWithNumber.test(source) || idAliasWithNumber.test(source)) {
          violations.push(`${relative(repoRoot, file)}: DB id type contains number; use decimal string only`);
        }
        idTypedWithNumber.lastIndex = 0;
        idAliasWithNumber.lastIndex = 0;
      }
    }
    failViolations('Frontend BIGINT contract regressions found:', violations);
  });
});
