
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model TCGPlayerCard
 * 
 */
export type TCGPlayerCard = $Result.DefaultSelection<Prisma.$TCGPlayerCardPayload>
/**
 * Model TCGPlayerSet
 * 
 */
export type TCGPlayerSet = $Result.DefaultSelection<Prisma.$TCGPlayerSetPayload>
/**
 * Model TCGPlayerHarvestSession
 * 
 */
export type TCGPlayerHarvestSession = $Result.DefaultSelection<Prisma.$TCGPlayerHarvestSessionPayload>
/**
 * Model TCGPlayerPriceHistory
 * 
 */
export type TCGPlayerPriceHistory = $Result.DefaultSelection<Prisma.$TCGPlayerPriceHistoryPayload>
/**
 * Model TCGPlayerConfiguration
 * 
 */
export type TCGPlayerConfiguration = $Result.DefaultSelection<Prisma.$TCGPlayerConfigurationPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more TCGPlayerCards
 * const tCGPlayerCards = await prisma.tCGPlayerCard.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more TCGPlayerCards
   * const tCGPlayerCards = await prisma.tCGPlayerCard.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.tCGPlayerCard`: Exposes CRUD operations for the **TCGPlayerCard** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TCGPlayerCards
    * const tCGPlayerCards = await prisma.tCGPlayerCard.findMany()
    * ```
    */
  get tCGPlayerCard(): Prisma.TCGPlayerCardDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tCGPlayerSet`: Exposes CRUD operations for the **TCGPlayerSet** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TCGPlayerSets
    * const tCGPlayerSets = await prisma.tCGPlayerSet.findMany()
    * ```
    */
  get tCGPlayerSet(): Prisma.TCGPlayerSetDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tCGPlayerHarvestSession`: Exposes CRUD operations for the **TCGPlayerHarvestSession** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TCGPlayerHarvestSessions
    * const tCGPlayerHarvestSessions = await prisma.tCGPlayerHarvestSession.findMany()
    * ```
    */
  get tCGPlayerHarvestSession(): Prisma.TCGPlayerHarvestSessionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tCGPlayerPriceHistory`: Exposes CRUD operations for the **TCGPlayerPriceHistory** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TCGPlayerPriceHistories
    * const tCGPlayerPriceHistories = await prisma.tCGPlayerPriceHistory.findMany()
    * ```
    */
  get tCGPlayerPriceHistory(): Prisma.TCGPlayerPriceHistoryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tCGPlayerConfiguration`: Exposes CRUD operations for the **TCGPlayerConfiguration** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TCGPlayerConfigurations
    * const tCGPlayerConfigurations = await prisma.tCGPlayerConfiguration.findMany()
    * ```
    */
  get tCGPlayerConfiguration(): Prisma.TCGPlayerConfigurationDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.15.0
   * Query Engine version: 85179d7826409ee107a6ba334b5e305ae3fba9fb
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    TCGPlayerCard: 'TCGPlayerCard',
    TCGPlayerSet: 'TCGPlayerSet',
    TCGPlayerHarvestSession: 'TCGPlayerHarvestSession',
    TCGPlayerPriceHistory: 'TCGPlayerPriceHistory',
    TCGPlayerConfiguration: 'TCGPlayerConfiguration'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "tCGPlayerCard" | "tCGPlayerSet" | "tCGPlayerHarvestSession" | "tCGPlayerPriceHistory" | "tCGPlayerConfiguration"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      TCGPlayerCard: {
        payload: Prisma.$TCGPlayerCardPayload<ExtArgs>
        fields: Prisma.TCGPlayerCardFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TCGPlayerCardFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TCGPlayerCardFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload>
          }
          findFirst: {
            args: Prisma.TCGPlayerCardFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TCGPlayerCardFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload>
          }
          findMany: {
            args: Prisma.TCGPlayerCardFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload>[]
          }
          create: {
            args: Prisma.TCGPlayerCardCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload>
          }
          createMany: {
            args: Prisma.TCGPlayerCardCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TCGPlayerCardCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload>[]
          }
          delete: {
            args: Prisma.TCGPlayerCardDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload>
          }
          update: {
            args: Prisma.TCGPlayerCardUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload>
          }
          deleteMany: {
            args: Prisma.TCGPlayerCardDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TCGPlayerCardUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TCGPlayerCardUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload>[]
          }
          upsert: {
            args: Prisma.TCGPlayerCardUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerCardPayload>
          }
          aggregate: {
            args: Prisma.TCGPlayerCardAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTCGPlayerCard>
          }
          groupBy: {
            args: Prisma.TCGPlayerCardGroupByArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerCardGroupByOutputType>[]
          }
          count: {
            args: Prisma.TCGPlayerCardCountArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerCardCountAggregateOutputType> | number
          }
        }
      }
      TCGPlayerSet: {
        payload: Prisma.$TCGPlayerSetPayload<ExtArgs>
        fields: Prisma.TCGPlayerSetFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TCGPlayerSetFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TCGPlayerSetFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload>
          }
          findFirst: {
            args: Prisma.TCGPlayerSetFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TCGPlayerSetFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload>
          }
          findMany: {
            args: Prisma.TCGPlayerSetFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload>[]
          }
          create: {
            args: Prisma.TCGPlayerSetCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload>
          }
          createMany: {
            args: Prisma.TCGPlayerSetCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TCGPlayerSetCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload>[]
          }
          delete: {
            args: Prisma.TCGPlayerSetDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload>
          }
          update: {
            args: Prisma.TCGPlayerSetUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload>
          }
          deleteMany: {
            args: Prisma.TCGPlayerSetDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TCGPlayerSetUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TCGPlayerSetUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload>[]
          }
          upsert: {
            args: Prisma.TCGPlayerSetUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerSetPayload>
          }
          aggregate: {
            args: Prisma.TCGPlayerSetAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTCGPlayerSet>
          }
          groupBy: {
            args: Prisma.TCGPlayerSetGroupByArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerSetGroupByOutputType>[]
          }
          count: {
            args: Prisma.TCGPlayerSetCountArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerSetCountAggregateOutputType> | number
          }
        }
      }
      TCGPlayerHarvestSession: {
        payload: Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>
        fields: Prisma.TCGPlayerHarvestSessionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TCGPlayerHarvestSessionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TCGPlayerHarvestSessionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload>
          }
          findFirst: {
            args: Prisma.TCGPlayerHarvestSessionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TCGPlayerHarvestSessionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload>
          }
          findMany: {
            args: Prisma.TCGPlayerHarvestSessionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload>[]
          }
          create: {
            args: Prisma.TCGPlayerHarvestSessionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload>
          }
          createMany: {
            args: Prisma.TCGPlayerHarvestSessionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TCGPlayerHarvestSessionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload>[]
          }
          delete: {
            args: Prisma.TCGPlayerHarvestSessionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload>
          }
          update: {
            args: Prisma.TCGPlayerHarvestSessionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload>
          }
          deleteMany: {
            args: Prisma.TCGPlayerHarvestSessionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TCGPlayerHarvestSessionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TCGPlayerHarvestSessionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload>[]
          }
          upsert: {
            args: Prisma.TCGPlayerHarvestSessionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerHarvestSessionPayload>
          }
          aggregate: {
            args: Prisma.TCGPlayerHarvestSessionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTCGPlayerHarvestSession>
          }
          groupBy: {
            args: Prisma.TCGPlayerHarvestSessionGroupByArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerHarvestSessionGroupByOutputType>[]
          }
          count: {
            args: Prisma.TCGPlayerHarvestSessionCountArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerHarvestSessionCountAggregateOutputType> | number
          }
        }
      }
      TCGPlayerPriceHistory: {
        payload: Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>
        fields: Prisma.TCGPlayerPriceHistoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TCGPlayerPriceHistoryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TCGPlayerPriceHistoryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload>
          }
          findFirst: {
            args: Prisma.TCGPlayerPriceHistoryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TCGPlayerPriceHistoryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload>
          }
          findMany: {
            args: Prisma.TCGPlayerPriceHistoryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload>[]
          }
          create: {
            args: Prisma.TCGPlayerPriceHistoryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload>
          }
          createMany: {
            args: Prisma.TCGPlayerPriceHistoryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TCGPlayerPriceHistoryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload>[]
          }
          delete: {
            args: Prisma.TCGPlayerPriceHistoryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload>
          }
          update: {
            args: Prisma.TCGPlayerPriceHistoryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload>
          }
          deleteMany: {
            args: Prisma.TCGPlayerPriceHistoryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TCGPlayerPriceHistoryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TCGPlayerPriceHistoryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload>[]
          }
          upsert: {
            args: Prisma.TCGPlayerPriceHistoryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerPriceHistoryPayload>
          }
          aggregate: {
            args: Prisma.TCGPlayerPriceHistoryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTCGPlayerPriceHistory>
          }
          groupBy: {
            args: Prisma.TCGPlayerPriceHistoryGroupByArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerPriceHistoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.TCGPlayerPriceHistoryCountArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerPriceHistoryCountAggregateOutputType> | number
          }
        }
      }
      TCGPlayerConfiguration: {
        payload: Prisma.$TCGPlayerConfigurationPayload<ExtArgs>
        fields: Prisma.TCGPlayerConfigurationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TCGPlayerConfigurationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TCGPlayerConfigurationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload>
          }
          findFirst: {
            args: Prisma.TCGPlayerConfigurationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TCGPlayerConfigurationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload>
          }
          findMany: {
            args: Prisma.TCGPlayerConfigurationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload>[]
          }
          create: {
            args: Prisma.TCGPlayerConfigurationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload>
          }
          createMany: {
            args: Prisma.TCGPlayerConfigurationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TCGPlayerConfigurationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload>[]
          }
          delete: {
            args: Prisma.TCGPlayerConfigurationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload>
          }
          update: {
            args: Prisma.TCGPlayerConfigurationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload>
          }
          deleteMany: {
            args: Prisma.TCGPlayerConfigurationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TCGPlayerConfigurationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TCGPlayerConfigurationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload>[]
          }
          upsert: {
            args: Prisma.TCGPlayerConfigurationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TCGPlayerConfigurationPayload>
          }
          aggregate: {
            args: Prisma.TCGPlayerConfigurationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTCGPlayerConfiguration>
          }
          groupBy: {
            args: Prisma.TCGPlayerConfigurationGroupByArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerConfigurationGroupByOutputType>[]
          }
          count: {
            args: Prisma.TCGPlayerConfigurationCountArgs<ExtArgs>
            result: $Utils.Optional<TCGPlayerConfigurationCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    tCGPlayerCard?: TCGPlayerCardOmit
    tCGPlayerSet?: TCGPlayerSetOmit
    tCGPlayerHarvestSession?: TCGPlayerHarvestSessionOmit
    tCGPlayerPriceHistory?: TCGPlayerPriceHistoryOmit
    tCGPlayerConfiguration?: TCGPlayerConfigurationOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model TCGPlayerCard
   */

  export type AggregateTCGPlayerCard = {
    _count: TCGPlayerCardCountAggregateOutputType | null
    _avg: TCGPlayerCardAvgAggregateOutputType | null
    _sum: TCGPlayerCardSumAggregateOutputType | null
    _min: TCGPlayerCardMinAggregateOutputType | null
    _max: TCGPlayerCardMaxAggregateOutputType | null
  }

  export type TCGPlayerCardAvgAggregateOutputType = {
    rarityWeight: number | null
    currentPrice: number | null
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    listingCount: number | null
    totalListings: number | null
    page: number | null
  }

  export type TCGPlayerCardSumAggregateOutputType = {
    rarityWeight: number | null
    currentPrice: number | null
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    listingCount: number | null
    totalListings: number | null
    page: number | null
  }

  export type TCGPlayerCardMinAggregateOutputType = {
    id: string | null
    externalId: string | null
    source: string | null
    name: string | null
    cleanedName: string | null
    setName: string | null
    setUrl: string | null
    rarity: string | null
    rarityWeight: number | null
    cardType: string | null
    cardNumber: string | null
    category: string | null
    menuCategory: string | null
    productUrl: string | null
    imageUrl: string | null
    tcgplayerUrl: string | null
    currentPrice: number | null
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    priceRange: string | null
    listingCount: number | null
    priceText: string | null
    inStock: boolean | null
    sellable: boolean | null
    totalListings: number | null
    page: number | null
    extractedAt: Date | null
    lastUpdated: Date | null
    harvestSessionId: string | null
    rawProductData: string | null
  }

  export type TCGPlayerCardMaxAggregateOutputType = {
    id: string | null
    externalId: string | null
    source: string | null
    name: string | null
    cleanedName: string | null
    setName: string | null
    setUrl: string | null
    rarity: string | null
    rarityWeight: number | null
    cardType: string | null
    cardNumber: string | null
    category: string | null
    menuCategory: string | null
    productUrl: string | null
    imageUrl: string | null
    tcgplayerUrl: string | null
    currentPrice: number | null
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    priceRange: string | null
    listingCount: number | null
    priceText: string | null
    inStock: boolean | null
    sellable: boolean | null
    totalListings: number | null
    page: number | null
    extractedAt: Date | null
    lastUpdated: Date | null
    harvestSessionId: string | null
    rawProductData: string | null
  }

  export type TCGPlayerCardCountAggregateOutputType = {
    id: number
    externalId: number
    source: number
    name: number
    cleanedName: number
    setName: number
    setUrl: number
    rarity: number
    rarityWeight: number
    cardType: number
    cardNumber: number
    category: number
    menuCategory: number
    productUrl: number
    imageUrl: number
    tcgplayerUrl: number
    currentPrice: number
    marketPrice: number
    lowPrice: number
    midPrice: number
    highPrice: number
    priceRange: number
    listingCount: number
    priceText: number
    inStock: number
    sellable: number
    totalListings: number
    page: number
    extractedAt: number
    lastUpdated: number
    harvestSessionId: number
    rawProductData: number
    _all: number
  }


  export type TCGPlayerCardAvgAggregateInputType = {
    rarityWeight?: true
    currentPrice?: true
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    listingCount?: true
    totalListings?: true
    page?: true
  }

  export type TCGPlayerCardSumAggregateInputType = {
    rarityWeight?: true
    currentPrice?: true
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    listingCount?: true
    totalListings?: true
    page?: true
  }

  export type TCGPlayerCardMinAggregateInputType = {
    id?: true
    externalId?: true
    source?: true
    name?: true
    cleanedName?: true
    setName?: true
    setUrl?: true
    rarity?: true
    rarityWeight?: true
    cardType?: true
    cardNumber?: true
    category?: true
    menuCategory?: true
    productUrl?: true
    imageUrl?: true
    tcgplayerUrl?: true
    currentPrice?: true
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    priceRange?: true
    listingCount?: true
    priceText?: true
    inStock?: true
    sellable?: true
    totalListings?: true
    page?: true
    extractedAt?: true
    lastUpdated?: true
    harvestSessionId?: true
    rawProductData?: true
  }

  export type TCGPlayerCardMaxAggregateInputType = {
    id?: true
    externalId?: true
    source?: true
    name?: true
    cleanedName?: true
    setName?: true
    setUrl?: true
    rarity?: true
    rarityWeight?: true
    cardType?: true
    cardNumber?: true
    category?: true
    menuCategory?: true
    productUrl?: true
    imageUrl?: true
    tcgplayerUrl?: true
    currentPrice?: true
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    priceRange?: true
    listingCount?: true
    priceText?: true
    inStock?: true
    sellable?: true
    totalListings?: true
    page?: true
    extractedAt?: true
    lastUpdated?: true
    harvestSessionId?: true
    rawProductData?: true
  }

  export type TCGPlayerCardCountAggregateInputType = {
    id?: true
    externalId?: true
    source?: true
    name?: true
    cleanedName?: true
    setName?: true
    setUrl?: true
    rarity?: true
    rarityWeight?: true
    cardType?: true
    cardNumber?: true
    category?: true
    menuCategory?: true
    productUrl?: true
    imageUrl?: true
    tcgplayerUrl?: true
    currentPrice?: true
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    priceRange?: true
    listingCount?: true
    priceText?: true
    inStock?: true
    sellable?: true
    totalListings?: true
    page?: true
    extractedAt?: true
    lastUpdated?: true
    harvestSessionId?: true
    rawProductData?: true
    _all?: true
  }

  export type TCGPlayerCardAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerCard to aggregate.
     */
    where?: TCGPlayerCardWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerCards to fetch.
     */
    orderBy?: TCGPlayerCardOrderByWithRelationInput | TCGPlayerCardOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TCGPlayerCardWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerCards from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerCards.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TCGPlayerCards
    **/
    _count?: true | TCGPlayerCardCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TCGPlayerCardAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TCGPlayerCardSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TCGPlayerCardMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TCGPlayerCardMaxAggregateInputType
  }

  export type GetTCGPlayerCardAggregateType<T extends TCGPlayerCardAggregateArgs> = {
        [P in keyof T & keyof AggregateTCGPlayerCard]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTCGPlayerCard[P]>
      : GetScalarType<T[P], AggregateTCGPlayerCard[P]>
  }




  export type TCGPlayerCardGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TCGPlayerCardWhereInput
    orderBy?: TCGPlayerCardOrderByWithAggregationInput | TCGPlayerCardOrderByWithAggregationInput[]
    by: TCGPlayerCardScalarFieldEnum[] | TCGPlayerCardScalarFieldEnum
    having?: TCGPlayerCardScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TCGPlayerCardCountAggregateInputType | true
    _avg?: TCGPlayerCardAvgAggregateInputType
    _sum?: TCGPlayerCardSumAggregateInputType
    _min?: TCGPlayerCardMinAggregateInputType
    _max?: TCGPlayerCardMaxAggregateInputType
  }

  export type TCGPlayerCardGroupByOutputType = {
    id: string
    externalId: string
    source: string
    name: string
    cleanedName: string | null
    setName: string
    setUrl: string | null
    rarity: string | null
    rarityWeight: number | null
    cardType: string | null
    cardNumber: string | null
    category: string
    menuCategory: string | null
    productUrl: string | null
    imageUrl: string | null
    tcgplayerUrl: string | null
    currentPrice: number | null
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    priceRange: string | null
    listingCount: number | null
    priceText: string | null
    inStock: boolean
    sellable: boolean
    totalListings: number | null
    page: number | null
    extractedAt: Date
    lastUpdated: Date
    harvestSessionId: string | null
    rawProductData: string | null
    _count: TCGPlayerCardCountAggregateOutputType | null
    _avg: TCGPlayerCardAvgAggregateOutputType | null
    _sum: TCGPlayerCardSumAggregateOutputType | null
    _min: TCGPlayerCardMinAggregateOutputType | null
    _max: TCGPlayerCardMaxAggregateOutputType | null
  }

  type GetTCGPlayerCardGroupByPayload<T extends TCGPlayerCardGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TCGPlayerCardGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TCGPlayerCardGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TCGPlayerCardGroupByOutputType[P]>
            : GetScalarType<T[P], TCGPlayerCardGroupByOutputType[P]>
        }
      >
    >


  export type TCGPlayerCardSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    externalId?: boolean
    source?: boolean
    name?: boolean
    cleanedName?: boolean
    setName?: boolean
    setUrl?: boolean
    rarity?: boolean
    rarityWeight?: boolean
    cardType?: boolean
    cardNumber?: boolean
    category?: boolean
    menuCategory?: boolean
    productUrl?: boolean
    imageUrl?: boolean
    tcgplayerUrl?: boolean
    currentPrice?: boolean
    marketPrice?: boolean
    lowPrice?: boolean
    midPrice?: boolean
    highPrice?: boolean
    priceRange?: boolean
    listingCount?: boolean
    priceText?: boolean
    inStock?: boolean
    sellable?: boolean
    totalListings?: boolean
    page?: boolean
    extractedAt?: boolean
    lastUpdated?: boolean
    harvestSessionId?: boolean
    rawProductData?: boolean
  }, ExtArgs["result"]["tCGPlayerCard"]>

  export type TCGPlayerCardSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    externalId?: boolean
    source?: boolean
    name?: boolean
    cleanedName?: boolean
    setName?: boolean
    setUrl?: boolean
    rarity?: boolean
    rarityWeight?: boolean
    cardType?: boolean
    cardNumber?: boolean
    category?: boolean
    menuCategory?: boolean
    productUrl?: boolean
    imageUrl?: boolean
    tcgplayerUrl?: boolean
    currentPrice?: boolean
    marketPrice?: boolean
    lowPrice?: boolean
    midPrice?: boolean
    highPrice?: boolean
    priceRange?: boolean
    listingCount?: boolean
    priceText?: boolean
    inStock?: boolean
    sellable?: boolean
    totalListings?: boolean
    page?: boolean
    extractedAt?: boolean
    lastUpdated?: boolean
    harvestSessionId?: boolean
    rawProductData?: boolean
  }, ExtArgs["result"]["tCGPlayerCard"]>

  export type TCGPlayerCardSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    externalId?: boolean
    source?: boolean
    name?: boolean
    cleanedName?: boolean
    setName?: boolean
    setUrl?: boolean
    rarity?: boolean
    rarityWeight?: boolean
    cardType?: boolean
    cardNumber?: boolean
    category?: boolean
    menuCategory?: boolean
    productUrl?: boolean
    imageUrl?: boolean
    tcgplayerUrl?: boolean
    currentPrice?: boolean
    marketPrice?: boolean
    lowPrice?: boolean
    midPrice?: boolean
    highPrice?: boolean
    priceRange?: boolean
    listingCount?: boolean
    priceText?: boolean
    inStock?: boolean
    sellable?: boolean
    totalListings?: boolean
    page?: boolean
    extractedAt?: boolean
    lastUpdated?: boolean
    harvestSessionId?: boolean
    rawProductData?: boolean
  }, ExtArgs["result"]["tCGPlayerCard"]>

  export type TCGPlayerCardSelectScalar = {
    id?: boolean
    externalId?: boolean
    source?: boolean
    name?: boolean
    cleanedName?: boolean
    setName?: boolean
    setUrl?: boolean
    rarity?: boolean
    rarityWeight?: boolean
    cardType?: boolean
    cardNumber?: boolean
    category?: boolean
    menuCategory?: boolean
    productUrl?: boolean
    imageUrl?: boolean
    tcgplayerUrl?: boolean
    currentPrice?: boolean
    marketPrice?: boolean
    lowPrice?: boolean
    midPrice?: boolean
    highPrice?: boolean
    priceRange?: boolean
    listingCount?: boolean
    priceText?: boolean
    inStock?: boolean
    sellable?: boolean
    totalListings?: boolean
    page?: boolean
    extractedAt?: boolean
    lastUpdated?: boolean
    harvestSessionId?: boolean
    rawProductData?: boolean
  }

  export type TCGPlayerCardOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "externalId" | "source" | "name" | "cleanedName" | "setName" | "setUrl" | "rarity" | "rarityWeight" | "cardType" | "cardNumber" | "category" | "menuCategory" | "productUrl" | "imageUrl" | "tcgplayerUrl" | "currentPrice" | "marketPrice" | "lowPrice" | "midPrice" | "highPrice" | "priceRange" | "listingCount" | "priceText" | "inStock" | "sellable" | "totalListings" | "page" | "extractedAt" | "lastUpdated" | "harvestSessionId" | "rawProductData", ExtArgs["result"]["tCGPlayerCard"]>

  export type $TCGPlayerCardPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TCGPlayerCard"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      externalId: string
      source: string
      name: string
      cleanedName: string | null
      setName: string
      setUrl: string | null
      rarity: string | null
      rarityWeight: number | null
      cardType: string | null
      cardNumber: string | null
      category: string
      menuCategory: string | null
      productUrl: string | null
      imageUrl: string | null
      tcgplayerUrl: string | null
      currentPrice: number | null
      marketPrice: number | null
      lowPrice: number | null
      midPrice: number | null
      highPrice: number | null
      priceRange: string | null
      listingCount: number | null
      priceText: string | null
      inStock: boolean
      sellable: boolean
      totalListings: number | null
      page: number | null
      extractedAt: Date
      lastUpdated: Date
      harvestSessionId: string | null
      rawProductData: string | null
    }, ExtArgs["result"]["tCGPlayerCard"]>
    composites: {}
  }

  type TCGPlayerCardGetPayload<S extends boolean | null | undefined | TCGPlayerCardDefaultArgs> = $Result.GetResult<Prisma.$TCGPlayerCardPayload, S>

  type TCGPlayerCardCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TCGPlayerCardFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TCGPlayerCardCountAggregateInputType | true
    }

  export interface TCGPlayerCardDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TCGPlayerCard'], meta: { name: 'TCGPlayerCard' } }
    /**
     * Find zero or one TCGPlayerCard that matches the filter.
     * @param {TCGPlayerCardFindUniqueArgs} args - Arguments to find a TCGPlayerCard
     * @example
     * // Get one TCGPlayerCard
     * const tCGPlayerCard = await prisma.tCGPlayerCard.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TCGPlayerCardFindUniqueArgs>(args: SelectSubset<T, TCGPlayerCardFindUniqueArgs<ExtArgs>>): Prisma__TCGPlayerCardClient<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TCGPlayerCard that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TCGPlayerCardFindUniqueOrThrowArgs} args - Arguments to find a TCGPlayerCard
     * @example
     * // Get one TCGPlayerCard
     * const tCGPlayerCard = await prisma.tCGPlayerCard.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TCGPlayerCardFindUniqueOrThrowArgs>(args: SelectSubset<T, TCGPlayerCardFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerCardClient<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerCard that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerCardFindFirstArgs} args - Arguments to find a TCGPlayerCard
     * @example
     * // Get one TCGPlayerCard
     * const tCGPlayerCard = await prisma.tCGPlayerCard.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TCGPlayerCardFindFirstArgs>(args?: SelectSubset<T, TCGPlayerCardFindFirstArgs<ExtArgs>>): Prisma__TCGPlayerCardClient<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerCard that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerCardFindFirstOrThrowArgs} args - Arguments to find a TCGPlayerCard
     * @example
     * // Get one TCGPlayerCard
     * const tCGPlayerCard = await prisma.tCGPlayerCard.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TCGPlayerCardFindFirstOrThrowArgs>(args?: SelectSubset<T, TCGPlayerCardFindFirstOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerCardClient<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TCGPlayerCards that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerCardFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TCGPlayerCards
     * const tCGPlayerCards = await prisma.tCGPlayerCard.findMany()
     * 
     * // Get first 10 TCGPlayerCards
     * const tCGPlayerCards = await prisma.tCGPlayerCard.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tCGPlayerCardWithIdOnly = await prisma.tCGPlayerCard.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TCGPlayerCardFindManyArgs>(args?: SelectSubset<T, TCGPlayerCardFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TCGPlayerCard.
     * @param {TCGPlayerCardCreateArgs} args - Arguments to create a TCGPlayerCard.
     * @example
     * // Create one TCGPlayerCard
     * const TCGPlayerCard = await prisma.tCGPlayerCard.create({
     *   data: {
     *     // ... data to create a TCGPlayerCard
     *   }
     * })
     * 
     */
    create<T extends TCGPlayerCardCreateArgs>(args: SelectSubset<T, TCGPlayerCardCreateArgs<ExtArgs>>): Prisma__TCGPlayerCardClient<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TCGPlayerCards.
     * @param {TCGPlayerCardCreateManyArgs} args - Arguments to create many TCGPlayerCards.
     * @example
     * // Create many TCGPlayerCards
     * const tCGPlayerCard = await prisma.tCGPlayerCard.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TCGPlayerCardCreateManyArgs>(args?: SelectSubset<T, TCGPlayerCardCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TCGPlayerCards and returns the data saved in the database.
     * @param {TCGPlayerCardCreateManyAndReturnArgs} args - Arguments to create many TCGPlayerCards.
     * @example
     * // Create many TCGPlayerCards
     * const tCGPlayerCard = await prisma.tCGPlayerCard.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TCGPlayerCards and only return the `id`
     * const tCGPlayerCardWithIdOnly = await prisma.tCGPlayerCard.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TCGPlayerCardCreateManyAndReturnArgs>(args?: SelectSubset<T, TCGPlayerCardCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TCGPlayerCard.
     * @param {TCGPlayerCardDeleteArgs} args - Arguments to delete one TCGPlayerCard.
     * @example
     * // Delete one TCGPlayerCard
     * const TCGPlayerCard = await prisma.tCGPlayerCard.delete({
     *   where: {
     *     // ... filter to delete one TCGPlayerCard
     *   }
     * })
     * 
     */
    delete<T extends TCGPlayerCardDeleteArgs>(args: SelectSubset<T, TCGPlayerCardDeleteArgs<ExtArgs>>): Prisma__TCGPlayerCardClient<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TCGPlayerCard.
     * @param {TCGPlayerCardUpdateArgs} args - Arguments to update one TCGPlayerCard.
     * @example
     * // Update one TCGPlayerCard
     * const tCGPlayerCard = await prisma.tCGPlayerCard.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TCGPlayerCardUpdateArgs>(args: SelectSubset<T, TCGPlayerCardUpdateArgs<ExtArgs>>): Prisma__TCGPlayerCardClient<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TCGPlayerCards.
     * @param {TCGPlayerCardDeleteManyArgs} args - Arguments to filter TCGPlayerCards to delete.
     * @example
     * // Delete a few TCGPlayerCards
     * const { count } = await prisma.tCGPlayerCard.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TCGPlayerCardDeleteManyArgs>(args?: SelectSubset<T, TCGPlayerCardDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerCards.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerCardUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TCGPlayerCards
     * const tCGPlayerCard = await prisma.tCGPlayerCard.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TCGPlayerCardUpdateManyArgs>(args: SelectSubset<T, TCGPlayerCardUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerCards and returns the data updated in the database.
     * @param {TCGPlayerCardUpdateManyAndReturnArgs} args - Arguments to update many TCGPlayerCards.
     * @example
     * // Update many TCGPlayerCards
     * const tCGPlayerCard = await prisma.tCGPlayerCard.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TCGPlayerCards and only return the `id`
     * const tCGPlayerCardWithIdOnly = await prisma.tCGPlayerCard.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TCGPlayerCardUpdateManyAndReturnArgs>(args: SelectSubset<T, TCGPlayerCardUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TCGPlayerCard.
     * @param {TCGPlayerCardUpsertArgs} args - Arguments to update or create a TCGPlayerCard.
     * @example
     * // Update or create a TCGPlayerCard
     * const tCGPlayerCard = await prisma.tCGPlayerCard.upsert({
     *   create: {
     *     // ... data to create a TCGPlayerCard
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TCGPlayerCard we want to update
     *   }
     * })
     */
    upsert<T extends TCGPlayerCardUpsertArgs>(args: SelectSubset<T, TCGPlayerCardUpsertArgs<ExtArgs>>): Prisma__TCGPlayerCardClient<$Result.GetResult<Prisma.$TCGPlayerCardPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TCGPlayerCards.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerCardCountArgs} args - Arguments to filter TCGPlayerCards to count.
     * @example
     * // Count the number of TCGPlayerCards
     * const count = await prisma.tCGPlayerCard.count({
     *   where: {
     *     // ... the filter for the TCGPlayerCards we want to count
     *   }
     * })
    **/
    count<T extends TCGPlayerCardCountArgs>(
      args?: Subset<T, TCGPlayerCardCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TCGPlayerCardCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TCGPlayerCard.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerCardAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TCGPlayerCardAggregateArgs>(args: Subset<T, TCGPlayerCardAggregateArgs>): Prisma.PrismaPromise<GetTCGPlayerCardAggregateType<T>>

    /**
     * Group by TCGPlayerCard.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerCardGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TCGPlayerCardGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TCGPlayerCardGroupByArgs['orderBy'] }
        : { orderBy?: TCGPlayerCardGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TCGPlayerCardGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTCGPlayerCardGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TCGPlayerCard model
   */
  readonly fields: TCGPlayerCardFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TCGPlayerCard.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TCGPlayerCardClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TCGPlayerCard model
   */
  interface TCGPlayerCardFieldRefs {
    readonly id: FieldRef<"TCGPlayerCard", 'String'>
    readonly externalId: FieldRef<"TCGPlayerCard", 'String'>
    readonly source: FieldRef<"TCGPlayerCard", 'String'>
    readonly name: FieldRef<"TCGPlayerCard", 'String'>
    readonly cleanedName: FieldRef<"TCGPlayerCard", 'String'>
    readonly setName: FieldRef<"TCGPlayerCard", 'String'>
    readonly setUrl: FieldRef<"TCGPlayerCard", 'String'>
    readonly rarity: FieldRef<"TCGPlayerCard", 'String'>
    readonly rarityWeight: FieldRef<"TCGPlayerCard", 'Int'>
    readonly cardType: FieldRef<"TCGPlayerCard", 'String'>
    readonly cardNumber: FieldRef<"TCGPlayerCard", 'String'>
    readonly category: FieldRef<"TCGPlayerCard", 'String'>
    readonly menuCategory: FieldRef<"TCGPlayerCard", 'String'>
    readonly productUrl: FieldRef<"TCGPlayerCard", 'String'>
    readonly imageUrl: FieldRef<"TCGPlayerCard", 'String'>
    readonly tcgplayerUrl: FieldRef<"TCGPlayerCard", 'String'>
    readonly currentPrice: FieldRef<"TCGPlayerCard", 'Float'>
    readonly marketPrice: FieldRef<"TCGPlayerCard", 'Float'>
    readonly lowPrice: FieldRef<"TCGPlayerCard", 'Float'>
    readonly midPrice: FieldRef<"TCGPlayerCard", 'Float'>
    readonly highPrice: FieldRef<"TCGPlayerCard", 'Float'>
    readonly priceRange: FieldRef<"TCGPlayerCard", 'String'>
    readonly listingCount: FieldRef<"TCGPlayerCard", 'Int'>
    readonly priceText: FieldRef<"TCGPlayerCard", 'String'>
    readonly inStock: FieldRef<"TCGPlayerCard", 'Boolean'>
    readonly sellable: FieldRef<"TCGPlayerCard", 'Boolean'>
    readonly totalListings: FieldRef<"TCGPlayerCard", 'Int'>
    readonly page: FieldRef<"TCGPlayerCard", 'Int'>
    readonly extractedAt: FieldRef<"TCGPlayerCard", 'DateTime'>
    readonly lastUpdated: FieldRef<"TCGPlayerCard", 'DateTime'>
    readonly harvestSessionId: FieldRef<"TCGPlayerCard", 'String'>
    readonly rawProductData: FieldRef<"TCGPlayerCard", 'String'>
  }
    

  // Custom InputTypes
  /**
   * TCGPlayerCard findUnique
   */
  export type TCGPlayerCardFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerCard to fetch.
     */
    where: TCGPlayerCardWhereUniqueInput
  }

  /**
   * TCGPlayerCard findUniqueOrThrow
   */
  export type TCGPlayerCardFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerCard to fetch.
     */
    where: TCGPlayerCardWhereUniqueInput
  }

  /**
   * TCGPlayerCard findFirst
   */
  export type TCGPlayerCardFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerCard to fetch.
     */
    where?: TCGPlayerCardWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerCards to fetch.
     */
    orderBy?: TCGPlayerCardOrderByWithRelationInput | TCGPlayerCardOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerCards.
     */
    cursor?: TCGPlayerCardWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerCards from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerCards.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerCards.
     */
    distinct?: TCGPlayerCardScalarFieldEnum | TCGPlayerCardScalarFieldEnum[]
  }

  /**
   * TCGPlayerCard findFirstOrThrow
   */
  export type TCGPlayerCardFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerCard to fetch.
     */
    where?: TCGPlayerCardWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerCards to fetch.
     */
    orderBy?: TCGPlayerCardOrderByWithRelationInput | TCGPlayerCardOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerCards.
     */
    cursor?: TCGPlayerCardWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerCards from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerCards.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerCards.
     */
    distinct?: TCGPlayerCardScalarFieldEnum | TCGPlayerCardScalarFieldEnum[]
  }

  /**
   * TCGPlayerCard findMany
   */
  export type TCGPlayerCardFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerCards to fetch.
     */
    where?: TCGPlayerCardWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerCards to fetch.
     */
    orderBy?: TCGPlayerCardOrderByWithRelationInput | TCGPlayerCardOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TCGPlayerCards.
     */
    cursor?: TCGPlayerCardWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerCards from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerCards.
     */
    skip?: number
    distinct?: TCGPlayerCardScalarFieldEnum | TCGPlayerCardScalarFieldEnum[]
  }

  /**
   * TCGPlayerCard create
   */
  export type TCGPlayerCardCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * The data needed to create a TCGPlayerCard.
     */
    data: XOR<TCGPlayerCardCreateInput, TCGPlayerCardUncheckedCreateInput>
  }

  /**
   * TCGPlayerCard createMany
   */
  export type TCGPlayerCardCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TCGPlayerCards.
     */
    data: TCGPlayerCardCreateManyInput | TCGPlayerCardCreateManyInput[]
  }

  /**
   * TCGPlayerCard createManyAndReturn
   */
  export type TCGPlayerCardCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * The data used to create many TCGPlayerCards.
     */
    data: TCGPlayerCardCreateManyInput | TCGPlayerCardCreateManyInput[]
  }

  /**
   * TCGPlayerCard update
   */
  export type TCGPlayerCardUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * The data needed to update a TCGPlayerCard.
     */
    data: XOR<TCGPlayerCardUpdateInput, TCGPlayerCardUncheckedUpdateInput>
    /**
     * Choose, which TCGPlayerCard to update.
     */
    where: TCGPlayerCardWhereUniqueInput
  }

  /**
   * TCGPlayerCard updateMany
   */
  export type TCGPlayerCardUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TCGPlayerCards.
     */
    data: XOR<TCGPlayerCardUpdateManyMutationInput, TCGPlayerCardUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerCards to update
     */
    where?: TCGPlayerCardWhereInput
    /**
     * Limit how many TCGPlayerCards to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerCard updateManyAndReturn
   */
  export type TCGPlayerCardUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * The data used to update TCGPlayerCards.
     */
    data: XOR<TCGPlayerCardUpdateManyMutationInput, TCGPlayerCardUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerCards to update
     */
    where?: TCGPlayerCardWhereInput
    /**
     * Limit how many TCGPlayerCards to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerCard upsert
   */
  export type TCGPlayerCardUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * The filter to search for the TCGPlayerCard to update in case it exists.
     */
    where: TCGPlayerCardWhereUniqueInput
    /**
     * In case the TCGPlayerCard found by the `where` argument doesn't exist, create a new TCGPlayerCard with this data.
     */
    create: XOR<TCGPlayerCardCreateInput, TCGPlayerCardUncheckedCreateInput>
    /**
     * In case the TCGPlayerCard was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TCGPlayerCardUpdateInput, TCGPlayerCardUncheckedUpdateInput>
  }

  /**
   * TCGPlayerCard delete
   */
  export type TCGPlayerCardDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
    /**
     * Filter which TCGPlayerCard to delete.
     */
    where: TCGPlayerCardWhereUniqueInput
  }

  /**
   * TCGPlayerCard deleteMany
   */
  export type TCGPlayerCardDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerCards to delete
     */
    where?: TCGPlayerCardWhereInput
    /**
     * Limit how many TCGPlayerCards to delete.
     */
    limit?: number
  }

  /**
   * TCGPlayerCard without action
   */
  export type TCGPlayerCardDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerCard
     */
    select?: TCGPlayerCardSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerCard
     */
    omit?: TCGPlayerCardOmit<ExtArgs> | null
  }


  /**
   * Model TCGPlayerSet
   */

  export type AggregateTCGPlayerSet = {
    _count: TCGPlayerSetCountAggregateOutputType | null
    _avg: TCGPlayerSetAvgAggregateOutputType | null
    _sum: TCGPlayerSetSumAggregateOutputType | null
    _min: TCGPlayerSetMinAggregateOutputType | null
    _max: TCGPlayerSetMaxAggregateOutputType | null
  }

  export type TCGPlayerSetAvgAggregateOutputType = {
    totalProducts: number | null
    totalPages: number | null
    pagesProcessed: number | null
  }

  export type TCGPlayerSetSumAggregateOutputType = {
    totalProducts: number | null
    totalPages: number | null
    pagesProcessed: number | null
  }

  export type TCGPlayerSetMinAggregateOutputType = {
    id: string | null
    title: string | null
    fullTitle: string | null
    url: string | null
    fullUrl: string | null
    menuCategory: string | null
    totalProducts: number | null
    totalPages: number | null
    pagesProcessed: number | null
    lastHarvestedAt: Date | null
    harvestStatus: string | null
    harvestErrors: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TCGPlayerSetMaxAggregateOutputType = {
    id: string | null
    title: string | null
    fullTitle: string | null
    url: string | null
    fullUrl: string | null
    menuCategory: string | null
    totalProducts: number | null
    totalPages: number | null
    pagesProcessed: number | null
    lastHarvestedAt: Date | null
    harvestStatus: string | null
    harvestErrors: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TCGPlayerSetCountAggregateOutputType = {
    id: number
    title: number
    fullTitle: number
    url: number
    fullUrl: number
    menuCategory: number
    totalProducts: number
    totalPages: number
    pagesProcessed: number
    lastHarvestedAt: number
    harvestStatus: number
    harvestErrors: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TCGPlayerSetAvgAggregateInputType = {
    totalProducts?: true
    totalPages?: true
    pagesProcessed?: true
  }

  export type TCGPlayerSetSumAggregateInputType = {
    totalProducts?: true
    totalPages?: true
    pagesProcessed?: true
  }

  export type TCGPlayerSetMinAggregateInputType = {
    id?: true
    title?: true
    fullTitle?: true
    url?: true
    fullUrl?: true
    menuCategory?: true
    totalProducts?: true
    totalPages?: true
    pagesProcessed?: true
    lastHarvestedAt?: true
    harvestStatus?: true
    harvestErrors?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TCGPlayerSetMaxAggregateInputType = {
    id?: true
    title?: true
    fullTitle?: true
    url?: true
    fullUrl?: true
    menuCategory?: true
    totalProducts?: true
    totalPages?: true
    pagesProcessed?: true
    lastHarvestedAt?: true
    harvestStatus?: true
    harvestErrors?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TCGPlayerSetCountAggregateInputType = {
    id?: true
    title?: true
    fullTitle?: true
    url?: true
    fullUrl?: true
    menuCategory?: true
    totalProducts?: true
    totalPages?: true
    pagesProcessed?: true
    lastHarvestedAt?: true
    harvestStatus?: true
    harvestErrors?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TCGPlayerSetAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerSet to aggregate.
     */
    where?: TCGPlayerSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerSets to fetch.
     */
    orderBy?: TCGPlayerSetOrderByWithRelationInput | TCGPlayerSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TCGPlayerSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerSets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TCGPlayerSets
    **/
    _count?: true | TCGPlayerSetCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TCGPlayerSetAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TCGPlayerSetSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TCGPlayerSetMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TCGPlayerSetMaxAggregateInputType
  }

  export type GetTCGPlayerSetAggregateType<T extends TCGPlayerSetAggregateArgs> = {
        [P in keyof T & keyof AggregateTCGPlayerSet]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTCGPlayerSet[P]>
      : GetScalarType<T[P], AggregateTCGPlayerSet[P]>
  }




  export type TCGPlayerSetGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TCGPlayerSetWhereInput
    orderBy?: TCGPlayerSetOrderByWithAggregationInput | TCGPlayerSetOrderByWithAggregationInput[]
    by: TCGPlayerSetScalarFieldEnum[] | TCGPlayerSetScalarFieldEnum
    having?: TCGPlayerSetScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TCGPlayerSetCountAggregateInputType | true
    _avg?: TCGPlayerSetAvgAggregateInputType
    _sum?: TCGPlayerSetSumAggregateInputType
    _min?: TCGPlayerSetMinAggregateInputType
    _max?: TCGPlayerSetMaxAggregateInputType
  }

  export type TCGPlayerSetGroupByOutputType = {
    id: string
    title: string
    fullTitle: string | null
    url: string
    fullUrl: string
    menuCategory: string
    totalProducts: number
    totalPages: number
    pagesProcessed: number
    lastHarvestedAt: Date | null
    harvestStatus: string
    harvestErrors: string | null
    createdAt: Date
    updatedAt: Date
    _count: TCGPlayerSetCountAggregateOutputType | null
    _avg: TCGPlayerSetAvgAggregateOutputType | null
    _sum: TCGPlayerSetSumAggregateOutputType | null
    _min: TCGPlayerSetMinAggregateOutputType | null
    _max: TCGPlayerSetMaxAggregateOutputType | null
  }

  type GetTCGPlayerSetGroupByPayload<T extends TCGPlayerSetGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TCGPlayerSetGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TCGPlayerSetGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TCGPlayerSetGroupByOutputType[P]>
            : GetScalarType<T[P], TCGPlayerSetGroupByOutputType[P]>
        }
      >
    >


  export type TCGPlayerSetSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    fullTitle?: boolean
    url?: boolean
    fullUrl?: boolean
    menuCategory?: boolean
    totalProducts?: boolean
    totalPages?: boolean
    pagesProcessed?: boolean
    lastHarvestedAt?: boolean
    harvestStatus?: boolean
    harvestErrors?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tCGPlayerSet"]>

  export type TCGPlayerSetSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    fullTitle?: boolean
    url?: boolean
    fullUrl?: boolean
    menuCategory?: boolean
    totalProducts?: boolean
    totalPages?: boolean
    pagesProcessed?: boolean
    lastHarvestedAt?: boolean
    harvestStatus?: boolean
    harvestErrors?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tCGPlayerSet"]>

  export type TCGPlayerSetSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    fullTitle?: boolean
    url?: boolean
    fullUrl?: boolean
    menuCategory?: boolean
    totalProducts?: boolean
    totalPages?: boolean
    pagesProcessed?: boolean
    lastHarvestedAt?: boolean
    harvestStatus?: boolean
    harvestErrors?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tCGPlayerSet"]>

  export type TCGPlayerSetSelectScalar = {
    id?: boolean
    title?: boolean
    fullTitle?: boolean
    url?: boolean
    fullUrl?: boolean
    menuCategory?: boolean
    totalProducts?: boolean
    totalPages?: boolean
    pagesProcessed?: boolean
    lastHarvestedAt?: boolean
    harvestStatus?: boolean
    harvestErrors?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TCGPlayerSetOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "title" | "fullTitle" | "url" | "fullUrl" | "menuCategory" | "totalProducts" | "totalPages" | "pagesProcessed" | "lastHarvestedAt" | "harvestStatus" | "harvestErrors" | "createdAt" | "updatedAt", ExtArgs["result"]["tCGPlayerSet"]>

  export type $TCGPlayerSetPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TCGPlayerSet"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      title: string
      fullTitle: string | null
      url: string
      fullUrl: string
      menuCategory: string
      totalProducts: number
      totalPages: number
      pagesProcessed: number
      lastHarvestedAt: Date | null
      harvestStatus: string
      harvestErrors: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["tCGPlayerSet"]>
    composites: {}
  }

  type TCGPlayerSetGetPayload<S extends boolean | null | undefined | TCGPlayerSetDefaultArgs> = $Result.GetResult<Prisma.$TCGPlayerSetPayload, S>

  type TCGPlayerSetCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TCGPlayerSetFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TCGPlayerSetCountAggregateInputType | true
    }

  export interface TCGPlayerSetDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TCGPlayerSet'], meta: { name: 'TCGPlayerSet' } }
    /**
     * Find zero or one TCGPlayerSet that matches the filter.
     * @param {TCGPlayerSetFindUniqueArgs} args - Arguments to find a TCGPlayerSet
     * @example
     * // Get one TCGPlayerSet
     * const tCGPlayerSet = await prisma.tCGPlayerSet.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TCGPlayerSetFindUniqueArgs>(args: SelectSubset<T, TCGPlayerSetFindUniqueArgs<ExtArgs>>): Prisma__TCGPlayerSetClient<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TCGPlayerSet that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TCGPlayerSetFindUniqueOrThrowArgs} args - Arguments to find a TCGPlayerSet
     * @example
     * // Get one TCGPlayerSet
     * const tCGPlayerSet = await prisma.tCGPlayerSet.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TCGPlayerSetFindUniqueOrThrowArgs>(args: SelectSubset<T, TCGPlayerSetFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerSetClient<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerSet that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerSetFindFirstArgs} args - Arguments to find a TCGPlayerSet
     * @example
     * // Get one TCGPlayerSet
     * const tCGPlayerSet = await prisma.tCGPlayerSet.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TCGPlayerSetFindFirstArgs>(args?: SelectSubset<T, TCGPlayerSetFindFirstArgs<ExtArgs>>): Prisma__TCGPlayerSetClient<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerSet that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerSetFindFirstOrThrowArgs} args - Arguments to find a TCGPlayerSet
     * @example
     * // Get one TCGPlayerSet
     * const tCGPlayerSet = await prisma.tCGPlayerSet.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TCGPlayerSetFindFirstOrThrowArgs>(args?: SelectSubset<T, TCGPlayerSetFindFirstOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerSetClient<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TCGPlayerSets that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerSetFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TCGPlayerSets
     * const tCGPlayerSets = await prisma.tCGPlayerSet.findMany()
     * 
     * // Get first 10 TCGPlayerSets
     * const tCGPlayerSets = await prisma.tCGPlayerSet.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tCGPlayerSetWithIdOnly = await prisma.tCGPlayerSet.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TCGPlayerSetFindManyArgs>(args?: SelectSubset<T, TCGPlayerSetFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TCGPlayerSet.
     * @param {TCGPlayerSetCreateArgs} args - Arguments to create a TCGPlayerSet.
     * @example
     * // Create one TCGPlayerSet
     * const TCGPlayerSet = await prisma.tCGPlayerSet.create({
     *   data: {
     *     // ... data to create a TCGPlayerSet
     *   }
     * })
     * 
     */
    create<T extends TCGPlayerSetCreateArgs>(args: SelectSubset<T, TCGPlayerSetCreateArgs<ExtArgs>>): Prisma__TCGPlayerSetClient<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TCGPlayerSets.
     * @param {TCGPlayerSetCreateManyArgs} args - Arguments to create many TCGPlayerSets.
     * @example
     * // Create many TCGPlayerSets
     * const tCGPlayerSet = await prisma.tCGPlayerSet.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TCGPlayerSetCreateManyArgs>(args?: SelectSubset<T, TCGPlayerSetCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TCGPlayerSets and returns the data saved in the database.
     * @param {TCGPlayerSetCreateManyAndReturnArgs} args - Arguments to create many TCGPlayerSets.
     * @example
     * // Create many TCGPlayerSets
     * const tCGPlayerSet = await prisma.tCGPlayerSet.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TCGPlayerSets and only return the `id`
     * const tCGPlayerSetWithIdOnly = await prisma.tCGPlayerSet.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TCGPlayerSetCreateManyAndReturnArgs>(args?: SelectSubset<T, TCGPlayerSetCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TCGPlayerSet.
     * @param {TCGPlayerSetDeleteArgs} args - Arguments to delete one TCGPlayerSet.
     * @example
     * // Delete one TCGPlayerSet
     * const TCGPlayerSet = await prisma.tCGPlayerSet.delete({
     *   where: {
     *     // ... filter to delete one TCGPlayerSet
     *   }
     * })
     * 
     */
    delete<T extends TCGPlayerSetDeleteArgs>(args: SelectSubset<T, TCGPlayerSetDeleteArgs<ExtArgs>>): Prisma__TCGPlayerSetClient<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TCGPlayerSet.
     * @param {TCGPlayerSetUpdateArgs} args - Arguments to update one TCGPlayerSet.
     * @example
     * // Update one TCGPlayerSet
     * const tCGPlayerSet = await prisma.tCGPlayerSet.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TCGPlayerSetUpdateArgs>(args: SelectSubset<T, TCGPlayerSetUpdateArgs<ExtArgs>>): Prisma__TCGPlayerSetClient<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TCGPlayerSets.
     * @param {TCGPlayerSetDeleteManyArgs} args - Arguments to filter TCGPlayerSets to delete.
     * @example
     * // Delete a few TCGPlayerSets
     * const { count } = await prisma.tCGPlayerSet.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TCGPlayerSetDeleteManyArgs>(args?: SelectSubset<T, TCGPlayerSetDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerSets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerSetUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TCGPlayerSets
     * const tCGPlayerSet = await prisma.tCGPlayerSet.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TCGPlayerSetUpdateManyArgs>(args: SelectSubset<T, TCGPlayerSetUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerSets and returns the data updated in the database.
     * @param {TCGPlayerSetUpdateManyAndReturnArgs} args - Arguments to update many TCGPlayerSets.
     * @example
     * // Update many TCGPlayerSets
     * const tCGPlayerSet = await prisma.tCGPlayerSet.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TCGPlayerSets and only return the `id`
     * const tCGPlayerSetWithIdOnly = await prisma.tCGPlayerSet.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TCGPlayerSetUpdateManyAndReturnArgs>(args: SelectSubset<T, TCGPlayerSetUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TCGPlayerSet.
     * @param {TCGPlayerSetUpsertArgs} args - Arguments to update or create a TCGPlayerSet.
     * @example
     * // Update or create a TCGPlayerSet
     * const tCGPlayerSet = await prisma.tCGPlayerSet.upsert({
     *   create: {
     *     // ... data to create a TCGPlayerSet
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TCGPlayerSet we want to update
     *   }
     * })
     */
    upsert<T extends TCGPlayerSetUpsertArgs>(args: SelectSubset<T, TCGPlayerSetUpsertArgs<ExtArgs>>): Prisma__TCGPlayerSetClient<$Result.GetResult<Prisma.$TCGPlayerSetPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TCGPlayerSets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerSetCountArgs} args - Arguments to filter TCGPlayerSets to count.
     * @example
     * // Count the number of TCGPlayerSets
     * const count = await prisma.tCGPlayerSet.count({
     *   where: {
     *     // ... the filter for the TCGPlayerSets we want to count
     *   }
     * })
    **/
    count<T extends TCGPlayerSetCountArgs>(
      args?: Subset<T, TCGPlayerSetCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TCGPlayerSetCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TCGPlayerSet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerSetAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TCGPlayerSetAggregateArgs>(args: Subset<T, TCGPlayerSetAggregateArgs>): Prisma.PrismaPromise<GetTCGPlayerSetAggregateType<T>>

    /**
     * Group by TCGPlayerSet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerSetGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TCGPlayerSetGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TCGPlayerSetGroupByArgs['orderBy'] }
        : { orderBy?: TCGPlayerSetGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TCGPlayerSetGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTCGPlayerSetGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TCGPlayerSet model
   */
  readonly fields: TCGPlayerSetFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TCGPlayerSet.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TCGPlayerSetClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TCGPlayerSet model
   */
  interface TCGPlayerSetFieldRefs {
    readonly id: FieldRef<"TCGPlayerSet", 'String'>
    readonly title: FieldRef<"TCGPlayerSet", 'String'>
    readonly fullTitle: FieldRef<"TCGPlayerSet", 'String'>
    readonly url: FieldRef<"TCGPlayerSet", 'String'>
    readonly fullUrl: FieldRef<"TCGPlayerSet", 'String'>
    readonly menuCategory: FieldRef<"TCGPlayerSet", 'String'>
    readonly totalProducts: FieldRef<"TCGPlayerSet", 'Int'>
    readonly totalPages: FieldRef<"TCGPlayerSet", 'Int'>
    readonly pagesProcessed: FieldRef<"TCGPlayerSet", 'Int'>
    readonly lastHarvestedAt: FieldRef<"TCGPlayerSet", 'DateTime'>
    readonly harvestStatus: FieldRef<"TCGPlayerSet", 'String'>
    readonly harvestErrors: FieldRef<"TCGPlayerSet", 'String'>
    readonly createdAt: FieldRef<"TCGPlayerSet", 'DateTime'>
    readonly updatedAt: FieldRef<"TCGPlayerSet", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TCGPlayerSet findUnique
   */
  export type TCGPlayerSetFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerSet to fetch.
     */
    where: TCGPlayerSetWhereUniqueInput
  }

  /**
   * TCGPlayerSet findUniqueOrThrow
   */
  export type TCGPlayerSetFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerSet to fetch.
     */
    where: TCGPlayerSetWhereUniqueInput
  }

  /**
   * TCGPlayerSet findFirst
   */
  export type TCGPlayerSetFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerSet to fetch.
     */
    where?: TCGPlayerSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerSets to fetch.
     */
    orderBy?: TCGPlayerSetOrderByWithRelationInput | TCGPlayerSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerSets.
     */
    cursor?: TCGPlayerSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerSets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerSets.
     */
    distinct?: TCGPlayerSetScalarFieldEnum | TCGPlayerSetScalarFieldEnum[]
  }

  /**
   * TCGPlayerSet findFirstOrThrow
   */
  export type TCGPlayerSetFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerSet to fetch.
     */
    where?: TCGPlayerSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerSets to fetch.
     */
    orderBy?: TCGPlayerSetOrderByWithRelationInput | TCGPlayerSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerSets.
     */
    cursor?: TCGPlayerSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerSets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerSets.
     */
    distinct?: TCGPlayerSetScalarFieldEnum | TCGPlayerSetScalarFieldEnum[]
  }

  /**
   * TCGPlayerSet findMany
   */
  export type TCGPlayerSetFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerSets to fetch.
     */
    where?: TCGPlayerSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerSets to fetch.
     */
    orderBy?: TCGPlayerSetOrderByWithRelationInput | TCGPlayerSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TCGPlayerSets.
     */
    cursor?: TCGPlayerSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerSets.
     */
    skip?: number
    distinct?: TCGPlayerSetScalarFieldEnum | TCGPlayerSetScalarFieldEnum[]
  }

  /**
   * TCGPlayerSet create
   */
  export type TCGPlayerSetCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * The data needed to create a TCGPlayerSet.
     */
    data: XOR<TCGPlayerSetCreateInput, TCGPlayerSetUncheckedCreateInput>
  }

  /**
   * TCGPlayerSet createMany
   */
  export type TCGPlayerSetCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TCGPlayerSets.
     */
    data: TCGPlayerSetCreateManyInput | TCGPlayerSetCreateManyInput[]
  }

  /**
   * TCGPlayerSet createManyAndReturn
   */
  export type TCGPlayerSetCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * The data used to create many TCGPlayerSets.
     */
    data: TCGPlayerSetCreateManyInput | TCGPlayerSetCreateManyInput[]
  }

  /**
   * TCGPlayerSet update
   */
  export type TCGPlayerSetUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * The data needed to update a TCGPlayerSet.
     */
    data: XOR<TCGPlayerSetUpdateInput, TCGPlayerSetUncheckedUpdateInput>
    /**
     * Choose, which TCGPlayerSet to update.
     */
    where: TCGPlayerSetWhereUniqueInput
  }

  /**
   * TCGPlayerSet updateMany
   */
  export type TCGPlayerSetUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TCGPlayerSets.
     */
    data: XOR<TCGPlayerSetUpdateManyMutationInput, TCGPlayerSetUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerSets to update
     */
    where?: TCGPlayerSetWhereInput
    /**
     * Limit how many TCGPlayerSets to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerSet updateManyAndReturn
   */
  export type TCGPlayerSetUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * The data used to update TCGPlayerSets.
     */
    data: XOR<TCGPlayerSetUpdateManyMutationInput, TCGPlayerSetUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerSets to update
     */
    where?: TCGPlayerSetWhereInput
    /**
     * Limit how many TCGPlayerSets to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerSet upsert
   */
  export type TCGPlayerSetUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * The filter to search for the TCGPlayerSet to update in case it exists.
     */
    where: TCGPlayerSetWhereUniqueInput
    /**
     * In case the TCGPlayerSet found by the `where` argument doesn't exist, create a new TCGPlayerSet with this data.
     */
    create: XOR<TCGPlayerSetCreateInput, TCGPlayerSetUncheckedCreateInput>
    /**
     * In case the TCGPlayerSet was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TCGPlayerSetUpdateInput, TCGPlayerSetUncheckedUpdateInput>
  }

  /**
   * TCGPlayerSet delete
   */
  export type TCGPlayerSetDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
    /**
     * Filter which TCGPlayerSet to delete.
     */
    where: TCGPlayerSetWhereUniqueInput
  }

  /**
   * TCGPlayerSet deleteMany
   */
  export type TCGPlayerSetDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerSets to delete
     */
    where?: TCGPlayerSetWhereInput
    /**
     * Limit how many TCGPlayerSets to delete.
     */
    limit?: number
  }

  /**
   * TCGPlayerSet without action
   */
  export type TCGPlayerSetDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerSet
     */
    select?: TCGPlayerSetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerSet
     */
    omit?: TCGPlayerSetOmit<ExtArgs> | null
  }


  /**
   * Model TCGPlayerHarvestSession
   */

  export type AggregateTCGPlayerHarvestSession = {
    _count: TCGPlayerHarvestSessionCountAggregateOutputType | null
    _avg: TCGPlayerHarvestSessionAvgAggregateOutputType | null
    _sum: TCGPlayerHarvestSessionSumAggregateOutputType | null
    _min: TCGPlayerHarvestSessionMinAggregateOutputType | null
    _max: TCGPlayerHarvestSessionMaxAggregateOutputType | null
  }

  export type TCGPlayerHarvestSessionAvgAggregateOutputType = {
    totalSets: number | null
    processedSets: number | null
    totalProducts: number | null
    successfulSets: number | null
    failedSets: number | null
    maxPagesPerSet: number | null
    maxSets: number | null
  }

  export type TCGPlayerHarvestSessionSumAggregateOutputType = {
    totalSets: number | null
    processedSets: number | null
    totalProducts: number | null
    successfulSets: number | null
    failedSets: number | null
    maxPagesPerSet: number | null
    maxSets: number | null
  }

  export type TCGPlayerHarvestSessionMinAggregateOutputType = {
    id: string | null
    sessionId: string | null
    startTime: Date | null
    endTime: Date | null
    status: string | null
    totalSets: number | null
    processedSets: number | null
    totalProducts: number | null
    successfulSets: number | null
    failedSets: number | null
    maxPagesPerSet: number | null
    maxSets: number | null
    harvestType: string | null
    errors: string | null
    summary: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TCGPlayerHarvestSessionMaxAggregateOutputType = {
    id: string | null
    sessionId: string | null
    startTime: Date | null
    endTime: Date | null
    status: string | null
    totalSets: number | null
    processedSets: number | null
    totalProducts: number | null
    successfulSets: number | null
    failedSets: number | null
    maxPagesPerSet: number | null
    maxSets: number | null
    harvestType: string | null
    errors: string | null
    summary: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TCGPlayerHarvestSessionCountAggregateOutputType = {
    id: number
    sessionId: number
    startTime: number
    endTime: number
    status: number
    totalSets: number
    processedSets: number
    totalProducts: number
    successfulSets: number
    failedSets: number
    maxPagesPerSet: number
    maxSets: number
    harvestType: number
    errors: number
    summary: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TCGPlayerHarvestSessionAvgAggregateInputType = {
    totalSets?: true
    processedSets?: true
    totalProducts?: true
    successfulSets?: true
    failedSets?: true
    maxPagesPerSet?: true
    maxSets?: true
  }

  export type TCGPlayerHarvestSessionSumAggregateInputType = {
    totalSets?: true
    processedSets?: true
    totalProducts?: true
    successfulSets?: true
    failedSets?: true
    maxPagesPerSet?: true
    maxSets?: true
  }

  export type TCGPlayerHarvestSessionMinAggregateInputType = {
    id?: true
    sessionId?: true
    startTime?: true
    endTime?: true
    status?: true
    totalSets?: true
    processedSets?: true
    totalProducts?: true
    successfulSets?: true
    failedSets?: true
    maxPagesPerSet?: true
    maxSets?: true
    harvestType?: true
    errors?: true
    summary?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TCGPlayerHarvestSessionMaxAggregateInputType = {
    id?: true
    sessionId?: true
    startTime?: true
    endTime?: true
    status?: true
    totalSets?: true
    processedSets?: true
    totalProducts?: true
    successfulSets?: true
    failedSets?: true
    maxPagesPerSet?: true
    maxSets?: true
    harvestType?: true
    errors?: true
    summary?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TCGPlayerHarvestSessionCountAggregateInputType = {
    id?: true
    sessionId?: true
    startTime?: true
    endTime?: true
    status?: true
    totalSets?: true
    processedSets?: true
    totalProducts?: true
    successfulSets?: true
    failedSets?: true
    maxPagesPerSet?: true
    maxSets?: true
    harvestType?: true
    errors?: true
    summary?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TCGPlayerHarvestSessionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerHarvestSession to aggregate.
     */
    where?: TCGPlayerHarvestSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerHarvestSessions to fetch.
     */
    orderBy?: TCGPlayerHarvestSessionOrderByWithRelationInput | TCGPlayerHarvestSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TCGPlayerHarvestSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerHarvestSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerHarvestSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TCGPlayerHarvestSessions
    **/
    _count?: true | TCGPlayerHarvestSessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TCGPlayerHarvestSessionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TCGPlayerHarvestSessionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TCGPlayerHarvestSessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TCGPlayerHarvestSessionMaxAggregateInputType
  }

  export type GetTCGPlayerHarvestSessionAggregateType<T extends TCGPlayerHarvestSessionAggregateArgs> = {
        [P in keyof T & keyof AggregateTCGPlayerHarvestSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTCGPlayerHarvestSession[P]>
      : GetScalarType<T[P], AggregateTCGPlayerHarvestSession[P]>
  }




  export type TCGPlayerHarvestSessionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TCGPlayerHarvestSessionWhereInput
    orderBy?: TCGPlayerHarvestSessionOrderByWithAggregationInput | TCGPlayerHarvestSessionOrderByWithAggregationInput[]
    by: TCGPlayerHarvestSessionScalarFieldEnum[] | TCGPlayerHarvestSessionScalarFieldEnum
    having?: TCGPlayerHarvestSessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TCGPlayerHarvestSessionCountAggregateInputType | true
    _avg?: TCGPlayerHarvestSessionAvgAggregateInputType
    _sum?: TCGPlayerHarvestSessionSumAggregateInputType
    _min?: TCGPlayerHarvestSessionMinAggregateInputType
    _max?: TCGPlayerHarvestSessionMaxAggregateInputType
  }

  export type TCGPlayerHarvestSessionGroupByOutputType = {
    id: string
    sessionId: string
    startTime: Date
    endTime: Date | null
    status: string
    totalSets: number
    processedSets: number
    totalProducts: number
    successfulSets: number
    failedSets: number
    maxPagesPerSet: number
    maxSets: number | null
    harvestType: string
    errors: string | null
    summary: string | null
    createdAt: Date
    updatedAt: Date
    _count: TCGPlayerHarvestSessionCountAggregateOutputType | null
    _avg: TCGPlayerHarvestSessionAvgAggregateOutputType | null
    _sum: TCGPlayerHarvestSessionSumAggregateOutputType | null
    _min: TCGPlayerHarvestSessionMinAggregateOutputType | null
    _max: TCGPlayerHarvestSessionMaxAggregateOutputType | null
  }

  type GetTCGPlayerHarvestSessionGroupByPayload<T extends TCGPlayerHarvestSessionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TCGPlayerHarvestSessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TCGPlayerHarvestSessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TCGPlayerHarvestSessionGroupByOutputType[P]>
            : GetScalarType<T[P], TCGPlayerHarvestSessionGroupByOutputType[P]>
        }
      >
    >


  export type TCGPlayerHarvestSessionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    startTime?: boolean
    endTime?: boolean
    status?: boolean
    totalSets?: boolean
    processedSets?: boolean
    totalProducts?: boolean
    successfulSets?: boolean
    failedSets?: boolean
    maxPagesPerSet?: boolean
    maxSets?: boolean
    harvestType?: boolean
    errors?: boolean
    summary?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tCGPlayerHarvestSession"]>

  export type TCGPlayerHarvestSessionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    startTime?: boolean
    endTime?: boolean
    status?: boolean
    totalSets?: boolean
    processedSets?: boolean
    totalProducts?: boolean
    successfulSets?: boolean
    failedSets?: boolean
    maxPagesPerSet?: boolean
    maxSets?: boolean
    harvestType?: boolean
    errors?: boolean
    summary?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tCGPlayerHarvestSession"]>

  export type TCGPlayerHarvestSessionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    startTime?: boolean
    endTime?: boolean
    status?: boolean
    totalSets?: boolean
    processedSets?: boolean
    totalProducts?: boolean
    successfulSets?: boolean
    failedSets?: boolean
    maxPagesPerSet?: boolean
    maxSets?: boolean
    harvestType?: boolean
    errors?: boolean
    summary?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tCGPlayerHarvestSession"]>

  export type TCGPlayerHarvestSessionSelectScalar = {
    id?: boolean
    sessionId?: boolean
    startTime?: boolean
    endTime?: boolean
    status?: boolean
    totalSets?: boolean
    processedSets?: boolean
    totalProducts?: boolean
    successfulSets?: boolean
    failedSets?: boolean
    maxPagesPerSet?: boolean
    maxSets?: boolean
    harvestType?: boolean
    errors?: boolean
    summary?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TCGPlayerHarvestSessionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "sessionId" | "startTime" | "endTime" | "status" | "totalSets" | "processedSets" | "totalProducts" | "successfulSets" | "failedSets" | "maxPagesPerSet" | "maxSets" | "harvestType" | "errors" | "summary" | "createdAt" | "updatedAt", ExtArgs["result"]["tCGPlayerHarvestSession"]>

  export type $TCGPlayerHarvestSessionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TCGPlayerHarvestSession"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      sessionId: string
      startTime: Date
      endTime: Date | null
      status: string
      totalSets: number
      processedSets: number
      totalProducts: number
      successfulSets: number
      failedSets: number
      maxPagesPerSet: number
      maxSets: number | null
      harvestType: string
      errors: string | null
      summary: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["tCGPlayerHarvestSession"]>
    composites: {}
  }

  type TCGPlayerHarvestSessionGetPayload<S extends boolean | null | undefined | TCGPlayerHarvestSessionDefaultArgs> = $Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload, S>

  type TCGPlayerHarvestSessionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TCGPlayerHarvestSessionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TCGPlayerHarvestSessionCountAggregateInputType | true
    }

  export interface TCGPlayerHarvestSessionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TCGPlayerHarvestSession'], meta: { name: 'TCGPlayerHarvestSession' } }
    /**
     * Find zero or one TCGPlayerHarvestSession that matches the filter.
     * @param {TCGPlayerHarvestSessionFindUniqueArgs} args - Arguments to find a TCGPlayerHarvestSession
     * @example
     * // Get one TCGPlayerHarvestSession
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TCGPlayerHarvestSessionFindUniqueArgs>(args: SelectSubset<T, TCGPlayerHarvestSessionFindUniqueArgs<ExtArgs>>): Prisma__TCGPlayerHarvestSessionClient<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TCGPlayerHarvestSession that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TCGPlayerHarvestSessionFindUniqueOrThrowArgs} args - Arguments to find a TCGPlayerHarvestSession
     * @example
     * // Get one TCGPlayerHarvestSession
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TCGPlayerHarvestSessionFindUniqueOrThrowArgs>(args: SelectSubset<T, TCGPlayerHarvestSessionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerHarvestSessionClient<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerHarvestSession that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerHarvestSessionFindFirstArgs} args - Arguments to find a TCGPlayerHarvestSession
     * @example
     * // Get one TCGPlayerHarvestSession
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TCGPlayerHarvestSessionFindFirstArgs>(args?: SelectSubset<T, TCGPlayerHarvestSessionFindFirstArgs<ExtArgs>>): Prisma__TCGPlayerHarvestSessionClient<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerHarvestSession that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerHarvestSessionFindFirstOrThrowArgs} args - Arguments to find a TCGPlayerHarvestSession
     * @example
     * // Get one TCGPlayerHarvestSession
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TCGPlayerHarvestSessionFindFirstOrThrowArgs>(args?: SelectSubset<T, TCGPlayerHarvestSessionFindFirstOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerHarvestSessionClient<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TCGPlayerHarvestSessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerHarvestSessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TCGPlayerHarvestSessions
     * const tCGPlayerHarvestSessions = await prisma.tCGPlayerHarvestSession.findMany()
     * 
     * // Get first 10 TCGPlayerHarvestSessions
     * const tCGPlayerHarvestSessions = await prisma.tCGPlayerHarvestSession.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tCGPlayerHarvestSessionWithIdOnly = await prisma.tCGPlayerHarvestSession.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TCGPlayerHarvestSessionFindManyArgs>(args?: SelectSubset<T, TCGPlayerHarvestSessionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TCGPlayerHarvestSession.
     * @param {TCGPlayerHarvestSessionCreateArgs} args - Arguments to create a TCGPlayerHarvestSession.
     * @example
     * // Create one TCGPlayerHarvestSession
     * const TCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.create({
     *   data: {
     *     // ... data to create a TCGPlayerHarvestSession
     *   }
     * })
     * 
     */
    create<T extends TCGPlayerHarvestSessionCreateArgs>(args: SelectSubset<T, TCGPlayerHarvestSessionCreateArgs<ExtArgs>>): Prisma__TCGPlayerHarvestSessionClient<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TCGPlayerHarvestSessions.
     * @param {TCGPlayerHarvestSessionCreateManyArgs} args - Arguments to create many TCGPlayerHarvestSessions.
     * @example
     * // Create many TCGPlayerHarvestSessions
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TCGPlayerHarvestSessionCreateManyArgs>(args?: SelectSubset<T, TCGPlayerHarvestSessionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TCGPlayerHarvestSessions and returns the data saved in the database.
     * @param {TCGPlayerHarvestSessionCreateManyAndReturnArgs} args - Arguments to create many TCGPlayerHarvestSessions.
     * @example
     * // Create many TCGPlayerHarvestSessions
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TCGPlayerHarvestSessions and only return the `id`
     * const tCGPlayerHarvestSessionWithIdOnly = await prisma.tCGPlayerHarvestSession.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TCGPlayerHarvestSessionCreateManyAndReturnArgs>(args?: SelectSubset<T, TCGPlayerHarvestSessionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TCGPlayerHarvestSession.
     * @param {TCGPlayerHarvestSessionDeleteArgs} args - Arguments to delete one TCGPlayerHarvestSession.
     * @example
     * // Delete one TCGPlayerHarvestSession
     * const TCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.delete({
     *   where: {
     *     // ... filter to delete one TCGPlayerHarvestSession
     *   }
     * })
     * 
     */
    delete<T extends TCGPlayerHarvestSessionDeleteArgs>(args: SelectSubset<T, TCGPlayerHarvestSessionDeleteArgs<ExtArgs>>): Prisma__TCGPlayerHarvestSessionClient<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TCGPlayerHarvestSession.
     * @param {TCGPlayerHarvestSessionUpdateArgs} args - Arguments to update one TCGPlayerHarvestSession.
     * @example
     * // Update one TCGPlayerHarvestSession
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TCGPlayerHarvestSessionUpdateArgs>(args: SelectSubset<T, TCGPlayerHarvestSessionUpdateArgs<ExtArgs>>): Prisma__TCGPlayerHarvestSessionClient<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TCGPlayerHarvestSessions.
     * @param {TCGPlayerHarvestSessionDeleteManyArgs} args - Arguments to filter TCGPlayerHarvestSessions to delete.
     * @example
     * // Delete a few TCGPlayerHarvestSessions
     * const { count } = await prisma.tCGPlayerHarvestSession.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TCGPlayerHarvestSessionDeleteManyArgs>(args?: SelectSubset<T, TCGPlayerHarvestSessionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerHarvestSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerHarvestSessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TCGPlayerHarvestSessions
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TCGPlayerHarvestSessionUpdateManyArgs>(args: SelectSubset<T, TCGPlayerHarvestSessionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerHarvestSessions and returns the data updated in the database.
     * @param {TCGPlayerHarvestSessionUpdateManyAndReturnArgs} args - Arguments to update many TCGPlayerHarvestSessions.
     * @example
     * // Update many TCGPlayerHarvestSessions
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TCGPlayerHarvestSessions and only return the `id`
     * const tCGPlayerHarvestSessionWithIdOnly = await prisma.tCGPlayerHarvestSession.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TCGPlayerHarvestSessionUpdateManyAndReturnArgs>(args: SelectSubset<T, TCGPlayerHarvestSessionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TCGPlayerHarvestSession.
     * @param {TCGPlayerHarvestSessionUpsertArgs} args - Arguments to update or create a TCGPlayerHarvestSession.
     * @example
     * // Update or create a TCGPlayerHarvestSession
     * const tCGPlayerHarvestSession = await prisma.tCGPlayerHarvestSession.upsert({
     *   create: {
     *     // ... data to create a TCGPlayerHarvestSession
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TCGPlayerHarvestSession we want to update
     *   }
     * })
     */
    upsert<T extends TCGPlayerHarvestSessionUpsertArgs>(args: SelectSubset<T, TCGPlayerHarvestSessionUpsertArgs<ExtArgs>>): Prisma__TCGPlayerHarvestSessionClient<$Result.GetResult<Prisma.$TCGPlayerHarvestSessionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TCGPlayerHarvestSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerHarvestSessionCountArgs} args - Arguments to filter TCGPlayerHarvestSessions to count.
     * @example
     * // Count the number of TCGPlayerHarvestSessions
     * const count = await prisma.tCGPlayerHarvestSession.count({
     *   where: {
     *     // ... the filter for the TCGPlayerHarvestSessions we want to count
     *   }
     * })
    **/
    count<T extends TCGPlayerHarvestSessionCountArgs>(
      args?: Subset<T, TCGPlayerHarvestSessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TCGPlayerHarvestSessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TCGPlayerHarvestSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerHarvestSessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TCGPlayerHarvestSessionAggregateArgs>(args: Subset<T, TCGPlayerHarvestSessionAggregateArgs>): Prisma.PrismaPromise<GetTCGPlayerHarvestSessionAggregateType<T>>

    /**
     * Group by TCGPlayerHarvestSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerHarvestSessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TCGPlayerHarvestSessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TCGPlayerHarvestSessionGroupByArgs['orderBy'] }
        : { orderBy?: TCGPlayerHarvestSessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TCGPlayerHarvestSessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTCGPlayerHarvestSessionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TCGPlayerHarvestSession model
   */
  readonly fields: TCGPlayerHarvestSessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TCGPlayerHarvestSession.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TCGPlayerHarvestSessionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TCGPlayerHarvestSession model
   */
  interface TCGPlayerHarvestSessionFieldRefs {
    readonly id: FieldRef<"TCGPlayerHarvestSession", 'String'>
    readonly sessionId: FieldRef<"TCGPlayerHarvestSession", 'String'>
    readonly startTime: FieldRef<"TCGPlayerHarvestSession", 'DateTime'>
    readonly endTime: FieldRef<"TCGPlayerHarvestSession", 'DateTime'>
    readonly status: FieldRef<"TCGPlayerHarvestSession", 'String'>
    readonly totalSets: FieldRef<"TCGPlayerHarvestSession", 'Int'>
    readonly processedSets: FieldRef<"TCGPlayerHarvestSession", 'Int'>
    readonly totalProducts: FieldRef<"TCGPlayerHarvestSession", 'Int'>
    readonly successfulSets: FieldRef<"TCGPlayerHarvestSession", 'Int'>
    readonly failedSets: FieldRef<"TCGPlayerHarvestSession", 'Int'>
    readonly maxPagesPerSet: FieldRef<"TCGPlayerHarvestSession", 'Int'>
    readonly maxSets: FieldRef<"TCGPlayerHarvestSession", 'Int'>
    readonly harvestType: FieldRef<"TCGPlayerHarvestSession", 'String'>
    readonly errors: FieldRef<"TCGPlayerHarvestSession", 'String'>
    readonly summary: FieldRef<"TCGPlayerHarvestSession", 'String'>
    readonly createdAt: FieldRef<"TCGPlayerHarvestSession", 'DateTime'>
    readonly updatedAt: FieldRef<"TCGPlayerHarvestSession", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TCGPlayerHarvestSession findUnique
   */
  export type TCGPlayerHarvestSessionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerHarvestSession to fetch.
     */
    where: TCGPlayerHarvestSessionWhereUniqueInput
  }

  /**
   * TCGPlayerHarvestSession findUniqueOrThrow
   */
  export type TCGPlayerHarvestSessionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerHarvestSession to fetch.
     */
    where: TCGPlayerHarvestSessionWhereUniqueInput
  }

  /**
   * TCGPlayerHarvestSession findFirst
   */
  export type TCGPlayerHarvestSessionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerHarvestSession to fetch.
     */
    where?: TCGPlayerHarvestSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerHarvestSessions to fetch.
     */
    orderBy?: TCGPlayerHarvestSessionOrderByWithRelationInput | TCGPlayerHarvestSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerHarvestSessions.
     */
    cursor?: TCGPlayerHarvestSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerHarvestSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerHarvestSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerHarvestSessions.
     */
    distinct?: TCGPlayerHarvestSessionScalarFieldEnum | TCGPlayerHarvestSessionScalarFieldEnum[]
  }

  /**
   * TCGPlayerHarvestSession findFirstOrThrow
   */
  export type TCGPlayerHarvestSessionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerHarvestSession to fetch.
     */
    where?: TCGPlayerHarvestSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerHarvestSessions to fetch.
     */
    orderBy?: TCGPlayerHarvestSessionOrderByWithRelationInput | TCGPlayerHarvestSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerHarvestSessions.
     */
    cursor?: TCGPlayerHarvestSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerHarvestSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerHarvestSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerHarvestSessions.
     */
    distinct?: TCGPlayerHarvestSessionScalarFieldEnum | TCGPlayerHarvestSessionScalarFieldEnum[]
  }

  /**
   * TCGPlayerHarvestSession findMany
   */
  export type TCGPlayerHarvestSessionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerHarvestSessions to fetch.
     */
    where?: TCGPlayerHarvestSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerHarvestSessions to fetch.
     */
    orderBy?: TCGPlayerHarvestSessionOrderByWithRelationInput | TCGPlayerHarvestSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TCGPlayerHarvestSessions.
     */
    cursor?: TCGPlayerHarvestSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerHarvestSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerHarvestSessions.
     */
    skip?: number
    distinct?: TCGPlayerHarvestSessionScalarFieldEnum | TCGPlayerHarvestSessionScalarFieldEnum[]
  }

  /**
   * TCGPlayerHarvestSession create
   */
  export type TCGPlayerHarvestSessionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * The data needed to create a TCGPlayerHarvestSession.
     */
    data: XOR<TCGPlayerHarvestSessionCreateInput, TCGPlayerHarvestSessionUncheckedCreateInput>
  }

  /**
   * TCGPlayerHarvestSession createMany
   */
  export type TCGPlayerHarvestSessionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TCGPlayerHarvestSessions.
     */
    data: TCGPlayerHarvestSessionCreateManyInput | TCGPlayerHarvestSessionCreateManyInput[]
  }

  /**
   * TCGPlayerHarvestSession createManyAndReturn
   */
  export type TCGPlayerHarvestSessionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * The data used to create many TCGPlayerHarvestSessions.
     */
    data: TCGPlayerHarvestSessionCreateManyInput | TCGPlayerHarvestSessionCreateManyInput[]
  }

  /**
   * TCGPlayerHarvestSession update
   */
  export type TCGPlayerHarvestSessionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * The data needed to update a TCGPlayerHarvestSession.
     */
    data: XOR<TCGPlayerHarvestSessionUpdateInput, TCGPlayerHarvestSessionUncheckedUpdateInput>
    /**
     * Choose, which TCGPlayerHarvestSession to update.
     */
    where: TCGPlayerHarvestSessionWhereUniqueInput
  }

  /**
   * TCGPlayerHarvestSession updateMany
   */
  export type TCGPlayerHarvestSessionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TCGPlayerHarvestSessions.
     */
    data: XOR<TCGPlayerHarvestSessionUpdateManyMutationInput, TCGPlayerHarvestSessionUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerHarvestSessions to update
     */
    where?: TCGPlayerHarvestSessionWhereInput
    /**
     * Limit how many TCGPlayerHarvestSessions to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerHarvestSession updateManyAndReturn
   */
  export type TCGPlayerHarvestSessionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * The data used to update TCGPlayerHarvestSessions.
     */
    data: XOR<TCGPlayerHarvestSessionUpdateManyMutationInput, TCGPlayerHarvestSessionUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerHarvestSessions to update
     */
    where?: TCGPlayerHarvestSessionWhereInput
    /**
     * Limit how many TCGPlayerHarvestSessions to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerHarvestSession upsert
   */
  export type TCGPlayerHarvestSessionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * The filter to search for the TCGPlayerHarvestSession to update in case it exists.
     */
    where: TCGPlayerHarvestSessionWhereUniqueInput
    /**
     * In case the TCGPlayerHarvestSession found by the `where` argument doesn't exist, create a new TCGPlayerHarvestSession with this data.
     */
    create: XOR<TCGPlayerHarvestSessionCreateInput, TCGPlayerHarvestSessionUncheckedCreateInput>
    /**
     * In case the TCGPlayerHarvestSession was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TCGPlayerHarvestSessionUpdateInput, TCGPlayerHarvestSessionUncheckedUpdateInput>
  }

  /**
   * TCGPlayerHarvestSession delete
   */
  export type TCGPlayerHarvestSessionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
    /**
     * Filter which TCGPlayerHarvestSession to delete.
     */
    where: TCGPlayerHarvestSessionWhereUniqueInput
  }

  /**
   * TCGPlayerHarvestSession deleteMany
   */
  export type TCGPlayerHarvestSessionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerHarvestSessions to delete
     */
    where?: TCGPlayerHarvestSessionWhereInput
    /**
     * Limit how many TCGPlayerHarvestSessions to delete.
     */
    limit?: number
  }

  /**
   * TCGPlayerHarvestSession without action
   */
  export type TCGPlayerHarvestSessionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerHarvestSession
     */
    select?: TCGPlayerHarvestSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerHarvestSession
     */
    omit?: TCGPlayerHarvestSessionOmit<ExtArgs> | null
  }


  /**
   * Model TCGPlayerPriceHistory
   */

  export type AggregateTCGPlayerPriceHistory = {
    _count: TCGPlayerPriceHistoryCountAggregateOutputType | null
    _avg: TCGPlayerPriceHistoryAvgAggregateOutputType | null
    _sum: TCGPlayerPriceHistorySumAggregateOutputType | null
    _min: TCGPlayerPriceHistoryMinAggregateOutputType | null
    _max: TCGPlayerPriceHistoryMaxAggregateOutputType | null
  }

  export type TCGPlayerPriceHistoryAvgAggregateOutputType = {
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    listingCount: number | null
  }

  export type TCGPlayerPriceHistorySumAggregateOutputType = {
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    listingCount: number | null
  }

  export type TCGPlayerPriceHistoryMinAggregateOutputType = {
    id: string | null
    cardId: string | null
    externalId: string | null
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    listingCount: number | null
    priceSource: string | null
    priceDate: Date | null
    createdAt: Date | null
  }

  export type TCGPlayerPriceHistoryMaxAggregateOutputType = {
    id: string | null
    cardId: string | null
    externalId: string | null
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    listingCount: number | null
    priceSource: string | null
    priceDate: Date | null
    createdAt: Date | null
  }

  export type TCGPlayerPriceHistoryCountAggregateOutputType = {
    id: number
    cardId: number
    externalId: number
    marketPrice: number
    lowPrice: number
    midPrice: number
    highPrice: number
    listingCount: number
    priceSource: number
    priceDate: number
    createdAt: number
    _all: number
  }


  export type TCGPlayerPriceHistoryAvgAggregateInputType = {
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    listingCount?: true
  }

  export type TCGPlayerPriceHistorySumAggregateInputType = {
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    listingCount?: true
  }

  export type TCGPlayerPriceHistoryMinAggregateInputType = {
    id?: true
    cardId?: true
    externalId?: true
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    listingCount?: true
    priceSource?: true
    priceDate?: true
    createdAt?: true
  }

  export type TCGPlayerPriceHistoryMaxAggregateInputType = {
    id?: true
    cardId?: true
    externalId?: true
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    listingCount?: true
    priceSource?: true
    priceDate?: true
    createdAt?: true
  }

  export type TCGPlayerPriceHistoryCountAggregateInputType = {
    id?: true
    cardId?: true
    externalId?: true
    marketPrice?: true
    lowPrice?: true
    midPrice?: true
    highPrice?: true
    listingCount?: true
    priceSource?: true
    priceDate?: true
    createdAt?: true
    _all?: true
  }

  export type TCGPlayerPriceHistoryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerPriceHistory to aggregate.
     */
    where?: TCGPlayerPriceHistoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerPriceHistories to fetch.
     */
    orderBy?: TCGPlayerPriceHistoryOrderByWithRelationInput | TCGPlayerPriceHistoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TCGPlayerPriceHistoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerPriceHistories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerPriceHistories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TCGPlayerPriceHistories
    **/
    _count?: true | TCGPlayerPriceHistoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TCGPlayerPriceHistoryAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TCGPlayerPriceHistorySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TCGPlayerPriceHistoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TCGPlayerPriceHistoryMaxAggregateInputType
  }

  export type GetTCGPlayerPriceHistoryAggregateType<T extends TCGPlayerPriceHistoryAggregateArgs> = {
        [P in keyof T & keyof AggregateTCGPlayerPriceHistory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTCGPlayerPriceHistory[P]>
      : GetScalarType<T[P], AggregateTCGPlayerPriceHistory[P]>
  }




  export type TCGPlayerPriceHistoryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TCGPlayerPriceHistoryWhereInput
    orderBy?: TCGPlayerPriceHistoryOrderByWithAggregationInput | TCGPlayerPriceHistoryOrderByWithAggregationInput[]
    by: TCGPlayerPriceHistoryScalarFieldEnum[] | TCGPlayerPriceHistoryScalarFieldEnum
    having?: TCGPlayerPriceHistoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TCGPlayerPriceHistoryCountAggregateInputType | true
    _avg?: TCGPlayerPriceHistoryAvgAggregateInputType
    _sum?: TCGPlayerPriceHistorySumAggregateInputType
    _min?: TCGPlayerPriceHistoryMinAggregateInputType
    _max?: TCGPlayerPriceHistoryMaxAggregateInputType
  }

  export type TCGPlayerPriceHistoryGroupByOutputType = {
    id: string
    cardId: string
    externalId: string
    marketPrice: number | null
    lowPrice: number | null
    midPrice: number | null
    highPrice: number | null
    listingCount: number | null
    priceSource: string
    priceDate: Date
    createdAt: Date
    _count: TCGPlayerPriceHistoryCountAggregateOutputType | null
    _avg: TCGPlayerPriceHistoryAvgAggregateOutputType | null
    _sum: TCGPlayerPriceHistorySumAggregateOutputType | null
    _min: TCGPlayerPriceHistoryMinAggregateOutputType | null
    _max: TCGPlayerPriceHistoryMaxAggregateOutputType | null
  }

  type GetTCGPlayerPriceHistoryGroupByPayload<T extends TCGPlayerPriceHistoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TCGPlayerPriceHistoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TCGPlayerPriceHistoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TCGPlayerPriceHistoryGroupByOutputType[P]>
            : GetScalarType<T[P], TCGPlayerPriceHistoryGroupByOutputType[P]>
        }
      >
    >


  export type TCGPlayerPriceHistorySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cardId?: boolean
    externalId?: boolean
    marketPrice?: boolean
    lowPrice?: boolean
    midPrice?: boolean
    highPrice?: boolean
    listingCount?: boolean
    priceSource?: boolean
    priceDate?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["tCGPlayerPriceHistory"]>

  export type TCGPlayerPriceHistorySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cardId?: boolean
    externalId?: boolean
    marketPrice?: boolean
    lowPrice?: boolean
    midPrice?: boolean
    highPrice?: boolean
    listingCount?: boolean
    priceSource?: boolean
    priceDate?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["tCGPlayerPriceHistory"]>

  export type TCGPlayerPriceHistorySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cardId?: boolean
    externalId?: boolean
    marketPrice?: boolean
    lowPrice?: boolean
    midPrice?: boolean
    highPrice?: boolean
    listingCount?: boolean
    priceSource?: boolean
    priceDate?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["tCGPlayerPriceHistory"]>

  export type TCGPlayerPriceHistorySelectScalar = {
    id?: boolean
    cardId?: boolean
    externalId?: boolean
    marketPrice?: boolean
    lowPrice?: boolean
    midPrice?: boolean
    highPrice?: boolean
    listingCount?: boolean
    priceSource?: boolean
    priceDate?: boolean
    createdAt?: boolean
  }

  export type TCGPlayerPriceHistoryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "cardId" | "externalId" | "marketPrice" | "lowPrice" | "midPrice" | "highPrice" | "listingCount" | "priceSource" | "priceDate" | "createdAt", ExtArgs["result"]["tCGPlayerPriceHistory"]>

  export type $TCGPlayerPriceHistoryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TCGPlayerPriceHistory"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      cardId: string
      externalId: string
      marketPrice: number | null
      lowPrice: number | null
      midPrice: number | null
      highPrice: number | null
      listingCount: number | null
      priceSource: string
      priceDate: Date
      createdAt: Date
    }, ExtArgs["result"]["tCGPlayerPriceHistory"]>
    composites: {}
  }

  type TCGPlayerPriceHistoryGetPayload<S extends boolean | null | undefined | TCGPlayerPriceHistoryDefaultArgs> = $Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload, S>

  type TCGPlayerPriceHistoryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TCGPlayerPriceHistoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TCGPlayerPriceHistoryCountAggregateInputType | true
    }

  export interface TCGPlayerPriceHistoryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TCGPlayerPriceHistory'], meta: { name: 'TCGPlayerPriceHistory' } }
    /**
     * Find zero or one TCGPlayerPriceHistory that matches the filter.
     * @param {TCGPlayerPriceHistoryFindUniqueArgs} args - Arguments to find a TCGPlayerPriceHistory
     * @example
     * // Get one TCGPlayerPriceHistory
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TCGPlayerPriceHistoryFindUniqueArgs>(args: SelectSubset<T, TCGPlayerPriceHistoryFindUniqueArgs<ExtArgs>>): Prisma__TCGPlayerPriceHistoryClient<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TCGPlayerPriceHistory that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TCGPlayerPriceHistoryFindUniqueOrThrowArgs} args - Arguments to find a TCGPlayerPriceHistory
     * @example
     * // Get one TCGPlayerPriceHistory
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TCGPlayerPriceHistoryFindUniqueOrThrowArgs>(args: SelectSubset<T, TCGPlayerPriceHistoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerPriceHistoryClient<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerPriceHistory that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerPriceHistoryFindFirstArgs} args - Arguments to find a TCGPlayerPriceHistory
     * @example
     * // Get one TCGPlayerPriceHistory
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TCGPlayerPriceHistoryFindFirstArgs>(args?: SelectSubset<T, TCGPlayerPriceHistoryFindFirstArgs<ExtArgs>>): Prisma__TCGPlayerPriceHistoryClient<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerPriceHistory that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerPriceHistoryFindFirstOrThrowArgs} args - Arguments to find a TCGPlayerPriceHistory
     * @example
     * // Get one TCGPlayerPriceHistory
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TCGPlayerPriceHistoryFindFirstOrThrowArgs>(args?: SelectSubset<T, TCGPlayerPriceHistoryFindFirstOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerPriceHistoryClient<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TCGPlayerPriceHistories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerPriceHistoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TCGPlayerPriceHistories
     * const tCGPlayerPriceHistories = await prisma.tCGPlayerPriceHistory.findMany()
     * 
     * // Get first 10 TCGPlayerPriceHistories
     * const tCGPlayerPriceHistories = await prisma.tCGPlayerPriceHistory.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tCGPlayerPriceHistoryWithIdOnly = await prisma.tCGPlayerPriceHistory.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TCGPlayerPriceHistoryFindManyArgs>(args?: SelectSubset<T, TCGPlayerPriceHistoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TCGPlayerPriceHistory.
     * @param {TCGPlayerPriceHistoryCreateArgs} args - Arguments to create a TCGPlayerPriceHistory.
     * @example
     * // Create one TCGPlayerPriceHistory
     * const TCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.create({
     *   data: {
     *     // ... data to create a TCGPlayerPriceHistory
     *   }
     * })
     * 
     */
    create<T extends TCGPlayerPriceHistoryCreateArgs>(args: SelectSubset<T, TCGPlayerPriceHistoryCreateArgs<ExtArgs>>): Prisma__TCGPlayerPriceHistoryClient<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TCGPlayerPriceHistories.
     * @param {TCGPlayerPriceHistoryCreateManyArgs} args - Arguments to create many TCGPlayerPriceHistories.
     * @example
     * // Create many TCGPlayerPriceHistories
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TCGPlayerPriceHistoryCreateManyArgs>(args?: SelectSubset<T, TCGPlayerPriceHistoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TCGPlayerPriceHistories and returns the data saved in the database.
     * @param {TCGPlayerPriceHistoryCreateManyAndReturnArgs} args - Arguments to create many TCGPlayerPriceHistories.
     * @example
     * // Create many TCGPlayerPriceHistories
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TCGPlayerPriceHistories and only return the `id`
     * const tCGPlayerPriceHistoryWithIdOnly = await prisma.tCGPlayerPriceHistory.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TCGPlayerPriceHistoryCreateManyAndReturnArgs>(args?: SelectSubset<T, TCGPlayerPriceHistoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TCGPlayerPriceHistory.
     * @param {TCGPlayerPriceHistoryDeleteArgs} args - Arguments to delete one TCGPlayerPriceHistory.
     * @example
     * // Delete one TCGPlayerPriceHistory
     * const TCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.delete({
     *   where: {
     *     // ... filter to delete one TCGPlayerPriceHistory
     *   }
     * })
     * 
     */
    delete<T extends TCGPlayerPriceHistoryDeleteArgs>(args: SelectSubset<T, TCGPlayerPriceHistoryDeleteArgs<ExtArgs>>): Prisma__TCGPlayerPriceHistoryClient<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TCGPlayerPriceHistory.
     * @param {TCGPlayerPriceHistoryUpdateArgs} args - Arguments to update one TCGPlayerPriceHistory.
     * @example
     * // Update one TCGPlayerPriceHistory
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TCGPlayerPriceHistoryUpdateArgs>(args: SelectSubset<T, TCGPlayerPriceHistoryUpdateArgs<ExtArgs>>): Prisma__TCGPlayerPriceHistoryClient<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TCGPlayerPriceHistories.
     * @param {TCGPlayerPriceHistoryDeleteManyArgs} args - Arguments to filter TCGPlayerPriceHistories to delete.
     * @example
     * // Delete a few TCGPlayerPriceHistories
     * const { count } = await prisma.tCGPlayerPriceHistory.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TCGPlayerPriceHistoryDeleteManyArgs>(args?: SelectSubset<T, TCGPlayerPriceHistoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerPriceHistories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerPriceHistoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TCGPlayerPriceHistories
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TCGPlayerPriceHistoryUpdateManyArgs>(args: SelectSubset<T, TCGPlayerPriceHistoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerPriceHistories and returns the data updated in the database.
     * @param {TCGPlayerPriceHistoryUpdateManyAndReturnArgs} args - Arguments to update many TCGPlayerPriceHistories.
     * @example
     * // Update many TCGPlayerPriceHistories
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TCGPlayerPriceHistories and only return the `id`
     * const tCGPlayerPriceHistoryWithIdOnly = await prisma.tCGPlayerPriceHistory.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TCGPlayerPriceHistoryUpdateManyAndReturnArgs>(args: SelectSubset<T, TCGPlayerPriceHistoryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TCGPlayerPriceHistory.
     * @param {TCGPlayerPriceHistoryUpsertArgs} args - Arguments to update or create a TCGPlayerPriceHistory.
     * @example
     * // Update or create a TCGPlayerPriceHistory
     * const tCGPlayerPriceHistory = await prisma.tCGPlayerPriceHistory.upsert({
     *   create: {
     *     // ... data to create a TCGPlayerPriceHistory
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TCGPlayerPriceHistory we want to update
     *   }
     * })
     */
    upsert<T extends TCGPlayerPriceHistoryUpsertArgs>(args: SelectSubset<T, TCGPlayerPriceHistoryUpsertArgs<ExtArgs>>): Prisma__TCGPlayerPriceHistoryClient<$Result.GetResult<Prisma.$TCGPlayerPriceHistoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TCGPlayerPriceHistories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerPriceHistoryCountArgs} args - Arguments to filter TCGPlayerPriceHistories to count.
     * @example
     * // Count the number of TCGPlayerPriceHistories
     * const count = await prisma.tCGPlayerPriceHistory.count({
     *   where: {
     *     // ... the filter for the TCGPlayerPriceHistories we want to count
     *   }
     * })
    **/
    count<T extends TCGPlayerPriceHistoryCountArgs>(
      args?: Subset<T, TCGPlayerPriceHistoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TCGPlayerPriceHistoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TCGPlayerPriceHistory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerPriceHistoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TCGPlayerPriceHistoryAggregateArgs>(args: Subset<T, TCGPlayerPriceHistoryAggregateArgs>): Prisma.PrismaPromise<GetTCGPlayerPriceHistoryAggregateType<T>>

    /**
     * Group by TCGPlayerPriceHistory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerPriceHistoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TCGPlayerPriceHistoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TCGPlayerPriceHistoryGroupByArgs['orderBy'] }
        : { orderBy?: TCGPlayerPriceHistoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TCGPlayerPriceHistoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTCGPlayerPriceHistoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TCGPlayerPriceHistory model
   */
  readonly fields: TCGPlayerPriceHistoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TCGPlayerPriceHistory.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TCGPlayerPriceHistoryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TCGPlayerPriceHistory model
   */
  interface TCGPlayerPriceHistoryFieldRefs {
    readonly id: FieldRef<"TCGPlayerPriceHistory", 'String'>
    readonly cardId: FieldRef<"TCGPlayerPriceHistory", 'String'>
    readonly externalId: FieldRef<"TCGPlayerPriceHistory", 'String'>
    readonly marketPrice: FieldRef<"TCGPlayerPriceHistory", 'Float'>
    readonly lowPrice: FieldRef<"TCGPlayerPriceHistory", 'Float'>
    readonly midPrice: FieldRef<"TCGPlayerPriceHistory", 'Float'>
    readonly highPrice: FieldRef<"TCGPlayerPriceHistory", 'Float'>
    readonly listingCount: FieldRef<"TCGPlayerPriceHistory", 'Int'>
    readonly priceSource: FieldRef<"TCGPlayerPriceHistory", 'String'>
    readonly priceDate: FieldRef<"TCGPlayerPriceHistory", 'DateTime'>
    readonly createdAt: FieldRef<"TCGPlayerPriceHistory", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TCGPlayerPriceHistory findUnique
   */
  export type TCGPlayerPriceHistoryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerPriceHistory to fetch.
     */
    where: TCGPlayerPriceHistoryWhereUniqueInput
  }

  /**
   * TCGPlayerPriceHistory findUniqueOrThrow
   */
  export type TCGPlayerPriceHistoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerPriceHistory to fetch.
     */
    where: TCGPlayerPriceHistoryWhereUniqueInput
  }

  /**
   * TCGPlayerPriceHistory findFirst
   */
  export type TCGPlayerPriceHistoryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerPriceHistory to fetch.
     */
    where?: TCGPlayerPriceHistoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerPriceHistories to fetch.
     */
    orderBy?: TCGPlayerPriceHistoryOrderByWithRelationInput | TCGPlayerPriceHistoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerPriceHistories.
     */
    cursor?: TCGPlayerPriceHistoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerPriceHistories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerPriceHistories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerPriceHistories.
     */
    distinct?: TCGPlayerPriceHistoryScalarFieldEnum | TCGPlayerPriceHistoryScalarFieldEnum[]
  }

  /**
   * TCGPlayerPriceHistory findFirstOrThrow
   */
  export type TCGPlayerPriceHistoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerPriceHistory to fetch.
     */
    where?: TCGPlayerPriceHistoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerPriceHistories to fetch.
     */
    orderBy?: TCGPlayerPriceHistoryOrderByWithRelationInput | TCGPlayerPriceHistoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerPriceHistories.
     */
    cursor?: TCGPlayerPriceHistoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerPriceHistories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerPriceHistories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerPriceHistories.
     */
    distinct?: TCGPlayerPriceHistoryScalarFieldEnum | TCGPlayerPriceHistoryScalarFieldEnum[]
  }

  /**
   * TCGPlayerPriceHistory findMany
   */
  export type TCGPlayerPriceHistoryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerPriceHistories to fetch.
     */
    where?: TCGPlayerPriceHistoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerPriceHistories to fetch.
     */
    orderBy?: TCGPlayerPriceHistoryOrderByWithRelationInput | TCGPlayerPriceHistoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TCGPlayerPriceHistories.
     */
    cursor?: TCGPlayerPriceHistoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerPriceHistories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerPriceHistories.
     */
    skip?: number
    distinct?: TCGPlayerPriceHistoryScalarFieldEnum | TCGPlayerPriceHistoryScalarFieldEnum[]
  }

  /**
   * TCGPlayerPriceHistory create
   */
  export type TCGPlayerPriceHistoryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * The data needed to create a TCGPlayerPriceHistory.
     */
    data: XOR<TCGPlayerPriceHistoryCreateInput, TCGPlayerPriceHistoryUncheckedCreateInput>
  }

  /**
   * TCGPlayerPriceHistory createMany
   */
  export type TCGPlayerPriceHistoryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TCGPlayerPriceHistories.
     */
    data: TCGPlayerPriceHistoryCreateManyInput | TCGPlayerPriceHistoryCreateManyInput[]
  }

  /**
   * TCGPlayerPriceHistory createManyAndReturn
   */
  export type TCGPlayerPriceHistoryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * The data used to create many TCGPlayerPriceHistories.
     */
    data: TCGPlayerPriceHistoryCreateManyInput | TCGPlayerPriceHistoryCreateManyInput[]
  }

  /**
   * TCGPlayerPriceHistory update
   */
  export type TCGPlayerPriceHistoryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * The data needed to update a TCGPlayerPriceHistory.
     */
    data: XOR<TCGPlayerPriceHistoryUpdateInput, TCGPlayerPriceHistoryUncheckedUpdateInput>
    /**
     * Choose, which TCGPlayerPriceHistory to update.
     */
    where: TCGPlayerPriceHistoryWhereUniqueInput
  }

  /**
   * TCGPlayerPriceHistory updateMany
   */
  export type TCGPlayerPriceHistoryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TCGPlayerPriceHistories.
     */
    data: XOR<TCGPlayerPriceHistoryUpdateManyMutationInput, TCGPlayerPriceHistoryUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerPriceHistories to update
     */
    where?: TCGPlayerPriceHistoryWhereInput
    /**
     * Limit how many TCGPlayerPriceHistories to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerPriceHistory updateManyAndReturn
   */
  export type TCGPlayerPriceHistoryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * The data used to update TCGPlayerPriceHistories.
     */
    data: XOR<TCGPlayerPriceHistoryUpdateManyMutationInput, TCGPlayerPriceHistoryUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerPriceHistories to update
     */
    where?: TCGPlayerPriceHistoryWhereInput
    /**
     * Limit how many TCGPlayerPriceHistories to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerPriceHistory upsert
   */
  export type TCGPlayerPriceHistoryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * The filter to search for the TCGPlayerPriceHistory to update in case it exists.
     */
    where: TCGPlayerPriceHistoryWhereUniqueInput
    /**
     * In case the TCGPlayerPriceHistory found by the `where` argument doesn't exist, create a new TCGPlayerPriceHistory with this data.
     */
    create: XOR<TCGPlayerPriceHistoryCreateInput, TCGPlayerPriceHistoryUncheckedCreateInput>
    /**
     * In case the TCGPlayerPriceHistory was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TCGPlayerPriceHistoryUpdateInput, TCGPlayerPriceHistoryUncheckedUpdateInput>
  }

  /**
   * TCGPlayerPriceHistory delete
   */
  export type TCGPlayerPriceHistoryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
    /**
     * Filter which TCGPlayerPriceHistory to delete.
     */
    where: TCGPlayerPriceHistoryWhereUniqueInput
  }

  /**
   * TCGPlayerPriceHistory deleteMany
   */
  export type TCGPlayerPriceHistoryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerPriceHistories to delete
     */
    where?: TCGPlayerPriceHistoryWhereInput
    /**
     * Limit how many TCGPlayerPriceHistories to delete.
     */
    limit?: number
  }

  /**
   * TCGPlayerPriceHistory without action
   */
  export type TCGPlayerPriceHistoryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerPriceHistory
     */
    select?: TCGPlayerPriceHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerPriceHistory
     */
    omit?: TCGPlayerPriceHistoryOmit<ExtArgs> | null
  }


  /**
   * Model TCGPlayerConfiguration
   */

  export type AggregateTCGPlayerConfiguration = {
    _count: TCGPlayerConfigurationCountAggregateOutputType | null
    _min: TCGPlayerConfigurationMinAggregateOutputType | null
    _max: TCGPlayerConfigurationMaxAggregateOutputType | null
  }

  export type TCGPlayerConfigurationMinAggregateOutputType = {
    id: string | null
    key: string | null
    value: string | null
    description: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TCGPlayerConfigurationMaxAggregateOutputType = {
    id: string | null
    key: string | null
    value: string | null
    description: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TCGPlayerConfigurationCountAggregateOutputType = {
    id: number
    key: number
    value: number
    description: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TCGPlayerConfigurationMinAggregateInputType = {
    id?: true
    key?: true
    value?: true
    description?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TCGPlayerConfigurationMaxAggregateInputType = {
    id?: true
    key?: true
    value?: true
    description?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TCGPlayerConfigurationCountAggregateInputType = {
    id?: true
    key?: true
    value?: true
    description?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TCGPlayerConfigurationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerConfiguration to aggregate.
     */
    where?: TCGPlayerConfigurationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerConfigurations to fetch.
     */
    orderBy?: TCGPlayerConfigurationOrderByWithRelationInput | TCGPlayerConfigurationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TCGPlayerConfigurationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerConfigurations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerConfigurations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TCGPlayerConfigurations
    **/
    _count?: true | TCGPlayerConfigurationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TCGPlayerConfigurationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TCGPlayerConfigurationMaxAggregateInputType
  }

  export type GetTCGPlayerConfigurationAggregateType<T extends TCGPlayerConfigurationAggregateArgs> = {
        [P in keyof T & keyof AggregateTCGPlayerConfiguration]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTCGPlayerConfiguration[P]>
      : GetScalarType<T[P], AggregateTCGPlayerConfiguration[P]>
  }




  export type TCGPlayerConfigurationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TCGPlayerConfigurationWhereInput
    orderBy?: TCGPlayerConfigurationOrderByWithAggregationInput | TCGPlayerConfigurationOrderByWithAggregationInput[]
    by: TCGPlayerConfigurationScalarFieldEnum[] | TCGPlayerConfigurationScalarFieldEnum
    having?: TCGPlayerConfigurationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TCGPlayerConfigurationCountAggregateInputType | true
    _min?: TCGPlayerConfigurationMinAggregateInputType
    _max?: TCGPlayerConfigurationMaxAggregateInputType
  }

  export type TCGPlayerConfigurationGroupByOutputType = {
    id: string
    key: string
    value: string
    description: string | null
    createdAt: Date
    updatedAt: Date
    _count: TCGPlayerConfigurationCountAggregateOutputType | null
    _min: TCGPlayerConfigurationMinAggregateOutputType | null
    _max: TCGPlayerConfigurationMaxAggregateOutputType | null
  }

  type GetTCGPlayerConfigurationGroupByPayload<T extends TCGPlayerConfigurationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TCGPlayerConfigurationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TCGPlayerConfigurationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TCGPlayerConfigurationGroupByOutputType[P]>
            : GetScalarType<T[P], TCGPlayerConfigurationGroupByOutputType[P]>
        }
      >
    >


  export type TCGPlayerConfigurationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    key?: boolean
    value?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tCGPlayerConfiguration"]>

  export type TCGPlayerConfigurationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    key?: boolean
    value?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tCGPlayerConfiguration"]>

  export type TCGPlayerConfigurationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    key?: boolean
    value?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tCGPlayerConfiguration"]>

  export type TCGPlayerConfigurationSelectScalar = {
    id?: boolean
    key?: boolean
    value?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TCGPlayerConfigurationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "key" | "value" | "description" | "createdAt" | "updatedAt", ExtArgs["result"]["tCGPlayerConfiguration"]>

  export type $TCGPlayerConfigurationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TCGPlayerConfiguration"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      key: string
      value: string
      description: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["tCGPlayerConfiguration"]>
    composites: {}
  }

  type TCGPlayerConfigurationGetPayload<S extends boolean | null | undefined | TCGPlayerConfigurationDefaultArgs> = $Result.GetResult<Prisma.$TCGPlayerConfigurationPayload, S>

  type TCGPlayerConfigurationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TCGPlayerConfigurationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TCGPlayerConfigurationCountAggregateInputType | true
    }

  export interface TCGPlayerConfigurationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TCGPlayerConfiguration'], meta: { name: 'TCGPlayerConfiguration' } }
    /**
     * Find zero or one TCGPlayerConfiguration that matches the filter.
     * @param {TCGPlayerConfigurationFindUniqueArgs} args - Arguments to find a TCGPlayerConfiguration
     * @example
     * // Get one TCGPlayerConfiguration
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TCGPlayerConfigurationFindUniqueArgs>(args: SelectSubset<T, TCGPlayerConfigurationFindUniqueArgs<ExtArgs>>): Prisma__TCGPlayerConfigurationClient<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TCGPlayerConfiguration that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TCGPlayerConfigurationFindUniqueOrThrowArgs} args - Arguments to find a TCGPlayerConfiguration
     * @example
     * // Get one TCGPlayerConfiguration
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TCGPlayerConfigurationFindUniqueOrThrowArgs>(args: SelectSubset<T, TCGPlayerConfigurationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerConfigurationClient<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerConfiguration that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerConfigurationFindFirstArgs} args - Arguments to find a TCGPlayerConfiguration
     * @example
     * // Get one TCGPlayerConfiguration
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TCGPlayerConfigurationFindFirstArgs>(args?: SelectSubset<T, TCGPlayerConfigurationFindFirstArgs<ExtArgs>>): Prisma__TCGPlayerConfigurationClient<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TCGPlayerConfiguration that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerConfigurationFindFirstOrThrowArgs} args - Arguments to find a TCGPlayerConfiguration
     * @example
     * // Get one TCGPlayerConfiguration
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TCGPlayerConfigurationFindFirstOrThrowArgs>(args?: SelectSubset<T, TCGPlayerConfigurationFindFirstOrThrowArgs<ExtArgs>>): Prisma__TCGPlayerConfigurationClient<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TCGPlayerConfigurations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerConfigurationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TCGPlayerConfigurations
     * const tCGPlayerConfigurations = await prisma.tCGPlayerConfiguration.findMany()
     * 
     * // Get first 10 TCGPlayerConfigurations
     * const tCGPlayerConfigurations = await prisma.tCGPlayerConfiguration.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tCGPlayerConfigurationWithIdOnly = await prisma.tCGPlayerConfiguration.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TCGPlayerConfigurationFindManyArgs>(args?: SelectSubset<T, TCGPlayerConfigurationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TCGPlayerConfiguration.
     * @param {TCGPlayerConfigurationCreateArgs} args - Arguments to create a TCGPlayerConfiguration.
     * @example
     * // Create one TCGPlayerConfiguration
     * const TCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.create({
     *   data: {
     *     // ... data to create a TCGPlayerConfiguration
     *   }
     * })
     * 
     */
    create<T extends TCGPlayerConfigurationCreateArgs>(args: SelectSubset<T, TCGPlayerConfigurationCreateArgs<ExtArgs>>): Prisma__TCGPlayerConfigurationClient<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TCGPlayerConfigurations.
     * @param {TCGPlayerConfigurationCreateManyArgs} args - Arguments to create many TCGPlayerConfigurations.
     * @example
     * // Create many TCGPlayerConfigurations
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TCGPlayerConfigurationCreateManyArgs>(args?: SelectSubset<T, TCGPlayerConfigurationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TCGPlayerConfigurations and returns the data saved in the database.
     * @param {TCGPlayerConfigurationCreateManyAndReturnArgs} args - Arguments to create many TCGPlayerConfigurations.
     * @example
     * // Create many TCGPlayerConfigurations
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TCGPlayerConfigurations and only return the `id`
     * const tCGPlayerConfigurationWithIdOnly = await prisma.tCGPlayerConfiguration.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TCGPlayerConfigurationCreateManyAndReturnArgs>(args?: SelectSubset<T, TCGPlayerConfigurationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TCGPlayerConfiguration.
     * @param {TCGPlayerConfigurationDeleteArgs} args - Arguments to delete one TCGPlayerConfiguration.
     * @example
     * // Delete one TCGPlayerConfiguration
     * const TCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.delete({
     *   where: {
     *     // ... filter to delete one TCGPlayerConfiguration
     *   }
     * })
     * 
     */
    delete<T extends TCGPlayerConfigurationDeleteArgs>(args: SelectSubset<T, TCGPlayerConfigurationDeleteArgs<ExtArgs>>): Prisma__TCGPlayerConfigurationClient<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TCGPlayerConfiguration.
     * @param {TCGPlayerConfigurationUpdateArgs} args - Arguments to update one TCGPlayerConfiguration.
     * @example
     * // Update one TCGPlayerConfiguration
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TCGPlayerConfigurationUpdateArgs>(args: SelectSubset<T, TCGPlayerConfigurationUpdateArgs<ExtArgs>>): Prisma__TCGPlayerConfigurationClient<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TCGPlayerConfigurations.
     * @param {TCGPlayerConfigurationDeleteManyArgs} args - Arguments to filter TCGPlayerConfigurations to delete.
     * @example
     * // Delete a few TCGPlayerConfigurations
     * const { count } = await prisma.tCGPlayerConfiguration.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TCGPlayerConfigurationDeleteManyArgs>(args?: SelectSubset<T, TCGPlayerConfigurationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerConfigurations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerConfigurationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TCGPlayerConfigurations
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TCGPlayerConfigurationUpdateManyArgs>(args: SelectSubset<T, TCGPlayerConfigurationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TCGPlayerConfigurations and returns the data updated in the database.
     * @param {TCGPlayerConfigurationUpdateManyAndReturnArgs} args - Arguments to update many TCGPlayerConfigurations.
     * @example
     * // Update many TCGPlayerConfigurations
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TCGPlayerConfigurations and only return the `id`
     * const tCGPlayerConfigurationWithIdOnly = await prisma.tCGPlayerConfiguration.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TCGPlayerConfigurationUpdateManyAndReturnArgs>(args: SelectSubset<T, TCGPlayerConfigurationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TCGPlayerConfiguration.
     * @param {TCGPlayerConfigurationUpsertArgs} args - Arguments to update or create a TCGPlayerConfiguration.
     * @example
     * // Update or create a TCGPlayerConfiguration
     * const tCGPlayerConfiguration = await prisma.tCGPlayerConfiguration.upsert({
     *   create: {
     *     // ... data to create a TCGPlayerConfiguration
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TCGPlayerConfiguration we want to update
     *   }
     * })
     */
    upsert<T extends TCGPlayerConfigurationUpsertArgs>(args: SelectSubset<T, TCGPlayerConfigurationUpsertArgs<ExtArgs>>): Prisma__TCGPlayerConfigurationClient<$Result.GetResult<Prisma.$TCGPlayerConfigurationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TCGPlayerConfigurations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerConfigurationCountArgs} args - Arguments to filter TCGPlayerConfigurations to count.
     * @example
     * // Count the number of TCGPlayerConfigurations
     * const count = await prisma.tCGPlayerConfiguration.count({
     *   where: {
     *     // ... the filter for the TCGPlayerConfigurations we want to count
     *   }
     * })
    **/
    count<T extends TCGPlayerConfigurationCountArgs>(
      args?: Subset<T, TCGPlayerConfigurationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TCGPlayerConfigurationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TCGPlayerConfiguration.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerConfigurationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TCGPlayerConfigurationAggregateArgs>(args: Subset<T, TCGPlayerConfigurationAggregateArgs>): Prisma.PrismaPromise<GetTCGPlayerConfigurationAggregateType<T>>

    /**
     * Group by TCGPlayerConfiguration.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TCGPlayerConfigurationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TCGPlayerConfigurationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TCGPlayerConfigurationGroupByArgs['orderBy'] }
        : { orderBy?: TCGPlayerConfigurationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TCGPlayerConfigurationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTCGPlayerConfigurationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TCGPlayerConfiguration model
   */
  readonly fields: TCGPlayerConfigurationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TCGPlayerConfiguration.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TCGPlayerConfigurationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TCGPlayerConfiguration model
   */
  interface TCGPlayerConfigurationFieldRefs {
    readonly id: FieldRef<"TCGPlayerConfiguration", 'String'>
    readonly key: FieldRef<"TCGPlayerConfiguration", 'String'>
    readonly value: FieldRef<"TCGPlayerConfiguration", 'String'>
    readonly description: FieldRef<"TCGPlayerConfiguration", 'String'>
    readonly createdAt: FieldRef<"TCGPlayerConfiguration", 'DateTime'>
    readonly updatedAt: FieldRef<"TCGPlayerConfiguration", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TCGPlayerConfiguration findUnique
   */
  export type TCGPlayerConfigurationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerConfiguration to fetch.
     */
    where: TCGPlayerConfigurationWhereUniqueInput
  }

  /**
   * TCGPlayerConfiguration findUniqueOrThrow
   */
  export type TCGPlayerConfigurationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerConfiguration to fetch.
     */
    where: TCGPlayerConfigurationWhereUniqueInput
  }

  /**
   * TCGPlayerConfiguration findFirst
   */
  export type TCGPlayerConfigurationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerConfiguration to fetch.
     */
    where?: TCGPlayerConfigurationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerConfigurations to fetch.
     */
    orderBy?: TCGPlayerConfigurationOrderByWithRelationInput | TCGPlayerConfigurationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerConfigurations.
     */
    cursor?: TCGPlayerConfigurationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerConfigurations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerConfigurations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerConfigurations.
     */
    distinct?: TCGPlayerConfigurationScalarFieldEnum | TCGPlayerConfigurationScalarFieldEnum[]
  }

  /**
   * TCGPlayerConfiguration findFirstOrThrow
   */
  export type TCGPlayerConfigurationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerConfiguration to fetch.
     */
    where?: TCGPlayerConfigurationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerConfigurations to fetch.
     */
    orderBy?: TCGPlayerConfigurationOrderByWithRelationInput | TCGPlayerConfigurationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TCGPlayerConfigurations.
     */
    cursor?: TCGPlayerConfigurationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerConfigurations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerConfigurations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TCGPlayerConfigurations.
     */
    distinct?: TCGPlayerConfigurationScalarFieldEnum | TCGPlayerConfigurationScalarFieldEnum[]
  }

  /**
   * TCGPlayerConfiguration findMany
   */
  export type TCGPlayerConfigurationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * Filter, which TCGPlayerConfigurations to fetch.
     */
    where?: TCGPlayerConfigurationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TCGPlayerConfigurations to fetch.
     */
    orderBy?: TCGPlayerConfigurationOrderByWithRelationInput | TCGPlayerConfigurationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TCGPlayerConfigurations.
     */
    cursor?: TCGPlayerConfigurationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TCGPlayerConfigurations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TCGPlayerConfigurations.
     */
    skip?: number
    distinct?: TCGPlayerConfigurationScalarFieldEnum | TCGPlayerConfigurationScalarFieldEnum[]
  }

  /**
   * TCGPlayerConfiguration create
   */
  export type TCGPlayerConfigurationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * The data needed to create a TCGPlayerConfiguration.
     */
    data: XOR<TCGPlayerConfigurationCreateInput, TCGPlayerConfigurationUncheckedCreateInput>
  }

  /**
   * TCGPlayerConfiguration createMany
   */
  export type TCGPlayerConfigurationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TCGPlayerConfigurations.
     */
    data: TCGPlayerConfigurationCreateManyInput | TCGPlayerConfigurationCreateManyInput[]
  }

  /**
   * TCGPlayerConfiguration createManyAndReturn
   */
  export type TCGPlayerConfigurationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * The data used to create many TCGPlayerConfigurations.
     */
    data: TCGPlayerConfigurationCreateManyInput | TCGPlayerConfigurationCreateManyInput[]
  }

  /**
   * TCGPlayerConfiguration update
   */
  export type TCGPlayerConfigurationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * The data needed to update a TCGPlayerConfiguration.
     */
    data: XOR<TCGPlayerConfigurationUpdateInput, TCGPlayerConfigurationUncheckedUpdateInput>
    /**
     * Choose, which TCGPlayerConfiguration to update.
     */
    where: TCGPlayerConfigurationWhereUniqueInput
  }

  /**
   * TCGPlayerConfiguration updateMany
   */
  export type TCGPlayerConfigurationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TCGPlayerConfigurations.
     */
    data: XOR<TCGPlayerConfigurationUpdateManyMutationInput, TCGPlayerConfigurationUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerConfigurations to update
     */
    where?: TCGPlayerConfigurationWhereInput
    /**
     * Limit how many TCGPlayerConfigurations to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerConfiguration updateManyAndReturn
   */
  export type TCGPlayerConfigurationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * The data used to update TCGPlayerConfigurations.
     */
    data: XOR<TCGPlayerConfigurationUpdateManyMutationInput, TCGPlayerConfigurationUncheckedUpdateManyInput>
    /**
     * Filter which TCGPlayerConfigurations to update
     */
    where?: TCGPlayerConfigurationWhereInput
    /**
     * Limit how many TCGPlayerConfigurations to update.
     */
    limit?: number
  }

  /**
   * TCGPlayerConfiguration upsert
   */
  export type TCGPlayerConfigurationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * The filter to search for the TCGPlayerConfiguration to update in case it exists.
     */
    where: TCGPlayerConfigurationWhereUniqueInput
    /**
     * In case the TCGPlayerConfiguration found by the `where` argument doesn't exist, create a new TCGPlayerConfiguration with this data.
     */
    create: XOR<TCGPlayerConfigurationCreateInput, TCGPlayerConfigurationUncheckedCreateInput>
    /**
     * In case the TCGPlayerConfiguration was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TCGPlayerConfigurationUpdateInput, TCGPlayerConfigurationUncheckedUpdateInput>
  }

  /**
   * TCGPlayerConfiguration delete
   */
  export type TCGPlayerConfigurationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
    /**
     * Filter which TCGPlayerConfiguration to delete.
     */
    where: TCGPlayerConfigurationWhereUniqueInput
  }

  /**
   * TCGPlayerConfiguration deleteMany
   */
  export type TCGPlayerConfigurationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TCGPlayerConfigurations to delete
     */
    where?: TCGPlayerConfigurationWhereInput
    /**
     * Limit how many TCGPlayerConfigurations to delete.
     */
    limit?: number
  }

  /**
   * TCGPlayerConfiguration without action
   */
  export type TCGPlayerConfigurationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TCGPlayerConfiguration
     */
    select?: TCGPlayerConfigurationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TCGPlayerConfiguration
     */
    omit?: TCGPlayerConfigurationOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const TCGPlayerCardScalarFieldEnum: {
    id: 'id',
    externalId: 'externalId',
    source: 'source',
    name: 'name',
    cleanedName: 'cleanedName',
    setName: 'setName',
    setUrl: 'setUrl',
    rarity: 'rarity',
    rarityWeight: 'rarityWeight',
    cardType: 'cardType',
    cardNumber: 'cardNumber',
    category: 'category',
    menuCategory: 'menuCategory',
    productUrl: 'productUrl',
    imageUrl: 'imageUrl',
    tcgplayerUrl: 'tcgplayerUrl',
    currentPrice: 'currentPrice',
    marketPrice: 'marketPrice',
    lowPrice: 'lowPrice',
    midPrice: 'midPrice',
    highPrice: 'highPrice',
    priceRange: 'priceRange',
    listingCount: 'listingCount',
    priceText: 'priceText',
    inStock: 'inStock',
    sellable: 'sellable',
    totalListings: 'totalListings',
    page: 'page',
    extractedAt: 'extractedAt',
    lastUpdated: 'lastUpdated',
    harvestSessionId: 'harvestSessionId',
    rawProductData: 'rawProductData'
  };

  export type TCGPlayerCardScalarFieldEnum = (typeof TCGPlayerCardScalarFieldEnum)[keyof typeof TCGPlayerCardScalarFieldEnum]


  export const TCGPlayerSetScalarFieldEnum: {
    id: 'id',
    title: 'title',
    fullTitle: 'fullTitle',
    url: 'url',
    fullUrl: 'fullUrl',
    menuCategory: 'menuCategory',
    totalProducts: 'totalProducts',
    totalPages: 'totalPages',
    pagesProcessed: 'pagesProcessed',
    lastHarvestedAt: 'lastHarvestedAt',
    harvestStatus: 'harvestStatus',
    harvestErrors: 'harvestErrors',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TCGPlayerSetScalarFieldEnum = (typeof TCGPlayerSetScalarFieldEnum)[keyof typeof TCGPlayerSetScalarFieldEnum]


  export const TCGPlayerHarvestSessionScalarFieldEnum: {
    id: 'id',
    sessionId: 'sessionId',
    startTime: 'startTime',
    endTime: 'endTime',
    status: 'status',
    totalSets: 'totalSets',
    processedSets: 'processedSets',
    totalProducts: 'totalProducts',
    successfulSets: 'successfulSets',
    failedSets: 'failedSets',
    maxPagesPerSet: 'maxPagesPerSet',
    maxSets: 'maxSets',
    harvestType: 'harvestType',
    errors: 'errors',
    summary: 'summary',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TCGPlayerHarvestSessionScalarFieldEnum = (typeof TCGPlayerHarvestSessionScalarFieldEnum)[keyof typeof TCGPlayerHarvestSessionScalarFieldEnum]


  export const TCGPlayerPriceHistoryScalarFieldEnum: {
    id: 'id',
    cardId: 'cardId',
    externalId: 'externalId',
    marketPrice: 'marketPrice',
    lowPrice: 'lowPrice',
    midPrice: 'midPrice',
    highPrice: 'highPrice',
    listingCount: 'listingCount',
    priceSource: 'priceSource',
    priceDate: 'priceDate',
    createdAt: 'createdAt'
  };

  export type TCGPlayerPriceHistoryScalarFieldEnum = (typeof TCGPlayerPriceHistoryScalarFieldEnum)[keyof typeof TCGPlayerPriceHistoryScalarFieldEnum]


  export const TCGPlayerConfigurationScalarFieldEnum: {
    id: 'id',
    key: 'key',
    value: 'value',
    description: 'description',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TCGPlayerConfigurationScalarFieldEnum = (typeof TCGPlayerConfigurationScalarFieldEnum)[keyof typeof TCGPlayerConfigurationScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    
  /**
   * Deep Input Types
   */


  export type TCGPlayerCardWhereInput = {
    AND?: TCGPlayerCardWhereInput | TCGPlayerCardWhereInput[]
    OR?: TCGPlayerCardWhereInput[]
    NOT?: TCGPlayerCardWhereInput | TCGPlayerCardWhereInput[]
    id?: StringFilter<"TCGPlayerCard"> | string
    externalId?: StringFilter<"TCGPlayerCard"> | string
    source?: StringFilter<"TCGPlayerCard"> | string
    name?: StringFilter<"TCGPlayerCard"> | string
    cleanedName?: StringNullableFilter<"TCGPlayerCard"> | string | null
    setName?: StringFilter<"TCGPlayerCard"> | string
    setUrl?: StringNullableFilter<"TCGPlayerCard"> | string | null
    rarity?: StringNullableFilter<"TCGPlayerCard"> | string | null
    rarityWeight?: IntNullableFilter<"TCGPlayerCard"> | number | null
    cardType?: StringNullableFilter<"TCGPlayerCard"> | string | null
    cardNumber?: StringNullableFilter<"TCGPlayerCard"> | string | null
    category?: StringFilter<"TCGPlayerCard"> | string
    menuCategory?: StringNullableFilter<"TCGPlayerCard"> | string | null
    productUrl?: StringNullableFilter<"TCGPlayerCard"> | string | null
    imageUrl?: StringNullableFilter<"TCGPlayerCard"> | string | null
    tcgplayerUrl?: StringNullableFilter<"TCGPlayerCard"> | string | null
    currentPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    marketPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    lowPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    midPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    highPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    priceRange?: StringNullableFilter<"TCGPlayerCard"> | string | null
    listingCount?: IntNullableFilter<"TCGPlayerCard"> | number | null
    priceText?: StringNullableFilter<"TCGPlayerCard"> | string | null
    inStock?: BoolFilter<"TCGPlayerCard"> | boolean
    sellable?: BoolFilter<"TCGPlayerCard"> | boolean
    totalListings?: IntNullableFilter<"TCGPlayerCard"> | number | null
    page?: IntNullableFilter<"TCGPlayerCard"> | number | null
    extractedAt?: DateTimeFilter<"TCGPlayerCard"> | Date | string
    lastUpdated?: DateTimeFilter<"TCGPlayerCard"> | Date | string
    harvestSessionId?: StringNullableFilter<"TCGPlayerCard"> | string | null
    rawProductData?: StringNullableFilter<"TCGPlayerCard"> | string | null
  }

  export type TCGPlayerCardOrderByWithRelationInput = {
    id?: SortOrder
    externalId?: SortOrder
    source?: SortOrder
    name?: SortOrder
    cleanedName?: SortOrderInput | SortOrder
    setName?: SortOrder
    setUrl?: SortOrderInput | SortOrder
    rarity?: SortOrderInput | SortOrder
    rarityWeight?: SortOrderInput | SortOrder
    cardType?: SortOrderInput | SortOrder
    cardNumber?: SortOrderInput | SortOrder
    category?: SortOrder
    menuCategory?: SortOrderInput | SortOrder
    productUrl?: SortOrderInput | SortOrder
    imageUrl?: SortOrderInput | SortOrder
    tcgplayerUrl?: SortOrderInput | SortOrder
    currentPrice?: SortOrderInput | SortOrder
    marketPrice?: SortOrderInput | SortOrder
    lowPrice?: SortOrderInput | SortOrder
    midPrice?: SortOrderInput | SortOrder
    highPrice?: SortOrderInput | SortOrder
    priceRange?: SortOrderInput | SortOrder
    listingCount?: SortOrderInput | SortOrder
    priceText?: SortOrderInput | SortOrder
    inStock?: SortOrder
    sellable?: SortOrder
    totalListings?: SortOrderInput | SortOrder
    page?: SortOrderInput | SortOrder
    extractedAt?: SortOrder
    lastUpdated?: SortOrder
    harvestSessionId?: SortOrderInput | SortOrder
    rawProductData?: SortOrderInput | SortOrder
  }

  export type TCGPlayerCardWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    externalId?: string
    AND?: TCGPlayerCardWhereInput | TCGPlayerCardWhereInput[]
    OR?: TCGPlayerCardWhereInput[]
    NOT?: TCGPlayerCardWhereInput | TCGPlayerCardWhereInput[]
    source?: StringFilter<"TCGPlayerCard"> | string
    name?: StringFilter<"TCGPlayerCard"> | string
    cleanedName?: StringNullableFilter<"TCGPlayerCard"> | string | null
    setName?: StringFilter<"TCGPlayerCard"> | string
    setUrl?: StringNullableFilter<"TCGPlayerCard"> | string | null
    rarity?: StringNullableFilter<"TCGPlayerCard"> | string | null
    rarityWeight?: IntNullableFilter<"TCGPlayerCard"> | number | null
    cardType?: StringNullableFilter<"TCGPlayerCard"> | string | null
    cardNumber?: StringNullableFilter<"TCGPlayerCard"> | string | null
    category?: StringFilter<"TCGPlayerCard"> | string
    menuCategory?: StringNullableFilter<"TCGPlayerCard"> | string | null
    productUrl?: StringNullableFilter<"TCGPlayerCard"> | string | null
    imageUrl?: StringNullableFilter<"TCGPlayerCard"> | string | null
    tcgplayerUrl?: StringNullableFilter<"TCGPlayerCard"> | string | null
    currentPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    marketPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    lowPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    midPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    highPrice?: FloatNullableFilter<"TCGPlayerCard"> | number | null
    priceRange?: StringNullableFilter<"TCGPlayerCard"> | string | null
    listingCount?: IntNullableFilter<"TCGPlayerCard"> | number | null
    priceText?: StringNullableFilter<"TCGPlayerCard"> | string | null
    inStock?: BoolFilter<"TCGPlayerCard"> | boolean
    sellable?: BoolFilter<"TCGPlayerCard"> | boolean
    totalListings?: IntNullableFilter<"TCGPlayerCard"> | number | null
    page?: IntNullableFilter<"TCGPlayerCard"> | number | null
    extractedAt?: DateTimeFilter<"TCGPlayerCard"> | Date | string
    lastUpdated?: DateTimeFilter<"TCGPlayerCard"> | Date | string
    harvestSessionId?: StringNullableFilter<"TCGPlayerCard"> | string | null
    rawProductData?: StringNullableFilter<"TCGPlayerCard"> | string | null
  }, "id" | "externalId">

  export type TCGPlayerCardOrderByWithAggregationInput = {
    id?: SortOrder
    externalId?: SortOrder
    source?: SortOrder
    name?: SortOrder
    cleanedName?: SortOrderInput | SortOrder
    setName?: SortOrder
    setUrl?: SortOrderInput | SortOrder
    rarity?: SortOrderInput | SortOrder
    rarityWeight?: SortOrderInput | SortOrder
    cardType?: SortOrderInput | SortOrder
    cardNumber?: SortOrderInput | SortOrder
    category?: SortOrder
    menuCategory?: SortOrderInput | SortOrder
    productUrl?: SortOrderInput | SortOrder
    imageUrl?: SortOrderInput | SortOrder
    tcgplayerUrl?: SortOrderInput | SortOrder
    currentPrice?: SortOrderInput | SortOrder
    marketPrice?: SortOrderInput | SortOrder
    lowPrice?: SortOrderInput | SortOrder
    midPrice?: SortOrderInput | SortOrder
    highPrice?: SortOrderInput | SortOrder
    priceRange?: SortOrderInput | SortOrder
    listingCount?: SortOrderInput | SortOrder
    priceText?: SortOrderInput | SortOrder
    inStock?: SortOrder
    sellable?: SortOrder
    totalListings?: SortOrderInput | SortOrder
    page?: SortOrderInput | SortOrder
    extractedAt?: SortOrder
    lastUpdated?: SortOrder
    harvestSessionId?: SortOrderInput | SortOrder
    rawProductData?: SortOrderInput | SortOrder
    _count?: TCGPlayerCardCountOrderByAggregateInput
    _avg?: TCGPlayerCardAvgOrderByAggregateInput
    _max?: TCGPlayerCardMaxOrderByAggregateInput
    _min?: TCGPlayerCardMinOrderByAggregateInput
    _sum?: TCGPlayerCardSumOrderByAggregateInput
  }

  export type TCGPlayerCardScalarWhereWithAggregatesInput = {
    AND?: TCGPlayerCardScalarWhereWithAggregatesInput | TCGPlayerCardScalarWhereWithAggregatesInput[]
    OR?: TCGPlayerCardScalarWhereWithAggregatesInput[]
    NOT?: TCGPlayerCardScalarWhereWithAggregatesInput | TCGPlayerCardScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TCGPlayerCard"> | string
    externalId?: StringWithAggregatesFilter<"TCGPlayerCard"> | string
    source?: StringWithAggregatesFilter<"TCGPlayerCard"> | string
    name?: StringWithAggregatesFilter<"TCGPlayerCard"> | string
    cleanedName?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    setName?: StringWithAggregatesFilter<"TCGPlayerCard"> | string
    setUrl?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    rarity?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    rarityWeight?: IntNullableWithAggregatesFilter<"TCGPlayerCard"> | number | null
    cardType?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    cardNumber?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    category?: StringWithAggregatesFilter<"TCGPlayerCard"> | string
    menuCategory?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    productUrl?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    imageUrl?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    tcgplayerUrl?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    currentPrice?: FloatNullableWithAggregatesFilter<"TCGPlayerCard"> | number | null
    marketPrice?: FloatNullableWithAggregatesFilter<"TCGPlayerCard"> | number | null
    lowPrice?: FloatNullableWithAggregatesFilter<"TCGPlayerCard"> | number | null
    midPrice?: FloatNullableWithAggregatesFilter<"TCGPlayerCard"> | number | null
    highPrice?: FloatNullableWithAggregatesFilter<"TCGPlayerCard"> | number | null
    priceRange?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    listingCount?: IntNullableWithAggregatesFilter<"TCGPlayerCard"> | number | null
    priceText?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    inStock?: BoolWithAggregatesFilter<"TCGPlayerCard"> | boolean
    sellable?: BoolWithAggregatesFilter<"TCGPlayerCard"> | boolean
    totalListings?: IntNullableWithAggregatesFilter<"TCGPlayerCard"> | number | null
    page?: IntNullableWithAggregatesFilter<"TCGPlayerCard"> | number | null
    extractedAt?: DateTimeWithAggregatesFilter<"TCGPlayerCard"> | Date | string
    lastUpdated?: DateTimeWithAggregatesFilter<"TCGPlayerCard"> | Date | string
    harvestSessionId?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
    rawProductData?: StringNullableWithAggregatesFilter<"TCGPlayerCard"> | string | null
  }

  export type TCGPlayerSetWhereInput = {
    AND?: TCGPlayerSetWhereInput | TCGPlayerSetWhereInput[]
    OR?: TCGPlayerSetWhereInput[]
    NOT?: TCGPlayerSetWhereInput | TCGPlayerSetWhereInput[]
    id?: StringFilter<"TCGPlayerSet"> | string
    title?: StringFilter<"TCGPlayerSet"> | string
    fullTitle?: StringNullableFilter<"TCGPlayerSet"> | string | null
    url?: StringFilter<"TCGPlayerSet"> | string
    fullUrl?: StringFilter<"TCGPlayerSet"> | string
    menuCategory?: StringFilter<"TCGPlayerSet"> | string
    totalProducts?: IntFilter<"TCGPlayerSet"> | number
    totalPages?: IntFilter<"TCGPlayerSet"> | number
    pagesProcessed?: IntFilter<"TCGPlayerSet"> | number
    lastHarvestedAt?: DateTimeNullableFilter<"TCGPlayerSet"> | Date | string | null
    harvestStatus?: StringFilter<"TCGPlayerSet"> | string
    harvestErrors?: StringNullableFilter<"TCGPlayerSet"> | string | null
    createdAt?: DateTimeFilter<"TCGPlayerSet"> | Date | string
    updatedAt?: DateTimeFilter<"TCGPlayerSet"> | Date | string
  }

  export type TCGPlayerSetOrderByWithRelationInput = {
    id?: SortOrder
    title?: SortOrder
    fullTitle?: SortOrderInput | SortOrder
    url?: SortOrder
    fullUrl?: SortOrder
    menuCategory?: SortOrder
    totalProducts?: SortOrder
    totalPages?: SortOrder
    pagesProcessed?: SortOrder
    lastHarvestedAt?: SortOrderInput | SortOrder
    harvestStatus?: SortOrder
    harvestErrors?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerSetWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    title?: string
    AND?: TCGPlayerSetWhereInput | TCGPlayerSetWhereInput[]
    OR?: TCGPlayerSetWhereInput[]
    NOT?: TCGPlayerSetWhereInput | TCGPlayerSetWhereInput[]
    fullTitle?: StringNullableFilter<"TCGPlayerSet"> | string | null
    url?: StringFilter<"TCGPlayerSet"> | string
    fullUrl?: StringFilter<"TCGPlayerSet"> | string
    menuCategory?: StringFilter<"TCGPlayerSet"> | string
    totalProducts?: IntFilter<"TCGPlayerSet"> | number
    totalPages?: IntFilter<"TCGPlayerSet"> | number
    pagesProcessed?: IntFilter<"TCGPlayerSet"> | number
    lastHarvestedAt?: DateTimeNullableFilter<"TCGPlayerSet"> | Date | string | null
    harvestStatus?: StringFilter<"TCGPlayerSet"> | string
    harvestErrors?: StringNullableFilter<"TCGPlayerSet"> | string | null
    createdAt?: DateTimeFilter<"TCGPlayerSet"> | Date | string
    updatedAt?: DateTimeFilter<"TCGPlayerSet"> | Date | string
  }, "id" | "title">

  export type TCGPlayerSetOrderByWithAggregationInput = {
    id?: SortOrder
    title?: SortOrder
    fullTitle?: SortOrderInput | SortOrder
    url?: SortOrder
    fullUrl?: SortOrder
    menuCategory?: SortOrder
    totalProducts?: SortOrder
    totalPages?: SortOrder
    pagesProcessed?: SortOrder
    lastHarvestedAt?: SortOrderInput | SortOrder
    harvestStatus?: SortOrder
    harvestErrors?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TCGPlayerSetCountOrderByAggregateInput
    _avg?: TCGPlayerSetAvgOrderByAggregateInput
    _max?: TCGPlayerSetMaxOrderByAggregateInput
    _min?: TCGPlayerSetMinOrderByAggregateInput
    _sum?: TCGPlayerSetSumOrderByAggregateInput
  }

  export type TCGPlayerSetScalarWhereWithAggregatesInput = {
    AND?: TCGPlayerSetScalarWhereWithAggregatesInput | TCGPlayerSetScalarWhereWithAggregatesInput[]
    OR?: TCGPlayerSetScalarWhereWithAggregatesInput[]
    NOT?: TCGPlayerSetScalarWhereWithAggregatesInput | TCGPlayerSetScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TCGPlayerSet"> | string
    title?: StringWithAggregatesFilter<"TCGPlayerSet"> | string
    fullTitle?: StringNullableWithAggregatesFilter<"TCGPlayerSet"> | string | null
    url?: StringWithAggregatesFilter<"TCGPlayerSet"> | string
    fullUrl?: StringWithAggregatesFilter<"TCGPlayerSet"> | string
    menuCategory?: StringWithAggregatesFilter<"TCGPlayerSet"> | string
    totalProducts?: IntWithAggregatesFilter<"TCGPlayerSet"> | number
    totalPages?: IntWithAggregatesFilter<"TCGPlayerSet"> | number
    pagesProcessed?: IntWithAggregatesFilter<"TCGPlayerSet"> | number
    lastHarvestedAt?: DateTimeNullableWithAggregatesFilter<"TCGPlayerSet"> | Date | string | null
    harvestStatus?: StringWithAggregatesFilter<"TCGPlayerSet"> | string
    harvestErrors?: StringNullableWithAggregatesFilter<"TCGPlayerSet"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"TCGPlayerSet"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TCGPlayerSet"> | Date | string
  }

  export type TCGPlayerHarvestSessionWhereInput = {
    AND?: TCGPlayerHarvestSessionWhereInput | TCGPlayerHarvestSessionWhereInput[]
    OR?: TCGPlayerHarvestSessionWhereInput[]
    NOT?: TCGPlayerHarvestSessionWhereInput | TCGPlayerHarvestSessionWhereInput[]
    id?: StringFilter<"TCGPlayerHarvestSession"> | string
    sessionId?: StringFilter<"TCGPlayerHarvestSession"> | string
    startTime?: DateTimeFilter<"TCGPlayerHarvestSession"> | Date | string
    endTime?: DateTimeNullableFilter<"TCGPlayerHarvestSession"> | Date | string | null
    status?: StringFilter<"TCGPlayerHarvestSession"> | string
    totalSets?: IntFilter<"TCGPlayerHarvestSession"> | number
    processedSets?: IntFilter<"TCGPlayerHarvestSession"> | number
    totalProducts?: IntFilter<"TCGPlayerHarvestSession"> | number
    successfulSets?: IntFilter<"TCGPlayerHarvestSession"> | number
    failedSets?: IntFilter<"TCGPlayerHarvestSession"> | number
    maxPagesPerSet?: IntFilter<"TCGPlayerHarvestSession"> | number
    maxSets?: IntNullableFilter<"TCGPlayerHarvestSession"> | number | null
    harvestType?: StringFilter<"TCGPlayerHarvestSession"> | string
    errors?: StringNullableFilter<"TCGPlayerHarvestSession"> | string | null
    summary?: StringNullableFilter<"TCGPlayerHarvestSession"> | string | null
    createdAt?: DateTimeFilter<"TCGPlayerHarvestSession"> | Date | string
    updatedAt?: DateTimeFilter<"TCGPlayerHarvestSession"> | Date | string
  }

  export type TCGPlayerHarvestSessionOrderByWithRelationInput = {
    id?: SortOrder
    sessionId?: SortOrder
    startTime?: SortOrder
    endTime?: SortOrderInput | SortOrder
    status?: SortOrder
    totalSets?: SortOrder
    processedSets?: SortOrder
    totalProducts?: SortOrder
    successfulSets?: SortOrder
    failedSets?: SortOrder
    maxPagesPerSet?: SortOrder
    maxSets?: SortOrderInput | SortOrder
    harvestType?: SortOrder
    errors?: SortOrderInput | SortOrder
    summary?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerHarvestSessionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    sessionId?: string
    AND?: TCGPlayerHarvestSessionWhereInput | TCGPlayerHarvestSessionWhereInput[]
    OR?: TCGPlayerHarvestSessionWhereInput[]
    NOT?: TCGPlayerHarvestSessionWhereInput | TCGPlayerHarvestSessionWhereInput[]
    startTime?: DateTimeFilter<"TCGPlayerHarvestSession"> | Date | string
    endTime?: DateTimeNullableFilter<"TCGPlayerHarvestSession"> | Date | string | null
    status?: StringFilter<"TCGPlayerHarvestSession"> | string
    totalSets?: IntFilter<"TCGPlayerHarvestSession"> | number
    processedSets?: IntFilter<"TCGPlayerHarvestSession"> | number
    totalProducts?: IntFilter<"TCGPlayerHarvestSession"> | number
    successfulSets?: IntFilter<"TCGPlayerHarvestSession"> | number
    failedSets?: IntFilter<"TCGPlayerHarvestSession"> | number
    maxPagesPerSet?: IntFilter<"TCGPlayerHarvestSession"> | number
    maxSets?: IntNullableFilter<"TCGPlayerHarvestSession"> | number | null
    harvestType?: StringFilter<"TCGPlayerHarvestSession"> | string
    errors?: StringNullableFilter<"TCGPlayerHarvestSession"> | string | null
    summary?: StringNullableFilter<"TCGPlayerHarvestSession"> | string | null
    createdAt?: DateTimeFilter<"TCGPlayerHarvestSession"> | Date | string
    updatedAt?: DateTimeFilter<"TCGPlayerHarvestSession"> | Date | string
  }, "id" | "sessionId">

  export type TCGPlayerHarvestSessionOrderByWithAggregationInput = {
    id?: SortOrder
    sessionId?: SortOrder
    startTime?: SortOrder
    endTime?: SortOrderInput | SortOrder
    status?: SortOrder
    totalSets?: SortOrder
    processedSets?: SortOrder
    totalProducts?: SortOrder
    successfulSets?: SortOrder
    failedSets?: SortOrder
    maxPagesPerSet?: SortOrder
    maxSets?: SortOrderInput | SortOrder
    harvestType?: SortOrder
    errors?: SortOrderInput | SortOrder
    summary?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TCGPlayerHarvestSessionCountOrderByAggregateInput
    _avg?: TCGPlayerHarvestSessionAvgOrderByAggregateInput
    _max?: TCGPlayerHarvestSessionMaxOrderByAggregateInput
    _min?: TCGPlayerHarvestSessionMinOrderByAggregateInput
    _sum?: TCGPlayerHarvestSessionSumOrderByAggregateInput
  }

  export type TCGPlayerHarvestSessionScalarWhereWithAggregatesInput = {
    AND?: TCGPlayerHarvestSessionScalarWhereWithAggregatesInput | TCGPlayerHarvestSessionScalarWhereWithAggregatesInput[]
    OR?: TCGPlayerHarvestSessionScalarWhereWithAggregatesInput[]
    NOT?: TCGPlayerHarvestSessionScalarWhereWithAggregatesInput | TCGPlayerHarvestSessionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TCGPlayerHarvestSession"> | string
    sessionId?: StringWithAggregatesFilter<"TCGPlayerHarvestSession"> | string
    startTime?: DateTimeWithAggregatesFilter<"TCGPlayerHarvestSession"> | Date | string
    endTime?: DateTimeNullableWithAggregatesFilter<"TCGPlayerHarvestSession"> | Date | string | null
    status?: StringWithAggregatesFilter<"TCGPlayerHarvestSession"> | string
    totalSets?: IntWithAggregatesFilter<"TCGPlayerHarvestSession"> | number
    processedSets?: IntWithAggregatesFilter<"TCGPlayerHarvestSession"> | number
    totalProducts?: IntWithAggregatesFilter<"TCGPlayerHarvestSession"> | number
    successfulSets?: IntWithAggregatesFilter<"TCGPlayerHarvestSession"> | number
    failedSets?: IntWithAggregatesFilter<"TCGPlayerHarvestSession"> | number
    maxPagesPerSet?: IntWithAggregatesFilter<"TCGPlayerHarvestSession"> | number
    maxSets?: IntNullableWithAggregatesFilter<"TCGPlayerHarvestSession"> | number | null
    harvestType?: StringWithAggregatesFilter<"TCGPlayerHarvestSession"> | string
    errors?: StringNullableWithAggregatesFilter<"TCGPlayerHarvestSession"> | string | null
    summary?: StringNullableWithAggregatesFilter<"TCGPlayerHarvestSession"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"TCGPlayerHarvestSession"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TCGPlayerHarvestSession"> | Date | string
  }

  export type TCGPlayerPriceHistoryWhereInput = {
    AND?: TCGPlayerPriceHistoryWhereInput | TCGPlayerPriceHistoryWhereInput[]
    OR?: TCGPlayerPriceHistoryWhereInput[]
    NOT?: TCGPlayerPriceHistoryWhereInput | TCGPlayerPriceHistoryWhereInput[]
    id?: StringFilter<"TCGPlayerPriceHistory"> | string
    cardId?: StringFilter<"TCGPlayerPriceHistory"> | string
    externalId?: StringFilter<"TCGPlayerPriceHistory"> | string
    marketPrice?: FloatNullableFilter<"TCGPlayerPriceHistory"> | number | null
    lowPrice?: FloatNullableFilter<"TCGPlayerPriceHistory"> | number | null
    midPrice?: FloatNullableFilter<"TCGPlayerPriceHistory"> | number | null
    highPrice?: FloatNullableFilter<"TCGPlayerPriceHistory"> | number | null
    listingCount?: IntNullableFilter<"TCGPlayerPriceHistory"> | number | null
    priceSource?: StringFilter<"TCGPlayerPriceHistory"> | string
    priceDate?: DateTimeFilter<"TCGPlayerPriceHistory"> | Date | string
    createdAt?: DateTimeFilter<"TCGPlayerPriceHistory"> | Date | string
  }

  export type TCGPlayerPriceHistoryOrderByWithRelationInput = {
    id?: SortOrder
    cardId?: SortOrder
    externalId?: SortOrder
    marketPrice?: SortOrderInput | SortOrder
    lowPrice?: SortOrderInput | SortOrder
    midPrice?: SortOrderInput | SortOrder
    highPrice?: SortOrderInput | SortOrder
    listingCount?: SortOrderInput | SortOrder
    priceSource?: SortOrder
    priceDate?: SortOrder
    createdAt?: SortOrder
  }

  export type TCGPlayerPriceHistoryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TCGPlayerPriceHistoryWhereInput | TCGPlayerPriceHistoryWhereInput[]
    OR?: TCGPlayerPriceHistoryWhereInput[]
    NOT?: TCGPlayerPriceHistoryWhereInput | TCGPlayerPriceHistoryWhereInput[]
    cardId?: StringFilter<"TCGPlayerPriceHistory"> | string
    externalId?: StringFilter<"TCGPlayerPriceHistory"> | string
    marketPrice?: FloatNullableFilter<"TCGPlayerPriceHistory"> | number | null
    lowPrice?: FloatNullableFilter<"TCGPlayerPriceHistory"> | number | null
    midPrice?: FloatNullableFilter<"TCGPlayerPriceHistory"> | number | null
    highPrice?: FloatNullableFilter<"TCGPlayerPriceHistory"> | number | null
    listingCount?: IntNullableFilter<"TCGPlayerPriceHistory"> | number | null
    priceSource?: StringFilter<"TCGPlayerPriceHistory"> | string
    priceDate?: DateTimeFilter<"TCGPlayerPriceHistory"> | Date | string
    createdAt?: DateTimeFilter<"TCGPlayerPriceHistory"> | Date | string
  }, "id">

  export type TCGPlayerPriceHistoryOrderByWithAggregationInput = {
    id?: SortOrder
    cardId?: SortOrder
    externalId?: SortOrder
    marketPrice?: SortOrderInput | SortOrder
    lowPrice?: SortOrderInput | SortOrder
    midPrice?: SortOrderInput | SortOrder
    highPrice?: SortOrderInput | SortOrder
    listingCount?: SortOrderInput | SortOrder
    priceSource?: SortOrder
    priceDate?: SortOrder
    createdAt?: SortOrder
    _count?: TCGPlayerPriceHistoryCountOrderByAggregateInput
    _avg?: TCGPlayerPriceHistoryAvgOrderByAggregateInput
    _max?: TCGPlayerPriceHistoryMaxOrderByAggregateInput
    _min?: TCGPlayerPriceHistoryMinOrderByAggregateInput
    _sum?: TCGPlayerPriceHistorySumOrderByAggregateInput
  }

  export type TCGPlayerPriceHistoryScalarWhereWithAggregatesInput = {
    AND?: TCGPlayerPriceHistoryScalarWhereWithAggregatesInput | TCGPlayerPriceHistoryScalarWhereWithAggregatesInput[]
    OR?: TCGPlayerPriceHistoryScalarWhereWithAggregatesInput[]
    NOT?: TCGPlayerPriceHistoryScalarWhereWithAggregatesInput | TCGPlayerPriceHistoryScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TCGPlayerPriceHistory"> | string
    cardId?: StringWithAggregatesFilter<"TCGPlayerPriceHistory"> | string
    externalId?: StringWithAggregatesFilter<"TCGPlayerPriceHistory"> | string
    marketPrice?: FloatNullableWithAggregatesFilter<"TCGPlayerPriceHistory"> | number | null
    lowPrice?: FloatNullableWithAggregatesFilter<"TCGPlayerPriceHistory"> | number | null
    midPrice?: FloatNullableWithAggregatesFilter<"TCGPlayerPriceHistory"> | number | null
    highPrice?: FloatNullableWithAggregatesFilter<"TCGPlayerPriceHistory"> | number | null
    listingCount?: IntNullableWithAggregatesFilter<"TCGPlayerPriceHistory"> | number | null
    priceSource?: StringWithAggregatesFilter<"TCGPlayerPriceHistory"> | string
    priceDate?: DateTimeWithAggregatesFilter<"TCGPlayerPriceHistory"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"TCGPlayerPriceHistory"> | Date | string
  }

  export type TCGPlayerConfigurationWhereInput = {
    AND?: TCGPlayerConfigurationWhereInput | TCGPlayerConfigurationWhereInput[]
    OR?: TCGPlayerConfigurationWhereInput[]
    NOT?: TCGPlayerConfigurationWhereInput | TCGPlayerConfigurationWhereInput[]
    id?: StringFilter<"TCGPlayerConfiguration"> | string
    key?: StringFilter<"TCGPlayerConfiguration"> | string
    value?: StringFilter<"TCGPlayerConfiguration"> | string
    description?: StringNullableFilter<"TCGPlayerConfiguration"> | string | null
    createdAt?: DateTimeFilter<"TCGPlayerConfiguration"> | Date | string
    updatedAt?: DateTimeFilter<"TCGPlayerConfiguration"> | Date | string
  }

  export type TCGPlayerConfigurationOrderByWithRelationInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerConfigurationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    key?: string
    AND?: TCGPlayerConfigurationWhereInput | TCGPlayerConfigurationWhereInput[]
    OR?: TCGPlayerConfigurationWhereInput[]
    NOT?: TCGPlayerConfigurationWhereInput | TCGPlayerConfigurationWhereInput[]
    value?: StringFilter<"TCGPlayerConfiguration"> | string
    description?: StringNullableFilter<"TCGPlayerConfiguration"> | string | null
    createdAt?: DateTimeFilter<"TCGPlayerConfiguration"> | Date | string
    updatedAt?: DateTimeFilter<"TCGPlayerConfiguration"> | Date | string
  }, "id" | "key">

  export type TCGPlayerConfigurationOrderByWithAggregationInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TCGPlayerConfigurationCountOrderByAggregateInput
    _max?: TCGPlayerConfigurationMaxOrderByAggregateInput
    _min?: TCGPlayerConfigurationMinOrderByAggregateInput
  }

  export type TCGPlayerConfigurationScalarWhereWithAggregatesInput = {
    AND?: TCGPlayerConfigurationScalarWhereWithAggregatesInput | TCGPlayerConfigurationScalarWhereWithAggregatesInput[]
    OR?: TCGPlayerConfigurationScalarWhereWithAggregatesInput[]
    NOT?: TCGPlayerConfigurationScalarWhereWithAggregatesInput | TCGPlayerConfigurationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TCGPlayerConfiguration"> | string
    key?: StringWithAggregatesFilter<"TCGPlayerConfiguration"> | string
    value?: StringWithAggregatesFilter<"TCGPlayerConfiguration"> | string
    description?: StringNullableWithAggregatesFilter<"TCGPlayerConfiguration"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"TCGPlayerConfiguration"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TCGPlayerConfiguration"> | Date | string
  }

  export type TCGPlayerCardCreateInput = {
    id?: string
    externalId: string
    source?: string
    name: string
    cleanedName?: string | null
    setName: string
    setUrl?: string | null
    rarity?: string | null
    rarityWeight?: number | null
    cardType?: string | null
    cardNumber?: string | null
    category?: string
    menuCategory?: string | null
    productUrl?: string | null
    imageUrl?: string | null
    tcgplayerUrl?: string | null
    currentPrice?: number | null
    marketPrice?: number | null
    lowPrice?: number | null
    midPrice?: number | null
    highPrice?: number | null
    priceRange?: string | null
    listingCount?: number | null
    priceText?: string | null
    inStock?: boolean
    sellable?: boolean
    totalListings?: number | null
    page?: number | null
    extractedAt?: Date | string
    lastUpdated?: Date | string
    harvestSessionId?: string | null
    rawProductData?: string | null
  }

  export type TCGPlayerCardUncheckedCreateInput = {
    id?: string
    externalId: string
    source?: string
    name: string
    cleanedName?: string | null
    setName: string
    setUrl?: string | null
    rarity?: string | null
    rarityWeight?: number | null
    cardType?: string | null
    cardNumber?: string | null
    category?: string
    menuCategory?: string | null
    productUrl?: string | null
    imageUrl?: string | null
    tcgplayerUrl?: string | null
    currentPrice?: number | null
    marketPrice?: number | null
    lowPrice?: number | null
    midPrice?: number | null
    highPrice?: number | null
    priceRange?: string | null
    listingCount?: number | null
    priceText?: string | null
    inStock?: boolean
    sellable?: boolean
    totalListings?: number | null
    page?: number | null
    extractedAt?: Date | string
    lastUpdated?: Date | string
    harvestSessionId?: string | null
    rawProductData?: string | null
  }

  export type TCGPlayerCardUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    cleanedName?: NullableStringFieldUpdateOperationsInput | string | null
    setName?: StringFieldUpdateOperationsInput | string
    setUrl?: NullableStringFieldUpdateOperationsInput | string | null
    rarity?: NullableStringFieldUpdateOperationsInput | string | null
    rarityWeight?: NullableIntFieldUpdateOperationsInput | number | null
    cardType?: NullableStringFieldUpdateOperationsInput | string | null
    cardNumber?: NullableStringFieldUpdateOperationsInput | string | null
    category?: StringFieldUpdateOperationsInput | string
    menuCategory?: NullableStringFieldUpdateOperationsInput | string | null
    productUrl?: NullableStringFieldUpdateOperationsInput | string | null
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    tcgplayerUrl?: NullableStringFieldUpdateOperationsInput | string | null
    currentPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    marketPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    lowPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    midPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    highPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    priceRange?: NullableStringFieldUpdateOperationsInput | string | null
    listingCount?: NullableIntFieldUpdateOperationsInput | number | null
    priceText?: NullableStringFieldUpdateOperationsInput | string | null
    inStock?: BoolFieldUpdateOperationsInput | boolean
    sellable?: BoolFieldUpdateOperationsInput | boolean
    totalListings?: NullableIntFieldUpdateOperationsInput | number | null
    page?: NullableIntFieldUpdateOperationsInput | number | null
    extractedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastUpdated?: DateTimeFieldUpdateOperationsInput | Date | string
    harvestSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    rawProductData?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TCGPlayerCardUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    cleanedName?: NullableStringFieldUpdateOperationsInput | string | null
    setName?: StringFieldUpdateOperationsInput | string
    setUrl?: NullableStringFieldUpdateOperationsInput | string | null
    rarity?: NullableStringFieldUpdateOperationsInput | string | null
    rarityWeight?: NullableIntFieldUpdateOperationsInput | number | null
    cardType?: NullableStringFieldUpdateOperationsInput | string | null
    cardNumber?: NullableStringFieldUpdateOperationsInput | string | null
    category?: StringFieldUpdateOperationsInput | string
    menuCategory?: NullableStringFieldUpdateOperationsInput | string | null
    productUrl?: NullableStringFieldUpdateOperationsInput | string | null
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    tcgplayerUrl?: NullableStringFieldUpdateOperationsInput | string | null
    currentPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    marketPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    lowPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    midPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    highPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    priceRange?: NullableStringFieldUpdateOperationsInput | string | null
    listingCount?: NullableIntFieldUpdateOperationsInput | number | null
    priceText?: NullableStringFieldUpdateOperationsInput | string | null
    inStock?: BoolFieldUpdateOperationsInput | boolean
    sellable?: BoolFieldUpdateOperationsInput | boolean
    totalListings?: NullableIntFieldUpdateOperationsInput | number | null
    page?: NullableIntFieldUpdateOperationsInput | number | null
    extractedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastUpdated?: DateTimeFieldUpdateOperationsInput | Date | string
    harvestSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    rawProductData?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TCGPlayerCardCreateManyInput = {
    id?: string
    externalId: string
    source?: string
    name: string
    cleanedName?: string | null
    setName: string
    setUrl?: string | null
    rarity?: string | null
    rarityWeight?: number | null
    cardType?: string | null
    cardNumber?: string | null
    category?: string
    menuCategory?: string | null
    productUrl?: string | null
    imageUrl?: string | null
    tcgplayerUrl?: string | null
    currentPrice?: number | null
    marketPrice?: number | null
    lowPrice?: number | null
    midPrice?: number | null
    highPrice?: number | null
    priceRange?: string | null
    listingCount?: number | null
    priceText?: string | null
    inStock?: boolean
    sellable?: boolean
    totalListings?: number | null
    page?: number | null
    extractedAt?: Date | string
    lastUpdated?: Date | string
    harvestSessionId?: string | null
    rawProductData?: string | null
  }

  export type TCGPlayerCardUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    cleanedName?: NullableStringFieldUpdateOperationsInput | string | null
    setName?: StringFieldUpdateOperationsInput | string
    setUrl?: NullableStringFieldUpdateOperationsInput | string | null
    rarity?: NullableStringFieldUpdateOperationsInput | string | null
    rarityWeight?: NullableIntFieldUpdateOperationsInput | number | null
    cardType?: NullableStringFieldUpdateOperationsInput | string | null
    cardNumber?: NullableStringFieldUpdateOperationsInput | string | null
    category?: StringFieldUpdateOperationsInput | string
    menuCategory?: NullableStringFieldUpdateOperationsInput | string | null
    productUrl?: NullableStringFieldUpdateOperationsInput | string | null
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    tcgplayerUrl?: NullableStringFieldUpdateOperationsInput | string | null
    currentPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    marketPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    lowPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    midPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    highPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    priceRange?: NullableStringFieldUpdateOperationsInput | string | null
    listingCount?: NullableIntFieldUpdateOperationsInput | number | null
    priceText?: NullableStringFieldUpdateOperationsInput | string | null
    inStock?: BoolFieldUpdateOperationsInput | boolean
    sellable?: BoolFieldUpdateOperationsInput | boolean
    totalListings?: NullableIntFieldUpdateOperationsInput | number | null
    page?: NullableIntFieldUpdateOperationsInput | number | null
    extractedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastUpdated?: DateTimeFieldUpdateOperationsInput | Date | string
    harvestSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    rawProductData?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TCGPlayerCardUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    source?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    cleanedName?: NullableStringFieldUpdateOperationsInput | string | null
    setName?: StringFieldUpdateOperationsInput | string
    setUrl?: NullableStringFieldUpdateOperationsInput | string | null
    rarity?: NullableStringFieldUpdateOperationsInput | string | null
    rarityWeight?: NullableIntFieldUpdateOperationsInput | number | null
    cardType?: NullableStringFieldUpdateOperationsInput | string | null
    cardNumber?: NullableStringFieldUpdateOperationsInput | string | null
    category?: StringFieldUpdateOperationsInput | string
    menuCategory?: NullableStringFieldUpdateOperationsInput | string | null
    productUrl?: NullableStringFieldUpdateOperationsInput | string | null
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    tcgplayerUrl?: NullableStringFieldUpdateOperationsInput | string | null
    currentPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    marketPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    lowPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    midPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    highPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    priceRange?: NullableStringFieldUpdateOperationsInput | string | null
    listingCount?: NullableIntFieldUpdateOperationsInput | number | null
    priceText?: NullableStringFieldUpdateOperationsInput | string | null
    inStock?: BoolFieldUpdateOperationsInput | boolean
    sellable?: BoolFieldUpdateOperationsInput | boolean
    totalListings?: NullableIntFieldUpdateOperationsInput | number | null
    page?: NullableIntFieldUpdateOperationsInput | number | null
    extractedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastUpdated?: DateTimeFieldUpdateOperationsInput | Date | string
    harvestSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    rawProductData?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TCGPlayerSetCreateInput = {
    id?: string
    title: string
    fullTitle?: string | null
    url: string
    fullUrl: string
    menuCategory: string
    totalProducts?: number
    totalPages?: number
    pagesProcessed?: number
    lastHarvestedAt?: Date | string | null
    harvestStatus?: string
    harvestErrors?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TCGPlayerSetUncheckedCreateInput = {
    id?: string
    title: string
    fullTitle?: string | null
    url: string
    fullUrl: string
    menuCategory: string
    totalProducts?: number
    totalPages?: number
    pagesProcessed?: number
    lastHarvestedAt?: Date | string | null
    harvestStatus?: string
    harvestErrors?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TCGPlayerSetUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    fullTitle?: NullableStringFieldUpdateOperationsInput | string | null
    url?: StringFieldUpdateOperationsInput | string
    fullUrl?: StringFieldUpdateOperationsInput | string
    menuCategory?: StringFieldUpdateOperationsInput | string
    totalProducts?: IntFieldUpdateOperationsInput | number
    totalPages?: IntFieldUpdateOperationsInput | number
    pagesProcessed?: IntFieldUpdateOperationsInput | number
    lastHarvestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    harvestStatus?: StringFieldUpdateOperationsInput | string
    harvestErrors?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerSetUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    fullTitle?: NullableStringFieldUpdateOperationsInput | string | null
    url?: StringFieldUpdateOperationsInput | string
    fullUrl?: StringFieldUpdateOperationsInput | string
    menuCategory?: StringFieldUpdateOperationsInput | string
    totalProducts?: IntFieldUpdateOperationsInput | number
    totalPages?: IntFieldUpdateOperationsInput | number
    pagesProcessed?: IntFieldUpdateOperationsInput | number
    lastHarvestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    harvestStatus?: StringFieldUpdateOperationsInput | string
    harvestErrors?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerSetCreateManyInput = {
    id?: string
    title: string
    fullTitle?: string | null
    url: string
    fullUrl: string
    menuCategory: string
    totalProducts?: number
    totalPages?: number
    pagesProcessed?: number
    lastHarvestedAt?: Date | string | null
    harvestStatus?: string
    harvestErrors?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TCGPlayerSetUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    fullTitle?: NullableStringFieldUpdateOperationsInput | string | null
    url?: StringFieldUpdateOperationsInput | string
    fullUrl?: StringFieldUpdateOperationsInput | string
    menuCategory?: StringFieldUpdateOperationsInput | string
    totalProducts?: IntFieldUpdateOperationsInput | number
    totalPages?: IntFieldUpdateOperationsInput | number
    pagesProcessed?: IntFieldUpdateOperationsInput | number
    lastHarvestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    harvestStatus?: StringFieldUpdateOperationsInput | string
    harvestErrors?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerSetUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    fullTitle?: NullableStringFieldUpdateOperationsInput | string | null
    url?: StringFieldUpdateOperationsInput | string
    fullUrl?: StringFieldUpdateOperationsInput | string
    menuCategory?: StringFieldUpdateOperationsInput | string
    totalProducts?: IntFieldUpdateOperationsInput | number
    totalPages?: IntFieldUpdateOperationsInput | number
    pagesProcessed?: IntFieldUpdateOperationsInput | number
    lastHarvestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    harvestStatus?: StringFieldUpdateOperationsInput | string
    harvestErrors?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerHarvestSessionCreateInput = {
    id?: string
    sessionId: string
    startTime?: Date | string
    endTime?: Date | string | null
    status?: string
    totalSets?: number
    processedSets?: number
    totalProducts?: number
    successfulSets?: number
    failedSets?: number
    maxPagesPerSet?: number
    maxSets?: number | null
    harvestType?: string
    errors?: string | null
    summary?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TCGPlayerHarvestSessionUncheckedCreateInput = {
    id?: string
    sessionId: string
    startTime?: Date | string
    endTime?: Date | string | null
    status?: string
    totalSets?: number
    processedSets?: number
    totalProducts?: number
    successfulSets?: number
    failedSets?: number
    maxPagesPerSet?: number
    maxSets?: number | null
    harvestType?: string
    errors?: string | null
    summary?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TCGPlayerHarvestSessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    startTime?: DateTimeFieldUpdateOperationsInput | Date | string
    endTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: StringFieldUpdateOperationsInput | string
    totalSets?: IntFieldUpdateOperationsInput | number
    processedSets?: IntFieldUpdateOperationsInput | number
    totalProducts?: IntFieldUpdateOperationsInput | number
    successfulSets?: IntFieldUpdateOperationsInput | number
    failedSets?: IntFieldUpdateOperationsInput | number
    maxPagesPerSet?: IntFieldUpdateOperationsInput | number
    maxSets?: NullableIntFieldUpdateOperationsInput | number | null
    harvestType?: StringFieldUpdateOperationsInput | string
    errors?: NullableStringFieldUpdateOperationsInput | string | null
    summary?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerHarvestSessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    startTime?: DateTimeFieldUpdateOperationsInput | Date | string
    endTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: StringFieldUpdateOperationsInput | string
    totalSets?: IntFieldUpdateOperationsInput | number
    processedSets?: IntFieldUpdateOperationsInput | number
    totalProducts?: IntFieldUpdateOperationsInput | number
    successfulSets?: IntFieldUpdateOperationsInput | number
    failedSets?: IntFieldUpdateOperationsInput | number
    maxPagesPerSet?: IntFieldUpdateOperationsInput | number
    maxSets?: NullableIntFieldUpdateOperationsInput | number | null
    harvestType?: StringFieldUpdateOperationsInput | string
    errors?: NullableStringFieldUpdateOperationsInput | string | null
    summary?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerHarvestSessionCreateManyInput = {
    id?: string
    sessionId: string
    startTime?: Date | string
    endTime?: Date | string | null
    status?: string
    totalSets?: number
    processedSets?: number
    totalProducts?: number
    successfulSets?: number
    failedSets?: number
    maxPagesPerSet?: number
    maxSets?: number | null
    harvestType?: string
    errors?: string | null
    summary?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TCGPlayerHarvestSessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    startTime?: DateTimeFieldUpdateOperationsInput | Date | string
    endTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: StringFieldUpdateOperationsInput | string
    totalSets?: IntFieldUpdateOperationsInput | number
    processedSets?: IntFieldUpdateOperationsInput | number
    totalProducts?: IntFieldUpdateOperationsInput | number
    successfulSets?: IntFieldUpdateOperationsInput | number
    failedSets?: IntFieldUpdateOperationsInput | number
    maxPagesPerSet?: IntFieldUpdateOperationsInput | number
    maxSets?: NullableIntFieldUpdateOperationsInput | number | null
    harvestType?: StringFieldUpdateOperationsInput | string
    errors?: NullableStringFieldUpdateOperationsInput | string | null
    summary?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerHarvestSessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    sessionId?: StringFieldUpdateOperationsInput | string
    startTime?: DateTimeFieldUpdateOperationsInput | Date | string
    endTime?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: StringFieldUpdateOperationsInput | string
    totalSets?: IntFieldUpdateOperationsInput | number
    processedSets?: IntFieldUpdateOperationsInput | number
    totalProducts?: IntFieldUpdateOperationsInput | number
    successfulSets?: IntFieldUpdateOperationsInput | number
    failedSets?: IntFieldUpdateOperationsInput | number
    maxPagesPerSet?: IntFieldUpdateOperationsInput | number
    maxSets?: NullableIntFieldUpdateOperationsInput | number | null
    harvestType?: StringFieldUpdateOperationsInput | string
    errors?: NullableStringFieldUpdateOperationsInput | string | null
    summary?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerPriceHistoryCreateInput = {
    id?: string
    cardId: string
    externalId: string
    marketPrice?: number | null
    lowPrice?: number | null
    midPrice?: number | null
    highPrice?: number | null
    listingCount?: number | null
    priceSource?: string
    priceDate?: Date | string
    createdAt?: Date | string
  }

  export type TCGPlayerPriceHistoryUncheckedCreateInput = {
    id?: string
    cardId: string
    externalId: string
    marketPrice?: number | null
    lowPrice?: number | null
    midPrice?: number | null
    highPrice?: number | null
    listingCount?: number | null
    priceSource?: string
    priceDate?: Date | string
    createdAt?: Date | string
  }

  export type TCGPlayerPriceHistoryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    cardId?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    marketPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    lowPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    midPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    highPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    listingCount?: NullableIntFieldUpdateOperationsInput | number | null
    priceSource?: StringFieldUpdateOperationsInput | string
    priceDate?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerPriceHistoryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    cardId?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    marketPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    lowPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    midPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    highPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    listingCount?: NullableIntFieldUpdateOperationsInput | number | null
    priceSource?: StringFieldUpdateOperationsInput | string
    priceDate?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerPriceHistoryCreateManyInput = {
    id?: string
    cardId: string
    externalId: string
    marketPrice?: number | null
    lowPrice?: number | null
    midPrice?: number | null
    highPrice?: number | null
    listingCount?: number | null
    priceSource?: string
    priceDate?: Date | string
    createdAt?: Date | string
  }

  export type TCGPlayerPriceHistoryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    cardId?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    marketPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    lowPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    midPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    highPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    listingCount?: NullableIntFieldUpdateOperationsInput | number | null
    priceSource?: StringFieldUpdateOperationsInput | string
    priceDate?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerPriceHistoryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    cardId?: StringFieldUpdateOperationsInput | string
    externalId?: StringFieldUpdateOperationsInput | string
    marketPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    lowPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    midPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    highPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    listingCount?: NullableIntFieldUpdateOperationsInput | number | null
    priceSource?: StringFieldUpdateOperationsInput | string
    priceDate?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerConfigurationCreateInput = {
    id?: string
    key: string
    value: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TCGPlayerConfigurationUncheckedCreateInput = {
    id?: string
    key: string
    value: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TCGPlayerConfigurationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerConfigurationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerConfigurationCreateManyInput = {
    id?: string
    key: string
    value: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TCGPlayerConfigurationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TCGPlayerConfigurationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type TCGPlayerCardCountOrderByAggregateInput = {
    id?: SortOrder
    externalId?: SortOrder
    source?: SortOrder
    name?: SortOrder
    cleanedName?: SortOrder
    setName?: SortOrder
    setUrl?: SortOrder
    rarity?: SortOrder
    rarityWeight?: SortOrder
    cardType?: SortOrder
    cardNumber?: SortOrder
    category?: SortOrder
    menuCategory?: SortOrder
    productUrl?: SortOrder
    imageUrl?: SortOrder
    tcgplayerUrl?: SortOrder
    currentPrice?: SortOrder
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    priceRange?: SortOrder
    listingCount?: SortOrder
    priceText?: SortOrder
    inStock?: SortOrder
    sellable?: SortOrder
    totalListings?: SortOrder
    page?: SortOrder
    extractedAt?: SortOrder
    lastUpdated?: SortOrder
    harvestSessionId?: SortOrder
    rawProductData?: SortOrder
  }

  export type TCGPlayerCardAvgOrderByAggregateInput = {
    rarityWeight?: SortOrder
    currentPrice?: SortOrder
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    listingCount?: SortOrder
    totalListings?: SortOrder
    page?: SortOrder
  }

  export type TCGPlayerCardMaxOrderByAggregateInput = {
    id?: SortOrder
    externalId?: SortOrder
    source?: SortOrder
    name?: SortOrder
    cleanedName?: SortOrder
    setName?: SortOrder
    setUrl?: SortOrder
    rarity?: SortOrder
    rarityWeight?: SortOrder
    cardType?: SortOrder
    cardNumber?: SortOrder
    category?: SortOrder
    menuCategory?: SortOrder
    productUrl?: SortOrder
    imageUrl?: SortOrder
    tcgplayerUrl?: SortOrder
    currentPrice?: SortOrder
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    priceRange?: SortOrder
    listingCount?: SortOrder
    priceText?: SortOrder
    inStock?: SortOrder
    sellable?: SortOrder
    totalListings?: SortOrder
    page?: SortOrder
    extractedAt?: SortOrder
    lastUpdated?: SortOrder
    harvestSessionId?: SortOrder
    rawProductData?: SortOrder
  }

  export type TCGPlayerCardMinOrderByAggregateInput = {
    id?: SortOrder
    externalId?: SortOrder
    source?: SortOrder
    name?: SortOrder
    cleanedName?: SortOrder
    setName?: SortOrder
    setUrl?: SortOrder
    rarity?: SortOrder
    rarityWeight?: SortOrder
    cardType?: SortOrder
    cardNumber?: SortOrder
    category?: SortOrder
    menuCategory?: SortOrder
    productUrl?: SortOrder
    imageUrl?: SortOrder
    tcgplayerUrl?: SortOrder
    currentPrice?: SortOrder
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    priceRange?: SortOrder
    listingCount?: SortOrder
    priceText?: SortOrder
    inStock?: SortOrder
    sellable?: SortOrder
    totalListings?: SortOrder
    page?: SortOrder
    extractedAt?: SortOrder
    lastUpdated?: SortOrder
    harvestSessionId?: SortOrder
    rawProductData?: SortOrder
  }

  export type TCGPlayerCardSumOrderByAggregateInput = {
    rarityWeight?: SortOrder
    currentPrice?: SortOrder
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    listingCount?: SortOrder
    totalListings?: SortOrder
    page?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type TCGPlayerSetCountOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    fullTitle?: SortOrder
    url?: SortOrder
    fullUrl?: SortOrder
    menuCategory?: SortOrder
    totalProducts?: SortOrder
    totalPages?: SortOrder
    pagesProcessed?: SortOrder
    lastHarvestedAt?: SortOrder
    harvestStatus?: SortOrder
    harvestErrors?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerSetAvgOrderByAggregateInput = {
    totalProducts?: SortOrder
    totalPages?: SortOrder
    pagesProcessed?: SortOrder
  }

  export type TCGPlayerSetMaxOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    fullTitle?: SortOrder
    url?: SortOrder
    fullUrl?: SortOrder
    menuCategory?: SortOrder
    totalProducts?: SortOrder
    totalPages?: SortOrder
    pagesProcessed?: SortOrder
    lastHarvestedAt?: SortOrder
    harvestStatus?: SortOrder
    harvestErrors?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerSetMinOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    fullTitle?: SortOrder
    url?: SortOrder
    fullUrl?: SortOrder
    menuCategory?: SortOrder
    totalProducts?: SortOrder
    totalPages?: SortOrder
    pagesProcessed?: SortOrder
    lastHarvestedAt?: SortOrder
    harvestStatus?: SortOrder
    harvestErrors?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerSetSumOrderByAggregateInput = {
    totalProducts?: SortOrder
    totalPages?: SortOrder
    pagesProcessed?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type TCGPlayerHarvestSessionCountOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    startTime?: SortOrder
    endTime?: SortOrder
    status?: SortOrder
    totalSets?: SortOrder
    processedSets?: SortOrder
    totalProducts?: SortOrder
    successfulSets?: SortOrder
    failedSets?: SortOrder
    maxPagesPerSet?: SortOrder
    maxSets?: SortOrder
    harvestType?: SortOrder
    errors?: SortOrder
    summary?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerHarvestSessionAvgOrderByAggregateInput = {
    totalSets?: SortOrder
    processedSets?: SortOrder
    totalProducts?: SortOrder
    successfulSets?: SortOrder
    failedSets?: SortOrder
    maxPagesPerSet?: SortOrder
    maxSets?: SortOrder
  }

  export type TCGPlayerHarvestSessionMaxOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    startTime?: SortOrder
    endTime?: SortOrder
    status?: SortOrder
    totalSets?: SortOrder
    processedSets?: SortOrder
    totalProducts?: SortOrder
    successfulSets?: SortOrder
    failedSets?: SortOrder
    maxPagesPerSet?: SortOrder
    maxSets?: SortOrder
    harvestType?: SortOrder
    errors?: SortOrder
    summary?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerHarvestSessionMinOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    startTime?: SortOrder
    endTime?: SortOrder
    status?: SortOrder
    totalSets?: SortOrder
    processedSets?: SortOrder
    totalProducts?: SortOrder
    successfulSets?: SortOrder
    failedSets?: SortOrder
    maxPagesPerSet?: SortOrder
    maxSets?: SortOrder
    harvestType?: SortOrder
    errors?: SortOrder
    summary?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerHarvestSessionSumOrderByAggregateInput = {
    totalSets?: SortOrder
    processedSets?: SortOrder
    totalProducts?: SortOrder
    successfulSets?: SortOrder
    failedSets?: SortOrder
    maxPagesPerSet?: SortOrder
    maxSets?: SortOrder
  }

  export type TCGPlayerPriceHistoryCountOrderByAggregateInput = {
    id?: SortOrder
    cardId?: SortOrder
    externalId?: SortOrder
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    listingCount?: SortOrder
    priceSource?: SortOrder
    priceDate?: SortOrder
    createdAt?: SortOrder
  }

  export type TCGPlayerPriceHistoryAvgOrderByAggregateInput = {
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    listingCount?: SortOrder
  }

  export type TCGPlayerPriceHistoryMaxOrderByAggregateInput = {
    id?: SortOrder
    cardId?: SortOrder
    externalId?: SortOrder
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    listingCount?: SortOrder
    priceSource?: SortOrder
    priceDate?: SortOrder
    createdAt?: SortOrder
  }

  export type TCGPlayerPriceHistoryMinOrderByAggregateInput = {
    id?: SortOrder
    cardId?: SortOrder
    externalId?: SortOrder
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    listingCount?: SortOrder
    priceSource?: SortOrder
    priceDate?: SortOrder
    createdAt?: SortOrder
  }

  export type TCGPlayerPriceHistorySumOrderByAggregateInput = {
    marketPrice?: SortOrder
    lowPrice?: SortOrder
    midPrice?: SortOrder
    highPrice?: SortOrder
    listingCount?: SortOrder
  }

  export type TCGPlayerConfigurationCountOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerConfigurationMaxOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TCGPlayerConfigurationMinOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}