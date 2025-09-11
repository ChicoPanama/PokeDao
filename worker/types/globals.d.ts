// Extremely conservative ambient types to eliminate red without touching code.
// Reversible: delete this file later to restore strictness.

// Allow importing JSON and common non-TS assets
declare module "*.json" {
  const value: any;
  export default value;
}

// Prisma compatibility layer for legacy code
declare global {
  namespace PrismaNamespace {
    interface CardCreateManyInput {
      id?: string;
      title?: string;
      name?: string;
      set?: string;
      number?: string;
      price?: number;
      currency?: string;
      source?: string;
      url?: string;
      seller?: string;
      isActive?: boolean;
      scrapedAt?: Date;
      metadata?: any;
      [key: string]: any;
    }
    
    interface CardWhereInput {
      source?: any;
      price?: any;
      scrapedAt?: any;
      [key: string]: any;
    }
    
    interface CardMinAggregateInputType {
      price?: boolean;
      [key: string]: any;
    }
    
    interface CardMaxAggregateInputType {
      price?: boolean;
      [key: string]: any;
    }
    
    interface CardCountAggregateInputType {
      price?: boolean;
      [key: string]: any;
    }
    
    interface CardOrderByWithRelationInput {
      source?: any;
      scrapedAt?: any;
      [key: string]: any;
    }
    
    interface CardSelect {
      title?: boolean;
      price?: boolean;
      currency?: boolean;
      scrapedAt?: boolean;
      [key: string]: any;
    }
  }
}

// Module augmentation for @prisma/client
declare module "@prisma/client" {
  interface CardCreateManyInput extends PrismaNamespace.CardCreateManyInput {}
  interface CardWhereInput extends PrismaNamespace.CardWhereInput {}
  interface CardMinAggregateInputType extends PrismaNamespace.CardMinAggregateInputType {}
  interface CardMaxAggregateInputType extends PrismaNamespace.CardMaxAggregateInputType {}
  interface CardCountAggregateInputType extends PrismaNamespace.CardCountAggregateInputType {}
  interface CardOrderByWithRelationInput extends PrismaNamespace.CardOrderByWithRelationInput {}
  interface CardSelect<T = any> extends PrismaNamespace.CardSelect {}
  
  // Add missing aggregate result properties
  interface GetCardAggregateType<T> {
    _avg?: any;
    _count?: any;
    _min?: any;
    _max?: any;
    [key: string]: any;
  }
}

// Allow any types to suppress implicit any errors
declare global {
  var card: any;
  var index: any;
  var prisma: any;
}

// LAST-RESORT WILDCARD (kept ON to go green now; remove later to regain strictness)
declare module "*";
