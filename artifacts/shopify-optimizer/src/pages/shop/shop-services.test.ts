import { describe, expect, it } from "vitest";
import { SHOP_SERVICE_OFFERS, shopServiceContactHref } from "./shop-services";

describe("storefront service offers", () => {
  it("describes the requested assistant options without the excluded project name", () => {
    const assistant = SHOP_SERVICE_OFFERS.find(offer => offer.icon === "assistant");
    expect(assistant?.description).toContain("WhatsApp");
    expect(assistant?.description).toContain("teléfono");
    expect(assistant?.variants.map(variant => variant.label)).toEqual([
      "Solo diseño",
      "Integración y configuración",
      "App personalizada opcional",
    ]);
    expect(JSON.stringify(SHOP_SERVICE_OFFERS).toLowerCase()).not.toContain("brasas caller");
  });

  it("offers web chatbots, custom agents, and setup or ongoing Ads service", () => {
    expect(SHOP_SERVICE_OFFERS.some(offer => offer.name.includes("Chatbot"))).toBe(true);
    expect(SHOP_SERVICE_OFFERS.some(offer => offer.name.includes("Agente de IA a medida"))).toBe(true);
    const ads = SHOP_SERVICE_OFFERS.find(offer => offer.group === "ads");
    expect(ads?.variants.map(variant => variant.label)).toEqual(["Configuración inicial", "Gestión continua"]);
  });

  it("builds a contact link with a bounded, URL-encoded request subject", () => {
    expect(shopServiceContactHref("Configurar WhatsApp & teléfono")).toBe(
      "/contacto?asunto=Configurar%20WhatsApp%20%26%20tel%C3%A9fono",
    );
    expect(decodeURIComponent(shopServiceContactHref("x".repeat(200)).split("=")[1])).toHaveLength(120);
  });
});
