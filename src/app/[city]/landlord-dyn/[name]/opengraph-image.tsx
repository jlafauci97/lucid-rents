// Force-dynamic twin — see ./page.tsx. Turbopack's metadata-route loader
// rejects `export ... from` here, so the config consts are restated and the
// default is re-exported through a local binding.
import Original from "../../landlord/[name]/opengraph-image";

export const runtime = "edge";
export const alt = "Landlord Profile - Lucid Rents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default Original;
