output "kubeconfig_path" {
  value = pathexpand(var.kubeconfig_path)
}

output "cluster_name" {
  value = var.cluster_name
}

output "argocd_http_url" {
  value = "http://localhost:${var.argocd_nodeport_http}"
}
