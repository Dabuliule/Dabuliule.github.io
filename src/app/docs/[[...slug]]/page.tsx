import { getPageImage, getPageMarkdownUrl, source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { gitConfig } from '@/lib/shared';
import { redirect } from 'next/navigation';
import { CalendarDays, Tags } from 'lucide-react';

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

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    const normalizedSlug = params.slug?.map((segment) => segment.replaceAll('-', '_'));

    if (normalizedSlug && source.getPage(normalizedSlug)) {
      redirect(`/docs/${normalizedSlug.join('/')}`);
    }

    notFound();
  }

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  const date = formatDate(page.data.date);
  const hasMeta = Boolean(page.data.tag || date);

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className={hasMeta ? 'mb-3' : 'mb-0'}>
        {page.data.description}
      </DocsDescription>
      {hasMeta ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-fd-muted-foreground">
          {page.data.tag ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-fd-muted px-2 py-1 font-medium text-fd-foreground">
              <Tags className="size-3.5" aria-hidden="true" />
              {page.data.tag}
            </span>
          ) : null}
          {date ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {date}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
