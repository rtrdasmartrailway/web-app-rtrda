import Link from "next/link";

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function WpButton({ href, className, children }: Props) {
  const isInternal = href.startsWith("/") || href.startsWith("#");
  const cls = `wp-block-button__link${className ? ` ${className}` : ""}`;

  if (isInternal) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={cls} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
