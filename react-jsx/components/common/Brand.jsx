/**
 * CBTMS mark used by authentication screens.
 *
 * The image is served from `public/images/logo.png`, so the same URL works in
 * development (Vite) and when FastAPI serves the built SPA.
 */
export function Brand({ className = 'login-brand', imgClassName = 'navic-logo login-logo', width = 2000, height = 2000 }) {
  return (
    <div className={className}>
      <img
        className={imgClassName}
        src={`${import.meta.env.BASE_URL}images/logo.png`}
        alt="NavIC College Bus Tracking and Management System"
        width={width}
        height={height}
      />
    </div>
  );
}
