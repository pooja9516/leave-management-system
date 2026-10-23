export default function Skeleton({ width = '100%', height = 14, className = '' }) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}
