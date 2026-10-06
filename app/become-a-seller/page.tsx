import { permanentRedirect } from "next/navigation";

export default function LegacyBecomeSellerPage() {
  permanentRedirect("/become-a-provider");
}
