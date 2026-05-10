import { Suspense } from "react";
import AssetDetailPage from "../AssetDetailPage";

export default function AssetSlugPage() {
    return (
        <Suspense fallback={null}>
            <AssetDetailPage />
        </Suspense>
    );
}
