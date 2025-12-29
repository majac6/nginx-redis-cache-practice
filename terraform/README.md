실행 방법 (Podman + KinD 핵심)

(필수) Podman을 KinD 런타임으로 쓰도록 환경변수 지정

export KIND_EXPERIMENTAL_PROVIDER=podman
export KUBECONFIG=~/.kube/kind-gitops


Terraform 적용

tf destroy
tf init
tf plan
tf apply -target=kind_cluster.this
tf apply


kubeconfig 사용

export KUBECONFIG=~/.kube/kind-gitops
k get nodes


Argo CD 초기 admin 비밀번호 확인(Helm/매니페스트 공통 패턴)

k -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo


브라우저 접속

http://localhost:30080 (기본값)

kubectl delete pod -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx