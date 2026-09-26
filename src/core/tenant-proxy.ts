import type { PrismaClientLike } from '../types/system';

/**
 * 테넌트 스코프 Prisma 프록시.
 *
 * 스코프 클라이언트로 접근하는 모든 모델은 `tenantId` 컬럼을 가진 테넌트 소유 모델로 취급한다.
 * 격리를 적용할 수 있는 호출만 허용하고, 적용할 수 없는 호출은 원본을 호출하지 않고 예외로 거부한다.
 *
 * 격리 범위는 호출한 모델의 최상위 `where`·`data` 이다. 다음은 적용하지 않는다.
 * - 관계 필드의 중첩 쓰기(`create`·`connect` 등): 거부한다.
 * - `include`·`select` 로 읽는 관계 모델: 적용하지 않는다(부모 레코드의 외래 키로만 연결된다).
 * - 스칼라 외래 키 값(예: `tagId`): 다른 테넌트 레코드를 가리키는지 확인하지 않는다.
 */

/** where 에 tenantId 를 강제하는 조회 메서드 */
const WHERE_READ_METHODS = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
] as const;

/** where 에 tenantId 를 강제하는 삭제 메서드 */
const WHERE_DELETE_METHODS = ['delete', 'deleteMany'] as const;

/** where 에 tenantId 를 강제하고 data 로 테넌트를 바꾸지 못하게 하는 변경 메서드 */
const WHERE_UPDATE_METHODS = ['update', 'updateMany', 'updateManyAndReturn'] as const;

/** data(단일 객체 또는 배열)에 tenantId 를 강제하는 생성 메서드 */
const CREATE_METHODS = ['create', 'createMany', 'createManyAndReturn'] as const;

/** 테넌트 조건을 적용할 수 없어 스코프 클라이언트에서 거부하는 클라이언트 함수 */
const REJECTED_CLIENT_METHODS = [
  '$queryRaw',
  '$queryRawUnsafe',
  '$executeRaw',
  '$executeRawUnsafe',
  '$runCommandRaw',
  '$extends',
  '$use',
] as const;

/**
 * 관계 필드의 중첩 쓰기 연산. 중첩 레코드에는 tenantId 를 적용할 수 없으므로 거부한다.
 * `set` 은 스칼라 필드 갱신 연산이기도 하므로 값이 객체·배열일 때만 관계 연산으로 본다.
 */
const NESTED_WRITE_OPERATIONS = [
  'create',
  'createMany',
  'connect',
  'connectOrCreate',
  'disconnect',
  'delete',
  'deleteMany',
  'update',
  'updateMany',
  'upsert',
] as const;

function includes(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

function isModelDelegate(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).findMany === 'function'
  );
}

function isolationError(target: string): Error {
  return new Error(
    `테넌트 스코프 Prisma 에서 격리를 보장할 수 없는 호출입니다: ${target}`,
  );
}

function withTenantWhere(args: any, tenantId: string): any {
  return { ...args, where: { ...args?.where, tenantId } };
}

function withTenantData(data: any, tenantId: string): any {
  return Array.isArray(data)
    ? data.map((item) => ({ ...item, tenantId }))
    : { ...data, tenantId };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isNestedWriteOperation(key: string, value: unknown): boolean {
  if (key === 'set') return value !== null && typeof value === 'object';
  return includes(NESTED_WRITE_OPERATIONS, key);
}

/**
 * 필드 값이 중첩 쓰기 연산 객체인지 판정한다.
 * Json 컬럼 값의 오탐을 줄이기 위해 모든 키가 중첩 쓰기 연산일 때만 해당한다.
 */
function isNestedWrite(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([key, v]) => isNestedWriteOperation(key, v));
}

/** data(단일 객체 또는 배열)의 필드에 관계 중첩 쓰기가 있으면 거부한다. */
function assertNoNestedWrite(data: unknown, target: string): void {
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    for (const [field, value] of Object.entries(item)) {
      if (isNestedWrite(value)) {
        throw new Error(
          `테넌트 스코프 Prisma 에서 관계 필드의 중첩 쓰기는 격리를 보장할 수 없습니다: ${target}.${field}`,
        );
      }
    }
  }
}

/** 변경 data 가 레코드를 다른 테넌트로 옮기려 하면 거부한다. */
function assertNoTenantChange(data: any, tenantId: string, target: string): void {
  if (!data || typeof data !== 'object') return;
  if ('tenant' in data) {
    throw new Error(`테넌트 스코프 Prisma 에서 tenant 관계를 변경할 수 없습니다: ${target}`);
  }
  if ('tenantId' in data && data.tenantId !== tenantId) {
    throw new Error(`테넌트 스코프 Prisma 에서 다른 테넌트로 옮길 수 없습니다: ${target}`);
  }
}

function createDelegateProxy(
  delegate: Record<string, any>,
  modelName: string,
  tenantId: string,
): Record<string, any> {
  return new Proxy(delegate, {
    get(del, method) {
      const original = del[method as string];
      if (typeof original !== 'function') return original;

      // Symbol·Object.prototype 함수(constructor, toString 등)는 데이터 접근이 아니므로 그대로 둔다.
      if (typeof method === 'symbol' || method in Object.prototype) {
        return original;
      }

      const methodName = String(method);
      const target = `${modelName}.${methodName}`;

      if (includes(WHERE_READ_METHODS, methodName) || includes(WHERE_DELETE_METHODS, methodName)) {
        return (args: any) => original.call(del, withTenantWhere(args, tenantId));
      }

      if (includes(WHERE_UPDATE_METHODS, methodName)) {
        return (args: any) => {
          assertNoTenantChange(args?.data, tenantId, target);
          assertNoNestedWrite(args?.data, target);
          return original.call(del, withTenantWhere(args, tenantId));
        };
      }

      if (includes(CREATE_METHODS, methodName)) {
        return (args: any) => {
          assertNoNestedWrite(args?.data, target);
          return original.call(del, {
            ...args,
            data: withTenantData(args?.data, tenantId),
          });
        };
      }

      if (methodName === 'upsert') {
        return (args: any) => {
          assertNoTenantChange(args?.update, tenantId, target);
          assertNoNestedWrite(args?.create, target);
          assertNoNestedWrite(args?.update, target);
          return original.call(del, {
            ...withTenantWhere(args, tenantId),
            create: withTenantData(args?.create, tenantId),
          });
        };
      }

      // 클라이언트 확장 등으로 추가된 알 수 없는 메서드는 격리를 적용할 수 없다.
      return () => {
        throw isolationError(target);
      };
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
        return (fn: (tx: PrismaClientLike) => Promise<any>, options?: unknown) => {
          // 배열형 트랜잭션은 요소가 스코프 클라이언트에서 만들어졌는지 확인할 수 없다.
          if (typeof fn !== 'function') {
            throw new Error(
              '테넌트 스코프 Prisma 의 $transaction 은 콜백형만 지원합니다. 배열형 트랜잭션은 격리를 보장할 수 없습니다.',
            );
          }
          return (target.$transaction as (...args: unknown[]) => Promise<any>)(
            (tx: PrismaClientLike) => fn(createTenantProxy(tx, tenantId)),
            options,
          );
        };
      }

      const value = target[prop as string];

      if (
        typeof prop === 'string' &&
        typeof value === 'function' &&
        includes(REJECTED_CLIENT_METHODS, prop)
      ) {
        return () => {
          throw isolationError(prop);
        };
      }

      if (isModelDelegate(value)) {
        return createDelegateProxy(value, String(prop), tenantId);
      }

      return value;
    },
  });
}
