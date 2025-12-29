variable "cluster_name" {
  type    = string
  default = "gitops-kind"
}

variable "kubeconfig_path" {
  type    = string
  default = "~/.kube/kind-gitops"
}

# KinD node 이미지(쿠버네티스 버전) - 필요 시 원하는 버전으로 교체
variable "node_image" {
  type    = string
  default = "kindest/node:v1.27.1"
}

# ArgoCD
variable "argocd_chart_version" {
  type    = string
  default = "" # 비워두면 최신이 선택될 수 있어 재현성이 떨어질 수 있음. 고정 권장.
}

# Redis
variable "redis_chart_version" {
  type    = string
  default = "" # 비워두면 최신
}

# 로컬 접속 편의를 위한 NodePort(원하면 변경)
variable "argocd_nodeport_http" {
  type    = number
  default = 30080
}

variable "redis_password" {
  type      = string
  sensitive = true
  default   = "local-dev-redis" # 운영에서는 반드시 변경/외부 주입
}
