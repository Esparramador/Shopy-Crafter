import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { AbDashboard, AbTest, ApplyPriceInput, ApplyRedesignInput, AuditSummary, BlogPost, BlogPostInput, BlogStrategy, BuildPromptInput, BulkGenerateInput, BulkJobResponse, BulkRedesignInput, CatalogOpportunity, CmsPage, CmsPageInput, CogsData, CompetitorAnalysisInput, CompetitorAnalysisResult, ConnectionTestResult, ConsistencyDashboard, CreateAbTestInput, CreateProjectInput, DeclareWinnerInput, ErrorResponse, FinancialDashboard, GenerateImageInput, GenerationJob, GetProjectProductsParams, HealthStatus, InfographicResult, JobStatus, KeywordInput, KeywordStrategy, ListAbTestsParams, ListCmsPagesResult, ListImageEnginesResult, PageSpeedInput, PageSpeedResult, PricingRecommendation, ProductAuditResult, ProductDetail, ProductListResponse, Project, PromptPreview, RedesignResult, RepairConsistencyInput, SaveCogsInput, SeoActionInput, SeoAuditResult, SimpleSuccess, SitemapResult, SuccessResponse, SyncResult, TokenRefreshResult, TrackEvent, UpdateProjectInput, VisualDna } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List all projects
 */
export declare const getListProjectsUrl: () => string;
export declare const listProjects: (options?: RequestInit) => Promise<Project[]>;
export declare const getListProjectsQueryKey: () => readonly ["/api/projects"];
export declare const getListProjectsQueryOptions: <TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListProjectsQueryResult = NonNullable<Awaited<ReturnType<typeof listProjects>>>;
export type ListProjectsQueryError = ErrorType<unknown>;
/**
 * @summary List all projects
 */
export declare function useListProjects<TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a new project (one per Shopify store)
 */
