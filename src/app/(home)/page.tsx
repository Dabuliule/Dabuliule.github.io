import Link from 'next/link';
import { source } from '@/lib/source';
import { ArrowUpRight, CalendarDays, FileText, Tags, UserRound } from 'lucide-react';

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

function getPageTime(page: Page) {
  if (!page.data.date) return 0;

  const time = new Date(page.data.date).getTime();
  return Number.isNaN(time) ? 0 : time;
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
    .sort((a, b) => getPageTime(b) - getPageTime(a));
  const tagGroups = Array.from(
    pages.reduce((groups, page) => {
      const tag = page.data.tag;
      if (!tag) return groups;

      const group = groups.get(tag) ?? [];
      group.push(page);
      groups.set(tag, group);

      return groups;
    }, new Map<string, Page[]>()),
  ).map(([tag, groupPages]) => ({ tag, pages: groupPages }));
  const latestPage = pages[0];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:py-16">
      <div className="mb-4 flex justify-end">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground"
        >
          <UserRound className="size-4" aria-hidden="true" />
          关于我
        </Link>
      </div>

      <section className="grid gap-3 border-b pb-8 sm:grid-cols-2">
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
            {tagGroups.map((group) => (
              <span
                key={group.tag}
                className="rounded-md bg-fd-muted px-2 py-1 text-xs font-medium"
              >
                {group.tag} · {group.pages.length}
              </span>
            ))}
          </div>
        </div>
      </section>

      {latestPage ? (
        <section className="grid gap-4 border-b py-8 md:grid-cols-[180px_1fr]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-normal text-fd-muted-foreground">
              最新文章
            </h2>
          </div>
          <ArticleCard page={latestPage} featured />
        </section>
      ) : null}

      <section className="grid gap-4 border-b py-8 md:grid-cols-[180px_1fr]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-normal text-fd-muted-foreground">
            分类浏览
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {tagGroups.map((group) => (
            <section key={group.tag} className="rounded-lg border bg-fd-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold">{group.tag}</h3>
                <span className="rounded-md bg-fd-muted px-2 py-1 text-xs font-medium text-fd-muted-foreground">
                  {group.pages.length} 篇
                </span>
              </div>
              <div className="grid gap-2">
                {group.pages.map((page) => (
                  <Link
                    key={page.url}
                    href={page.url}
                    className="group flex items-start justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-fd-accent"
                  >
                    <span className="text-sm leading-6 group-hover:text-fd-foreground">
                      {page.data.title}
                    </span>
                    {page.data.date ? (
                      <span className="shrink-0 text-xs leading-6 text-fd-muted-foreground">
                        {formatDate(page.data.date)}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

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
