COMPOSE = docker compose -f docker-compose.yml

HEROKU_APP        ?= tank-it
HEROKU_PLATFORM   ?= linux/amd64
HEROKU_IMAGE      ?= registry.heroku.com/$(HEROKU_APP)/web
HEROKU_DOCKERFILE ?= backend/src/TankIt.Api/Dockerfile
HEROKU_URL        ?= $(shell heroku apps:info -a $(HEROKU_APP) --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("app",{}).get("web_url",""))' 2>/dev/null)

all: up

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) --profile dev --profile prod down --remove-orphans

build:
	$(COMPOSE) build
	cd frontend/game && yarn build
	cd frontend/app && yarn build

build-frontend:
	cd frontend/game && yarn build
	cd frontend/app && yarn build

rebuild:
	$(COMPOSE) up -d --build

logs:
	$(COMPOSE) logs -f

clean:
	$(COMPOSE) --profile dev --profile prod down -v --remove-orphans

fclean:
	$(COMPOSE) --profile dev --profile prod down -v --rmi local --remove-orphans

ps:
	$(COMPOSE) ps

install: backend-restore
	yarn install --frozen-lockfile
	cd frontend/game && yarn install --frozen-lockfile
	cd frontend/app && yarn install --frozen-lockfile

lint: lint-frontend lint-backend

lint-frontend:
	yarn lint
	yarn format:check

lint-backend: backend-restore
	dotnet format backend/TankIt.sln --verify-no-changes --no-restore

typecheck: typecheck-frontend typecheck-backend

typecheck-frontend:
	cd frontend/game && yarn typecheck
	cd frontend/app && yarn typecheck

typecheck-backend: backend-restore
	dotnet build backend/TankIt.sln --no-restore --configuration Release

test: test-frontend test-backend

# Local-only end-to-end suite (Playwright) — never part of CI, see e2e/README.md.
test-e2e: dev
	cd e2e && yarn install --frozen-lockfile
	cd e2e && yarn test

test-frontend:
	cd frontend/game && yarn test
	cd frontend/app && yarn test

test-backend: typecheck-backend
	dotnet test backend/TankIt.sln --no-build --no-restore --configuration Release

backend-restore:
	dotnet restore backend/TankIt.sln

# Same gates as .github/workflows/ci.yml. Keep this as the single source of
# truth so `make deploy-heroku` cannot skip the quality checks.
ci: lint typecheck build-frontend test

dev:
	$(COMPOSE) --profile dev up -d

prod:
	$(COMPOSE) --profile prod up -d

heroku-login:
	heroku container:login

heroku-check:
	@command -v heroku >/dev/null 2>&1 || { echo "heroku CLI not found"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "docker not found"; exit 1; }
	@heroku apps:info -a $(HEROKU_APP) >/dev/null 2>&1 || { echo "Heroku app $(HEROKU_APP) not found"; exit 1; }
	@test -n "$$(heroku config:get DATABASE_URL -a $(HEROKU_APP))" || { echo "DATABASE_URL not set on $(HEROKU_APP)"; exit 1; }
	@test -n "$$(heroku config:get JWT_SIGNING_KEY -a $(HEROKU_APP))" || { echo "JWT_SIGNING_KEY not set on $(HEROKU_APP)"; exit 1; }

heroku-build:
	docker build --platform $(HEROKU_PLATFORM) \
		-f $(HEROKU_DOCKERFILE) \
		-t $(HEROKU_IMAGE) .

heroku-push: heroku-build
	docker push $(HEROKU_IMAGE)

heroku-release:
	heroku container:release web -a $(HEROKU_APP)

# Full path: quality gates first, then build/push/release.
deploy-heroku: heroku-check ci heroku-push heroku-release
	@echo "Deployed $(HEROKU_APP): $(HEROKU_URL)"

# Emergency path: skip CI, still build/push/release.
deploy-heroku-fast: heroku-check heroku-push heroku-release
	@echo "Deployed $(HEROKU_APP): $(HEROKU_URL)"

heroku-logs:
	heroku logs --tail -a $(HEROKU_APP)

heroku-health:
	@url="$(HEROKU_URL)"; \
	[ -n "$$url" ] || url="https://$(HEROKU_APP).herokuapp.com/"; \
	url=$${url%/}; \
	ok=0; \
	for i in $$(seq 1 30); do \
		if curl -fsS "$$url/health" >/dev/null 2>&1; then \
			ok=1; \
			break; \
		fi; \
		sleep 2; \
	done; \
	if [ $$ok -ne 1 ]; then \
		echo "Health check failed for $$url/"; \
		exit 1; \
	fi; \
	curl -fsS "$$url/health"; \
	echo; \
	curl -fsS "$$url/api/health"; \
	echo

heroku-rollback:
	heroku releases:rollback -a $(HEROKU_APP)

db-migrate:
	cd backend && dotnet ef database update -p src/TankIt.Api -s src/TankIt.Api

db-migration-add name=MigrationName:
	cd backend && dotnet ef migrations add $(name) -p src/TankIt.Api -s src/TankIt.Api

.NOTPARALLEL: deploy-heroku deploy-heroku-fast

.PHONY: all up down build build-frontend rebuild logs clean fclean ps install dev prod ci \
	heroku-login heroku-check heroku-build heroku-push heroku-release \
	deploy-heroku deploy-heroku-fast heroku-logs heroku-health heroku-rollback \
	lint lint-frontend lint-backend typecheck typecheck-frontend typecheck-backend \
	test test-frontend test-backend test-e2e backend-restore db-migrate db-migration-add
