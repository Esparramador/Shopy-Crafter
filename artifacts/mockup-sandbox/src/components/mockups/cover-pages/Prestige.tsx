export function Prestige() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FAF7F2 0%, #F0E6D3 40%, #E8D5B8 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Georgia', 'Times New Roman', serif",
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
        background: 'radial-gradient(ellipse at 20% 80%, rgba(184,115,51,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(184,115,51,0.05) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        top: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80px',
        height: '2px',
        background: 'linear-gradient(90deg, transparent, #B87333, transparent)',
      }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, maxWidth: '700px', textAlign: 'center' }}>
        
        <div style={{
          display: 'inline-block',
          padding: '8px 28px',
          border: '1px solid rgba(184,115,51,0.35)',
          borderRadius: '2px',
          fontSize: '11px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: '#B87333',
          marginBottom: '48px',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          fontWeight: 500,
        }}>
          Informe Oficial
        </div>

        <div style={{
          width: '60px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, #B87333, transparent)',
          marginBottom: '40px',
        }} />

        <h1 style={{
          fontSize: '42px',
          fontWeight: 400,
          color: '#2C1810',
          lineHeight: 1.2,
          margin: '0 0 16px 0',
          letterSpacing: '1px',
        }}>
          Auditoría Completa
        </h1>
        <h2 style={{
          fontSize: '22px',
          fontWeight: 300,
          color: '#8B6914',
          margin: '0 0 40px 0',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}>
          de Tienda Online
        </h2>

        <div style={{
          width: '60px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, #B87333, transparent)',
          marginBottom: '40px',
        }} />

        <p style={{
          fontSize: '14px',
          color: '#7A6A5A',
          letterSpacing: '1px',
          margin: 0,
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}>
          1 de Abril, 2026
        </p>
      </div>

      <div style={{ zIndex: 1, textAlign: 'center', marginTop: 'auto', paddingTop: '40px' }}>
        <div style={{
          width: '120px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(184,115,51,0.3), transparent)',
          margin: '0 auto 32px',
        }} />
        
        <h3 style={{
          fontSize: '28px',
          fontWeight: 400,
          color: '#2C1810',
          margin: '0 0 8px 0',
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Comic Crafter
        </h3>
        <p style={{
          fontSize: '12px',
          color: '#9A8A7A',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          margin: '0 0 40px 0',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}>
          comic-crafter.myshopify.com
        </p>

        <p style={{
          fontSize: '10px',
          color: '#B0A090',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          margin: 0,
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}>
          Shopy Crafter eCommerce
        </p>
      </div>
    </div>
  );
}