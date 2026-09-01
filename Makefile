IMAGE ?= ghcr.io/bartvanbenthem/cloud-controlplane-portal:latest

.PHONY: build-frontend build run docker-build deploy

build-frontend:
	cd frontend && npm install && npm run build
	rm -rf backend/internal/web/dist
	mkdir -p backend/internal/web/dist
	cp -r frontend/dist/* backend/internal/web/dist/

build: build-frontend
	cd backend && go build -o ../bin/portal-backend .

run: build
	./bin/portal-backend

docker-build:
	docker build -t $(IMAGE) .

deploy:
	kubectl apply -f deploy/00-namespace.yaml
	kubectl apply -f deploy/01-serviceaccount.yaml
	kubectl apply -f deploy/02-rbac.yaml
	@echo "NOTE: copy deploy/03-secret.example.yaml to deploy/03-secret.yaml," \
	      "fill in real credentials, and kubectl apply -f deploy/03-secret.yaml" \
	      "before applying the Deployment."
	kubectl apply -f deploy/04-deployment.yaml
	kubectl apply -f deploy/05-service.yaml
