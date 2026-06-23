const FB_PAGE_ID = "100799302693049";

export function StickyFacebookButton({ isHome }: { isHome: boolean }) {
  if (!isHome) return null;

  return (
    <a
      href={`https://m.me/${FB_PAGE_ID}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Facebook Messenger"
      className="sticky-fb-btn"
    >
      <span className="sticky-fb-btn-ring" aria-hidden="true" />
      <span className="sticky-fb-btn-ring sticky-fb-btn-ring-delay" aria-hidden="true" />
      <svg
        className="sticky-fb-btn-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.908 1.434 5.5 3.678 7.198V22l3.405-1.871c.92.255 1.905.393 2.917.393 5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.012 12.422l-2.56-2.737-5.01 2.737 5.51-5.853 2.604 2.737 4.967-2.737-5.51 5.853z" />
      </svg>
    </a>
  );
}
