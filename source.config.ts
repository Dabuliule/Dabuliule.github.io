import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';

// You can customize Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema.extend({
      date: pageSchema.shape.title.optional(),
      order: pageSchema.shape.title.optional(),
      tag: pageSchema.shape.title.optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid, remarkMath],
    // Render math before the default code highlighter sees language-math nodes.
    rehypePlugins: (plugins) => [rehypeKatex, ...plugins],
  },
});
