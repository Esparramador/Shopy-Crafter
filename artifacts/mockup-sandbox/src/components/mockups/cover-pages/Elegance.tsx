export function Elegance() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0A1628 0%, #0F2340 35%, #162D50 65%, #0A1628 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      position: 'relative',
      overflow: 'hidden',
      padding: '60px 40px',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at 30% 20%, rgba(100,150,220,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(192,192,192,0.04) 0%, transparent 40%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        top: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80px',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(192,192,192,0.5), transparent)',
      }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, maxWidth: '700px', textAlign: 'center' }}>
        
        <div style={{
          display: 'inline-block',
          padding: '8px 28px',
          border: '1px solid rgba(192,192,192,0.25)',
          borderRadius: '0',
          fontSize: '11px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: 'rgba(192,192,192,0.7)',
          marginBottom: '48px',
          fontWeight: 400,
        }}>
          Informe Oficial
        </div>

        <div style={{
          width: '60px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(192,192,192,0.4), transparent)',
          marginBottom: '40px',
        }} />

        <h1 style={{
          fontSize: '42px',
          fontWeight: 300,
          color: '#E8ECF2',
          lineHeight: 1.2,
          margin: '0 0 16px 0',
          letterSpacing: '2px',
        }}>
          Auditoría Completa
        </h1>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 300,
          color: 'rgba(192,192,192,0.6)',
          margin: '0 0 40px 0',
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          de Tienda Online
        </h2>

        <div style={{
          width: '60px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(192,192,192,0.4), transparent)',
          marginBottom: '40px',
        }} />

        <p style={{
          fontSize: '14px',
          color: 'rgba(192,192,192,0.45)',
          letterSpacing: '1px',
          margin: 0,
        }}>
          1 de Abril, 2026
        </p>
      </div>

      <div style={{ zIndex: 1, textAlign: 'center', marginTop: 'auto', paddingTop: '40px' }}>
        <div style={{
          width: '120px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(192,192,192,0.2), transparent)',
          margin: '0 auto 32px',
        }} />
        
        <h3 style={{
          fontSize: '28px',
          fontWeight: 300,
          color: '#C0C0C0',
          margin: '0 0 8px 0',
          letterSpacing: '4px',
          textTransform: 'uppercase',
        }}>
          Comic Crafter
        </h3>
        <p style={{
          fontSize: '12px',
          color: 'rgba(192,192,192,0.35)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          margin: '0 0 40px 0',
        }}>
          comic-crafter.myshopify.com
        </p>

        <p style={{
          fontSize: '10px',
          color: 'rgba(192,192,192,0.25)',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          Shopy Crafter eCommerce
        </p>
      </div>
    </div>
  );
}