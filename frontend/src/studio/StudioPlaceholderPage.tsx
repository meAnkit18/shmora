interface Props {
  title: string;
  description: string;
}

export function StudioPlaceholderPage({ title, description }: Props) {
  return (
    <div className="mx-auto max-w-site p-6 lg:p-8">
      <h1 className="font-display text-display-sm text-ink">{title}</h1>
      <div className="mt-6 grid place-items-center rounded-xl border border-dashed border-hairline py-24 text-center">
        <p className="max-w-md text-body-sm text-fg-muted">{description}</p>
      </div>
    </div>
  );
}
