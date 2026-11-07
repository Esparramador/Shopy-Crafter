export * from "./generated/api";
export * from "./generated/types";
import type { GetProjectProductsParams as GetProjectProductsParamsType, ListAbTestsParams as ListAbTestsParamsType } from "./generated/types";
export declare const GetProjectProductsParams: import("zod").ZodObject<{
    projectId: import("zod").ZodCoercedNumber<unknown>;
}, import("zod/v4/core").$strip>;
export type GetProjectProductsParams = GetProjectProductsParamsType;
export declare const ListAbTestsParams: import("zod").ZodObject<{
    projectId: import("zod").ZodCoercedNumber<unknown>;
}, import("zod/v4/core").$strip>;
export type ListAbTestsParams = ListAbTestsParamsType;
import type { GetWooResourceParams as GetWooResourceParamsType, GetWooSchemaParams as GetWooSchemaParamsType, ListWooResourcesParams as ListWooResourcesParamsType, UpdateWooResourceParams as UpdateWooResourceParamsType } from "./generated/types";
export declare const GetWooResourceParams: import("zod").ZodObject<{
    id: import("zod").ZodCoercedNumber<unknown>;
    resource: import("zod").ZodEnum<{
        products: "products";
        variations: "variations";
        categories: "categories";
        attributes: "attributes";
        terms: "terms";
        orders: "orders";
        customers: "customers";
        coupons: "coupons";
    }>;
    entityId: import("zod").ZodCoercedNumber<unknown>;
}, import("zod/v4/core").$strip>;
export type GetWooResourceParams = GetWooResourceParamsType;
export declare const GetWooSchemaParams: import("zod").ZodObject<{
    id: import("zod").ZodCoercedNumber<unknown>;
    resource: import("zod").ZodEnum<{
        products: "products";
        variations: "variations";
        categories: "categories";
        attributes: "attributes";
        terms: "terms";
        orders: "orders";
        customers: "customers";
        coupons: "coupons";
    }>;
}, import("zod/v4/core").$strip>;
export type GetWooSchemaParams = GetWooSchemaParamsType;
export declare const ListWooResourcesParams: import("zod").ZodObject<{
    id: import("zod").ZodCoercedNumber<unknown>;
    resource: import("zod").ZodEnum<{
        products: "products";
        variations: "variations";
        categories: "categories";
        attributes: "attributes";
        terms: "terms";
        orders: "orders";
        customers: "customers";
        coupons: "coupons";
    }>;
}, import("zod/v4/core").$strip>;
export type ListWooResourcesParams = ListWooResourcesParamsType;
export declare const UpdateWooResourceParams: import("zod").ZodObject<{
    id: import("zod").ZodCoercedNumber<unknown>;
    resource: import("zod").ZodEnum<{
        products: "products";
        variations: "variations";
        categories: "categories";
        attributes: "attributes";
        terms: "terms";
        orders: "orders";
        customers: "customers";
        coupons: "coupons";
    }>;
    entityId: import("zod").ZodCoercedNumber<unknown>;
}, import("zod/v4/core").$strip>;
export type UpdateWooResourceParams = UpdateWooResourceParamsType;
//# sourceMappingURL=index.d.ts.map