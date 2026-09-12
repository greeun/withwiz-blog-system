import type { PrismaClientLike } from '../types/system';

const READ_METHODS = ['findMany', 'findFirst', 'findUnique', 'count', 'groupBy'] as const;

const MUTATE_METHODS = ['update', 'delete', 'updateMany', 'deleteMany'] as const;

function isModelDelegate(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).findMany === 'function'
  );
}

function createDelegateProxy(delegate: Record<string, any>, tenantId: string): Record<string, any> {
  return new Proxy(delegate, {
    get(del, method) {
      const original = del[method as string];
      if (typeof original !== 'function') return original;

      const methodName = String(method);

      if ((READ_METHODS as readonly string[]).includes(methodName)) {
        return (args: any) =>
          original.call(del, {
            ...args,
            where: { ...args?.where, tenantId },
          });
      }

      if (methodName === 'create') {
        return (args: any) =>
          original.call(del, {
            ...args,
            data: { ...args?.data, tenantId },
          });
      }

      if ((MUTATE_METHODS as readonly string[]).includes(methodName)) {
        return (args: any) =>
          original.call(del, {
            ...args,
            where: { ...args?.where, tenantId },
          });
      }

      return original.bind(del);
    },
  });
}

export function createTenantProxy(
  prisma: PrismaClientLike,
  tenantId: string,
): PrismaClientLike {
  return new Proxy(prisma, {
    get(target, prop) {
      // 내부 tx 객체에도 동일한 tenantId 프록시를 적용해야 격리가 유지된다
      if (prop === '$transaction') {
        return (fn: (tx: PrismaClientLike) => Promise<any>) =>
          target.$transaction((tx: PrismaClientLike) =>
            fn(createTenantProxy(tx, tenantId)),
          );
      }

      const value = target[prop as string];

      if (isModelDelegate(value)) {
        return createDelegateProxy(value, tenantId);
      }

      return value;
    },
  });
}
