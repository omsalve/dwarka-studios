export function FeatherMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2C12 2 5 6 5 13c0 4.5 3.2 7.6 7 9 3.8-1.4 7-4.5 7-9 0-7-7-11-7-11Z"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M12 4.5V21"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path
        d="M12 8 8.5 10M12 8 15.5 10M12 12 8 14.3M12 12 16 14.3M12 16 9 17.8M12 16 15 17.8"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
