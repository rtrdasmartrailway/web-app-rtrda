"use client";

export function StickyFacebookButton() {
  return (
    <a
      href="https://m.me/100799302693049"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Facebook Messenger"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#0075FF] text-white shadow-lg hover:scale-110 transition-transform duration-200"
    >
      {/* Shockwave rings */}
      <span className="absolute inset-0 rounded-full bg-[#0075FF] opacity-40 shockwave-ring pointer-events-none" />
      <span className="absolute inset-0 rounded-full bg-[#0075FF] opacity-30 shockwave-ring-delay pointer-events-none" />

      {/* Messenger Icon */}
      <svg
        className="relative w-7 h-7"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C6.48 2 2 6.03 2 10.89c0 2.51 1.25 4.76 3.21 6.24v3.04c0 .27.17.5.43.59.06.02.12.03.18.03.19 0 .37-.09.48-.24l1.47-2.03c1.07.29 2.2.45 3.37.45 5.52 0 10-4.03 10-8.89S17.52 2 12 2zm.01 14.5c-1.05 0-2.06-.26-2.96-.74l-2.13 1.48v-2.62c-1.55-1.11-2.55-2.79-2.55-4.62 0-3.34 3.13-6.05 7-6.05s7 2.71 7 6.05-3.13 6.05-7 6.05c-.28 0-.55-.02-.82-.04l-.49-.01zm3.23-4.5l-2.87-2.72c-.24-.23-.63-.23-.87 0l-.83.79c-.2.19-.46.3-.74.3H9.07c-.38 0-.56.44-.31.71l2.61 2.71c.24.26.62.26.86 0l3.01-3.21c.43-.01.61-.5.33-.77l-.01-.01z" />
      </svg>
    </a>
  );
}
