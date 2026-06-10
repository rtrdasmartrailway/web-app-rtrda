export default function Loading() {
  return (
    <div className="site-shell">
      <div className="page-hero" aria-hidden="true">
        <div className="site-container hero-inner">
          <div className="skeleton-line" style={{ width: "60%", height: "1.5rem", marginBottom: "1rem" }} />
          <div className="skeleton-line" style={{ width: "40%", height: "2.5rem" }} />
        </div>
      </div>
    </div>
  );
}
