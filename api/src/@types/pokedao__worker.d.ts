declare module '@pokedao/worker' {
  export function normalizeCardQuery(input: any): any;
  export function getComparableSales(input: any): Promise<{ comps: any[] }>;
  export function sanitizeComps(input: any[]): any[];
  export function computeFairValue(comps: any[]): {
    fv: number;
    confidence: number;
    basis?: any;
  };
}

