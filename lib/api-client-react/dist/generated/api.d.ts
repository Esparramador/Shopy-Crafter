import type { DataTag, DefinedInitialDataOptions, DefinedUseQueryResult, QueryClient, QueryKey, UndefinedInitialDataOptions, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AbDashboard, AbTest, ApplyPriceInput, ApplyRedesignInput, AuditSummary, BlogPost, BlogPostInput, BlogStrategy, BuildPromptInput, BulkGenerateInput, BulkJobResponse, BulkRedesignInput, CatalogOpportunity, CmsPage, CmsPageInput, CogsData, CompetitorAnalysisInput, CompetitorAnalysisResult, ConnectionTestResult, ConsistencyDashboard, CreateAbTestInput, CreateProjectInput, DeclareWinnerInput, ErrorResponse, FinancialDashboard, GenerateImageInput, GenerationJob, GetProjectProductsParams, GetWooResourceParams, GetWooSchemaParams, HealthStatus, InfographicResult, JobStatus, KeywordInput, KeywordStrategy, ListAbTestsParams, ListCmsPagesResult, ListImageEnginesResult, ListWooResourcesParams, PageSpeedInput, PageSpeedResult, PricingRecommendation, ProductAuditResult, ProductDetail, ProductListResponse, Project, PromptPreview, RedesignResult, RepairConsistencyInput, SaveCogsInput, SeoActionInput, SeoAuditResult, SimpleSuccess, SitemapResult, SuccessResponse, SyncResult, TokenRefreshResult, TrackEvent, UpdateProjectInput, UpdateWooResourceParams, VisualDna, WooImportInput, WooMutation, WooObject, WooPreviewInput, WooUploadInput } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getGetWooOverviewUrl: (id: number) => string;
export declare const getWooOverview: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getGetWooOverviewQueryKey: (id: number) => readonly [`/api/admin/woo/project/${number}/overview`];
export declare const getGetWooOverviewQueryOptions: <TData = Awaited<ReturnType<typeof getWooOverview>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooOverview>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getWooOverview>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetWooOverviewQueryResult = NonNullable<Awaited<ReturnType<typeof getWooOverview>>>;
export type GetWooOverviewQueryError = ErrorType<unknown>;
export declare function useGetWooOverview<TData = Awaited<ReturnType<typeof getWooOverview>>, TError = ErrorType<unknown>>(id: number, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooOverview>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getWooOverview>>, TError, Awaited<ReturnType<typeof getWooOverview>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooOverview<TData = Awaited<ReturnType<typeof getWooOverview>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooOverview>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getWooOverview>>, TError, Awaited<ReturnType<typeof getWooOverview>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooOverview<TData = Awaited<ReturnType<typeof getWooOverview>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooOverview>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getGetWooInventoryUrl: (id: number) => string;
export declare const getWooInventory: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getGetWooInventoryQueryKey: (id: number) => readonly [`/api/admin/woo/project/${number}/inventory`];
export declare const getGetWooInventoryQueryOptions: <TData = Awaited<ReturnType<typeof getWooInventory>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooInventory>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getWooInventory>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetWooInventoryQueryResult = NonNullable<Awaited<ReturnType<typeof getWooInventory>>>;
export type GetWooInventoryQueryError = ErrorType<unknown>;
export declare function useGetWooInventory<TData = Awaited<ReturnType<typeof getWooInventory>>, TError = ErrorType<unknown>>(id: number, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooInventory>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getWooInventory>>, TError, Awaited<ReturnType<typeof getWooInventory>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooInventory<TData = Awaited<ReturnType<typeof getWooInventory>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooInventory>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getWooInventory>>, TError, Awaited<ReturnType<typeof getWooInventory>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooInventory<TData = Awaited<ReturnType<typeof getWooInventory>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooInventory>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getListWooResourcesUrl: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", params?: ListWooResourcesParams) => string;
export declare const listWooResources: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", params?: ListWooResourcesParams, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getListWooResourcesQueryKey: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", params?: ListWooResourcesParams) => readonly [`/api/admin/woo/project/${number}/resources/products` | `/api/admin/woo/project/${number}/resources/variations` | `/api/admin/woo/project/${number}/resources/categories` | `/api/admin/woo/project/${number}/resources/attributes` | `/api/admin/woo/project/${number}/resources/terms` | `/api/admin/woo/project/${number}/resources/orders` | `/api/admin/woo/project/${number}/resources/customers` | `/api/admin/woo/project/${number}/resources/coupons`, ...ListWooResourcesParams[]];
export declare const getListWooResourcesQueryOptions: <TData = Awaited<ReturnType<typeof listWooResources>>, TError = ErrorType<unknown>>(id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", params?: ListWooResourcesParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listWooResources>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listWooResources>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListWooResourcesQueryResult = NonNullable<Awaited<ReturnType<typeof listWooResources>>>;
export type ListWooResourcesQueryError = ErrorType<unknown>;
export declare function useListWooResources<TData = Awaited<ReturnType<typeof listWooResources>>, TError = ErrorType<unknown>>(id: number, resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons', params: undefined | ListWooResourcesParams, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listWooResources>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listWooResources>>, TError, Awaited<ReturnType<typeof listWooResources>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListWooResources<TData = Awaited<ReturnType<typeof listWooResources>>, TError = ErrorType<unknown>>(id: number, resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons', params?: ListWooResourcesParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listWooResources>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listWooResources>>, TError, Awaited<ReturnType<typeof listWooResources>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListWooResources<TData = Awaited<ReturnType<typeof listWooResources>>, TError = ErrorType<unknown>>(id: number, resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons', params?: ListWooResourcesParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listWooResources>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getCreateWooResourceUrl: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons") => string;
export declare const createWooResource: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", wooMutation: WooMutation, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getCreateWooResourceMutationKey: () => readonly ["createWooResource"];
export declare const getCreateWooResourceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createWooResource>>, TError, CreateWooResourceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createWooResource>>, TError, CreateWooResourceMutationVariables, TContext>;
export type CreateWooResourceMutationResult = NonNullable<Awaited<ReturnType<typeof createWooResource>>>;
export type CreateWooResourceMutationBody = BodyType<WooMutation>;
export type CreateWooResourceMutationError = ErrorType<unknown>;
export type CreateWooResourceMutationVariables = {
    id: number;
    resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons';
    data: BodyType<WooMutation>;
};
export declare const useCreateWooResource: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createWooResource>>, TError, CreateWooResourceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createWooResource>>, TError, CreateWooResourceMutationVariables, TContext>;
export declare const getGetWooResourceUrl: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", entityId: number, params?: GetWooResourceParams) => string;
export declare const getWooResource: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", entityId: number, params?: GetWooResourceParams, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getGetWooResourceQueryKey: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", entityId: number, params?: GetWooResourceParams) => readonly [`/api/admin/woo/project/${number}/resources/products/${number}` | `/api/admin/woo/project/${number}/resources/variations/${number}` | `/api/admin/woo/project/${number}/resources/categories/${number}` | `/api/admin/woo/project/${number}/resources/attributes/${number}` | `/api/admin/woo/project/${number}/resources/terms/${number}` | `/api/admin/woo/project/${number}/resources/orders/${number}` | `/api/admin/woo/project/${number}/resources/customers/${number}` | `/api/admin/woo/project/${number}/resources/coupons/${number}`, ...GetWooResourceParams[]];
export declare const getGetWooResourceQueryOptions: <TData = Awaited<ReturnType<typeof getWooResource>>, TError = ErrorType<unknown>>(id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", entityId: number, params?: GetWooResourceParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooResource>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getWooResource>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetWooResourceQueryResult = NonNullable<Awaited<ReturnType<typeof getWooResource>>>;
export type GetWooResourceQueryError = ErrorType<unknown>;
export declare function useGetWooResource<TData = Awaited<ReturnType<typeof getWooResource>>, TError = ErrorType<unknown>>(id: number, resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons', entityId: number, params: undefined | GetWooResourceParams, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooResource>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getWooResource>>, TError, Awaited<ReturnType<typeof getWooResource>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooResource<TData = Awaited<ReturnType<typeof getWooResource>>, TError = ErrorType<unknown>>(id: number, resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons', entityId: number, params?: GetWooResourceParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooResource>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getWooResource>>, TError, Awaited<ReturnType<typeof getWooResource>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooResource<TData = Awaited<ReturnType<typeof getWooResource>>, TError = ErrorType<unknown>>(id: number, resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons', entityId: number, params?: GetWooResourceParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooResource>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getUpdateWooResourceUrl: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", entityId: number, params?: UpdateWooResourceParams) => string;
export declare const updateWooResource: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", entityId: number, wooMutation: WooMutation, params?: UpdateWooResourceParams, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getUpdateWooResourceMutationKey: () => readonly ["updateWooResource"];
export declare const getUpdateWooResourceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateWooResource>>, TError, UpdateWooResourceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateWooResource>>, TError, UpdateWooResourceMutationVariables, TContext>;
export type UpdateWooResourceMutationResult = NonNullable<Awaited<ReturnType<typeof updateWooResource>>>;
export type UpdateWooResourceMutationBody = BodyType<WooMutation>;
export type UpdateWooResourceMutationError = ErrorType<unknown>;
export type UpdateWooResourceMutationVariables = {
    id: number;
    resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons';
    entityId: number;
    data: BodyType<WooMutation>;
    params?: UpdateWooResourceParams;
};
export declare const useUpdateWooResource: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateWooResource>>, TError, UpdateWooResourceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof updateWooResource>>, TError, UpdateWooResourceMutationVariables, TContext>;
export declare const getGetWooSchemaUrl: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", params?: GetWooSchemaParams) => string;
export declare const getWooSchema: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", params?: GetWooSchemaParams, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getGetWooSchemaQueryKey: (id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", params?: GetWooSchemaParams) => readonly [`/api/admin/woo/project/${number}/schema/products` | `/api/admin/woo/project/${number}/schema/variations` | `/api/admin/woo/project/${number}/schema/categories` | `/api/admin/woo/project/${number}/schema/attributes` | `/api/admin/woo/project/${number}/schema/terms` | `/api/admin/woo/project/${number}/schema/orders` | `/api/admin/woo/project/${number}/schema/customers` | `/api/admin/woo/project/${number}/schema/coupons`, ...GetWooSchemaParams[]];
export declare const getGetWooSchemaQueryOptions: <TData = Awaited<ReturnType<typeof getWooSchema>>, TError = ErrorType<unknown>>(id: number, resource: "products" | "variations" | "categories" | "attributes" | "terms" | "orders" | "customers" | "coupons", params?: GetWooSchemaParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooSchema>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getWooSchema>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetWooSchemaQueryResult = NonNullable<Awaited<ReturnType<typeof getWooSchema>>>;
export type GetWooSchemaQueryError = ErrorType<unknown>;
export declare function useGetWooSchema<TData = Awaited<ReturnType<typeof getWooSchema>>, TError = ErrorType<unknown>>(id: number, resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons', params: undefined | GetWooSchemaParams, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooSchema>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getWooSchema>>, TError, Awaited<ReturnType<typeof getWooSchema>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooSchema<TData = Awaited<ReturnType<typeof getWooSchema>>, TError = ErrorType<unknown>>(id: number, resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons', params?: GetWooSchemaParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooSchema>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getWooSchema>>, TError, Awaited<ReturnType<typeof getWooSchema>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooSchema<TData = Awaited<ReturnType<typeof getWooSchema>>, TError = ErrorType<unknown>>(id: number, resource: 'products' | 'variations' | 'categories' | 'attributes' | 'terms' | 'orders' | 'customers' | 'coupons', params?: GetWooSchemaParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooSchema>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getRequestWooUploadUrl: (id: number) => string;
export declare const requestWooUpload: (id: number, wooUploadInput: WooUploadInput, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getRequestWooUploadMutationKey: () => readonly ["requestWooUpload"];
export declare const getRequestWooUploadMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestWooUpload>>, TError, RequestWooUploadMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof requestWooUpload>>, TError, RequestWooUploadMutationVariables, TContext>;
export type RequestWooUploadMutationResult = NonNullable<Awaited<ReturnType<typeof requestWooUpload>>>;
export type RequestWooUploadMutationBody = BodyType<WooUploadInput>;
export type RequestWooUploadMutationError = ErrorType<unknown>;
export type RequestWooUploadMutationVariables = {
    id: number;
    data: BodyType<WooUploadInput>;
};
export declare const useRequestWooUpload: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestWooUpload>>, TError, RequestWooUploadMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof requestWooUpload>>, TError, RequestWooUploadMutationVariables, TContext>;
export declare const getPreviewWooFilesUrl: (id: number) => string;
export declare const previewWooFiles: (id: number, wooPreviewInput: WooPreviewInput, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getPreviewWooFilesMutationKey: () => readonly ["previewWooFiles"];
export declare const getPreviewWooFilesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof previewWooFiles>>, TError, PreviewWooFilesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof previewWooFiles>>, TError, PreviewWooFilesMutationVariables, TContext>;
export type PreviewWooFilesMutationResult = NonNullable<Awaited<ReturnType<typeof previewWooFiles>>>;
export type PreviewWooFilesMutationBody = BodyType<WooPreviewInput>;
export type PreviewWooFilesMutationError = ErrorType<unknown>;
export type PreviewWooFilesMutationVariables = {
    id: number;
    data: BodyType<WooPreviewInput>;
};
export declare const usePreviewWooFiles: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof previewWooFiles>>, TError, PreviewWooFilesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof previewWooFiles>>, TError, PreviewWooFilesMutationVariables, TContext>;
export declare const getGetWooImportUrl: (id: number, importId: string) => string;
export declare const getWooImport: (id: number, importId: string, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getGetWooImportQueryKey: (id: number, importId: string) => readonly [`/api/admin/woo/project/${number}/imports/${string}`];
export declare const getGetWooImportQueryOptions: <TData = Awaited<ReturnType<typeof getWooImport>>, TError = ErrorType<unknown>>(id: number, importId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooImport>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getWooImport>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetWooImportQueryResult = NonNullable<Awaited<ReturnType<typeof getWooImport>>>;
export type GetWooImportQueryError = ErrorType<unknown>;
export declare function useGetWooImport<TData = Awaited<ReturnType<typeof getWooImport>>, TError = ErrorType<unknown>>(id: number, importId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooImport>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getWooImport>>, TError, Awaited<ReturnType<typeof getWooImport>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooImport<TData = Awaited<ReturnType<typeof getWooImport>>, TError = ErrorType<unknown>>(id: number, importId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooImport>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getWooImport>>, TError, Awaited<ReturnType<typeof getWooImport>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWooImport<TData = Awaited<ReturnType<typeof getWooImport>>, TError = ErrorType<unknown>>(id: number, importId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWooImport>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getApplyWooFilesUrl: (id: number, importId: string) => string;
export declare const applyWooFiles: (id: number, importId: string, wooImportInput: WooImportInput, options?: Parameters<typeof customFetch>[1]) => Promise<WooObject>;
export declare const getApplyWooFilesMutationKey: () => readonly ["applyWooFiles"];
export declare const getApplyWooFilesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyWooFiles>>, TError, ApplyWooFilesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof applyWooFiles>>, TError, ApplyWooFilesMutationVariables, TContext>;
export type ApplyWooFilesMutationResult = NonNullable<Awaited<ReturnType<typeof applyWooFiles>>>;
export type ApplyWooFilesMutationBody = BodyType<WooImportInput>;
export type ApplyWooFilesMutationError = ErrorType<unknown>;
export type ApplyWooFilesMutationVariables = {
    id: number;
    importId: string;
    data: BodyType<WooImportInput>;
};
export declare const useApplyWooFiles: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyWooFiles>>, TError, ApplyWooFilesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof applyWooFiles>>, TError, ApplyWooFilesMutationVariables, TContext>;
export declare const getGetPublishedWooFileUrl: (projectId: number, token: string) => string;
export declare const getPublishedWooFile: (projectId: number, token: string, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getGetPublishedWooFileQueryKey: (projectId: number, token: string) => readonly [`/api/woo-media/${number}/${string}`];
export declare const getGetPublishedWooFileQueryOptions: <TData = Awaited<ReturnType<typeof getPublishedWooFile>>, TError = ErrorType<void>>(projectId: number, token: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getPublishedWooFile>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPublishedWooFile>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetPublishedWooFileQueryResult = NonNullable<Awaited<ReturnType<typeof getPublishedWooFile>>>;
export type GetPublishedWooFileQueryError = ErrorType<void>;
export declare function useGetPublishedWooFile<TData = Awaited<ReturnType<typeof getPublishedWooFile>>, TError = ErrorType<void>>(projectId: number, token: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getPublishedWooFile>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getPublishedWooFile>>, TError, Awaited<ReturnType<typeof getPublishedWooFile>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetPublishedWooFile<TData = Awaited<ReturnType<typeof getPublishedWooFile>>, TError = ErrorType<void>>(projectId: number, token: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getPublishedWooFile>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getPublishedWooFile>>, TError, Awaited<ReturnType<typeof getPublishedWooFile>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetPublishedWooFile<TData = Awaited<ReturnType<typeof getPublishedWooFile>>, TError = ErrorType<void>>(projectId: number, token: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getPublishedWooFile>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getListProjectsUrl: () => string;
/**
 * @summary List all projects
 */
export declare const listProjects: (options?: Parameters<typeof customFetch>[1]) => Promise<Project[]>;
export declare const getListProjectsQueryKey: () => readonly ["/api/projects"];
export declare const getListProjectsQueryOptions: <TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListProjectsQueryResult = NonNullable<Awaited<ReturnType<typeof listProjects>>>;
export type ListProjectsQueryError = ErrorType<unknown>;
export declare function useListProjects<TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listProjects>>, TError, Awaited<ReturnType<typeof listProjects>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListProjects<TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listProjects>>, TError, Awaited<ReturnType<typeof listProjects>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListProjects<TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getCreateProjectUrl: () => string;
/**
 * @summary Create a new project (one per Shopify store)
 */
export declare const createProject: (createProjectInput: CreateProjectInput, options?: Parameters<typeof customFetch>[1]) => Promise<Project>;
export declare const getCreateProjectMutationKey: () => readonly ["createProject"];
export declare const getCreateProjectMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProject>>, TError, CreateProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createProject>>, TError, CreateProjectMutationVariables, TContext>;
export type CreateProjectMutationResult = NonNullable<Awaited<ReturnType<typeof createProject>>>;
export type CreateProjectMutationBody = BodyType<CreateProjectInput>;
export type CreateProjectMutationError = ErrorType<ErrorResponse>;
export type CreateProjectMutationVariables = {
    data: BodyType<CreateProjectInput>;
};
/**
* @summary Create a new project (one per Shopify store)
*/
export declare const useCreateProject: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProject>>, TError, CreateProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createProject>>, TError, CreateProjectMutationVariables, TContext>;
export declare const getGetProjectUrl: (projectId: number) => string;
/**
 * @summary Get project by ID
 */
export declare const getProject: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<Project>;
export declare const getGetProjectQueryKey: (projectId: number) => readonly [`/api/projects/${number}`];
export declare const getGetProjectQueryOptions: <TData = Awaited<ReturnType<typeof getProject>>, TError = ErrorType<ErrorResponse>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProject>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProject>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetProjectQueryResult = NonNullable<Awaited<ReturnType<typeof getProject>>>;
export type GetProjectQueryError = ErrorType<ErrorResponse>;
export declare function useGetProject<TData = Awaited<ReturnType<typeof getProject>>, TError = ErrorType<ErrorResponse>>(projectId: number, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProject>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getProject>>, TError, Awaited<ReturnType<typeof getProject>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetProject<TData = Awaited<ReturnType<typeof getProject>>, TError = ErrorType<ErrorResponse>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProject>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getProject>>, TError, Awaited<ReturnType<typeof getProject>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetProject<TData = Awaited<ReturnType<typeof getProject>>, TError = ErrorType<ErrorResponse>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProject>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getUpdateProjectUrl: (projectId: number) => string;
/**
 * @summary Update project configuration
 */
export declare const updateProject: (projectId: number, updateProjectInput: UpdateProjectInput, options?: Parameters<typeof customFetch>[1]) => Promise<Project>;
export declare const getUpdateProjectMutationKey: () => readonly ["updateProject"];
export declare const getUpdateProjectMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProject>>, TError, UpdateProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateProject>>, TError, UpdateProjectMutationVariables, TContext>;
export type UpdateProjectMutationResult = NonNullable<Awaited<ReturnType<typeof updateProject>>>;
export type UpdateProjectMutationBody = BodyType<UpdateProjectInput>;
export type UpdateProjectMutationError = ErrorType<unknown>;
export type UpdateProjectMutationVariables = {
    projectId: number;
    data: BodyType<UpdateProjectInput>;
};
/**
* @summary Update project configuration
*/
export declare const useUpdateProject: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProject>>, TError, UpdateProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof updateProject>>, TError, UpdateProjectMutationVariables, TContext>;
export declare const getDeleteProjectUrl: (projectId: number) => string;
/**
 * @summary Delete project
 */
export declare const deleteProject: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getDeleteProjectMutationKey: () => readonly ["deleteProject"];
export declare const getDeleteProjectMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteProject>>, TError, DeleteProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteProject>>, TError, DeleteProjectMutationVariables, TContext>;
export type DeleteProjectMutationResult = NonNullable<Awaited<ReturnType<typeof deleteProject>>>;
export type DeleteProjectMutationError = ErrorType<unknown>;
export type DeleteProjectMutationVariables = {
    projectId: number;
};
/**
* @summary Delete project
*/
export declare const useDeleteProject: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteProject>>, TError, DeleteProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof deleteProject>>, TError, DeleteProjectMutationVariables, TContext>;
export declare const getRefreshProjectTokenUrl: (projectId: number) => string;
/**
 * @summary Refresh Shopify OAuth access token using client_credentials
 */
export declare const refreshProjectToken: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<TokenRefreshResult>;
export declare const getRefreshProjectTokenMutationKey: () => readonly ["refreshProjectToken"];
export declare const getRefreshProjectTokenMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof refreshProjectToken>>, TError, RefreshProjectTokenMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof refreshProjectToken>>, TError, RefreshProjectTokenMutationVariables, TContext>;
export type RefreshProjectTokenMutationResult = NonNullable<Awaited<ReturnType<typeof refreshProjectToken>>>;
export type RefreshProjectTokenMutationError = ErrorType<ErrorResponse>;
export type RefreshProjectTokenMutationVariables = {
    projectId: number;
};
/**
* @summary Refresh Shopify OAuth access token using client_credentials
*/
export declare const useRefreshProjectToken: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof refreshProjectToken>>, TError, RefreshProjectTokenMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof refreshProjectToken>>, TError, RefreshProjectTokenMutationVariables, TContext>;
export declare const getTestProjectConnectionUrl: (projectId: number) => string;
/**
 * @summary Test Shopify connection and token validity
 */
export declare const testProjectConnection: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<ConnectionTestResult>;
export declare const getTestProjectConnectionMutationKey: () => readonly ["testProjectConnection"];
export declare const getTestProjectConnectionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof testProjectConnection>>, TError, TestProjectConnectionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof testProjectConnection>>, TError, TestProjectConnectionMutationVariables, TContext>;
export type TestProjectConnectionMutationResult = NonNullable<Awaited<ReturnType<typeof testProjectConnection>>>;
export type TestProjectConnectionMutationError = ErrorType<unknown>;
export type TestProjectConnectionMutationVariables = {
    projectId: number;
};
/**
* @summary Test Shopify connection and token validity
*/
export declare const useTestProjectConnection: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof testProjectConnection>>, TError, TestProjectConnectionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof testProjectConnection>>, TError, TestProjectConnectionMutationVariables, TContext>;
export declare const getGetProjectProductsUrl: (projectId: number, params?: GetProjectProductsParams) => string;
/**
 * @summary Get all products from Shopify store (with local audit data)
 */
export declare const getProjectProducts: (projectId: number, params?: GetProjectProductsParams, options?: Parameters<typeof customFetch>[1]) => Promise<ProductListResponse>;
export declare const getGetProjectProductsQueryKey: (projectId: number, params?: GetProjectProductsParams) => readonly [`/api/projects/${number}/products`, ...GetProjectProductsParams[]];
export declare const getGetProjectProductsQueryOptions: <TData = Awaited<ReturnType<typeof getProjectProducts>>, TError = ErrorType<unknown>>(projectId: number, params?: GetProjectProductsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetProjectProductsQueryResult = NonNullable<Awaited<ReturnType<typeof getProjectProducts>>>;
export type GetProjectProductsQueryError = ErrorType<unknown>;
export declare function useGetProjectProducts<TData = Awaited<ReturnType<typeof getProjectProducts>>, TError = ErrorType<unknown>>(projectId: number, params: undefined | GetProjectProductsParams, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, Awaited<ReturnType<typeof getProjectProducts>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetProjectProducts<TData = Awaited<ReturnType<typeof getProjectProducts>>, TError = ErrorType<unknown>>(projectId: number, params?: GetProjectProductsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, Awaited<ReturnType<typeof getProjectProducts>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetProjectProducts<TData = Awaited<ReturnType<typeof getProjectProducts>>, TError = ErrorType<unknown>>(projectId: number, params?: GetProjectProductsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getSyncProductsUrl: (projectId: number) => string;
/**
 * @summary Sync all products from Shopify and run audit
 */
export declare const syncProducts: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<SyncResult>;
export declare const getSyncProductsMutationKey: () => readonly ["syncProducts"];
export declare const getSyncProductsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof syncProducts>>, TError, SyncProductsMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof syncProducts>>, TError, SyncProductsMutationVariables, TContext>;
export type SyncProductsMutationResult = NonNullable<Awaited<ReturnType<typeof syncProducts>>>;
export type SyncProductsMutationError = ErrorType<unknown>;
export type SyncProductsMutationVariables = {
    projectId: number;
};
/**
* @summary Sync all products from Shopify and run audit
*/
export declare const useSyncProducts: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof syncProducts>>, TError, SyncProductsMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof syncProducts>>, TError, SyncProductsMutationVariables, TContext>;
export declare const getGetProductUrl: (projectId: number, productId: string) => string;
/**
 * @summary Get single product with full audit data
 */
export declare const getProduct: (projectId: number, productId: string, options?: Parameters<typeof customFetch>[1]) => Promise<ProductDetail>;
export declare const getGetProductQueryKey: (projectId: number, productId: string) => readonly [`/api/projects/${number}/products/${string}`];
export declare const getGetProductQueryOptions: <TData = Awaited<ReturnType<typeof getProduct>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetProductQueryResult = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
export type GetProductQueryError = ErrorType<unknown>;
export declare function useGetProduct<TData = Awaited<ReturnType<typeof getProduct>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getProduct>>, TError, Awaited<ReturnType<typeof getProduct>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetProduct<TData = Awaited<ReturnType<typeof getProduct>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getProduct>>, TError, Awaited<ReturnType<typeof getProduct>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetProduct<TData = Awaited<ReturnType<typeof getProduct>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getRunAuditUrl: (projectId: number) => string;
/**
 * @summary Run product audit for entire store
 */
export declare const runAudit: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<AuditSummary>;
export declare const getRunAuditMutationKey: () => readonly ["runAudit"];
export declare const getRunAuditMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runAudit>>, TError, RunAuditMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof runAudit>>, TError, RunAuditMutationVariables, TContext>;
export type RunAuditMutationResult = NonNullable<Awaited<ReturnType<typeof runAudit>>>;
export type RunAuditMutationError = ErrorType<unknown>;
export type RunAuditMutationVariables = {
    projectId: number;
};
/**
* @summary Run product audit for entire store
*/
export declare const useRunAudit: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runAudit>>, TError, RunAuditMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof runAudit>>, TError, RunAuditMutationVariables, TContext>;
export declare const getAuditProductUrl: (projectId: number, productId: string) => string;
/**
 * @summary Run audit for a single product
 */
export declare const auditProduct: (projectId: number, productId: string, options?: Parameters<typeof customFetch>[1]) => Promise<ProductAuditResult>;
export declare const getAuditProductMutationKey: () => readonly ["auditProduct"];
export declare const getAuditProductMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof auditProduct>>, TError, AuditProductMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof auditProduct>>, TError, AuditProductMutationVariables, TContext>;
export type AuditProductMutationResult = NonNullable<Awaited<ReturnType<typeof auditProduct>>>;
export type AuditProductMutationError = ErrorType<unknown>;
export type AuditProductMutationVariables = {
    projectId: number;
    productId: string;
};
/**
* @summary Run audit for a single product
*/
export declare const useAuditProduct: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof auditProduct>>, TError, AuditProductMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof auditProduct>>, TError, AuditProductMutationVariables, TContext>;
export declare const getGetCatalogOpportunitiesUrl: (projectId: number) => string;
/**
 * @summary Get AI-suggested missing products for the store niche
 */
export declare const getCatalogOpportunities: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<CatalogOpportunity[]>;
export declare const getGetCatalogOpportunitiesMutationKey: () => readonly ["getCatalogOpportunities"];
export declare const getGetCatalogOpportunitiesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getCatalogOpportunities>>, TError, GetCatalogOpportunitiesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof getCatalogOpportunities>>, TError, GetCatalogOpportunitiesMutationVariables, TContext>;
export type GetCatalogOpportunitiesMutationResult = NonNullable<Awaited<ReturnType<typeof getCatalogOpportunities>>>;
export type GetCatalogOpportunitiesMutationError = ErrorType<unknown>;
export type GetCatalogOpportunitiesMutationVariables = {
    projectId: number;
};
/**
* @summary Get AI-suggested missing products for the store niche
*/
export declare const useGetCatalogOpportunities: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getCatalogOpportunities>>, TError, GetCatalogOpportunitiesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof getCatalogOpportunities>>, TError, GetCatalogOpportunitiesMutationVariables, TContext>;
export declare const getRedesignProductUrl: (projectId: number, productId: string) => string;
/**
 * @summary AI redesign a single product with Claude
 */
export declare const redesignProduct: (projectId: number, productId: string, options?: Parameters<typeof customFetch>[1]) => Promise<RedesignResult>;
export declare const getRedesignProductMutationKey: () => readonly ["redesignProduct"];
export declare const getRedesignProductMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof redesignProduct>>, TError, RedesignProductMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof redesignProduct>>, TError, RedesignProductMutationVariables, TContext>;
export type RedesignProductMutationResult = NonNullable<Awaited<ReturnType<typeof redesignProduct>>>;
export type RedesignProductMutationError = ErrorType<unknown>;
export type RedesignProductMutationVariables = {
    projectId: number;
    productId: string;
};
/**
* @summary AI redesign a single product with Claude
*/
export declare const useRedesignProduct: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof redesignProduct>>, TError, RedesignProductMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof redesignProduct>>, TError, RedesignProductMutationVariables, TContext>;
export declare const getApplyRedesignUrl: (projectId: number, productId: string) => string;
/**
 * @summary Apply redesign to Shopify product
 */
export declare const applyRedesign: (projectId: number, productId: string, applyRedesignInput: ApplyRedesignInput, options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getApplyRedesignMutationKey: () => readonly ["applyRedesign"];
export declare const getApplyRedesignMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyRedesign>>, TError, ApplyRedesignMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof applyRedesign>>, TError, ApplyRedesignMutationVariables, TContext>;
export type ApplyRedesignMutationResult = NonNullable<Awaited<ReturnType<typeof applyRedesign>>>;
export type ApplyRedesignMutationBody = BodyType<ApplyRedesignInput>;
export type ApplyRedesignMutationError = ErrorType<unknown>;
export type ApplyRedesignMutationVariables = {
    projectId: number;
    productId: string;
    data: BodyType<ApplyRedesignInput>;
};
/**
* @summary Apply redesign to Shopify product
*/
export declare const useApplyRedesign: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyRedesign>>, TError, ApplyRedesignMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof applyRedesign>>, TError, ApplyRedesignMutationVariables, TContext>;
export declare const getBulkRedesignUrl: (projectId: number) => string;
/**
 * @summary Bulk redesign products (all weak or all)
 */
export declare const bulkRedesign: (projectId: number, bulkRedesignInput: BulkRedesignInput, options?: Parameters<typeof customFetch>[1]) => Promise<BulkJobResponse>;
export declare const getBulkRedesignMutationKey: () => readonly ["bulkRedesign"];
export declare const getBulkRedesignMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkRedesign>>, TError, BulkRedesignMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof bulkRedesign>>, TError, BulkRedesignMutationVariables, TContext>;
export type BulkRedesignMutationResult = NonNullable<Awaited<ReturnType<typeof bulkRedesign>>>;
export type BulkRedesignMutationBody = BodyType<BulkRedesignInput>;
export type BulkRedesignMutationError = ErrorType<unknown>;
export type BulkRedesignMutationVariables = {
    projectId: number;
    data: BodyType<BulkRedesignInput>;
};
/**
* @summary Bulk redesign products (all weak or all)
*/
export declare const useBulkRedesign: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkRedesign>>, TError, BulkRedesignMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof bulkRedesign>>, TError, BulkRedesignMutationVariables, TContext>;
export declare const getListCmsPagesUrl: () => string;
/**
 * @summary Lista páginas (publicadas para público; todas para admin)
 */
export declare const listCmsPages: (options?: Parameters<typeof customFetch>[1]) => Promise<ListCmsPagesResult>;
export declare const getListCmsPagesQueryKey: () => readonly ["/api/cms/pages"];
export declare const getListCmsPagesQueryOptions: <TData = Awaited<ReturnType<typeof listCmsPages>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListCmsPagesQueryResult = NonNullable<Awaited<ReturnType<typeof listCmsPages>>>;
export type ListCmsPagesQueryError = ErrorType<unknown>;
export declare function useListCmsPages<TData = Awaited<ReturnType<typeof listCmsPages>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, Awaited<ReturnType<typeof listCmsPages>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListCmsPages<TData = Awaited<ReturnType<typeof listCmsPages>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, Awaited<ReturnType<typeof listCmsPages>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListCmsPages<TData = Awaited<ReturnType<typeof listCmsPages>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getCreateCmsPageUrl: () => string;
/**
 * @summary Crea una nueva página externa (admin)
 */
export declare const createCmsPage: (cmsPageInput: CmsPageInput, options?: Parameters<typeof customFetch>[1]) => Promise<CmsPage>;
export declare const getCreateCmsPageMutationKey: () => readonly ["createCmsPage"];
export declare const getCreateCmsPageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCmsPage>>, TError, CreateCmsPageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCmsPage>>, TError, CreateCmsPageMutationVariables, TContext>;
export type CreateCmsPageMutationResult = NonNullable<Awaited<ReturnType<typeof createCmsPage>>>;
export type CreateCmsPageMutationBody = BodyType<CmsPageInput>;
export type CreateCmsPageMutationError = ErrorType<unknown>;
export type CreateCmsPageMutationVariables = {
    data: BodyType<CmsPageInput>;
};
/**
* @summary Crea una nueva página externa (admin)
*/
export declare const useCreateCmsPage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCmsPage>>, TError, CreateCmsPageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createCmsPage>>, TError, CreateCmsPageMutationVariables, TContext>;
export declare const getGetCmsPageUrl: (slug: string) => string;
/**
 * @summary Obtiene una página por slug
 */
export declare const getCmsPage: (slug: string, options?: Parameters<typeof customFetch>[1]) => Promise<CmsPage>;
export declare const getGetCmsPageQueryKey: (slug: string) => readonly [`/api/cms/pages/${string}`];
export declare const getGetCmsPageQueryOptions: <TData = Awaited<ReturnType<typeof getCmsPage>>, TError = ErrorType<unknown>>(slug: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetCmsPageQueryResult = NonNullable<Awaited<ReturnType<typeof getCmsPage>>>;
export type GetCmsPageQueryError = ErrorType<unknown>;
export declare function useGetCmsPage<TData = Awaited<ReturnType<typeof getCmsPage>>, TError = ErrorType<unknown>>(slug: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, Awaited<ReturnType<typeof getCmsPage>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetCmsPage<TData = Awaited<ReturnType<typeof getCmsPage>>, TError = ErrorType<unknown>>(slug: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, Awaited<ReturnType<typeof getCmsPage>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetCmsPage<TData = Awaited<ReturnType<typeof getCmsPage>>, TError = ErrorType<unknown>>(slug: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getUpdateCmsPageUrl: (id: number) => string;
/**
 * @summary Actualiza una página (admin)
 */
export declare const updateCmsPage: (id: number, cmsPageInput: CmsPageInput, options?: Parameters<typeof customFetch>[1]) => Promise<CmsPage>;
export declare const getUpdateCmsPageMutationKey: () => readonly ["updateCmsPage"];
export declare const getUpdateCmsPageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCmsPage>>, TError, UpdateCmsPageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateCmsPage>>, TError, UpdateCmsPageMutationVariables, TContext>;
export type UpdateCmsPageMutationResult = NonNullable<Awaited<ReturnType<typeof updateCmsPage>>>;
export type UpdateCmsPageMutationBody = BodyType<CmsPageInput>;
export type UpdateCmsPageMutationError = ErrorType<unknown>;
export type UpdateCmsPageMutationVariables = {
    id: number;
    data: BodyType<CmsPageInput>;
};
/**
* @summary Actualiza una página (admin)
*/
export declare const useUpdateCmsPage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCmsPage>>, TError, UpdateCmsPageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof updateCmsPage>>, TError, UpdateCmsPageMutationVariables, TContext>;
export declare const getDeleteCmsPageUrl: (id: number) => string;
/**
 * @summary Elimina una página (admin)
 */
export declare const deleteCmsPage: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<SimpleSuccess>;
export declare const getDeleteCmsPageMutationKey: () => readonly ["deleteCmsPage"];
export declare const getDeleteCmsPageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCmsPage>>, TError, DeleteCmsPageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteCmsPage>>, TError, DeleteCmsPageMutationVariables, TContext>;
export type DeleteCmsPageMutationResult = NonNullable<Awaited<ReturnType<typeof deleteCmsPage>>>;
export type DeleteCmsPageMutationError = ErrorType<unknown>;
export type DeleteCmsPageMutationVariables = {
    id: number;
};
/**
* @summary Elimina una página (admin)
*/
export declare const useDeleteCmsPage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCmsPage>>, TError, DeleteCmsPageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof deleteCmsPage>>, TError, DeleteCmsPageMutationVariables, TContext>;
export declare const getListImageEnginesUrl: () => string;
/**
 * @summary Lista los motores de generación de imagen disponibles
 */
export declare const listImageEngines: (options?: Parameters<typeof customFetch>[1]) => Promise<ListImageEnginesResult>;
export declare const getListImageEnginesQueryKey: () => readonly ["/api/images/engines"];
export declare const getListImageEnginesQueryOptions: <TData = Awaited<ReturnType<typeof listImageEngines>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListImageEnginesQueryResult = NonNullable<Awaited<ReturnType<typeof listImageEngines>>>;
export type ListImageEnginesQueryError = ErrorType<unknown>;
export declare function useListImageEngines<TData = Awaited<ReturnType<typeof listImageEngines>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, Awaited<ReturnType<typeof listImageEngines>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListImageEngines<TData = Awaited<ReturnType<typeof listImageEngines>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, Awaited<ReturnType<typeof listImageEngines>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListImageEngines<TData = Awaited<ReturnType<typeof listImageEngines>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getGenerateImageUrl: (projectId: number, productId: string) => string;
/**
 * @summary Generate a single product image with Replicate
 */
export declare const generateImage: (projectId: number, productId: string, generateImageInput: GenerateImageInput, options?: Parameters<typeof customFetch>[1]) => Promise<GenerationJob>;
export declare const getGenerateImageMutationKey: () => readonly ["generateImage"];
export declare const getGenerateImageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateImage>>, TError, GenerateImageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateImage>>, TError, GenerateImageMutationVariables, TContext>;
export type GenerateImageMutationResult = NonNullable<Awaited<ReturnType<typeof generateImage>>>;
export type GenerateImageMutationBody = BodyType<GenerateImageInput>;
export type GenerateImageMutationError = ErrorType<unknown>;
export type GenerateImageMutationVariables = {
    projectId: number;
    productId: string;
    data: BodyType<GenerateImageInput>;
};
/**
* @summary Generate a single product image with Replicate
*/
export declare const useGenerateImage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateImage>>, TError, GenerateImageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof generateImage>>, TError, GenerateImageMutationVariables, TContext>;
export declare const getGenerateInfographicUrl: (projectId: number, productId: string) => string;
/**
 * @summary Generate SVG infographic for a product via Claude
 */
export declare const generateInfographic: (projectId: number, productId: string, options?: Parameters<typeof customFetch>[1]) => Promise<InfographicResult>;
export declare const getGenerateInfographicMutationKey: () => readonly ["generateInfographic"];
export declare const getGenerateInfographicMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateInfographic>>, TError, GenerateInfographicMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateInfographic>>, TError, GenerateInfographicMutationVariables, TContext>;
export type GenerateInfographicMutationResult = NonNullable<Awaited<ReturnType<typeof generateInfographic>>>;
export type GenerateInfographicMutationError = ErrorType<unknown>;
export type GenerateInfographicMutationVariables = {
    projectId: number;
    productId: string;
};
/**
* @summary Generate SVG infographic for a product via Claude
*/
export declare const useGenerateInfographic: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateInfographic>>, TError, GenerateInfographicMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof generateInfographic>>, TError, GenerateInfographicMutationVariables, TContext>;
export declare const getGetGenerationJobUrl: (projectId: number, jobId: string) => string;
/**
 * @summary Poll image generation job status
 */
export declare const getGenerationJob: (projectId: number, jobId: string, options?: Parameters<typeof customFetch>[1]) => Promise<GenerationJob>;
export declare const getGetGenerationJobQueryKey: (projectId: number, jobId: string) => readonly [`/api/projects/${number}/generation-jobs/${string}`];
export declare const getGetGenerationJobQueryOptions: <TData = Awaited<ReturnType<typeof getGenerationJob>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetGenerationJobQueryResult = NonNullable<Awaited<ReturnType<typeof getGenerationJob>>>;
export type GetGenerationJobQueryError = ErrorType<unknown>;
export declare function useGetGenerationJob<TData = Awaited<ReturnType<typeof getGenerationJob>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, Awaited<ReturnType<typeof getGenerationJob>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetGenerationJob<TData = Awaited<ReturnType<typeof getGenerationJob>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, Awaited<ReturnType<typeof getGenerationJob>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetGenerationJob<TData = Awaited<ReturnType<typeof getGenerationJob>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getUploadImageToShopifyUrl: (projectId: number, productId: string, imageId: string) => string;
/**
 * @summary Upload a generated image to Shopify product
 */
export declare const uploadImageToShopify: (projectId: number, productId: string, imageId: string, options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getUploadImageToShopifyMutationKey: () => readonly ["uploadImageToShopify"];
export declare const getUploadImageToShopifyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadImageToShopify>>, TError, UploadImageToShopifyMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof uploadImageToShopify>>, TError, UploadImageToShopifyMutationVariables, TContext>;
export type UploadImageToShopifyMutationResult = NonNullable<Awaited<ReturnType<typeof uploadImageToShopify>>>;
export type UploadImageToShopifyMutationError = ErrorType<unknown>;
export type UploadImageToShopifyMutationVariables = {
    projectId: number;
    productId: string;
    imageId: string;
};
/**
* @summary Upload a generated image to Shopify product
*/
export declare const useUploadImageToShopify: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadImageToShopify>>, TError, UploadImageToShopifyMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof uploadImageToShopify>>, TError, UploadImageToShopifyMutationVariables, TContext>;
export declare const getBulkGenerateImagesUrl: (projectId: number) => string;
/**
 * @summary Bulk image generation (Boost Masivo)
 */
export declare const bulkGenerateImages: (projectId: number, bulkGenerateInput: BulkGenerateInput, options?: Parameters<typeof customFetch>[1]) => Promise<BulkJobResponse>;
export declare const getBulkGenerateImagesMutationKey: () => readonly ["bulkGenerateImages"];
export declare const getBulkGenerateImagesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkGenerateImages>>, TError, BulkGenerateImagesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof bulkGenerateImages>>, TError, BulkGenerateImagesMutationVariables, TContext>;
export type BulkGenerateImagesMutationResult = NonNullable<Awaited<ReturnType<typeof bulkGenerateImages>>>;
export type BulkGenerateImagesMutationBody = BodyType<BulkGenerateInput>;
export type BulkGenerateImagesMutationError = ErrorType<unknown>;
export type BulkGenerateImagesMutationVariables = {
    projectId: number;
    data: BodyType<BulkGenerateInput>;
};
/**
* @summary Bulk image generation (Boost Masivo)
*/
export declare const useBulkGenerateImages: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkGenerateImages>>, TError, BulkGenerateImagesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof bulkGenerateImages>>, TError, BulkGenerateImagesMutationVariables, TContext>;
export declare const getBuildImagePromptUrl: (projectId: number) => string;
/**
 * @summary Preview the image prompt Claude will generate before sending to Replicate
 */
export declare const buildImagePrompt: (projectId: number, buildPromptInput: BuildPromptInput, options?: Parameters<typeof customFetch>[1]) => Promise<PromptPreview>;
export declare const getBuildImagePromptMutationKey: () => readonly ["buildImagePrompt"];
export declare const getBuildImagePromptMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof buildImagePrompt>>, TError, BuildImagePromptMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof buildImagePrompt>>, TError, BuildImagePromptMutationVariables, TContext>;
export type BuildImagePromptMutationResult = NonNullable<Awaited<ReturnType<typeof buildImagePrompt>>>;
export type BuildImagePromptMutationBody = BodyType<BuildPromptInput>;
export type BuildImagePromptMutationError = ErrorType<unknown>;
export type BuildImagePromptMutationVariables = {
    projectId: number;
    data: BodyType<BuildPromptInput>;
};
/**
* @summary Preview the image prompt Claude will generate before sending to Replicate
*/
export declare const useBuildImagePrompt: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof buildImagePrompt>>, TError, BuildImagePromptMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof buildImagePrompt>>, TError, BuildImagePromptMutationVariables, TContext>;
export declare const getGetVisualDnaUrl: (projectId: number) => string;
/**
 * @summary Get stored visual DNA for the store
 */
export declare const getVisualDna: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<VisualDna>;
export declare const getGetVisualDnaQueryKey: (projectId: number) => readonly [`/api/projects/${number}/visual-dna`];
export declare const getGetVisualDnaQueryOptions: <TData = Awaited<ReturnType<typeof getVisualDna>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetVisualDnaQueryResult = NonNullable<Awaited<ReturnType<typeof getVisualDna>>>;
export type GetVisualDnaQueryError = ErrorType<unknown>;
export declare function useGetVisualDna<TData = Awaited<ReturnType<typeof getVisualDna>>, TError = ErrorType<unknown>>(projectId: number, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, Awaited<ReturnType<typeof getVisualDna>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetVisualDna<TData = Awaited<ReturnType<typeof getVisualDna>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, Awaited<ReturnType<typeof getVisualDna>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetVisualDna<TData = Awaited<ReturnType<typeof getVisualDna>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getExtractVisualDnaUrl: (projectId: number) => string;
/**
 * @summary Extract visual DNA from store images via Claude Vision
 */
export declare const extractVisualDna: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<VisualDna>;
export declare const getExtractVisualDnaMutationKey: () => readonly ["extractVisualDna"];
export declare const getExtractVisualDnaMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof extractVisualDna>>, TError, ExtractVisualDnaMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof extractVisualDna>>, TError, ExtractVisualDnaMutationVariables, TContext>;
export type ExtractVisualDnaMutationResult = NonNullable<Awaited<ReturnType<typeof extractVisualDna>>>;
export type ExtractVisualDnaMutationError = ErrorType<unknown>;
export type ExtractVisualDnaMutationVariables = {
    projectId: number;
};
/**
* @summary Extract visual DNA from store images via Claude Vision
*/
export declare const useExtractVisualDna: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof extractVisualDna>>, TError, ExtractVisualDnaMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof extractVisualDna>>, TError, ExtractVisualDnaMutationVariables, TContext>;
export declare const getGetConsistencyScoresUrl: (projectId: number) => string;
/**
 * @summary Get consistency scores for all products
 */
export declare const getConsistencyScores: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<ConsistencyDashboard>;
export declare const getGetConsistencyScoresQueryKey: (projectId: number) => readonly [`/api/projects/${number}/consistency-scores`];
export declare const getGetConsistencyScoresQueryOptions: <TData = Awaited<ReturnType<typeof getConsistencyScores>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetConsistencyScoresQueryResult = NonNullable<Awaited<ReturnType<typeof getConsistencyScores>>>;
export type GetConsistencyScoresQueryError = ErrorType<unknown>;
export declare function useGetConsistencyScores<TData = Awaited<ReturnType<typeof getConsistencyScores>>, TError = ErrorType<unknown>>(projectId: number, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, Awaited<ReturnType<typeof getConsistencyScores>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetConsistencyScores<TData = Awaited<ReturnType<typeof getConsistencyScores>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, Awaited<ReturnType<typeof getConsistencyScores>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetConsistencyScores<TData = Awaited<ReturnType<typeof getConsistencyScores>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getRepairConsistencyUrl: (projectId: number) => string;
/**
 * @summary Repair off-brand product images with StyleLock
 */
export declare const repairConsistency: (projectId: number, repairConsistencyInput: RepairConsistencyInput, options?: Parameters<typeof customFetch>[1]) => Promise<BulkJobResponse>;
export declare const getRepairConsistencyMutationKey: () => readonly ["repairConsistency"];
export declare const getRepairConsistencyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof repairConsistency>>, TError, RepairConsistencyMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof repairConsistency>>, TError, RepairConsistencyMutationVariables, TContext>;
export type RepairConsistencyMutationResult = NonNullable<Awaited<ReturnType<typeof repairConsistency>>>;
export type RepairConsistencyMutationBody = BodyType<RepairConsistencyInput>;
export type RepairConsistencyMutationError = ErrorType<unknown>;
export type RepairConsistencyMutationVariables = {
    projectId: number;
    data: BodyType<RepairConsistencyInput>;
};
/**
* @summary Repair off-brand product images with StyleLock
*/
export declare const useRepairConsistency: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof repairConsistency>>, TError, RepairConsistencyMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof repairConsistency>>, TError, RepairConsistencyMutationVariables, TContext>;
export declare const getListAbTestsUrl: (projectId: number, params?: ListAbTestsParams) => string;
/**
 * @summary List all A/B tests for a project
 */
export declare const listAbTests: (projectId: number, params?: ListAbTestsParams, options?: Parameters<typeof customFetch>[1]) => Promise<AbTest[]>;
export declare const getListAbTestsQueryKey: (projectId: number, params?: ListAbTestsParams) => readonly [`/api/projects/${number}/ab-tests`, ...ListAbTestsParams[]];
export declare const getListAbTestsQueryOptions: <TData = Awaited<ReturnType<typeof listAbTests>>, TError = ErrorType<unknown>>(projectId: number, params?: ListAbTestsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listAbTests>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAbTests>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListAbTestsQueryResult = NonNullable<Awaited<ReturnType<typeof listAbTests>>>;
export type ListAbTestsQueryError = ErrorType<unknown>;
export declare function useListAbTests<TData = Awaited<ReturnType<typeof listAbTests>>, TError = ErrorType<unknown>>(projectId: number, params: undefined | ListAbTestsParams, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listAbTests>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listAbTests>>, TError, Awaited<ReturnType<typeof listAbTests>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListAbTests<TData = Awaited<ReturnType<typeof listAbTests>>, TError = ErrorType<unknown>>(projectId: number, params?: ListAbTestsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listAbTests>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listAbTests>>, TError, Awaited<ReturnType<typeof listAbTests>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListAbTests<TData = Awaited<ReturnType<typeof listAbTests>>, TError = ErrorType<unknown>>(projectId: number, params?: ListAbTestsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listAbTests>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getCreateAbTestUrl: (projectId: number) => string;
/**
 * @summary Create a new A/B test
 */
export declare const createAbTest: (projectId: number, createAbTestInput: CreateAbTestInput, options?: Parameters<typeof customFetch>[1]) => Promise<AbTest>;
export declare const getCreateAbTestMutationKey: () => readonly ["createAbTest"];
export declare const getCreateAbTestMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAbTest>>, TError, CreateAbTestMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAbTest>>, TError, CreateAbTestMutationVariables, TContext>;
export type CreateAbTestMutationResult = NonNullable<Awaited<ReturnType<typeof createAbTest>>>;
export type CreateAbTestMutationBody = BodyType<CreateAbTestInput>;
export type CreateAbTestMutationError = ErrorType<unknown>;
export type CreateAbTestMutationVariables = {
    projectId: number;
    data: BodyType<CreateAbTestInput>;
};
/**
* @summary Create a new A/B test
*/
export declare const useCreateAbTest: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAbTest>>, TError, CreateAbTestMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createAbTest>>, TError, CreateAbTestMutationVariables, TContext>;
export declare const getGetAbTestUrl: (projectId: number, testId: string) => string;
/**
 * @summary Get A/B test details
 */
export declare const getAbTest: (projectId: number, testId: string, options?: Parameters<typeof customFetch>[1]) => Promise<AbTest>;
export declare const getGetAbTestQueryKey: (projectId: number, testId: string) => readonly [`/api/projects/${number}/ab-tests/${string}`];
export declare const getGetAbTestQueryOptions: <TData = Awaited<ReturnType<typeof getAbTest>>, TError = ErrorType<unknown>>(projectId: number, testId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAbTest>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAbTest>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetAbTestQueryResult = NonNullable<Awaited<ReturnType<typeof getAbTest>>>;
export type GetAbTestQueryError = ErrorType<unknown>;
export declare function useGetAbTest<TData = Awaited<ReturnType<typeof getAbTest>>, TError = ErrorType<unknown>>(projectId: number, testId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAbTest>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getAbTest>>, TError, Awaited<ReturnType<typeof getAbTest>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetAbTest<TData = Awaited<ReturnType<typeof getAbTest>>, TError = ErrorType<unknown>>(projectId: number, testId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAbTest>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getAbTest>>, TError, Awaited<ReturnType<typeof getAbTest>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetAbTest<TData = Awaited<ReturnType<typeof getAbTest>>, TError = ErrorType<unknown>>(projectId: number, testId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAbTest>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getDeclareAbTestWinnerUrl: (projectId: number, testId: string) => string;
/**
 * @summary Manually declare winner or auto-process stats
 */
export declare const declareAbTestWinner: (projectId: number, testId: string, declareWinnerInput: DeclareWinnerInput, options?: Parameters<typeof customFetch>[1]) => Promise<AbTest>;
export declare const getDeclareAbTestWinnerMutationKey: () => readonly ["declareAbTestWinner"];
export declare const getDeclareAbTestWinnerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof declareAbTestWinner>>, TError, DeclareAbTestWinnerMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof declareAbTestWinner>>, TError, DeclareAbTestWinnerMutationVariables, TContext>;
export type DeclareAbTestWinnerMutationResult = NonNullable<Awaited<ReturnType<typeof declareAbTestWinner>>>;
export type DeclareAbTestWinnerMutationBody = BodyType<DeclareWinnerInput>;
export type DeclareAbTestWinnerMutationError = ErrorType<unknown>;
export type DeclareAbTestWinnerMutationVariables = {
    projectId: number;
    testId: string;
    data: BodyType<DeclareWinnerInput>;
};
/**
* @summary Manually declare winner or auto-process stats
*/
export declare const useDeclareAbTestWinner: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof declareAbTestWinner>>, TError, DeclareAbTestWinnerMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof declareAbTestWinner>>, TError, DeclareAbTestWinnerMutationVariables, TContext>;
export declare const getGetAbDashboardUrl: (projectId: number) => string;
/**
 * @summary Get A/B testing revenue impact dashboard
 */
export declare const getAbDashboard: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<AbDashboard>;
export declare const getGetAbDashboardQueryKey: (projectId: number) => readonly [`/api/projects/${number}/ab-dashboard`];
export declare const getGetAbDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getAbDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetAbDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getAbDashboard>>>;
export type GetAbDashboardQueryError = ErrorType<unknown>;
export declare function useGetAbDashboard<TData = Awaited<ReturnType<typeof getAbDashboard>>, TError = ErrorType<unknown>>(projectId: number, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, Awaited<ReturnType<typeof getAbDashboard>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetAbDashboard<TData = Awaited<ReturnType<typeof getAbDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, Awaited<ReturnType<typeof getAbDashboard>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetAbDashboard<TData = Awaited<ReturnType<typeof getAbDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getTrackEventUrl: () => string;
/**
 * @summary Pixel tracker endpoint (receives events from tracker.js)
 */
export declare const trackEvent: (trackEventBody: TrackEvent, options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getTrackEventMutationKey: () => readonly ["trackEvent"];
export declare const getTrackEventMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof trackEvent>>, TError, TrackEventMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof trackEvent>>, TError, TrackEventMutationVariables, TContext>;
export type TrackEventMutationResult = NonNullable<Awaited<ReturnType<typeof trackEvent>>>;
export type TrackEventMutationBody = BodyType<TrackEvent>;
export type TrackEventMutationError = ErrorType<unknown>;
export type TrackEventMutationVariables = {
    data: BodyType<TrackEvent>;
};
/**
* @summary Pixel tracker endpoint (receives events from tracker.js)
*/
export declare const useTrackEvent: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof trackEvent>>, TError, TrackEventMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof trackEvent>>, TError, TrackEventMutationVariables, TContext>;
export declare const getGetProductCogsUrl: (projectId: number, productId: string) => string;
/**
 * @summary Get COGS structure for a product
 */
export declare const getProductCogs: (projectId: number, productId: string, options?: Parameters<typeof customFetch>[1]) => Promise<CogsData>;
export declare const getGetProductCogsQueryKey: (projectId: number, productId: string) => readonly [`/api/projects/${number}/products/${string}/cogs`];
export declare const getGetProductCogsQueryOptions: <TData = Awaited<ReturnType<typeof getProductCogs>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetProductCogsQueryResult = NonNullable<Awaited<ReturnType<typeof getProductCogs>>>;
export type GetProductCogsQueryError = ErrorType<unknown>;
export declare function useGetProductCogs<TData = Awaited<ReturnType<typeof getProductCogs>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, Awaited<ReturnType<typeof getProductCogs>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetProductCogs<TData = Awaited<ReturnType<typeof getProductCogs>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, Awaited<ReturnType<typeof getProductCogs>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetProductCogs<TData = Awaited<ReturnType<typeof getProductCogs>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getSaveProductCogsUrl: (projectId: number, productId: string) => string;
/**
 * @summary Save COGS structure for a product
 */
export declare const saveProductCogs: (projectId: number, productId: string, saveCogsInput: SaveCogsInput, options?: Parameters<typeof customFetch>[1]) => Promise<CogsData>;
export declare const getSaveProductCogsMutationKey: () => readonly ["saveProductCogs"];
export declare const getSaveProductCogsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof saveProductCogs>>, TError, SaveProductCogsMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof saveProductCogs>>, TError, SaveProductCogsMutationVariables, TContext>;
export type SaveProductCogsMutationResult = NonNullable<Awaited<ReturnType<typeof saveProductCogs>>>;
export type SaveProductCogsMutationBody = BodyType<SaveCogsInput>;
export type SaveProductCogsMutationError = ErrorType<unknown>;
export type SaveProductCogsMutationVariables = {
    projectId: number;
    productId: string;
    data: BodyType<SaveCogsInput>;
};
/**
* @summary Save COGS structure for a product
*/
export declare const useSaveProductCogs: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof saveProductCogs>>, TError, SaveProductCogsMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof saveProductCogs>>, TError, SaveProductCogsMutationVariables, TContext>;
export declare const getAnalyzeCompetitorPricesUrl: (projectId: number, productId: string) => string;
/**
 * @summary Scrape and analyze competitor pricing
 */
export declare const analyzeCompetitorPrices: (projectId: number, productId: string, competitorAnalysisInput: CompetitorAnalysisInput, options?: Parameters<typeof customFetch>[1]) => Promise<CompetitorAnalysisResult>;
export declare const getAnalyzeCompetitorPricesMutationKey: () => readonly ["analyzeCompetitorPrices"];
export declare const getAnalyzeCompetitorPricesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof analyzeCompetitorPrices>>, TError, AnalyzeCompetitorPricesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof analyzeCompetitorPrices>>, TError, AnalyzeCompetitorPricesMutationVariables, TContext>;
export type AnalyzeCompetitorPricesMutationResult = NonNullable<Awaited<ReturnType<typeof analyzeCompetitorPrices>>>;
export type AnalyzeCompetitorPricesMutationBody = BodyType<CompetitorAnalysisInput>;
export type AnalyzeCompetitorPricesMutationError = ErrorType<unknown>;
export type AnalyzeCompetitorPricesMutationVariables = {
    projectId: number;
    productId: string;
    data: BodyType<CompetitorAnalysisInput>;
};
/**
* @summary Scrape and analyze competitor pricing
*/
export declare const useAnalyzeCompetitorPrices: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof analyzeCompetitorPrices>>, TError, AnalyzeCompetitorPricesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof analyzeCompetitorPrices>>, TError, AnalyzeCompetitorPricesMutationVariables, TContext>;
export declare const getCalculateOptimalPriceUrl: (projectId: number, productId: string) => string;
/**
 * @summary Calculate optimal price using Claude as financial analyst
 */
export declare const calculateOptimalPrice: (projectId: number, productId: string, options?: Parameters<typeof customFetch>[1]) => Promise<PricingRecommendation>;
export declare const getCalculateOptimalPriceMutationKey: () => readonly ["calculateOptimalPrice"];
export declare const getCalculateOptimalPriceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof calculateOptimalPrice>>, TError, CalculateOptimalPriceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof calculateOptimalPrice>>, TError, CalculateOptimalPriceMutationVariables, TContext>;
export type CalculateOptimalPriceMutationResult = NonNullable<Awaited<ReturnType<typeof calculateOptimalPrice>>>;
export type CalculateOptimalPriceMutationError = ErrorType<unknown>;
export type CalculateOptimalPriceMutationVariables = {
    projectId: number;
    productId: string;
};
/**
* @summary Calculate optimal price using Claude as financial analyst
*/
export declare const useCalculateOptimalPrice: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof calculateOptimalPrice>>, TError, CalculateOptimalPriceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof calculateOptimalPrice>>, TError, CalculateOptimalPriceMutationVariables, TContext>;
export declare const getApplyPriceToShopifyUrl: (projectId: number, productId: string) => string;
/**
 * @summary Apply recommended price to Shopify product
 */
export declare const applyPriceToShopify: (projectId: number, productId: string, applyPriceInput: ApplyPriceInput, options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getApplyPriceToShopifyMutationKey: () => readonly ["applyPriceToShopify"];
export declare const getApplyPriceToShopifyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyPriceToShopify>>, TError, ApplyPriceToShopifyMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof applyPriceToShopify>>, TError, ApplyPriceToShopifyMutationVariables, TContext>;
export type ApplyPriceToShopifyMutationResult = NonNullable<Awaited<ReturnType<typeof applyPriceToShopify>>>;
export type ApplyPriceToShopifyMutationBody = BodyType<ApplyPriceInput>;
export type ApplyPriceToShopifyMutationError = ErrorType<unknown>;
export type ApplyPriceToShopifyMutationVariables = {
    projectId: number;
    productId: string;
    data: BodyType<ApplyPriceInput>;
};
/**
* @summary Apply recommended price to Shopify product
*/
export declare const useApplyPriceToShopify: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyPriceToShopify>>, TError, ApplyPriceToShopifyMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof applyPriceToShopify>>, TError, ApplyPriceToShopifyMutationVariables, TContext>;
export declare const getGetFinancialDashboardUrl: (projectId: number) => string;
/**
 * @summary Get P&L dashboard with live Shopify orders data
 */
export declare const getFinancialDashboard: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<FinancialDashboard>;
export declare const getGetFinancialDashboardQueryKey: (projectId: number) => readonly [`/api/projects/${number}/financial-dashboard`];
export declare const getGetFinancialDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getFinancialDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetFinancialDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getFinancialDashboard>>>;
export type GetFinancialDashboardQueryError = ErrorType<unknown>;
export declare function useGetFinancialDashboard<TData = Awaited<ReturnType<typeof getFinancialDashboard>>, TError = ErrorType<unknown>>(projectId: number, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, Awaited<ReturnType<typeof getFinancialDashboard>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetFinancialDashboard<TData = Awaited<ReturnType<typeof getFinancialDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, Awaited<ReturnType<typeof getFinancialDashboard>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetFinancialDashboard<TData = Awaited<ReturnType<typeof getFinancialDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getRunSeoAuditUrl: (projectId: number) => string;
/**
 * @summary Run full SEO audit for the store
 */
export declare const runSeoAudit: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<SeoAuditResult>;
export declare const getRunSeoAuditMutationKey: () => readonly ["runSeoAudit"];
export declare const getRunSeoAuditMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runSeoAudit>>, TError, RunSeoAuditMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof runSeoAudit>>, TError, RunSeoAuditMutationVariables, TContext>;
export type RunSeoAuditMutationResult = NonNullable<Awaited<ReturnType<typeof runSeoAudit>>>;
export type RunSeoAuditMutationError = ErrorType<unknown>;
export type RunSeoAuditMutationVariables = {
    projectId: number;
};
/**
* @summary Run full SEO audit for the store
*/
export declare const useRunSeoAudit: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runSeoAudit>>, TError, RunSeoAuditMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof runSeoAudit>>, TError, RunSeoAuditMutationVariables, TContext>;
export declare const getGenerateSchemasUrl: (projectId: number) => string;
/**
 * @summary Generate JSON-LD schemas and inject to Shopify
 */
export declare const generateSchemas: (projectId: number, seoActionInput: SeoActionInput, options?: Parameters<typeof customFetch>[1]) => Promise<BulkJobResponse>;
export declare const getGenerateSchemasMutationKey: () => readonly ["generateSchemas"];
export declare const getGenerateSchemasMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSchemas>>, TError, GenerateSchemasMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateSchemas>>, TError, GenerateSchemasMutationVariables, TContext>;
export type GenerateSchemasMutationResult = NonNullable<Awaited<ReturnType<typeof generateSchemas>>>;
export type GenerateSchemasMutationBody = BodyType<SeoActionInput>;
export type GenerateSchemasMutationError = ErrorType<unknown>;
export type GenerateSchemasMutationVariables = {
    projectId: number;
    data: BodyType<SeoActionInput>;
};
/**
* @summary Generate JSON-LD schemas and inject to Shopify
*/
export declare const useGenerateSchemas: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSchemas>>, TError, GenerateSchemasMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof generateSchemas>>, TError, GenerateSchemasMutationVariables, TContext>;
export declare const getGenerateMetasUrl: (projectId: number) => string;
/**
 * @summary Batch generate meta tags for all products missing them
 */
export declare const generateMetas: (projectId: number, seoActionInput: SeoActionInput, options?: Parameters<typeof customFetch>[1]) => Promise<BulkJobResponse>;
export declare const getGenerateMetasMutationKey: () => readonly ["generateMetas"];
export declare const getGenerateMetasMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateMetas>>, TError, GenerateMetasMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateMetas>>, TError, GenerateMetasMutationVariables, TContext>;
export type GenerateMetasMutationResult = NonNullable<Awaited<ReturnType<typeof generateMetas>>>;
export type GenerateMetasMutationBody = BodyType<SeoActionInput>;
export type GenerateMetasMutationError = ErrorType<unknown>;
export type GenerateMetasMutationVariables = {
    projectId: number;
    data: BodyType<SeoActionInput>;
};
/**
* @summary Batch generate meta tags for all products missing them
*/
export declare const useGenerateMetas: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateMetas>>, TError, GenerateMetasMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof generateMetas>>, TError, GenerateMetasMutationVariables, TContext>;
export declare const getGenerateSitemapUrl: (projectId: number) => string;
/**
 * @summary Generate XML sitemap and ping Google
 */
export declare const generateSitemap: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<SitemapResult>;
export declare const getGenerateSitemapMutationKey: () => readonly ["generateSitemap"];
export declare const getGenerateSitemapMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSitemap>>, TError, GenerateSitemapMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateSitemap>>, TError, GenerateSitemapMutationVariables, TContext>;
export type GenerateSitemapMutationResult = NonNullable<Awaited<ReturnType<typeof generateSitemap>>>;
export type GenerateSitemapMutationError = ErrorType<unknown>;
export type GenerateSitemapMutationVariables = {
    projectId: number;
};
/**
* @summary Generate XML sitemap and ping Google
*/
export declare const useGenerateSitemap: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSitemap>>, TError, GenerateSitemapMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof generateSitemap>>, TError, GenerateSitemapMutationVariables, TContext>;
export declare const getAuditPageSpeedUrl: (projectId: number) => string;
/**
 * @summary Audit Core Web Vitals via PageSpeed Insights
 */
export declare const auditPageSpeed: (projectId: number, pageSpeedInput: PageSpeedInput, options?: Parameters<typeof customFetch>[1]) => Promise<PageSpeedResult>;
export declare const getAuditPageSpeedMutationKey: () => readonly ["auditPageSpeed"];
export declare const getAuditPageSpeedMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof auditPageSpeed>>, TError, AuditPageSpeedMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof auditPageSpeed>>, TError, AuditPageSpeedMutationVariables, TContext>;
export type AuditPageSpeedMutationResult = NonNullable<Awaited<ReturnType<typeof auditPageSpeed>>>;
export type AuditPageSpeedMutationBody = BodyType<PageSpeedInput>;
export type AuditPageSpeedMutationError = ErrorType<unknown>;
export type AuditPageSpeedMutationVariables = {
    projectId: number;
    data: BodyType<PageSpeedInput>;
};
/**
* @summary Audit Core Web Vitals via PageSpeed Insights
*/
export declare const useAuditPageSpeed: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof auditPageSpeed>>, TError, AuditPageSpeedMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof auditPageSpeed>>, TError, AuditPageSpeedMutationVariables, TContext>;
export declare const getGetKeywordIntelligenceUrl: (projectId: number) => string;
/**
 * @summary Get keyword strategy for a product
 */
export declare const getKeywordIntelligence: (projectId: number, keywordInput: KeywordInput, options?: Parameters<typeof customFetch>[1]) => Promise<KeywordStrategy>;
export declare const getGetKeywordIntelligenceMutationKey: () => readonly ["getKeywordIntelligence"];
export declare const getGetKeywordIntelligenceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getKeywordIntelligence>>, TError, GetKeywordIntelligenceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof getKeywordIntelligence>>, TError, GetKeywordIntelligenceMutationVariables, TContext>;
export type GetKeywordIntelligenceMutationResult = NonNullable<Awaited<ReturnType<typeof getKeywordIntelligence>>>;
export type GetKeywordIntelligenceMutationBody = BodyType<KeywordInput>;
export type GetKeywordIntelligenceMutationError = ErrorType<unknown>;
export type GetKeywordIntelligenceMutationVariables = {
    projectId: number;
    data: BodyType<KeywordInput>;
};
/**
* @summary Get keyword strategy for a product
*/
export declare const useGetKeywordIntelligence: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getKeywordIntelligence>>, TError, GetKeywordIntelligenceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof getKeywordIntelligence>>, TError, GetKeywordIntelligenceMutationVariables, TContext>;
export declare const getGetBlogStrategyUrl: (projectId: number) => string;
/**
 * @summary Generate blog content strategy for the store
 */
export declare const getBlogStrategy: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<BlogStrategy>;
export declare const getGetBlogStrategyMutationKey: () => readonly ["getBlogStrategy"];
export declare const getGetBlogStrategyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getBlogStrategy>>, TError, GetBlogStrategyMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof getBlogStrategy>>, TError, GetBlogStrategyMutationVariables, TContext>;
export type GetBlogStrategyMutationResult = NonNullable<Awaited<ReturnType<typeof getBlogStrategy>>>;
export type GetBlogStrategyMutationError = ErrorType<unknown>;
export type GetBlogStrategyMutationVariables = {
    projectId: number;
};
/**
* @summary Generate blog content strategy for the store
*/
export declare const useGetBlogStrategy: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getBlogStrategy>>, TError, GetBlogStrategyMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof getBlogStrategy>>, TError, GetBlogStrategyMutationVariables, TContext>;
export declare const getGenerateBlogPostUrl: (projectId: number) => string;
/**
 * @summary Generate a full blog post with Claude
 */
export declare const generateBlogPost: (projectId: number, blogPostInput: BlogPostInput, options?: Parameters<typeof customFetch>[1]) => Promise<BlogPost>;
export declare const getGenerateBlogPostMutationKey: () => readonly ["generateBlogPost"];
export declare const getGenerateBlogPostMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateBlogPost>>, TError, GenerateBlogPostMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateBlogPost>>, TError, GenerateBlogPostMutationVariables, TContext>;
export type GenerateBlogPostMutationResult = NonNullable<Awaited<ReturnType<typeof generateBlogPost>>>;
export type GenerateBlogPostMutationBody = BodyType<BlogPostInput>;
export type GenerateBlogPostMutationError = ErrorType<unknown>;
export type GenerateBlogPostMutationVariables = {
    projectId: number;
    data: BodyType<BlogPostInput>;
};
/**
* @summary Generate a full blog post with Claude
*/
export declare const useGenerateBlogPost: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateBlogPost>>, TError, GenerateBlogPostMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof generateBlogPost>>, TError, GenerateBlogPostMutationVariables, TContext>;
export declare const getFixAltTextsUrl: (projectId: number) => string;
/**
 * @summary Batch generate and apply SEO alt texts for all product images
 */
export declare const fixAltTexts: (projectId: number, options?: Parameters<typeof customFetch>[1]) => Promise<BulkJobResponse>;
export declare const getFixAltTextsMutationKey: () => readonly ["fixAltTexts"];
export declare const getFixAltTextsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof fixAltTexts>>, TError, FixAltTextsMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof fixAltTexts>>, TError, FixAltTextsMutationVariables, TContext>;
export type FixAltTextsMutationResult = NonNullable<Awaited<ReturnType<typeof fixAltTexts>>>;
export type FixAltTextsMutationError = ErrorType<unknown>;
export type FixAltTextsMutationVariables = {
    projectId: number;
};
/**
* @summary Batch generate and apply SEO alt texts for all product images
*/
export declare const useFixAltTexts: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof fixAltTexts>>, TError, FixAltTextsMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof fixAltTexts>>, TError, FixAltTextsMutationVariables, TContext>;
export declare const getGetJobStatusUrl: (projectId: number, jobId: string) => string;
/**
 * @summary Get background job status (bulk operations)
 */
export declare const getJobStatus: (projectId: number, jobId: string, options?: Parameters<typeof customFetch>[1]) => Promise<JobStatus>;
export declare const getGetJobStatusQueryKey: (projectId: number, jobId: string) => readonly [`/api/projects/${number}/jobs/${string}`];
export declare const getGetJobStatusQueryOptions: <TData = Awaited<ReturnType<typeof getJobStatus>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetJobStatusQueryResult = NonNullable<Awaited<ReturnType<typeof getJobStatus>>>;
export type GetJobStatusQueryError = ErrorType<unknown>;
export declare function useGetJobStatus<TData = Awaited<ReturnType<typeof getJobStatus>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, Awaited<ReturnType<typeof getJobStatus>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetJobStatus<TData = Awaited<ReturnType<typeof getJobStatus>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, Awaited<ReturnType<typeof getJobStatus>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetJobStatus<TData = Awaited<ReturnType<typeof getJobStatus>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export {};
//# sourceMappingURL=api.d.ts.map