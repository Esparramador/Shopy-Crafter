export function Classic() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(170deg, #0D0D0D 0%, #1A1A1A 40%, #141414 100%)',
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
        background: 'radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.04) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        top: '35px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, transparent, #D4AF37)' }} />
        <div style={{ width: '6px', height: '6px', border: '1px solid rgba(212,175,55,0.4)', transform: 'rotate(45deg)' }} />
        <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, #D4AF37, transparent)' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, maxWidth: '700px', textAlign: 'center' }}>
        
        <div style={{
          display: 'inline-block',
          padding: '10px 32px',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05))',
          border: '1px solid rgba(212,175,55,0.3)',
          fontSize: '11px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: '#D4AF37',
          marginBottom: '48px',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          fontWeight: 500,
        }}>
          Informe Oficial
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '40px',
        }}>
          <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg, transparent, #D4AF37)' }} />
          <div style={{ width: '4px', height: '4px', background: '#D4AF37', borderRadius: '50%' }} />
          <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg, #D4AF37, transparent)' }} />
        </div>

        <h1 style={{
          fontSize: '44px',
          fontWeight: 400,
          color: '#F5F0E8',
          lineHeight: 1.2,
          margin: '0 0 16px 0',
          letterSpacing: '1px',
        }}>
          Auditoría Completa
        </h1>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 300,
          color: '#D4AF37',
          margin: '0 0 40px 0',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}>
          de Tienda Online
        </h2>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '40px',
        }}>
          <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4))' }} />
          <div style={{ width: '4px', height: '4px', background: 'rgba(212,175,55,0.4)', borderRadius: '50%' }} />
          <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg, rgba(212,175,55,0.4), transparent)' }} />
        </div>

        <p style={{
          fontSize: '14px',
          color: 'rgba(212,175,55,0.45)',
          letterSpacing: '1px',
          margin: 0,
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}>
          1 de Abril, 2026
        </p>
      </div>

      <div style={{ zIndex: 1, textAlign: 'center', marginTop: 'auto', paddingTop: '40px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '32px',
        }}>
          <div style={{ width: '50px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.2))' }} />
          <div style={{ width: '4px', height: '4px', border: '1px solid rgba(212,175,55,0.2)', transform: 'rotate(45deg)' }} />
          <div style={{ width: '50px', height: '1px', background: 'linear-gradient(90deg, rgba(212,175,55,0.2), transparent)' }} />
        </div>
        
        <h3 style={{
          fontSize: '28px',
          fontWeight: 400,
          color: '#D4AF37',
          margin: '0 0 8px 0',
          letterSpacing: '4px',
          textTransform: 'uppercase',
        }}>
          Comic Crafter
        </h3>
        <p style={{
          fontSize: '12px',
          color: 'rgba(245,240,232,0.3)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          margin: '0 0 40px 0',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}>
          comic-crafter.myshopify.com
        </p>

        <p style={{
          fontSize: '10px',
          color: 'rgba(212,175,55,0.25)',
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