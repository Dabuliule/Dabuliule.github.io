'use client';

import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

type MermaidProps = {
  chart: string;
};

export function Mermaid({ chart }: MermaidProps) {
  const id = `mermaid-${useId().replaceAll(':', '')}`;
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const root = document.documentElement;

    async function render() {
      try {
        setError(null);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: root.classList.contains('dark') ? 'dark' : 'default',
        });

        const result = await mermaid.render(id, chart);
        if (!cancelled) setSvg(result.svg);
      } catch (err) {
        if (!cancelled) {
          setSvg('');
          setError(err instanceof Error ? err.message : 'Unable to render Mermaid diagram.');
        }
      }
    }

    void render();

    const observer = new MutationObserver(() => {
      void render();
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-lg border bg-fd-muted p-4 text-sm text-fd-muted-foreground">
        {error}
      </pre>
    );
  }

  return (
    <div
      className="my-6 overflow-x-auto rounded-lg border bg-fd-background p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
