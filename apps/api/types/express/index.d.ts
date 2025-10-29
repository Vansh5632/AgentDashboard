// apps/api/types/express/index.d.ts

// Tell TypeScript we're merging our definition with the original Express definition
declare global {
  namespace Express {
    export interface Request {
      user?: { // Make it optional or define a specific type
        userId: string;
        tenantId: string;
      };
    }
  }
}

// This export is required to make this file a module
export {};