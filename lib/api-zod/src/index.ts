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
// Query types share operation names with path-parameter Zod values in Orval.
import {
  GetWooResourceParams as GetWooResourceParamsSchema,
  GetWooSchemaParams as GetWooSchemaParamsSchema,
  ListWooResourcesParams as ListWooResourcesParamsSchema,
  UpdateWooResourceParams as UpdateWooResourceParamsSchema,
} from "./generated/api";
import type {
  GetWooResourceParams as GetWooResourceParamsType,
  GetWooSchemaParams as GetWooSchemaParamsType,
  ListWooResourcesParams as ListWooResourcesParamsType,
  UpdateWooResourceParams as UpdateWooResourceParamsType,
} from "./generated/types";
export const GetWooResourceParams = GetWooResourceParamsSchema;
export type GetWooResourceParams = GetWooResourceParamsType;
export const GetWooSchemaParams = GetWooSchemaParamsSchema;
export type GetWooSchemaParams = GetWooSchemaParamsType;
export const ListWooResourcesParams = ListWooResourcesParamsSchema;
export type ListWooResourcesParams = ListWooResourcesParamsType;
export const UpdateWooResourceParams = UpdateWooResourceParamsSchema;
export type UpdateWooResourceParams = UpdateWooResourceParamsType;