export declare const getCreateProjectUrl: () => string;
export declare const createProject: (createProjectInput: CreateProjectInput, options?: RequestInit) => Promise<Project>;
export declare const getCreateProjectMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProject>>, TError, {
        data: BodyType<CreateProjectInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createProject>>, TError, {
    data: BodyType<CreateProjectInput>;
}, TContext>;
export type CreateProjectMutationResult = NonNullable<Awaited<ReturnType<typeof createProject>>>;
export type CreateProjectMutationBody = BodyType<CreateProjectInput>;
export type CreateProjectMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Create a new project (one per Shopify store)
 */
export declare const useCreateProject: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProject>>, TError, {
        data: BodyType<CreateProjectInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createProject>>, TError, {
    data: BodyType<CreateProjectInput>;
}, TContext>;
/**
 * @summary Get project by ID
 */
export declare const getGetProjectUrl: (projectId: number) => string;
export declare const getProject: (projectId: number, options?: RequestInit) => Promise<Project>;
export declare const getGetProjectQueryKey: (projectId: number) => readonly [`/api/projects/${number}`];
export declare const getGetProjectQueryOptions: <TData = Awaited<ReturnType<typeof getProject>>, TError = ErrorType<ErrorResponse>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProject>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProjectQueryResult = NonNullable<Awaited<ReturnType<typeof getProject>>>;
export type GetProjectQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get project by ID
 */
export declare function useGetProject<TData = Awaited<ReturnType<typeof getProject>>, TError = ErrorType<ErrorResponse>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update project configuration
 */
export declare const getUpdateProjectUrl: (projectId: number) => string;
export declare const updateProject: (projectId: number, updateProjectInput: UpdateProjectInput, options?: RequestInit) => Promise<Project>;
export declare const getUpdateProjectMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProject>>, TError, {
        projectId: number;
        data: BodyType<UpdateProjectInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateProject>>, TError, {
    projectId: number;
    data: BodyType<UpdateProjectInput>;
}, TContext>;
export type UpdateProjectMutationResult = NonNullable<Awaited<ReturnType<typeof updateProject>>>;
export type UpdateProjectMutationBody = BodyType<UpdateProjectInput>;
export type UpdateProjectMutationError = ErrorType<unknown>;
/**
 * @summary Update project configuration
 */
export declare const useUpdateProject: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProject>>, TError, {
        projectId: number;
        data: BodyType<UpdateProjectInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateProject>>, TError, {
    projectId: number;
    data: BodyType<UpdateProjectInput>;
}, TContext>;
/**
 * @summary Delete project
 */
export declare const getDeleteProjectUrl: (projectId: number) => string;
export declare const deleteProject: (projectId: number, options?: RequestInit) => Promise<SuccessResponse>;
export declare const getDeleteProjectMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteProject>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteProject>>, TError, {
    projectId: number;
}, TContext>;
export type DeleteProjectMutationResult = NonNullable<Awaited<ReturnType<typeof deleteProject>>>;
export type DeleteProjectMutationError = ErrorType<unknown>;
/**
 * @summary Delete project
 */
export declare const useDeleteProject: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteProject>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteProject>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Refresh Shopify OAuth access token using client_credentials
 */
export declare const getRefreshProjectTokenUrl: (projectId: number) => string;
export declare const refreshProjectToken: (projectId: number, options?: RequestInit) => Promise<TokenRefreshResult>;
export declare const getRefreshProjectTokenMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof refreshProjectToken>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof refreshProjectToken>>, TError, {
    projectId: number;
}, TContext>;
export type RefreshProjectTokenMutationResult = NonNullable<Awaited<ReturnType<typeof refreshProjectToken>>>;
export type RefreshProjectTokenMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Refresh Shopify OAuth access token using client_credentials
 */
export declare const useRefreshProjectToken: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof refreshProjectToken>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof refreshProjectToken>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Test Shopify connection and token validity
 */
export declare const getTestProjectConnectionUrl: (projectId: number) => string;
export declare const testProjectConnection: (projectId: number, options?: RequestInit) => Promise<ConnectionTestResult>;
export declare const getTestProjectConnectionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof testProjectConnection>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof testProjectConnection>>, TError, {
    projectId: number;
}, TContext>;
export type TestProjectConnectionMutationResult = NonNullable<Awaited<ReturnType<typeof testProjectConnection>>>;
export type TestProjectConnectionMutationError = ErrorType<unknown>;
/**
 * @summary Test Shopify connection and token validity
 */
export declare const useTestProjectConnection: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof testProjectConnection>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof testProjectConnection>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Get all products from Shopify store (with local audit data)
 */
export declare const getGetProjectProductsUrl: (projectId: number, params?: GetProjectProductsParams) => string;
export declare const getProjectProducts: (projectId: number, params?: GetProjectProductsParams, options?: RequestInit) => Promise<ProductListResponse>;
export declare const getGetProjectProductsQueryKey: (projectId: number, params?: GetProjectProductsParams) => readonly [`/api/projects/${number}/products`, ...GetProjectProductsParams[]];
export declare const getGetProjectProductsQueryOptions: <TData = Awaited<ReturnType<typeof getProjectProducts>>, TError = ErrorType<unknown>>(projectId: number, params?: GetProjectProductsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProjectProductsQueryResult = NonNullable<Awaited<ReturnType<typeof getProjectProducts>>>;
export type GetProjectProductsQueryError = ErrorType<unknown>;
/**
 * @summary Get all products from Shopify store (with local audit data)
 */
export declare function useGetProjectProducts<TData = Awaited<ReturnType<typeof getProjectProducts>>, TError = ErrorType<unknown>>(projectId: number, params?: GetProjectProductsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProjectProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Sync all products from Shopify and run audit
 */
export declare const getSyncProductsUrl: (projectId: number) => string;
export declare const syncProducts: (projectId: number, options?: RequestInit) => Promise<SyncResult>;
export declare const getSyncProductsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof syncProducts>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof syncProducts>>, TError, {
    projectId: number;
}, TContext>;
export type SyncProductsMutationResult = NonNullable<Awaited<ReturnType<typeof syncProducts>>>;
export type SyncProductsMutationError = ErrorType<unknown>;
/**
 * @summary Sync all products from Shopify and run audit
 */
export declare const useSyncProducts: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof syncProducts>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof syncProducts>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Get single product with full audit data
 */
export declare const getGetProductUrl: (projectId: number, productId: string) => string;
export declare const getProduct: (projectId: number, productId: string, options?: RequestInit) => Promise<ProductDetail>;
export declare const getGetProductQueryKey: (projectId: number, productId: string) => readonly [`/api/projects/${number}/products/${string}`];
export declare const getGetProductQueryOptions: <TData = Awaited<ReturnType<typeof getProduct>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProductQueryResult = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
export type GetProductQueryError = ErrorType<unknown>;
/**
 * @summary Get single product with full audit data
 */
export declare function useGetProduct<TData = Awaited<ReturnType<typeof getProduct>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Run product audit for entire store
 */
export declare const getRunAuditUrl: (projectId: number) => string;
export declare const runAudit: (projectId: number, options?: RequestInit) => Promise<AuditSummary>;
export declare const getRunAuditMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runAudit>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof runAudit>>, TError, {
    projectId: number;
}, TContext>;
export type RunAuditMutationResult = NonNullable<Awaited<ReturnType<typeof runAudit>>>;
export type RunAuditMutationError = ErrorType<unknown>;
/**
 * @summary Run product audit for entire store
 */
export declare const useRunAudit: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runAudit>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof runAudit>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Run audit for a single product
 */
export declare const getAuditProductUrl: (projectId: number, productId: string) => string;
export declare const auditProduct: (projectId: number, productId: string, options?: RequestInit) => Promise<ProductAuditResult>;
export declare const getAuditProductMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof auditProduct>>, TError, {
        projectId: number;
        productId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof auditProduct>>, TError, {
    projectId: number;
    productId: string;
}, TContext>;
export type AuditProductMutationResult = NonNullable<Awaited<ReturnType<typeof auditProduct>>>;
export type AuditProductMutationError = ErrorType<unknown>;
/**
 * @summary Run audit for a single product
 */
export declare const useAuditProduct: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof auditProduct>>, TError, {
        projectId: number;
        productId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof auditProduct>>, TError, {
    projectId: number;
    productId: string;
}, TContext>;
/**
 * @summary Get AI-suggested missing products for the store niche
 */
export declare const getGetCatalogOpportunitiesUrl: (projectId: number) => string;
export declare const getCatalogOpportunities: (projectId: number, options?: RequestInit) => Promise<CatalogOpportunity[]>;
export declare const getGetCatalogOpportunitiesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getCatalogOpportunities>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof getCatalogOpportunities>>, TError, {
    projectId: number;
}, TContext>;
export type GetCatalogOpportunitiesMutationResult = NonNullable<Awaited<ReturnType<typeof getCatalogOpportunities>>>;
export type GetCatalogOpportunitiesMutationError = ErrorType<unknown>;
/**
 * @summary Get AI-suggested missing products for the store niche
 */
export declare const useGetCatalogOpportunities: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getCatalogOpportunities>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof getCatalogOpportunities>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary AI redesign a single product with Claude
 */
export declare const getRedesignProductUrl: (projectId: number, productId: string) => string;
export declare const redesignProduct: (projectId: number, productId: string, options?: RequestInit) => Promise<RedesignResult>;
export declare const getRedesignProductMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof redesignProduct>>, TError, {
        projectId: number;
        productId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof redesignProduct>>, TError, {
    projectId: number;
    productId: string;
}, TContext>;
export type RedesignProductMutationResult = NonNullable<Awaited<ReturnType<typeof redesignProduct>>>;
export type RedesignProductMutationError = ErrorType<unknown>;
/**
 * @summary AI redesign a single product with Claude
 */
export declare const useRedesignProduct: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof redesignProduct>>, TError, {
        projectId: number;
        productId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof redesignProduct>>, TError, {
    projectId: number;
    productId: string;
}, TContext>;
/**
 * @summary Apply redesign to Shopify product
 */
export declare const getApplyRedesignUrl: (projectId: number, productId: string) => string;
export declare const applyRedesign: (projectId: number, productId: string, applyRedesignInput: ApplyRedesignInput, options?: RequestInit) => Promise<SuccessResponse>;
export declare const getApplyRedesignMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyRedesign>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<ApplyRedesignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof applyRedesign>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<ApplyRedesignInput>;
}, TContext>;
export type ApplyRedesignMutationResult = NonNullable<Awaited<ReturnType<typeof applyRedesign>>>;
export type ApplyRedesignMutationBody = BodyType<ApplyRedesignInput>;
export type ApplyRedesignMutationError = ErrorType<unknown>;
/**
 * @summary Apply redesign to Shopify product
 */
export declare const useApplyRedesign: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyRedesign>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<ApplyRedesignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof applyRedesign>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<ApplyRedesignInput>;
}, TContext>;
/**
 * @summary Bulk redesign products (all weak or all)
 */
export declare const getBulkRedesignUrl: (projectId: number) => string;
export declare const bulkRedesign: (projectId: number, bulkRedesignInput: BulkRedesignInput, options?: RequestInit) => Promise<BulkJobResponse>;
export declare const getBulkRedesignMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkRedesign>>, TError, {
        projectId: number;
        data: BodyType<BulkRedesignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof bulkRedesign>>, TError, {
    projectId: number;
    data: BodyType<BulkRedesignInput>;
}, TContext>;
export type BulkRedesignMutationResult = NonNullable<Awaited<ReturnType<typeof bulkRedesign>>>;
export type BulkRedesignMutationBody = BodyType<BulkRedesignInput>;
export type BulkRedesignMutationError = ErrorType<unknown>;
/**
 * @summary Bulk redesign products (all weak or all)
 */
export declare const useBulkRedesign: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkRedesign>>, TError, {
        projectId: number;
        data: BodyType<BulkRedesignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof bulkRedesign>>, TError, {
    projectId: number;
    data: BodyType<BulkRedesignInput>;
}, TContext>;
/**
 * @summary Lista páginas (publicadas para público; todas para admin)
 */
export declare const getListCmsPagesUrl: () => string;
export declare const listCmsPages: (options?: RequestInit) => Promise<ListCmsPagesResult>;
export declare const getListCmsPagesQueryKey: () => readonly ["/api/cms/pages"];
export declare const getListCmsPagesQueryOptions: <TData = Awaited<ReturnType<typeof listCmsPages>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCmsPagesQueryResult = NonNullable<Awaited<ReturnType<typeof listCmsPages>>>;
export type ListCmsPagesQueryError = ErrorType<unknown>;
/**
 * @summary Lista páginas (publicadas para público; todas para admin)
 */
export declare function useListCmsPages<TData = Awaited<ReturnType<typeof listCmsPages>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCmsPages>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Crea una nueva página externa (admin)
 */
export declare const getCreateCmsPageUrl: () => string;
export declare const createCmsPage: (cmsPageInput: CmsPageInput, options?: RequestInit) => Promise<CmsPage>;
export declare const getCreateCmsPageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCmsPage>>, TError, {
        data: BodyType<CmsPageInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCmsPage>>, TError, {
    data: BodyType<CmsPageInput>;
}, TContext>;
export type CreateCmsPageMutationResult = NonNullable<Awaited<ReturnType<typeof createCmsPage>>>;
export type CreateCmsPageMutationBody = BodyType<CmsPageInput>;
export type CreateCmsPageMutationError = ErrorType<unknown>;
/**
 * @summary Crea una nueva página externa (admin)
 */
export declare const useCreateCmsPage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCmsPage>>, TError, {
        data: BodyType<CmsPageInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCmsPage>>, TError, {
    data: BodyType<CmsPageInput>;
}, TContext>;
/**
 * @summary Obtiene una página por slug
 */
export declare const getGetCmsPageUrl: (slug: string) => string;
export declare const getCmsPage: (slug: string, options?: RequestInit) => Promise<CmsPage>;
export declare const getGetCmsPageQueryKey: (slug: string) => readonly [`/api/cms/pages/${string}`];
export declare const getGetCmsPageQueryOptions: <TData = Awaited<ReturnType<typeof getCmsPage>>, TError = ErrorType<unknown>>(slug: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCmsPageQueryResult = NonNullable<Awaited<ReturnType<typeof getCmsPage>>>;
export type GetCmsPageQueryError = ErrorType<unknown>;
/**
 * @summary Obtiene una página por slug
 */
export declare function useGetCmsPage<TData = Awaited<ReturnType<typeof getCmsPage>>, TError = ErrorType<unknown>>(slug: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCmsPage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Actualiza una página (admin)
 */
export declare const getUpdateCmsPageUrl: (id: number) => string;
export declare const updateCmsPage: (id: number, cmsPageInput: CmsPageInput, options?: RequestInit) => Promise<CmsPage>;
export declare const getUpdateCmsPageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCmsPage>>, TError, {
        id: number;
        data: BodyType<CmsPageInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateCmsPage>>, TError, {
    id: number;
    data: BodyType<CmsPageInput>;
}, TContext>;
export type UpdateCmsPageMutationResult = NonNullable<Awaited<ReturnType<typeof updateCmsPage>>>;
export type UpdateCmsPageMutationBody = BodyType<CmsPageInput>;
export type UpdateCmsPageMutationError = ErrorType<unknown>;
/**
 * @summary Actualiza una página (admin)
 */
export declare const useUpdateCmsPage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCmsPage>>, TError, {
        id: number;
        data: BodyType<CmsPageInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateCmsPage>>, TError, {
    id: number;
    data: BodyType<CmsPageInput>;
}, TContext>;
/**
 * @summary Elimina una página (admin)
 */
export declare const getDeleteCmsPageUrl: (id: number) => string;
export declare const deleteCmsPage: (id: number, options?: RequestInit) => Promise<SimpleSuccess>;
export declare const getDeleteCmsPageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCmsPage>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteCmsPage>>, TError, {
    id: number;
}, TContext>;
export type DeleteCmsPageMutationResult = NonNullable<Awaited<ReturnType<typeof deleteCmsPage>>>;
export type DeleteCmsPageMutationError = ErrorType<unknown>;
/**
 * @summary Elimina una página (admin)
 */
export declare const useDeleteCmsPage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCmsPage>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteCmsPage>>, TError, {
    id: number;
}, TContext>;
/**
 * @summary Lista los motores de generación de imagen disponibles
 */
export declare const getListImageEnginesUrl: () => string;
export declare const listImageEngines: (options?: RequestInit) => Promise<ListImageEnginesResult>;
export declare const getListImageEnginesQueryKey: () => readonly ["/api/images/engines"];
export declare const getListImageEnginesQueryOptions: <TData = Awaited<ReturnType<typeof listImageEngines>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListImageEnginesQueryResult = NonNullable<Awaited<ReturnType<typeof listImageEngines>>>;
export type ListImageEnginesQueryError = ErrorType<unknown>;
/**
 * @summary Lista los motores de generación de imagen disponibles
 */
export declare function useListImageEngines<TData = Awaited<ReturnType<typeof listImageEngines>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listImageEngines>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Generate a single product image with Replicate
 */
export declare const getGenerateImageUrl: (projectId: number, productId: string) => string;
export declare const generateImage: (projectId: number, productId: string, generateImageInput: GenerateImageInput, options?: RequestInit) => Promise<GenerationJob>;
export declare const getGenerateImageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateImage>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<GenerateImageInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateImage>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<GenerateImageInput>;
}, TContext>;
export type GenerateImageMutationResult = NonNullable<Awaited<ReturnType<typeof generateImage>>>;
export type GenerateImageMutationBody = BodyType<GenerateImageInput>;
export type GenerateImageMutationError = ErrorType<unknown>;
/**
 * @summary Generate a single product image with Replicate
 */
export declare const useGenerateImage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateImage>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<GenerateImageInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateImage>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<GenerateImageInput>;
}, TContext>;
/**
 * @summary Generate SVG infographic for a product via Claude
 */
export declare const getGenerateInfographicUrl: (projectId: number, productId: string) => string;
export declare const generateInfographic: (projectId: number, productId: string, options?: RequestInit) => Promise<InfographicResult>;
export declare const getGenerateInfographicMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateInfographic>>, TError, {
        projectId: number;
        productId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateInfographic>>, TError, {
    projectId: number;
    productId: string;
}, TContext>;
export type GenerateInfographicMutationResult = NonNullable<Awaited<ReturnType<typeof generateInfographic>>>;
export type GenerateInfographicMutationError = ErrorType<unknown>;
/**
 * @summary Generate SVG infographic for a product via Claude
 */
export declare const useGenerateInfographic: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateInfographic>>, TError, {
        projectId: number;
        productId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateInfographic>>, TError, {
    projectId: number;
    productId: string;
}, TContext>;
/**
 * @summary Poll image generation job status
 */
export declare const getGetGenerationJobUrl: (projectId: number, jobId: string) => string;
export declare const getGenerationJob: (projectId: number, jobId: string, options?: RequestInit) => Promise<GenerationJob>;
export declare const getGetGenerationJobQueryKey: (projectId: number, jobId: string) => readonly [`/api/projects/${number}/generation-jobs/${string}`];
export declare const getGetGenerationJobQueryOptions: <TData = Awaited<ReturnType<typeof getGenerationJob>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetGenerationJobQueryResult = NonNullable<Awaited<ReturnType<typeof getGenerationJob>>>;
export type GetGenerationJobQueryError = ErrorType<unknown>;
/**
 * @summary Poll image generation job status
 */
export declare function useGetGenerationJob<TData = Awaited<ReturnType<typeof getGenerationJob>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getGenerationJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Upload a generated image to Shopify product
 */
export declare const getUploadImageToShopifyUrl: (projectId: number, productId: string, imageId: string) => string;
export declare const uploadImageToShopify: (projectId: number, productId: string, imageId: string, options?: RequestInit) => Promise<SuccessResponse>;
export declare const getUploadImageToShopifyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadImageToShopify>>, TError, {
        projectId: number;
        productId: string;
        imageId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof uploadImageToShopify>>, TError, {
    projectId: number;
    productId: string;
    imageId: string;
}, TContext>;
export type UploadImageToShopifyMutationResult = NonNullable<Awaited<ReturnType<typeof uploadImageToShopify>>>;
export type UploadImageToShopifyMutationError = ErrorType<unknown>;
/**
 * @summary Upload a generated image to Shopify product
 */
export declare const useUploadImageToShopify: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadImageToShopify>>, TError, {
        projectId: number;
        productId: string;
        imageId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof uploadImageToShopify>>, TError, {
    projectId: number;
    productId: string;
    imageId: string;
}, TContext>;
/**
 * @summary Bulk image generation (Boost Masivo)
 */
export declare const getBulkGenerateImagesUrl: (projectId: number) => string;
export declare const bulkGenerateImages: (projectId: number, bulkGenerateInput: BulkGenerateInput, options?: RequestInit) => Promise<BulkJobResponse>;
export declare const getBulkGenerateImagesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkGenerateImages>>, TError, {
        projectId: number;
        data: BodyType<BulkGenerateInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof bulkGenerateImages>>, TError, {
    projectId: number;
    data: BodyType<BulkGenerateInput>;
}, TContext>;
export type BulkGenerateImagesMutationResult = NonNullable<Awaited<ReturnType<typeof bulkGenerateImages>>>;
export type BulkGenerateImagesMutationBody = BodyType<BulkGenerateInput>;
export type BulkGenerateImagesMutationError = ErrorType<unknown>;
/**
 * @summary Bulk image generation (Boost Masivo)
 */
export declare const useBulkGenerateImages: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkGenerateImages>>, TError, {
        projectId: number;
        data: BodyType<BulkGenerateInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof bulkGenerateImages>>, TError, {
    projectId: number;
    data: BodyType<BulkGenerateInput>;
}, TContext>;
/**
 * @summary Preview the image prompt Claude will generate before sending to Replicate
 */
export declare const getBuildImagePromptUrl: (projectId: number) => string;
export declare const buildImagePrompt: (projectId: number, buildPromptInput: BuildPromptInput, options?: RequestInit) => Promise<PromptPreview>;
export declare const getBuildImagePromptMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof buildImagePrompt>>, TError, {
        projectId: number;
        data: BodyType<BuildPromptInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof buildImagePrompt>>, TError, {
    projectId: number;
    data: BodyType<BuildPromptInput>;
}, TContext>;
export type BuildImagePromptMutationResult = NonNullable<Awaited<ReturnType<typeof buildImagePrompt>>>;
export type BuildImagePromptMutationBody = BodyType<BuildPromptInput>;
export type BuildImagePromptMutationError = ErrorType<unknown>;
/**
 * @summary Preview the image prompt Claude will generate before sending to Replicate
 */
export declare const useBuildImagePrompt: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof buildImagePrompt>>, TError, {
        projectId: number;
        data: BodyType<BuildPromptInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof buildImagePrompt>>, TError, {
    projectId: number;
    data: BodyType<BuildPromptInput>;
}, TContext>;
/**
 * @summary Get stored visual DNA for the store
 */
export declare const getGetVisualDnaUrl: (projectId: number) => string;
export declare const getVisualDna: (projectId: number, options?: RequestInit) => Promise<VisualDna>;
export declare const getGetVisualDnaQueryKey: (projectId: number) => readonly [`/api/projects/${number}/visual-dna`];
export declare const getGetVisualDnaQueryOptions: <TData = Awaited<ReturnType<typeof getVisualDna>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetVisualDnaQueryResult = NonNullable<Awaited<ReturnType<typeof getVisualDna>>>;
export type GetVisualDnaQueryError = ErrorType<unknown>;
/**
 * @summary Get stored visual DNA for the store
 */
export declare function useGetVisualDna<TData = Awaited<ReturnType<typeof getVisualDna>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVisualDna>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Extract visual DNA from store images via Claude Vision
 */
export declare const getExtractVisualDnaUrl: (projectId: number) => string;
export declare const extractVisualDna: (projectId: number, options?: RequestInit) => Promise<VisualDna>;
export declare const getExtractVisualDnaMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof extractVisualDna>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof extractVisualDna>>, TError, {
    projectId: number;
}, TContext>;
export type ExtractVisualDnaMutationResult = NonNullable<Awaited<ReturnType<typeof extractVisualDna>>>;
export type ExtractVisualDnaMutationError = ErrorType<unknown>;
/**
 * @summary Extract visual DNA from store images via Claude Vision
 */
export declare const useExtractVisualDna: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof extractVisualDna>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof extractVisualDna>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Get consistency scores for all products
 */
export declare const getGetConsistencyScoresUrl: (projectId: number) => string;
export declare const getConsistencyScores: (projectId: number, options?: RequestInit) => Promise<ConsistencyDashboard>;
export declare const getGetConsistencyScoresQueryKey: (projectId: number) => readonly [`/api/projects/${number}/consistency-scores`];
export declare const getGetConsistencyScoresQueryOptions: <TData = Awaited<ReturnType<typeof getConsistencyScores>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetConsistencyScoresQueryResult = NonNullable<Awaited<ReturnType<typeof getConsistencyScores>>>;
export type GetConsistencyScoresQueryError = ErrorType<unknown>;
/**
 * @summary Get consistency scores for all products
 */
export declare function useGetConsistencyScores<TData = Awaited<ReturnType<typeof getConsistencyScores>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getConsistencyScores>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Repair off-brand product images with StyleLock
 */
export declare const getRepairConsistencyUrl: (projectId: number) => string;
export declare const repairConsistency: (projectId: number, repairConsistencyInput: RepairConsistencyInput, options?: RequestInit) => Promise<BulkJobResponse>;
export declare const getRepairConsistencyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof repairConsistency>>, TError, {
        projectId: number;
        data: BodyType<RepairConsistencyInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof repairConsistency>>, TError, {
    projectId: number;
    data: BodyType<RepairConsistencyInput>;
}, TContext>;
export type RepairConsistencyMutationResult = NonNullable<Awaited<ReturnType<typeof repairConsistency>>>;
export type RepairConsistencyMutationBody = BodyType<RepairConsistencyInput>;
export type RepairConsistencyMutationError = ErrorType<unknown>;
/**
 * @summary Repair off-brand product images with StyleLock
 */
export declare const useRepairConsistency: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof repairConsistency>>, TError, {
        projectId: number;
        data: BodyType<RepairConsistencyInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof repairConsistency>>, TError, {
    projectId: number;
    data: BodyType<RepairConsistencyInput>;
}, TContext>;
/**
 * @summary List all A/B tests for a project
 */
export declare const getListAbTestsUrl: (projectId: number, params?: ListAbTestsParams) => string;
export declare const listAbTests: (projectId: number, params?: ListAbTestsParams, options?: RequestInit) => Promise<AbTest[]>;
export declare const getListAbTestsQueryKey: (projectId: number, params?: ListAbTestsParams) => readonly [`/api/projects/${number}/ab-tests`, ...ListAbTestsParams[]];
export declare const getListAbTestsQueryOptions: <TData = Awaited<ReturnType<typeof listAbTests>>, TError = ErrorType<unknown>>(projectId: number, params?: ListAbTestsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAbTests>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAbTests>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAbTestsQueryResult = NonNullable<Awaited<ReturnType<typeof listAbTests>>>;
export type ListAbTestsQueryError = ErrorType<unknown>;
/**
 * @summary List all A/B tests for a project
 */
export declare function useListAbTests<TData = Awaited<ReturnType<typeof listAbTests>>, TError = ErrorType<unknown>>(projectId: number, params?: ListAbTestsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAbTests>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a new A/B test
 */
export declare const getCreateAbTestUrl: (projectId: number) => string;
export declare const createAbTest: (projectId: number, createAbTestInput: CreateAbTestInput, options?: RequestInit) => Promise<AbTest>;
export declare const getCreateAbTestMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAbTest>>, TError, {
        projectId: number;
        data: BodyType<CreateAbTestInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAbTest>>, TError, {
    projectId: number;
    data: BodyType<CreateAbTestInput>;
}, TContext>;
export type CreateAbTestMutationResult = NonNullable<Awaited<ReturnType<typeof createAbTest>>>;
export type CreateAbTestMutationBody = BodyType<CreateAbTestInput>;
export type CreateAbTestMutationError = ErrorType<unknown>;
/**
 * @summary Create a new A/B test
 */
export declare const useCreateAbTest: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAbTest>>, TError, {
        projectId: number;
        data: BodyType<CreateAbTestInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAbTest>>, TError, {
    projectId: number;
    data: BodyType<CreateAbTestInput>;
}, TContext>;
/**
 * @summary Get A/B test details
 */
export declare const getGetAbTestUrl: (projectId: number, testId: string) => string;
export declare const getAbTest: (projectId: number, testId: string, options?: RequestInit) => Promise<AbTest>;
export declare const getGetAbTestQueryKey: (projectId: number, testId: string) => readonly [`/api/projects/${number}/ab-tests/${string}`];
export declare const getGetAbTestQueryOptions: <TData = Awaited<ReturnType<typeof getAbTest>>, TError = ErrorType<unknown>>(projectId: number, testId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAbTest>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAbTest>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAbTestQueryResult = NonNullable<Awaited<ReturnType<typeof getAbTest>>>;
export type GetAbTestQueryError = ErrorType<unknown>;
/**
 * @summary Get A/B test details
 */
export declare function useGetAbTest<TData = Awaited<ReturnType<typeof getAbTest>>, TError = ErrorType<unknown>>(projectId: number, testId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAbTest>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Manually declare winner or auto-process stats
 */
export declare const getDeclareAbTestWinnerUrl: (projectId: number, testId: string) => string;
export declare const declareAbTestWinner: (projectId: number, testId: string, declareWinnerInput: DeclareWinnerInput, options?: RequestInit) => Promise<AbTest>;
export declare const getDeclareAbTestWinnerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof declareAbTestWinner>>, TError, {
        projectId: number;
        testId: string;
        data: BodyType<DeclareWinnerInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof declareAbTestWinner>>, TError, {
    projectId: number;
    testId: string;
    data: BodyType<DeclareWinnerInput>;
}, TContext>;
export type DeclareAbTestWinnerMutationResult = NonNullable<Awaited<ReturnType<typeof declareAbTestWinner>>>;
export type DeclareAbTestWinnerMutationBody = BodyType<DeclareWinnerInput>;
export type DeclareAbTestWinnerMutationError = ErrorType<unknown>;
/**
 * @summary Manually declare winner or auto-process stats
 */
export declare const useDeclareAbTestWinner: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof declareAbTestWinner>>, TError, {
        projectId: number;
        testId: string;
        data: BodyType<DeclareWinnerInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof declareAbTestWinner>>, TError, {
    projectId: number;
    testId: string;
    data: BodyType<DeclareWinnerInput>;
}, TContext>;
/**
 * @summary Get A/B testing revenue impact dashboard
 */
export declare const getGetAbDashboardUrl: (projectId: number) => string;
export declare const getAbDashboard: (projectId: number, options?: RequestInit) => Promise<AbDashboard>;
export declare const getGetAbDashboardQueryKey: (projectId: number) => readonly [`/api/projects/${number}/ab-dashboard`];
export declare const getGetAbDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getAbDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAbDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getAbDashboard>>>;
export type GetAbDashboardQueryError = ErrorType<unknown>;
/**
 * @summary Get A/B testing revenue impact dashboard
 */
export declare function useGetAbDashboard<TData = Awaited<ReturnType<typeof getAbDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAbDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Pixel tracker endpoint (receives events from tracker.js)
 */
export declare const getTrackEventUrl: () => string;
export declare const trackEvent: (trackEvent: TrackEvent, options?: RequestInit) => Promise<SuccessResponse>;
export declare const getTrackEventMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof trackEvent>>, TError, {
        data: BodyType<TrackEvent>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof trackEvent>>, TError, {
    data: BodyType<TrackEvent>;
}, TContext>;
export type TrackEventMutationResult = NonNullable<Awaited<ReturnType<typeof trackEvent>>>;
export type TrackEventMutationBody = BodyType<TrackEvent>;
export type TrackEventMutationError = ErrorType<unknown>;
/**
 * @summary Pixel tracker endpoint (receives events from tracker.js)
 */
export declare const useTrackEvent: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof trackEvent>>, TError, {
        data: BodyType<TrackEvent>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof trackEvent>>, TError, {
    data: BodyType<TrackEvent>;
}, TContext>;
/**
 * @summary Get COGS structure for a product
 */
export declare const getGetProductCogsUrl: (projectId: number, productId: string) => string;
export declare const getProductCogs: (projectId: number, productId: string, options?: RequestInit) => Promise<CogsData>;
export declare const getGetProductCogsQueryKey: (projectId: number, productId: string) => readonly [`/api/projects/${number}/products/${string}/cogs`];
export declare const getGetProductCogsQueryOptions: <TData = Awaited<ReturnType<typeof getProductCogs>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProductCogsQueryResult = NonNullable<Awaited<ReturnType<typeof getProductCogs>>>;
export type GetProductCogsQueryError = ErrorType<unknown>;
/**
 * @summary Get COGS structure for a product
 */
export declare function useGetProductCogs<TData = Awaited<ReturnType<typeof getProductCogs>>, TError = ErrorType<unknown>>(projectId: number, productId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProductCogs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Save COGS structure for a product
 */
export declare const getSaveProductCogsUrl: (projectId: number, productId: string) => string;
export declare const saveProductCogs: (projectId: number, productId: string, saveCogsInput: SaveCogsInput, options?: RequestInit) => Promise<CogsData>;
export declare const getSaveProductCogsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof saveProductCogs>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<SaveCogsInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof saveProductCogs>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<SaveCogsInput>;
}, TContext>;
export type SaveProductCogsMutationResult = NonNullable<Awaited<ReturnType<typeof saveProductCogs>>>;
export type SaveProductCogsMutationBody = BodyType<SaveCogsInput>;
export type SaveProductCogsMutationError = ErrorType<unknown>;
/**
 * @summary Save COGS structure for a product
 */
export declare const useSaveProductCogs: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof saveProductCogs>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<SaveCogsInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof saveProductCogs>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<SaveCogsInput>;
}, TContext>;
/**
 * @summary Scrape and analyze competitor pricing
 */
export declare const getAnalyzeCompetitorPricesUrl: (projectId: number, productId: string) => string;
export declare const analyzeCompetitorPrices: (projectId: number, productId: string, competitorAnalysisInput: CompetitorAnalysisInput, options?: RequestInit) => Promise<CompetitorAnalysisResult>;
export declare const getAnalyzeCompetitorPricesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof analyzeCompetitorPrices>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<CompetitorAnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof analyzeCompetitorPrices>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<CompetitorAnalysisInput>;
}, TContext>;
export type AnalyzeCompetitorPricesMutationResult = NonNullable<Awaited<ReturnType<typeof analyzeCompetitorPrices>>>;
export type AnalyzeCompetitorPricesMutationBody = BodyType<CompetitorAnalysisInput>;
export type AnalyzeCompetitorPricesMutationError = ErrorType<unknown>;
/**
 * @summary Scrape and analyze competitor pricing
 */
export declare const useAnalyzeCompetitorPrices: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof analyzeCompetitorPrices>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<CompetitorAnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof analyzeCompetitorPrices>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<CompetitorAnalysisInput>;
}, TContext>;
/**
 * @summary Calculate optimal price using Claude as financial analyst
 */
export declare const getCalculateOptimalPriceUrl: (projectId: number, productId: string) => string;
export declare const calculateOptimalPrice: (projectId: number, productId: string, options?: RequestInit) => Promise<PricingRecommendation>;
export declare const getCalculateOptimalPriceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof calculateOptimalPrice>>, TError, {
        projectId: number;
        productId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof calculateOptimalPrice>>, TError, {
    projectId: number;
    productId: string;
}, TContext>;
export type CalculateOptimalPriceMutationResult = NonNullable<Awaited<ReturnType<typeof calculateOptimalPrice>>>;
export type CalculateOptimalPriceMutationError = ErrorType<unknown>;
/**
 * @summary Calculate optimal price using Claude as financial analyst
 */
export declare const useCalculateOptimalPrice: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof calculateOptimalPrice>>, TError, {
        projectId: number;
        productId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof calculateOptimalPrice>>, TError, {
    projectId: number;
    productId: string;
}, TContext>;
/**
 * @summary Apply recommended price to Shopify product
 */
export declare const getApplyPriceToShopifyUrl: (projectId: number, productId: string) => string;
export declare const applyPriceToShopify: (projectId: number, productId: string, applyPriceInput: ApplyPriceInput, options?: RequestInit) => Promise<SuccessResponse>;
export declare const getApplyPriceToShopifyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyPriceToShopify>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<ApplyPriceInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof applyPriceToShopify>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<ApplyPriceInput>;
}, TContext>;
export type ApplyPriceToShopifyMutationResult = NonNullable<Awaited<ReturnType<typeof applyPriceToShopify>>>;
export type ApplyPriceToShopifyMutationBody = BodyType<ApplyPriceInput>;
export type ApplyPriceToShopifyMutationError = ErrorType<unknown>;
/**
 * @summary Apply recommended price to Shopify product
 */
export declare const useApplyPriceToShopify: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof applyPriceToShopify>>, TError, {
        projectId: number;
        productId: string;
        data: BodyType<ApplyPriceInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof applyPriceToShopify>>, TError, {
    projectId: number;
    productId: string;
    data: BodyType<ApplyPriceInput>;
}, TContext>;
/**
 * @summary Get P&L dashboard with live Shopify orders data
 */
export declare const getGetFinancialDashboardUrl: (projectId: number) => string;
export declare const getFinancialDashboard: (projectId: number, options?: RequestInit) => Promise<FinancialDashboard>;
export declare const getGetFinancialDashboardQueryKey: (projectId: number) => readonly [`/api/projects/${number}/financial-dashboard`];
export declare const getGetFinancialDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getFinancialDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFinancialDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getFinancialDashboard>>>;
export type GetFinancialDashboardQueryError = ErrorType<unknown>;
/**
 * @summary Get P&L dashboard with live Shopify orders data
 */
export declare function useGetFinancialDashboard<TData = Awaited<ReturnType<typeof getFinancialDashboard>>, TError = ErrorType<unknown>>(projectId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFinancialDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Run full SEO audit for the store
 */
export declare const getRunSeoAuditUrl: (projectId: number) => string;
export declare const runSeoAudit: (projectId: number, options?: RequestInit) => Promise<SeoAuditResult>;
export declare const getRunSeoAuditMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runSeoAudit>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof runSeoAudit>>, TError, {
    projectId: number;
}, TContext>;
export type RunSeoAuditMutationResult = NonNullable<Awaited<ReturnType<typeof runSeoAudit>>>;
export type RunSeoAuditMutationError = ErrorType<unknown>;
/**
 * @summary Run full SEO audit for the store
 */
export declare const useRunSeoAudit: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runSeoAudit>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof runSeoAudit>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Generate JSON-LD schemas and inject to Shopify
 */
export declare const getGenerateSchemasUrl: (projectId: number) => string;
export declare const generateSchemas: (projectId: number, seoActionInput: SeoActionInput, options?: RequestInit) => Promise<BulkJobResponse>;
export declare const getGenerateSchemasMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSchemas>>, TError, {
        projectId: number;
        data: BodyType<SeoActionInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateSchemas>>, TError, {
    projectId: number;
    data: BodyType<SeoActionInput>;
}, TContext>;
export type GenerateSchemasMutationResult = NonNullable<Awaited<ReturnType<typeof generateSchemas>>>;
export type GenerateSchemasMutationBody = BodyType<SeoActionInput>;
export type GenerateSchemasMutationError = ErrorType<unknown>;
/**
 * @summary Generate JSON-LD schemas and inject to Shopify
 */
export declare const useGenerateSchemas: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSchemas>>, TError, {
        projectId: number;
        data: BodyType<SeoActionInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateSchemas>>, TError, {
    projectId: number;
    data: BodyType<SeoActionInput>;
}, TContext>;
/**
 * @summary Batch generate meta tags for all products missing them
 */
export declare const getGenerateMetasUrl: (projectId: number) => string;
export declare const generateMetas: (projectId: number, seoActionInput: SeoActionInput, options?: RequestInit) => Promise<BulkJobResponse>;
export declare const getGenerateMetasMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateMetas>>, TError, {
        projectId: number;
        data: BodyType<SeoActionInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateMetas>>, TError, {
    projectId: number;
    data: BodyType<SeoActionInput>;
}, TContext>;
export type GenerateMetasMutationResult = NonNullable<Awaited<ReturnType<typeof generateMetas>>>;
export type GenerateMetasMutationBody = BodyType<SeoActionInput>;
export type GenerateMetasMutationError = ErrorType<unknown>;
/**
 * @summary Batch generate meta tags for all products missing them
 */
export declare const useGenerateMetas: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateMetas>>, TError, {
        projectId: number;
        data: BodyType<SeoActionInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateMetas>>, TError, {
    projectId: number;
    data: BodyType<SeoActionInput>;
}, TContext>;
/**
 * @summary Generate XML sitemap and ping Google
 */
export declare const getGenerateSitemapUrl: (projectId: number) => string;
export declare const generateSitemap: (projectId: number, options?: RequestInit) => Promise<SitemapResult>;
export declare const getGenerateSitemapMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSitemap>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateSitemap>>, TError, {
    projectId: number;
}, TContext>;
export type GenerateSitemapMutationResult = NonNullable<Awaited<ReturnType<typeof generateSitemap>>>;
export type GenerateSitemapMutationError = ErrorType<unknown>;
/**
 * @summary Generate XML sitemap and ping Google
 */
export declare const useGenerateSitemap: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateSitemap>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateSitemap>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Audit Core Web Vitals via PageSpeed Insights
 */
export declare const getAuditPageSpeedUrl: (projectId: number) => string;
export declare const auditPageSpeed: (projectId: number, pageSpeedInput: PageSpeedInput, options?: RequestInit) => Promise<PageSpeedResult>;
export declare const getAuditPageSpeedMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof auditPageSpeed>>, TError, {
        projectId: number;
        data: BodyType<PageSpeedInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof auditPageSpeed>>, TError, {
    projectId: number;
    data: BodyType<PageSpeedInput>;
}, TContext>;
export type AuditPageSpeedMutationResult = NonNullable<Awaited<ReturnType<typeof auditPageSpeed>>>;
export type AuditPageSpeedMutationBody = BodyType<PageSpeedInput>;
export type AuditPageSpeedMutationError = ErrorType<unknown>;
/**
 * @summary Audit Core Web Vitals via PageSpeed Insights
 */
export declare const useAuditPageSpeed: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof auditPageSpeed>>, TError, {
        projectId: number;
        data: BodyType<PageSpeedInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof auditPageSpeed>>, TError, {
    projectId: number;
    data: BodyType<PageSpeedInput>;
}, TContext>;
/**
 * @summary Get keyword strategy for a product
 */
export declare const getGetKeywordIntelligenceUrl: (projectId: number) => string;
export declare const getKeywordIntelligence: (projectId: number, keywordInput: KeywordInput, options?: RequestInit) => Promise<KeywordStrategy>;
export declare const getGetKeywordIntelligenceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getKeywordIntelligence>>, TError, {
        projectId: number;
        data: BodyType<KeywordInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof getKeywordIntelligence>>, TError, {
    projectId: number;
    data: BodyType<KeywordInput>;
}, TContext>;
export type GetKeywordIntelligenceMutationResult = NonNullable<Awaited<ReturnType<typeof getKeywordIntelligence>>>;
export type GetKeywordIntelligenceMutationBody = BodyType<KeywordInput>;
export type GetKeywordIntelligenceMutationError = ErrorType<unknown>;
/**
 * @summary Get keyword strategy for a product
 */
export declare const useGetKeywordIntelligence: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getKeywordIntelligence>>, TError, {
        projectId: number;
        data: BodyType<KeywordInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof getKeywordIntelligence>>, TError, {
    projectId: number;
    data: BodyType<KeywordInput>;
}, TContext>;
/**
 * @summary Generate blog content strategy for the store
 */
export declare const getGetBlogStrategyUrl: (projectId: number) => string;
export declare const getBlogStrategy: (projectId: number, options?: RequestInit) => Promise<BlogStrategy>;
export declare const getGetBlogStrategyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getBlogStrategy>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof getBlogStrategy>>, TError, {
    projectId: number;
}, TContext>;
export type GetBlogStrategyMutationResult = NonNullable<Awaited<ReturnType<typeof getBlogStrategy>>>;
export type GetBlogStrategyMutationError = ErrorType<unknown>;
/**
 * @summary Generate blog content strategy for the store
 */
export declare const useGetBlogStrategy: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getBlogStrategy>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof getBlogStrategy>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Generate a full blog post with Claude
 */
export declare const getGenerateBlogPostUrl: (projectId: number) => string;
export declare const generateBlogPost: (projectId: number, blogPostInput: BlogPostInput, options?: RequestInit) => Promise<BlogPost>;
export declare const getGenerateBlogPostMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateBlogPost>>, TError, {
        projectId: number;
        data: BodyType<BlogPostInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateBlogPost>>, TError, {
    projectId: number;
    data: BodyType<BlogPostInput>;
}, TContext>;
export type GenerateBlogPostMutationResult = NonNullable<Awaited<ReturnType<typeof generateBlogPost>>>;
export type GenerateBlogPostMutationBody = BodyType<BlogPostInput>;
export type GenerateBlogPostMutationError = ErrorType<unknown>;
/**
 * @summary Generate a full blog post with Claude
 */
export declare const useGenerateBlogPost: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateBlogPost>>, TError, {
        projectId: number;
        data: BodyType<BlogPostInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateBlogPost>>, TError, {
    projectId: number;
    data: BodyType<BlogPostInput>;
}, TContext>;
/**
 * @summary Batch generate and apply SEO alt texts for all product images
 */
export declare const getFixAltTextsUrl: (projectId: number) => string;
export declare const fixAltTexts: (projectId: number, options?: RequestInit) => Promise<BulkJobResponse>;
export declare const getFixAltTextsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof fixAltTexts>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof fixAltTexts>>, TError, {
    projectId: number;
}, TContext>;
export type FixAltTextsMutationResult = NonNullable<Awaited<ReturnType<typeof fixAltTexts>>>;
export type FixAltTextsMutationError = ErrorType<unknown>;
/**
 * @summary Batch generate and apply SEO alt texts for all product images
 */
export declare const useFixAltTexts: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof fixAltTexts>>, TError, {
        projectId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof fixAltTexts>>, TError, {
    projectId: number;
}, TContext>;
/**
 * @summary Get background job status (bulk operations)
 */
export declare const getGetJobStatusUrl: (projectId: number, jobId: string) => string;
export declare const getJobStatus: (projectId: number, jobId: string, options?: RequestInit) => Promise<JobStatus>;
export declare const getGetJobStatusQueryKey: (projectId: number, jobId: string) => readonly [`/api/projects/${number}/jobs/${string}`];
export declare const getGetJobStatusQueryOptions: <TData = Awaited<ReturnType<typeof getJobStatus>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetJobStatusQueryResult = NonNullable<Awaited<ReturnType<typeof getJobStatus>>>;
export type GetJobStatusQueryError = ErrorType<unknown>;
/**
 * @summary Get background job status (bulk operations)
 */
export declare function useGetJobStatus<TData = Awaited<ReturnType<typeof getJobStatus>>, TError = ErrorType<unknown>>(projectId: number, jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJobStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map