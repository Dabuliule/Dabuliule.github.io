import Link from 'next/link';
import { source } from '@/lib/source';

export default function HomePage() {
  const pages = source.getPages().filter((page) => page.url !== '/docs');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
      <div className="mb-10">
        <h1 className="mb-3 text-3xl font-bold">Blog</h1>
        <Link href="/docs" className="text-sm font-medium underline">
          Open docs
        </Link>
      </div>

      <div className="flex flex-col gap-5">
        {pages.map((page) => (
          <Link
            key={page.url}
            href={page.url}
            className="rounded-lg border p-5 transition-colors hover:bg-fd-accent"
          >
            <h2 className="text-lg font-semibold">{page.data.title}</h2>
            {page.data.description ? (
              <p className="mt-2 text-sm text-fd-muted-foreground">{page.data.description}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </main>
  );
}
