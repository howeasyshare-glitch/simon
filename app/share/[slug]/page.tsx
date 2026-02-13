export default function Page({ params }: { params: { slug: string } }) {
  const slug = encodeURIComponent(params.slug || '');
  return (
    <iframe
      className="shellFrame"
      src={`/legacy/share.html?slug=${slug}`}
      title={`Share ${params.slug}`}
    />
  );
}
