terraform {
  required_version = ">= 1.14.3"

  required_providers {
    kind = {
      source = "tehcyx/kind"
      # 최신(예: 0.10.0)이면 좋지만, 로컬 예제 안정성을 위해 범위를 좁혀도 됩니다.
      # version = "0.10.0"
      version = ">= 0.4.0"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.31.0"
    }

    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.14.0"
    }
  }
}
