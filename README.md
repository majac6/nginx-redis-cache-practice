# nginx-redis-cache-practice

로컬 k8s 에 redis 를 외부로 export 하기
kubectl -n redis port-forward svc/redis-master 6379:6379