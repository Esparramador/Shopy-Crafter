export * from "./generated/api";
export * from "./generated/types";

// orval genera un esquema zod (valor) y un tipo con el mismo nombre para estos
// parámetros; `export *` doble los vuelve ambiguos, así que se reexportan ambos.
import {
  GetProjectProductsParams as GetProjectProductsParamsSchema,
  ListAbTestsParams as ListAbTestsParamsSchema,
} from "./generated/api";
import type {
  GetProjectProductsParams as GetProjectProductsParamsType,
  ListAbTestsParams as ListAbTestsParamsType,
} from "./generated/types";
export const GetProjectProductsParams = GetProjectProductsParamsSchema;
export type GetProjectProductsParams = GetProjectProductsParamsType;
export const ListAbTestsParams = ListAbTestsParamsSchema;
export type ListAbTestsParams = ListAbTestsParamsType;
