import Link from 'next/link';
import { source } from '@/lib/source';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
});

function getTime(date?: string) {
  const time = date ? Date.parse(date) : 0;
  return Number.isNaN(time) ? 0 : time;
}

export default function HomePage() {
  const pages = source.getPages().filter((page) => page.url !== '/docs').sort((a, b) =>
    getTime(b.data.date) - getTime(a.data.date) ||
    Number(b.data.order ?? 0) - Number(a.data.order ?? 0) ||
    a.url.localeCompare(b.url),
  );
  const tags = Array.from(new Set(pages.map((page) => page.data.tag ?? '其他')));
  const series = pages.filter((page) => page.data.tag === 'AI').sort((a, b) =>
    Number(a.data.order ?? 0) - Number(b.data.order ?? 0),
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-16">
      <header className="border-b pb-8 sm:pb-10">
        <p className="mb-3 text-sm font-medium text-fd-muted-foreground">学习 · 实践 · 记录</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">代码札记</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-fd-muted-foreground">
          记录 AI、Agent Runtime 与后端工程中的学习和实践，把技术背后的原理一步步讲清楚。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <a href="#articles" className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-4 py-2.5 font-medium text-fd-primary-foreground hover:opacity-85">
            浏览文章 <ArrowRight className="size-4" aria-hidden="true" />
          </a>
          <Link href="/docs" className="text-fd-muted-foreground hover:text-fd-foreground">关于我 ↗</Link>
          <span className="text-fd-muted-foreground">{pages.length} 篇文章 · {tags.length} 个分类</span>
        </div>
      </header>

      {series.length > 0 && (
        <section aria-labelledby="series-title" className="border-b py-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="series-title" className="text-lg font-semibold">AI 基础 · 系列阅读</h2>
            <p className="text-xs text-fd-muted-foreground">从基础到实践，按顺序阅读</p>
          </div>
          <ol className="grid gap-3 md:grid-cols-3">
            {series.map((page, index) => (
              <li key={page.url} className="flex">
                <Link href={page.url} className="group flex w-full gap-3 rounded-xl border bg-fd-card p-4 transition-colors hover:bg-fd-accent">
                  <span className="pt-0.5 text-xs font-medium tabular-nums text-fd-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="text-sm font-medium leading-6">{page.data.title}</h3>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section id="articles" aria-labelledby="articles-title" className="scroll-mt-24 pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="articles-title" className="text-xl font-semibold">全部文章</h2>
          <p className="text-xs text-fd-muted-foreground">按发布时间，由新到旧</p>
        </div>
        <style>{`
          #articles:not(:has(.category-target:target)) [data-tag="all"] {
            background: var(--color-fd-primary); color: var(--color-fd-primary-foreground);
          }
          ${tags.map((_, index) => `
            #articles:has(#category-${index}:target) .article-row:not([data-category="${index}"]) { display: none; }
            #articles:has(#category-${index}:target) [data-tag="${index}"] {
              background: var(--color-fd-primary); color: var(--color-fd-primary-foreground);
            }
          `).join('')}
        `}</style>
        <nav aria-label="按分类筛选文章" className="my-5 flex flex-wrap gap-2">
          <a href="#articles" className="article-filter rounded-full border px-3 py-1.5 text-xs" data-tag="all">全部 {pages.length}</a>
          {tags.map((tag, index) => (
            <a key={tag} href={`#category-${index}`} className="article-filter rounded-full border px-3 py-1.5 text-xs text-fd-muted-foreground hover:bg-fd-accent" data-tag={index}>
              {tag} <span className="ml-1 tabular-nums">{pages.filter((page) => (page.data.tag ?? '其他') === tag).length}</span>
            </a>
          ))}
        </nav>
        {tags.map((tag, index) => <span key={tag} id={`category-${index}`} className="category-target scroll-mt-40" />)}
        <div className="article-list border-t">
          {pages.map((page, index) => (
            <article key={page.url} data-category={tags.indexOf(page.data.tag ?? '其他')} className="article-row border-b">
              <Link href={page.url} className="group grid gap-3 rounded-lg py-6 transition-colors hover:bg-fd-muted/50 sm:grid-cols-[100px_minmax(0,1fr)_20px] sm:gap-6 sm:px-3">
                <div className="flex items-center gap-2 text-xs leading-6 text-fd-muted-foreground sm:block">
                  {page.data.date ? <time dateTime={page.data.date} className="tabular-nums">{dateFormatter.format(getTime(page.data.date))}</time> : <span>日期待补充</span>}
                  {index === 0 && <span className="inline-block rounded bg-fd-muted px-2 text-fd-foreground sm:mt-2">最新</span>}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold leading-7 sm:text-lg">{page.data.title}</h3>
                  {page.data.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-fd-muted-foreground">{page.data.description}</p>}
                  <span className="mt-3 inline-block text-xs text-fd-muted-foreground">{page.data.tag ?? '其他'}</span>
                </div>
                <ArrowUpRight className="mt-1 hidden size-4 text-fd-muted-foreground group-hover:text-fd-foreground sm:block" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
