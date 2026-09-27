import { beforeEach, describe, expect, it, vi } from "vitest";

let projectExists = true;
vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (projectExists ? [{ id: 7 }] : []) }),
      }),
    }),
  },
  projectsTable: { id: "id" },
}));

import { canAccessProject, clientOwnsProjectId } from "./access";

describe("clientOwnsProjectId", () => {
  it("el cliente accede solo al proyecto de su invitación (users.client_id = id de proyecto)", () => {
    expect(clientOwnsProjectId("7", 7)).toBe(true);
    expect(clientOwnsProjectId(7, 7)).toBe(true);
    expect(clientOwnsProjectId("7", 8)).toBe(false);
  });

  it("no acepta valores vacíos ni credenciales OAuth como identidad", () => {
    expect(clientOwnsProjectId(null, 7)).toBe(false);
    expect(clientOwnsProjectId("", 0)).toBe(false);
    expect(clientOwnsProjectId("0", 0)).toBe(false);
    expect(clientOwnsProjectId("shpca_1234", 7)).toBe(false);
    expect(clientOwnsProjectId("7.0x", 7)).toBe(false);
  });
});

describe("canAccessProject", () => {
  beforeEach(() => { projectExists = true; });

  it("admin siempre", async () => {
    expect(await canAccessProject("admin", null, 99)).toBe(true);
  });

  it("cliente: su proyecto sí, otro no", async () => {
    expect(await canAccessProject("client", "7", 7)).toBe(true);
    expect(await canAccessProject("client", "7", 8)).toBe(false);
  });

  it("cliente: su proyecto borrado → no", async () => {
    projectExists = false;
    expect(await canAccessProject("client", "7", 7)).toBe(false);
  });

  it("rol desconocido → no", async () => {
    expect(await canAccessProject(undefined, "7", 7)).toBe(false);
  });
});
