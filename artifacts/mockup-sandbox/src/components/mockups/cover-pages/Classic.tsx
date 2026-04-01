export function Classic() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(170deg, #08080e 0%, #0c0c14 40%, #08080e 100%)',
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
        background: 'radial-gradient(ellipse at 50% 40%, rgba(200,168,75,0.05) 0%, transparent 60%)',
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
          border: '2px solid rgba(200,168,75,0.25)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(200,168,75,0.06)',
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
          color: '#c8a84b',
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
          color: 'rgba(200,168,75,0.4)',
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