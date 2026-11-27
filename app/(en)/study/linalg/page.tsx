import type { Metadata } from "next";
import { LinalgPage } from "@/components/study/la-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "신경망은 왜 행렬 곱인가: 벡터, 내적, 랭크, SVD",
  description: "Linear algebra study notes with interactive figures on one Siamese cat drawing: a picture as a table and one colour cell as a vector, dot product, length, cosine and distance under a shade, the JPEG colour matrix as a layer, matrix products and why two linear layers collapse without ReLU, rank and the changes a layer cannot see, the SVD and low-rank approximation of a 64 by 64 gray table, and PCA of the cell colours.",
  alternates: { canonical: "/study/linalg/" },
};

export default function LinalgStudyPage() {
  return <LinalgPage />;
}
