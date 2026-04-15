/**
 * V2 Layout
 *
 * Wraps the v2 building page content in a .v2 div that scopes the ported
 * mockup stylesheet + applies zoom:0.8 to match the mockup scale.
 *
 * As of the site-wide nav refactor, the top navigation is rendered by the
 * root layout's <Navbar /> (now using the same v2 design site-wide), so
 * this layout no longer hides any production chrome.
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="v2" style={{ zoom: 0.8 }}>
      {children}
    </div>
  );
}
