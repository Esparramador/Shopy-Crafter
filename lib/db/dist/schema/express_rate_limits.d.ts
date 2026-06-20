export declare const expressRateLimitsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "express_rate_limits";
    schema: undefined;
    columns: {
        key: import("drizzle-orm/pg-core").PgColumn<{
            name: "key";
            tableName: "express_rate_limits";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        totalHits: import("drizzle-orm/pg-core").PgColumn<{
            name: "total_hits";
            tableName: "express_rate_limits";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        resetAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "reset_at";
            tableName: "express_rate_limits";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export type ExpressRateLimit = typeof expressRateLimitsTable.$inferSelect;
//# sourceMappingURL=express_rate_limits.d.ts.map