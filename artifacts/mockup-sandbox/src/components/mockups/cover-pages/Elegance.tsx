export function Elegance() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0b1628 0%, #0f1d35 35%, #111e36 65%, #0b1628 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: '0',
    }}>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at 50% 40%, rgba(74,144,217,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
      }}>
        <div style={{
          width: '200px',
          height: '200px',
          borderRadius: '20px',
          overflow: 'hidden',
          border: '2px solid rgba(74,144,217,0.3)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px #1a2a4a, 0 0 60px rgba(74,144,217,0.06)',
          marginBottom: '40px',
        }}>
          <img
            src="/__mockup/sc-logo-corporate.png"
            alt="Shopy Crafter"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <p style={{
          fontSize: '28px',
          fontWeight: 300,
          color: '#c0c8d8',
          letterSpacing: '8px',
          textTransform: 'uppercase',
          margin: 0,
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}>
          Shopy Crafter
        </p>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '48px',
        right: '60px',
        textAlign: 'right',
        zIndex: 1,
      }}>
        <p style={{
          fontSize: '14px',
          color: 'rgba(192,200,216,0.35)',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          margin: 0,
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          fontWeight: 300,
        }}>
          Comic Crafter
        </p>
      </div>
    </div>
  );
}