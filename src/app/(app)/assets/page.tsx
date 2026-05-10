import { Suspense } from "react";
import AssetDetailPage from "./AssetDetailPage";

export default function AssetsPage() {
    return (
        <Suspense fallback={null}>
            <AssetDetailPage />
        </Suspense>
    );
}
