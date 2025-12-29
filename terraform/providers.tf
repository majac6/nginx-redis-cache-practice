provider "kind" {}

# kind provider가 생성한 kubeconfig 파일을 kube/helm provider가 사용
provider "kubernetes" {
  config_path = pathexpand(var.kubeconfig_path)
}

provider "helm" {
  kubernetes = {
    config_path = pathexpand(var.kubeconfig_path)
  }
}

