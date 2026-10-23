/** tone: neutral | primary | success | warning | danger */
export default function Badge({ tone = 'neutral', dot = false, children }) {
  return <span className={`badge badge--${tone}${dot ? ' badge--dot' : ''}`}>{children}</span>;
}
