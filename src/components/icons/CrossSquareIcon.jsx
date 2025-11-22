import React from "react";

export default function CrossSquareIcon({ className, ...props }) {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      {...props}
    >
      <g transform="translate(4.000000, 4.000000)" strokeLinejoin="round">
        <circle cx="20" cy="4" r="4" fill="currentColor" fillRule="nonzero" />
        <circle cx="20" cy="36" r="4" fill="currentColor" fillRule="nonzero" />
        <circle cx="4" cy="20" r="4" fill="currentColor" fillRule="nonzero" />
        <circle cx="36" cy="20" r="4" fill="currentColor" fillRule="nonzero" />
        <path d="M8,20 L32,20" strokeLinecap="round" />
        <path d="M8,20 L32,20" strokeLinecap="round" transform="translate(20.000000, 20.000000) rotate(90.000000) translate(-20.000000, -20.000000)" />
        <path d="M11.1104658,6.69474141 C10.2379344,7.27885667 9.42606093,7.94652207 8.6862915,8.6862915 C7.94652207,9.42606093 7.27885667,10.2379344 6.69474141,11.1104658 M6.69474141,28.8895342 C7.27885667,29.7620656 7.94652207,30.5739391 8.6862915,31.3137085 C9.42606093,32.0534779 10.2379344,32.7211433 11.1104658,33.3052586 M28.8895342,33.3052586 C29.7620656,32.7211433 30.5739391,32.0534779 31.3137085,31.3137085 C32.0534779,30.5739391 32.7211433,29.7620656 33.3052586,28.8895342 M33.3052586,11.1104658 C32.7211433,10.2379344 32.0534779,9.42606093 31.3137085,8.6862915 C30.5739391,7.94652207 29.7620656,7.27885667 28.8895342,6.69474141" strokeLinecap="round" />
      </g>
    </svg>
  );
}

