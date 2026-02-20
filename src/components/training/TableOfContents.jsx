import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

function extractHeadings(markdownContent) {
  if (!markdownContent) return [];
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const headings = [];
  let match;
  while ((match = headingRegex.exec(markdownContent)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    // Generate slug the same way rehype-slug would
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    headings.push({ level, text, slug });
  }
  return headings;
}

export default function TableOfContents({ content, className }) {
  const [activeSlug, setActiveSlug] = useState('');
  const headings = extractHeadings(content);
  const observerRef = useRef(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
          }
        }
      },
      { rootMargin: '0px 0px -60% 0px', threshold: 0.1 }
    );

    observerRef.current = observer;

    // Wait for DOM to render the headings
    const timeout = setTimeout(() => {
      headings.forEach(({ slug }) => {
        const el = document.getElementById(slug);
        if (el) observer.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [content]);

  if (headings.length < 2) return null;

  return (
    <nav className={cn('sticky top-6', className)} aria-label="Table of contents">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        On this page
      </div>
      <ul className="space-y-1">
        {headings.map(({ level, text, slug }) => (
          <li key={slug}>
            <a
              href={`#${slug}`}
              className={cn(
                'block text-sm leading-snug py-0.5 border-l-2 transition-colors',
                level === 1 ? 'pl-3' : level === 2 ? 'pl-4' : 'pl-6',
                activeSlug === slug
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(slug);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setActiveSlug(slug);
                }
              }}
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
