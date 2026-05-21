import Link from 'next/link';
import { source } from '@/lib/source';
import { ArrowUpRight, BookOpen, CalendarDays, FileText, Tags } from 'lucide-react';

type Page = (typeof source)['$inferPage'];

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatDate(date?: string) {
  if (!date) return null;

  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return date;

  return dateFormatter.format(value);
}

function ArticleCard({ page, featured = false }: { page: Page; featured?: boolean }) {
  const date = formatDate(page.data.date);

  return (
    <Link
      href={page.url}
      className="group rounded-lg border bg-fd-card p-5 transition-colors hover:bg-fd-accent"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-fd-muted-foreground">
        {page.data.tag ? (
          <span className="rounded-md bg-fd-muted px-2 py-1 font-medium">{page.data.tag}</span>
        ) : null}
        {date ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {date}
          </span>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-4">
        <h3 className={`${featured ? 'text-xl' : 'text-lg'} font-semibold leading-snug`}>
          {page.data.title}
        </h3>
        <ArrowUpRight
          className={`${featured ? 'size-5' : 'size-4'} mt-1 shrink-0 text-fd-muted-foreground transition-colors group-hover:text-fd-foreground`}
          aria-hidden="true"
        />
      </div>
      {page.data.description ? (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-fd-muted-foreground">
          {page.data.description}
        </p>
      ) : null}
    </Link>
  );
}

export default function HomePage() {
  const pages = source
    .getPages()
    .filter((page) => page.url !== '/docs')
    .sort((a, b) => {
      const aTime = a.data.date ? new Date(a.data.date).getTime() : 0;
      const bTime = b.data.date ? new Date(b.data.date).getTime() : 0;

      return bTime - aTime;
    });
  const tags = Array.from(new Set(pages.map((page) => page.data.tag).filter(Boolean)));
  const latestPage = pages[0];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:py-16">
      <div className="grid gap-10 border-b pb-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <section>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-fd-muted-foreground">
            <BookOpen className="size-3.5" aria-hidden="true" />
            个人技术博客
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
            写一些终于想明白的东西
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-fd-muted-foreground">
            记录写代码、做项目、读系统时遇到的问题：
            踩过的坑，拆开的概念，以及某一刻突然想通的想法。
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-lg border bg-fd-card p-4">
            <div className="flex items-center gap-2 text-sm text-fd-muted-foreground">
              <FileText className="size-4" aria-hidden="true" />
              文章
            </div>
            <div className="mt-2 text-2xl font-semibold">{pages.length}</div>
          </div>
          <div className="rounded-lg border bg-fd-card p-4">
            <div className="flex items-center gap-2 text-sm text-fd-muted-foreground">
              <Tags className="size-4" aria-hidden="true" />
              Tag
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-md bg-fd-muted px-2 py-1 text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      {latestPage ? (
        <section className="grid gap-4 border-b py-8 md:grid-cols-[180px_1fr]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-normal text-fd-muted-foreground">
              最新
            </h2>
          </div>
          <ArticleCard page={latestPage} featured />
        </section>
      ) : null}

      <section className="grid gap-4 py-8 md:grid-cols-[180px_1fr]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-normal text-fd-muted-foreground">
            归档
          </h2>
        </div>
        <div className="grid gap-3">
          {pages.map((page) => (
            <ArticleCard key={page.url} page={page} />
          ))}
        </div>
      </section>
    </main>
  );
}
