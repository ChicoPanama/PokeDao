// Legacy schema compatibility for worker package
// This file provides type overrides to make existing code compatible with new schema

declare module "@prisma/client" {
  // Export PrismaClient class
  export class PrismaClient {
    card: any;
    [key: string]: any;
  }
  // Override Card type to include legacy fields
  interface Card {
    id: string;
    name: string;
    set: string;
    number: string;
    variant?: string | null;
    grade?: string | null;
    condition?: string | null;
    
    // Legacy fields for compatibility
    title?: string;
    price?: number;
    currency?: string;
    source?: string;
    url?: string;
    seller?: string;
    isActive?: boolean;
    scrapedAt?: Date;
    metadata?: any;
    
    // New normalization fields
    language?: string | null;
    normalizedName?: string | null;
    setCode?: string | null;
    rarity?: string | null;
    variantKey?: string | null;
    
    createdAt: Date;
    updatedAt: Date;
  }
  
  // Extend input types to accept legacy fields
  interface CardCreateManyInput {
    id?: string;
    name?: string;
    set?: string;
    number?: string;
    variant?: string | null;
    grade?: string | null;
    condition?: string | null;
    
    // Legacy compatibility
    title?: string;
    price?: number;
    currency?: string;
    source?: string;
    url?: string;
    seller?: string;
    isActive?: boolean;
    scrapedAt?: Date;
    metadata?: any;
    
    // New fields
    language?: string | null;
    normalizedName?: string | null;
    setCode?: string | null;
    rarity?: string | null;
    variantKey?: string | null;
    
    createdAt?: Date;
    updatedAt?: Date;
  }
  
  // Extend where input to accept legacy filters
  interface CardWhereInput {
    id?: string | StringFilter;
    name?: string | StringFilter;
    set?: string | StringFilter;
    number?: string | StringFilter;
    
    // Legacy filters for compatibility
    source?: string | StringFilter;
    price?: number | IntFilter | FloatFilter;
    scrapedAt?: Date | DateTimeFilter;
    title?: string | StringFilter;
    
    AND?: CardWhereInput | CardWhereInput[];
    OR?: CardWhereInput[];
    NOT?: CardWhereInput | CardWhereInput[];
    
    [key: string]: any;
  }
  
  // Extend select to include legacy fields
  interface CardSelect<T = any> {
    id?: boolean;
    name?: boolean;
    set?: boolean;
    number?: boolean;
    variant?: boolean;
    grade?: boolean;
    condition?: boolean;
    
    // Legacy selects
    title?: boolean;
    price?: boolean;
    currency?: boolean;
    source?: boolean;
    url?: boolean;
    seller?: boolean;
    isActive?: boolean;
    scrapedAt?: boolean;
    metadata?: boolean;
    
    // New fields
    language?: boolean;
    normalizedName?: boolean;
    setCode?: boolean;
    rarity?: boolean;
    variantKey?: boolean;
    
    createdAt?: boolean;
    updatedAt?: boolean;
    
    [key: string]: any;
  }
  
  // Extend order by to include legacy fields
  interface CardOrderByWithRelationInput {
    id?: SortOrder;
    name?: SortOrder;
    set?: SortOrder;
    number?: SortOrder;
    
    // Legacy ordering
    source?: SortOrder;
    price?: SortOrder;
    scrapedAt?: SortOrder;
    title?: SortOrder;
    
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    
    [key: string]: any;
  }
  
  // Extend aggregate inputs to include legacy fields
  interface CardMinAggregateInputType {
    id?: boolean;
    name?: boolean;
    set?: boolean;
    number?: boolean;
    
    // Legacy aggregates
    price?: boolean;
    source?: boolean;
    title?: boolean;
    
    createdAt?: boolean;
    updatedAt?: boolean;
    
    [key: string]: any;
  }
  
  interface CardMaxAggregateInputType {
    id?: boolean;
    name?: boolean;
    set?: boolean;
    number?: boolean;
    
    // Legacy aggregates
    price?: boolean;
    source?: boolean;
    title?: boolean;
    
    createdAt?: boolean;
    updatedAt?: boolean;
    
    [key: string]: any;
  }
  
  interface CardCountAggregateInputType {
    id?: boolean;
    name?: boolean;
    set?: boolean;
    number?: boolean;
    
    // Legacy counts
    price?: boolean;
    source?: boolean;
    title?: boolean;
    
    createdAt?: boolean;
    updatedAt?: boolean;
    _all?: boolean;
    
    [key: string]: any;
  }
  
  // Fix aggregate result types
  interface GetCardAggregateType<T> {
    _count?: CardCountAggregateOutputType | null;
    _min?: CardMinAggregateOutputType | null;
    _max?: CardMaxAggregateOutputType | null;
    _avg?: CardAvgAggregateOutputType | null;
    _sum?: CardSumAggregateOutputType | null;
  }
  
  interface CardCountAggregateOutputType {
    id?: number;
    name?: number;
    set?: number;
    number?: number;
    price?: number; // Legacy support
    _all?: number;
    [key: string]: number | undefined;
  }
  
  interface CardMinAggregateOutputType {
    id?: string | null;
    name?: string | null;
    set?: string | null;
    number?: string | null;
    price?: number | null; // Legacy support
    createdAt?: Date | null;
    updatedAt?: Date | null;
    [key: string]: any;
  }
  
  interface CardMaxAggregateOutputType {
    id?: string | null;
    name?: string | null;
    set?: string | null;
    number?: string | null;
    price?: number | null; // Legacy support
    createdAt?: Date | null;
    updatedAt?: Date | null;
    [key: string]: any;
  }
  
  interface CardAvgAggregateOutputType {
    price?: number | null; // Legacy support
    [key: string]: number | null | undefined;
  }
  
  interface CardSumAggregateOutputType {
    price?: number | null; // Legacy support
    [key: string]: number | null | undefined;
  }
}
