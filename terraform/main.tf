########################################
# main.tf
# 1) KinD Cluster
# 2) Namespaces (argocd/redis/ingress-nginx/apps)
# 3) ingress-nginx (Helm)
# 4) Argo CD (Helm) + Ingress enabled
# 5) Redis (Helm)
# 5) Argo CD Application (nginx-app) registered via kubernetes_manifest
########################################

########################################
# 1) KinD Cluster
########################################
resource "kind_cluster" "this" {
  name            = var.cluster_name
  node_image      = var.node_image
  kubeconfig_path = pathexpand(var.kubeconfig_path)
  wait_for_ready  = true

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"

      # Ingress HTTP/HTTPS 접근용 (호스트 -> kind 노드)
      # extra_port_mappings {
      #   container_port = 80
      #   host_port      = 8080
      # }

      # extra_port_mappings {
      #   container_port = 443
      #   host_port      = 8443
      # }

      # [추가] 30080 포트 매핑 추가
      # 호스트(내 PC) 30080 -> KinD 컨테이너 30080
      extra_port_mappings {
        container_port = 30080
        host_port      = 30080
      }
      extra_port_mappings {
        container_port = 31379
        host_port      = 6379
      }

      # [핵심] 데이터 영속성 설정
      extra_mounts {
        # 내 PC: main.tf가 있는 곳의 'cluster-data' 폴더 (자동 생성 안되니 미리 만들어야 함!)
        host_path = abspath("${path.root}/../cluster-data")
        # KinD 노드: 기본 스토리지 클래스가 데이터를 저장하는 위치
        container_path = "/var/local-path-provisioner"
      }
    }

    node {
      role = "worker"
    }
  }
}

########################################
# 2) Namespaces
########################################
resource "kubernetes_namespace" "argocd" {
  metadata { name = "argocd" }
  depends_on = [kind_cluster.this]
}

resource "kubernetes_namespace" "redis" {
  metadata { name = "redis" }
  depends_on = [kind_cluster.this]
}

resource "kubernetes_namespace" "ingress_nginx" {
  metadata { name = "ingress-nginx" }
  depends_on = [kind_cluster.this]
}

resource "kubernetes_namespace" "apps" {
  metadata { name = "apps" }
  depends_on = [kind_cluster.this]
}

########################################
# 3) ingress-nginx (Helm) - values 방식
########################################
resource "helm_release" "ingress_nginx" {
  name      = "ingress-nginx"
  namespace = kubernetes_namespace.ingress_nginx.metadata[0].name

  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"

  values = [
    yamlencode({
      controller = {
        admissionWebhooks = { enabled = false }

        service = {
          type = "NodePort"
          # [추가] http 포트를 30080으로 고정
          nodePorts = {
            http = 30080
          }
        }

      }
    })
  ]

  depends_on = [kubernetes_namespace.ingress_nginx]
}


########################################
# 4) Argo CD (Helm) + Ingress - values 방식
########################################
resource "helm_release" "argocd" {
  name      = "argocd"
  namespace = kubernetes_namespace.argocd.metadata[0].name

  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"

  values = [
    yamlencode({
      server = {
        service = {
          type = "ClusterIP"
        }
        ingress = {
          enabled          = true
          ingressClassName = "nginx"
          hostname         = "localhost"
          path             = "/argocd"
          pathType         = "Prefix"
        }
      }
      configs = {
        params = {
          # 실습 편의(HTTP 접근) - 운영 비권장
          "server.insecure" = true
          "server.rootpath" = "/argocd"
        }
      }
    })
  ]

  depends_on = [
    kubernetes_namespace.argocd,
    helm_release.ingress_nginx
  ]
}

########################################
# 5) Redis (Helm) - values 방식
########################################
resource "helm_release" "redis" {
  name      = "redis"
  namespace = kubernetes_namespace.redis.metadata[0].name

  repository = "https://charts.bitnami.com/bitnami"
  chart      = "redis"

  values = [
    yamlencode({
      architecture = "standalone"

      auth = {
        enabled  = true
        password = var.redis_password # 변수로 관리하시던 것 유지
      }

      master = {
        disableCommands = []
        persistence = {
          enabled = true
          size    = "1Gi"
        }

        # [추가] 외부 접속을 위한 NodePort 설정
        service = {
          type = "NodePort"
          nodePorts = {
            redis = "31379" # Kind 클러스터 설정과 매핑될 고정 포트
          }
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.redis]
}

resource "kubernetes_manifest" "prerender_application" {
  manifest = yamldecode(
    file(abspath("${path.root}/../k8s/prerender/application.yaml"))
  )

  depends_on = [
    helm_release.argocd
  ]
}

resource "kubernetes_manifest" "app_a_application" {
  manifest = yamldecode(
    file(abspath("${path.root}/../k8s/app-a/application.yaml"))
  )

  depends_on = [
    helm_release.argocd
  ]
}
