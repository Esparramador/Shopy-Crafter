export function Prestige() {
  const logoSrc = "/sc-logo-prestige.png";

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1A1510 0%, #231D15 30%, #1E1812 60%, #151010 100%)',
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
        background: 'radial-gradient(ellipse at 50% 40%, rgba(196,149,106,0.06) 0%, transparent 70%)',
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
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '3px solid rgba(196,149,106,0.3)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 80px rgba(196,149,106,0.08)',
          marginBottom: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1510',
        }}>
          <div style={{
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #C4956A 0%, #8B6914 50%, #C4956A 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '72px',
            fontWeight: 700,
            color: '#1A1510',
            fontFamily: "'Georgia', serif",
          }}>SC</div>
        </div>

        <p style={{
          fontSize: '28px',
          fontWeight: 300,
          color: '#C4956A',
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
          color: 'rgba(196,149,106,0.5)',
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