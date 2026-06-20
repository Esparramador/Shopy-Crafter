import { useGame } from "../lib/gameStore";

export function Inventory() {
  const { showInventory, inventory, toggleInventory, removeItem, heal } = useGame();

  if (!showInventory) return null;

  const useItem = (id: string, type: string) => {
    if (type === "health") {
      heal(50);
      removeItem(id);
    }
  };

  return (
    <div className="inventory-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase" }}>🎒 Inventario</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>Objetos del CEO</div>
        </div>
        <button onClick={toggleInventory} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 20 }}>✕</button>
      </div>

      {inventory.length === 0 ? (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "24px 0", fontSize: 13 }}>
          El inventario está vacío
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {inventory.map(item => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
            }}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                {item.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{item.description}</div>}
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                  Cantidad: {item.quantity} &nbsp;·&nbsp; Tipo: {item.type}
                </div>
              </div>
              {item.type === "health" && (
                <button className="btn btn-gold" onClick={() => useItem(item.id, item.type)} style={{ fontSize: 11, padding: "4px 10px" }}>
                  Usar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
        Presiona I para cerrar
      </div>
    </div>
  );
}
